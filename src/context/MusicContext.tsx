// @ts-nocheck
"use client";

import React, { createContext, useCallback, useContext, useState, useRef, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "./AuthContext";
import type { Track, PlayerStatus } from "@/types";

export type SleepMode = "15" | "30" | "45" | "60" | "playlistEnd" | null;

interface MusicContextValue {
  currentTrack: Track | null;
  status: PlayerStatus;
  playingUrl: string | null;
  duration: number;
  volume: number;
  isFullScreen: boolean;
  seekRequest: number | null;
  queue: Track[];
  isShuffle: boolean;
  repeatMode: "off" | "all" | "one";
  
  sleepMode: SleepMode;
  sleepSeconds: number | null;
  setSleepMode: (mode: SleepMode) => void; 
  
  playTrack: (track: Track, newQueue?: Track[]) => void;
  playNext: () => void;
  playPrev: () => void;
  toggleShuffle: () => void;
  toggleRepeat: () => void;
  togglePlayPause: () => void;
  setVolume: (v: number) => void;
  seek: (time: number) => void;
  onProgress: (state: any) => void;
  onDuration: (d: number) => void;
  onEnded: () => void;
  setIsFullScreen: (val: boolean) => void;
  clearSeekRequest: () => void;
}

const MusicContext = createContext<MusicContextValue | null>(null);

function getISOWeek(date: Date) {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(),0,1));
  return d.getUTCFullYear() + "-W" + Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1)/7);
}

export function MusicProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth(); 
  
  const [currentTrack, setCurrentTrack] = useState<Track | null>(null);
  const [status, setStatus] = useState<PlayerStatus>("idle");
  const [playingUrl, setPlayingUrl] = useState<string | null>(null);
  
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(0.8);
  const [isFullScreen, setIsFullScreen] = useState(false);
  const [seekRequest, setSeekRequest] = useState<number | null>(null);

  const [queue, setQueue] = useState<Track[]>([]);
  const [isShuffle, setIsShuffle] = useState(false);
  const [repeatMode, setRepeatMode] = useState<"off" | "all" | "one">("off");

  const [sleepModeState, setSleepModeState] = useState<SleepMode>(null);
  const [sleepSeconds, setSleepSeconds] = useState<number | null>(null);
  const sleepModeRef = useRef<SleepMode>(null);

  const queueRef = useRef<Track[]>([]);
  const currentTrackIdRef = useRef<string | null>(null);
  const isShuffleRef = useRef(false);
  const repeatModeRef = useRef<"off" | "all" | "one">("off");
  const playHistoryRef = useRef<string[]>([]);
  
  const currentTimeRef = useRef(0);
  
  const ytCacheRef = useRef<Record<string, string>>({});

  const listenAccumulatorRef = useRef(0);
  const lastPlayedSecondsRef = useRef(0);

  useEffect(() => {
    try {
      const savedCache = localStorage.getItem("stream_yt_cache");
      if (savedCache) {
        ytCacheRef.current = JSON.parse(savedCache);
      }
    } catch (e) {
      console.error("Erreur lecture cache", e);
    }
  }, []);

  const saveToCache = (trackId: string, videoId: string) => {
    ytCacheRef.current[trackId] = videoId;
    try {
      localStorage.setItem("stream_yt_cache", JSON.stringify(ytCacheRef.current));
    } catch (e) {
      console.warn("Cache plein, on le vide partiellement");
      const keys = Object.keys(ytCacheRef.current);
      if (keys.length > 200) {
        const newCache = {};
        keys.slice(keys.length - 200).forEach(k => newCache[k] = ytCacheRef.current[k]);
        ytCacheRef.current = newCache;
        localStorage.setItem("stream_yt_cache", JSON.stringify(ytCacheRef.current));
      }
    }
  };

  const setSleepMode = (mode: SleepMode) => {
    setSleepModeState(mode);
    sleepModeRef.current = mode;
    if (mode === "playlistEnd") {
        setSleepSeconds(null);
    } else if (mode) {
        setSleepSeconds(parseInt(mode) * 60);
    } else {
        setSleepSeconds(null);
    }
  };

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (status === "playing" && sleepSeconds !== null) {
      interval = setInterval(() => {
        setSleepSeconds(prev => {
          if (prev === null) return null;
          if (prev <= 1) {
            setStatus("paused");
            setSleepModeState(null);
            sleepModeRef.current = null;
            return null;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [status, sleepSeconds]);

  const syncDbStats = async () => {
    if (!user) return;
    const stats = JSON.parse(localStorage.getItem("dailyStats") || "null");
    const top = JSON.parse(localStorage.getItem("weeklyTopTracks") || "null");
    
    const updates: any = {};
    if (stats) updates.daily_stats = stats;
    if (top) updates.top_tracks = top;
    
    if (Object.keys(updates).length > 0) {
      await supabase.from('profiles').update(updates).eq('id', user.id);
    }
  };

  const checkWeekRollover = async () => {
    const currentWeekStr = getISOWeek(new Date());
    const savedWeekStr = localStorage.getItem("currentWeekStr");

    if (!savedWeekStr) {
      localStorage.setItem("currentWeekStr", currentWeekStr);
      return;
    }

    if (savedWeekStr !== currentWeekStr) {
      const oldStats = JSON.parse(localStorage.getItem("dailyStats") || "null");
      const oldTracks = JSON.parse(localStorage.getItem("weeklyTopTracks") || "[]");

      if (oldStats) localStorage.setItem("lastWeekStats", JSON.stringify(oldStats));
      if (oldTracks.length > 0) localStorage.setItem("lastWeekTopTracks", JSON.stringify(oldTracks));

      const emptyDaily = [
        { day: "Lun", minutes: 0 }, { day: "Mar", minutes: 0 }, { day: "Mer", minutes: 0 },
        { day: "Jeu", minutes: 0 }, { day: "Ven", minutes: 0 }, { day: "Sam", minutes: 0 }, { day: "Dim", minutes: 0 },
      ];
      localStorage.setItem("dailyStats", JSON.stringify(emptyDaily));
      localStorage.setItem("weeklyTopTracks", JSON.stringify([]));
      localStorage.setItem("currentWeekStr", currentWeekStr);

      if (user) {
        await supabase.from('profiles').update({ 
          last_week_stats: oldStats,
          last_week_top_tracks: oldTracks,
          daily_stats: emptyDaily,
          top_tracks: []
        }).eq('id', user.id);
      }
    }
  };

  const addMinuteToStats = async () => {
    await checkWeekRollover();

    const days = ["Dim", "Lun", "Mar", "Mer", "Jeu", "Ven", "Sam"];
    const todayStr = days[new Date().getDay()];

    let stats = JSON.parse(localStorage.getItem("dailyStats") || "null");
    if (!stats || stats.length === 0) {
      stats = [
        { day: "Lun", minutes: 0 }, { day: "Mar", minutes: 0 }, { day: "Mer", minutes: 0 },
        { day: "Jeu", minutes: 0 }, { day: "Ven", minutes: 0 }, { day: "Sam", minutes: 0 }, { day: "Dim", minutes: 0 },
      ];
    }
    
    const todayIndex = stats.findIndex((s: any) => s.day === todayStr);
    if (todayIndex !== -1) {
      stats[todayIndex].minutes += 1;
    }
    
    localStorage.setItem("dailyStats", JSON.stringify(stats));
    window.dispatchEvent(new Event("statsUpdated")); 
  };

  const updateTopTracks = async (track: Track) => {
    await checkWeekRollover();

    let top = JSON.parse(localStorage.getItem("weeklyTopTracks") || "[]");
    const existing = top.find((t: any) => t.id === track.id);
    if (existing) {
      existing.plays += 1;
    } else {
      top.push({ ...track, plays: 1 });
    }
    
    top.sort((a: any, b: any) => b.plays - a.plays);
    top = top.slice(0, 10);
    
    localStorage.setItem("weeklyTopTracks", JSON.stringify(top));
    window.dispatchEvent(new Event("statsUpdated"));
  };

  const handleProgress = (state: any) => {
    const currentPlayed = state.playedSeconds || 0;
    currentTimeRef.current = currentPlayed;

    window.dispatchEvent(new CustomEvent("musicTimeUpdate", { 
      detail: { currentTime: currentPlayed } 
    }));

    if (status === "playing") {
      const delta = currentPlayed - lastPlayedSecondsRef.current;
      lastPlayedSecondsRef.current = currentPlayed;

      if (delta > 0 && delta <= 2) {
        listenAccumulatorRef.current += delta;
        
        if (listenAccumulatorRef.current >= 60) {
          listenAccumulatorRef.current -= 60; 
          addMinuteToStats();
        }
      }
    } else {
      lastPlayedSecondsRef.current = currentPlayed;
    }
  };

  const prefetchTrack = (track: Track) => {
    if (!track || ytCacheRef.current[track.id]) return; 
    const query = `${track.artist} ${track.title} audio -"full album" -"1 hour" -"live" -"compilation"`;
    
    fetch(`/api/youtube?q=${encodeURIComponent(query)}`)
      .then(res => res.json())
      .then(data => {
        if (data.videoId) {
          saveToCache(track.id, data.videoId); 
        }
      })
      .catch(() => {});
  };

  const prefetchNextLogic = useCallback(() => {
    const q = queueRef.current;
    if (q.length === 0) return;

    let nextTrack: Track | undefined;
    if (isShuffleRef.current) {
      const unplayed = q.filter(t => !playHistoryRef.current.includes(t.id) && t.id !== currentTrackIdRef.current);
      if (unplayed.length > 0) nextTrack = unplayed[Math.floor(Math.random() * unplayed.length)];
    } else {
      const currentIndex = q.findIndex(t => t.id === currentTrackIdRef.current);
      if (currentIndex !== -1 && currentIndex + 1 < q.length) {
        nextTrack = q[currentIndex + 1];
      } else if (repeatModeRef.current === "all") {
        nextTrack = q[0];
      }
    }
    if (nextTrack) prefetchTrack(nextTrack);
  }, []);

  // 🟢 SÉCURITÉ : Envoi du son en cours d'écoute SEULEMENT après 10s de lecture continue
  useEffect(() => {
    let syncTimeout: NodeJS.Timeout;
    
    if (user && currentTrack && status === "playing") {
      syncTimeout = setTimeout(() => {
        supabase.from('profiles').update({
          current_listening: {
            title: currentTrack.title,
            artist: currentTrack.artist,
            image: currentTrack.image
          }
        }).eq('id', user.id).then(); // `.then()` permet l'exécution silencieuse
      }, 10000); // 10 secondes d'attente
    }

    // Le cleanup annule le timeout si on change de son ou si on met pause avant les 10s
    return () => clearTimeout(syncTimeout);
  }, [user, currentTrack, status]);

  const loadAndPlayUrl = useCallback(async (track: Track) => {
    setStatus("loading");
    setCurrentTrack(track);
    currentTrackIdRef.current = track.id; 
    
    updateTopTracks(track);
    syncDbStats(); 

    lastPlayedSecondsRef.current = 0; 
    currentTimeRef.current = 0; 

    if (ytCacheRef.current[track.id]) {
      setPlayingUrl(`https://www.youtube.com/watch?v=${ytCacheRef.current[track.id]}`);
      setStatus("playing");
      prefetchNextLogic();
      return;
    }

    try {
      const query = `${track.artist} ${track.title} audio -"full album" -"1 hour" -"live" -"compilation"`;
      const res = await fetch(`/api/youtube?q=${encodeURIComponent(query)}`);
      const data = await res.json();

      if (data.videoId) {
        saveToCache(track.id, data.videoId); 
        setPlayingUrl(`https://www.youtube.com/watch?v=${data.videoId}`);
        setStatus("playing");
        prefetchNextLogic();
      } else {
        setStatus("idle");
      }
    } catch (error) {
      console.error("Erreur API :", error);
      setStatus("idle");
    }
  }, [prefetchNextLogic, user]);

  const playTrack = useCallback(async (track: Track, newQueue?: Track[]) => {
    if (newQueue && newQueue.length > 0) {
      setQueue(newQueue);
      queueRef.current = newQueue;
      playHistoryRef.current = [track.id];
    } else {
      const exists = queueRef.current.some(t => t.id === track.id);
      if (!exists) {
         setQueue([]);
         queueRef.current = [];
         playHistoryRef.current = [];
      } else {
         playHistoryRef.current.push(track.id);
      }
    }
    await loadAndPlayUrl(track);
  }, [loadAndPlayUrl]);

  const playRadioTrack = async () => {
    const lastTrack = currentTrack;
    if (!lastTrack) {
      setStatus("idle");
      return;
    }
    
    try {
      setStatus("loading");
      const res = await fetch(`/api/radio?id=${lastTrack.id}&artist=${encodeURIComponent(lastTrack.artist)}`);
      const data = await res.json();
      
      if (data.tracks && data.tracks.length > 0) {
        const unplayed = data.tracks.filter((t: Track) => !playHistoryRef.current.includes(t.id));
        const nextTrack = unplayed.length > 0 ? unplayed[0] : data.tracks[0];
        
        setQueue(prev => [...prev, nextTrack]);
        queueRef.current.push(nextTrack);
        playHistoryRef.current.push(nextTrack.id);
        
        loadAndPlayUrl(nextTrack);
      } else {
        setStatus("idle"); 
      }
    } catch (e) {
      setStatus("idle");
    }
  };

  const playNext = useCallback(() => {
    const q = queueRef.current;
    
    const handlePlaylistEnd = () => {
      if (sleepModeRef.current === "playlistEnd") {
        setStatus("paused");
        setSleepModeState(null);
        sleepModeRef.current = null;
      } else {
        playRadioTrack();
      }
    };

    if (q.length === 0) {
      if (currentTrackIdRef.current) {
        handlePlaylistEnd();
      } else {
        setStatus("idle");
      }
      return;
    }

    let nextTrack: Track | undefined;

    if (isShuffleRef.current) {
      const unplayed = q.filter(t => !playHistoryRef.current.includes(t.id));
      if (unplayed.length === 0) {
        if (repeatModeRef.current === "off") {
          handlePlaylistEnd();
          return;
        }
        nextTrack = q[Math.floor(Math.random() * q.length)];
        playHistoryRef.current = [nextTrack.id];
      } else {
        nextTrack = unplayed[Math.floor(Math.random() * unplayed.length)];
        playHistoryRef.current.push(nextTrack.id);
      }
    } else {
      const currentIndex = q.findIndex(t => t.id === currentTrackIdRef.current);
      if (currentIndex !== -1 && currentIndex + 1 < q.length) {
        nextTrack = q[currentIndex + 1];
        playHistoryRef.current.push(nextTrack.id);
      } else {
        if (repeatModeRef.current === "all") {
          nextTrack = q[0];
          playHistoryRef.current = [nextTrack.id];
        } else {
          handlePlaylistEnd();
          return;
        }
      }
    }

    if (nextTrack) {
      loadAndPlayUrl(nextTrack);
    }
  }, [loadAndPlayUrl, currentTrack]);

  const playPrev = useCallback(() => {
    const q = queueRef.current;
    if (currentTimeRef.current > 3) {
      setSeekRequest(0);
      return;
    }
    if (q.length === 0) {
      setSeekRequest(0);
      return;
    }
    const currentIndex = q.findIndex(t => t.id === currentTrackIdRef.current);
    if (currentIndex > 0) {
      const prevTrack = q[currentIndex - 1];
      playHistoryRef.current.push(prevTrack.id);
      loadAndPlayUrl(prevTrack);
    } else {
      const prevTrack = q[q.length - 1];
      loadAndPlayUrl(prevTrack);
    }
  }, [loadAndPlayUrl]);

  const toggleShuffle = () => {
    isShuffleRef.current = !isShuffleRef.current;
    setIsShuffle(!isShuffle);
  };

  const toggleRepeat = () => {
    const nextMode = repeatModeRef.current === "off" ? "all" :
                     repeatModeRef.current === "all" ? "one" : "off";
    repeatModeRef.current = nextMode;
    setRepeatMode(nextMode);
  };

  const togglePlayPause = () => setStatus(prev => prev === "playing" ? "paused" : "playing");
  
  const seek = (time: number) => { 
    setSeekRequest(time); 
    window.dispatchEvent(new CustomEvent("musicTimeUpdate", { detail: { currentTime: time } }));
    lastPlayedSecondsRef.current = time; 
  };
  
  const clearSeekRequest = () => setSeekRequest(null);

  const handleEnded = useCallback(() => {
    if (repeatModeRef.current === "one" && currentTrackIdRef.current) {
      const q = queueRef.current;
      const trackToReplay = q.find(t => t.id === currentTrackIdRef.current) || currentTrack;
      if (trackToReplay) {
         loadAndPlayUrl(trackToReplay);
         return;
      }
    }
    playNext();
  }, [playNext, currentTrack, loadAndPlayUrl]);

  useEffect(() => {
    if ('mediaSession' in navigator && currentTrack) {
      navigator.mediaSession.metadata = new MediaMetadata({
        title: currentTrack.title,
        artist: currentTrack.artist,
        album: 'Stream Music',
        artwork: [
          { src: currentTrack.image || 'https://api.dicebear.com/7.x/shapes/svg?seed=music', sizes: '512x512', type: 'image/png' }
        ]
      });

      navigator.mediaSession.setActionHandler('play', () => {
        setStatus(prev => prev === "paused" ? "playing" : "playing");
      });
      navigator.mediaSession.setActionHandler('pause', () => {
        setStatus(prev => prev === "playing" ? "paused" : "paused");
      });
      navigator.mediaSession.setActionHandler('previoustrack', () => {
        playPrev();
      });
      navigator.mediaSession.setActionHandler('nexttrack', () => {
        playNext();
      });
    }
  }, [currentTrack, playNext, playPrev]);

  return (
    <MusicContext.Provider value={{
      currentTrack, status, playingUrl, duration, volume,
      isFullScreen, seekRequest, queue, isShuffle, repeatMode,
      sleepMode: sleepModeState, sleepSeconds, setSleepMode, 
      playTrack, playNext, playPrev, toggleShuffle, toggleRepeat, togglePlayPause, setVolume, seek,
      onProgress: handleProgress,
      onDuration: (d: number) => setDuration(d),
      onEnded: handleEnded,
      setIsFullScreen, clearSeekRequest
    }}>
      {children}
    </MusicContext.Provider>
  );
}

export const useMusic = () => {
  const ctx = useContext(MusicContext);
  if (!ctx) throw new Error("useMusic must be used within MusicProvider");
  return ctx;
};