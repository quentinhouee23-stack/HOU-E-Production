// @ts-nocheck
"use client";

import React, { createContext, useCallback, useContext, useState, useRef, useEffect, useMemo } from "react";
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
  isMusicLoaded: boolean;
}

const MusicContext = createContext<MusicContextValue | null>(null);

function getISOWeek(date: Date) {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return d.getUTCFullYear() + "-W" + Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
}

const isValidYTId = (id: string | null | undefined) => {
  return typeof id === "string" && id.length === 11;
};

export function MusicProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();

  const [isMusicLoaded, setIsMusicLoaded] = useState(false);
  const [currentTrack, setCurrentTrack] = useState<Track | null>(null);
  const [status, setStatus] = useState<PlayerStatus>("idle");
  const [playingUrl, setPlayingUrl] = useState<string | null>(null);
  const [duration, setDuration] = useState(0);
  const [volume, setVolumeState] = useState(0.8);
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

  // 🟢 Cache videoId → persisté dans localStorage (permanent)
  const ytCacheRef = useRef<Record<string, string>>({});

  // 🟢 Cache videoId → audioUrl → en mémoire uniquement (les URLs Invidious expirent)
  // On ne persiste PAS les audioUrls : elles sont valides ~6h, on en récupère
  // une fraîche à chaque session ou si le chargement échoue.
  const audioUrlCacheRef = useRef<Record<string, string>>({});

  const listenAccumulatorRef = useRef(0);
  const lastPlayedSecondsRef = useRef(0);

  useEffect(() => {
    try {
      let currentCache = {};
      const savedCache = localStorage.getItem("stream_yt_cache");
      if (savedCache) {
        const rawCache = JSON.parse(savedCache);
        for (const key in rawCache) {
          if (isValidYTId(rawCache[key])) {
            currentCache[key] = rawCache[key];
          }
        }
        ytCacheRef.current = currentCache;
        localStorage.setItem("stream_yt_cache", JSON.stringify(currentCache));
      }

      const savedVolume = localStorage.getItem("houee_volume");
      if (savedVolume) setVolumeState(parseFloat(savedVolume));

      const savedTrack = localStorage.getItem("houee_last_track");
      if (savedTrack) {
        const parsedTrack = JSON.parse(savedTrack);
        setCurrentTrack(parsedTrack);
        currentTrackIdRef.current = parsedTrack.id;
        // 🟢 On ne restaure PAS playingUrl ici : les audioUrls Invidious expirent.
        // La piste s'affichera dans le mini player mais sera en état "idle".
        // L'utilisateur appuie sur play → on récupère une URL fraîche.
        setPlayingUrl(null);
      }

      const savedQueue = localStorage.getItem("houee_last_queue");
      if (savedQueue) {
        const parsedQueue = JSON.parse(savedQueue);
        setQueue(parsedQueue);
        queueRef.current = parsedQueue;
      }
    } catch (e) {
      console.error("Erreur lecture cache audio", e);
    } finally {
      setIsMusicLoaded(true);
    }
  }, []);

  const setVolume = useCallback((v: number) => {
    setVolumeState(v);
    localStorage.setItem("houee_volume", v.toString());
  }, []);

  useEffect(() => {
    if (isMusicLoaded && currentTrack) {
      localStorage.setItem("houee_last_track", JSON.stringify(currentTrack));
    }
  }, [currentTrack, isMusicLoaded]);

  useEffect(() => {
    if (isMusicLoaded) {
      localStorage.setItem("houee_last_queue", JSON.stringify(queue));
    }
  }, [queue, isMusicLoaded]);

  const saveToCache = useCallback((trackId: string, videoId: string) => {
    if (!isValidYTId(videoId)) return;
    ytCacheRef.current[trackId] = videoId;
    try {
      localStorage.setItem("stream_yt_cache", JSON.stringify(ytCacheRef.current));
    } catch (e) {
      const keys = Object.keys(ytCacheRef.current);
      if (keys.length > 200) {
        const newCache = {};
        keys.slice(keys.length - 200).forEach(k => newCache[k] = ytCacheRef.current[k]);
        ytCacheRef.current = newCache;
        localStorage.setItem("stream_yt_cache", JSON.stringify(ytCacheRef.current));
      }
    }
  }, []);

  const setSleepMode = useCallback((mode: SleepMode) => {
    setSleepModeState(mode);
    sleepModeRef.current = mode;
    if (mode === "playlistEnd") {
      setSleepSeconds(null);
    } else if (mode) {
      setSleepSeconds(parseInt(mode) * 60);
    } else {
      setSleepSeconds(null);
    }
  }, []);

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

  const syncDbStats = useCallback(async () => {
    if (!user) return;
    const stats = JSON.parse(localStorage.getItem("dailyStats") || "null");
    const top = JSON.parse(localStorage.getItem("weeklyTopTracks") || "null");
    const updates: any = {};
    if (stats) updates.daily_stats = stats;
    if (top) updates.top_tracks = top;
    if (Object.keys(updates).length > 0) {
      await supabase.from('profiles').update(updates).eq('id', user.id);
    }
  }, [user]);

  const checkWeekRollover = useCallback(async () => {
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
  }, [user]);

  const addMinuteToStats = useCallback(async () => {
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
    if (todayIndex !== -1) stats[todayIndex].minutes += 1;
    localStorage.setItem("dailyStats", JSON.stringify(stats));
    window.dispatchEvent(new Event("statsUpdated"));
  }, [checkWeekRollover]);

  const updateTopTracks = useCallback(async (track: Track) => {
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
  }, [checkWeekRollover]);

  const handleProgress = useCallback((state: any) => {
    const currentPlayed = state.playedSeconds || 0;
    currentTimeRef.current = currentPlayed;

    if ('mediaSession' in navigator && navigator.mediaSession.setPositionState && duration > 0) {
      try {
        navigator.mediaSession.setPositionState({
          duration,
          playbackRate: 1,
          position: currentPlayed,
        });
      } catch (e) {}
    }

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
  }, [status, addMinuteToStats, duration]);

  const prefetchTrack = useCallback((track: Track) => {
    if (!track || ytCacheRef.current[track.id]) return;
    const query = `${track.artist} ${track.title} audio -"full album" -"1 hour" -"live" -"compilation"`;
    fetch(`/api/youtube?q=${encodeURIComponent(query)}&bg=true`)
      .then(res => res.json())
      .then(data => {
        if (data.videoId && isValidYTId(data.videoId)) {
          saveToCache(track.id, data.videoId);
          // 🟢 On mémorise aussi l'audioUrl en mémoire si disponible
          if (data.audioUrl) {
            audioUrlCacheRef.current[data.videoId] = data.audioUrl;
          }
        }
      })
      .catch(() => {});
  }, [saveToCache]);

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
  }, [prefetchTrack]);

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
        }).eq('id', user.id).then();
      }, 10000);
    }
    return () => clearTimeout(syncTimeout);
  }, [user, currentTrack, status]);

  // 🟢 CŒUR DU FIX : loadAndPlayUrl utilise maintenant des URLs audio directes
  // au lieu de l'iframe YouTube → background iOS natif, aucun hack nécessaire.
  const loadAndPlayUrl = useCallback(async (track: Track) => {
    // Stoppe les previews en cours
    if (typeof document !== "undefined") {
      document.querySelectorAll('audio').forEach(audio => {
        // On ne touche pas au <audio> du Player (géré par Player.tsx lui-même)
        // On arrête uniquement les previews Deezer des pages de recherche
        if (!audio.hasAttribute('data-player')) {
          audio.pause();
          audio.removeAttribute('src');
          audio.load();
        }
      });
      window.dispatchEvent(new Event('stopPreview'));
    }

    setStatus("loading");
    setCurrentTrack(track);
    currentTrackIdRef.current = track.id;
    updateTopTracks(track);
    syncDbStats();
    lastPlayedSecondsRef.current = 0;
    currentTimeRef.current = 0;

    const cachedVideoId = ytCacheRef.current[track.id];

    // CAS 1 : On a un videoId en cache
    if (cachedVideoId && isValidYTId(cachedVideoId)) {
      // Sous-cas A : On a aussi l'audioUrl en mémoire → on joue immédiatement
      const cachedAudioUrl = audioUrlCacheRef.current[cachedVideoId];
      if (cachedAudioUrl) {
        setPlayingUrl(cachedAudioUrl);
        setStatus("playing");
        prefetchNextLogic();
        return;
      }

      // Sous-cas B : On a le videoId mais pas d'audioUrl en mémoire
      // → on récupère une URL fraîche depuis Invidious (rapide, ~1-2s)
      try {
        const res = await fetch(`/api/youtube?videoId=${cachedVideoId}`);
        const data = await res.json();
        if (data.audioUrl) {
          audioUrlCacheRef.current[cachedVideoId] = data.audioUrl;
          setPlayingUrl(data.audioUrl);
          setStatus("playing");
          prefetchNextLogic();
          return;
        }
      } catch (e) {
        console.warn("Impossible de récupérer l'audioUrl pour le cache, relance la recherche complète");
      }
    }

    // CAS 2 : Pas de cache → recherche complète (videoId + audioUrl en une seule requête)
    try {
      const query = `${track.artist} ${track.title} audio -"full album" -"1 hour" -"live" -"compilation"`;
      const res = await fetch(`/api/youtube?q=${encodeURIComponent(query)}`);
      const data = await res.json();

      if (data.videoId && isValidYTId(data.videoId)) {
        saveToCache(track.id, data.videoId);

        if (data.audioUrl) {
          // 🟢 CAS IDÉAL : On a l'URL audio directe → <audio> natif → background iOS ✓
          audioUrlCacheRef.current[data.videoId] = data.audioUrl;
          setPlayingUrl(data.audioUrl);
          setStatus("playing");
          prefetchNextLogic();
        } else {
          // 🟡 FALLBACK : Invidious n'a pas pu fournir l'audioUrl
          // On utilise l'URL YouTube (pas de background iOS, mais au moins ça joue)
          console.warn("audioUrl indisponible, fallback YouTube iframe");
          setPlayingUrl(`https://www.youtube.com/watch?v=${data.videoId}`);
          setStatus("playing");
          prefetchNextLogic();
        }
      } else {
        setStatus("idle");
      }
    } catch (error) {
      console.error("Erreur API :", error);
      setStatus("idle");
    }
  }, [prefetchNextLogic, syncDbStats, updateTopTracks, saveToCache]);

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

  const playRadioTrack = useCallback(async () => {
    const lastTrack = currentTrack;
    if (!lastTrack) { setStatus("idle"); return; }
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
  }, [currentTrack, loadAndPlayUrl]);

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
      currentTrackIdRef.current ? handlePlaylistEnd() : setStatus("idle");
      return;
    }
    let nextTrack: Track | undefined;
    if (isShuffleRef.current) {
      const unplayed = q.filter(t => !playHistoryRef.current.includes(t.id));
      if (unplayed.length === 0) {
        if (repeatModeRef.current === "off") { handlePlaylistEnd(); return; }
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
    if (nextTrack) loadAndPlayUrl(nextTrack);
  }, [loadAndPlayUrl, playRadioTrack]);

  const playPrev = useCallback(() => {
    const q = queueRef.current;
    if (currentTimeRef.current > 3) { setSeekRequest(0); return; }
    if (q.length === 0) { setSeekRequest(0); return; }
    const currentIndex = q.findIndex(t => t.id === currentTrackIdRef.current);
    if (currentIndex > 0) {
      const prevTrack = q[currentIndex - 1];
      playHistoryRef.current.push(prevTrack.id);
      loadAndPlayUrl(prevTrack);
    } else {
      loadAndPlayUrl(q[q.length - 1]);
    }
  }, [loadAndPlayUrl]);

  const toggleShuffle = useCallback(() => {
    isShuffleRef.current = !isShuffleRef.current;
    setIsShuffle(prev => !prev);
  }, []);

  const toggleRepeat = useCallback(() => {
    const nextMode = repeatModeRef.current === "off" ? "all" :
      repeatModeRef.current === "all" ? "one" : "off";
    repeatModeRef.current = nextMode;
    setRepeatMode(nextMode);
  }, []);

  const togglePlayPause = useCallback(() => {
    if (status === "playing") {
      setStatus("paused");
    } else {
      if (!playingUrl && currentTrack) {
        loadAndPlayUrl(currentTrack);
      } else {
        setStatus("playing");
      }
    }
  }, [status, playingUrl, currentTrack, loadAndPlayUrl]);

  const seek = useCallback((time: number) => {
    setSeekRequest(time);
    window.dispatchEvent(new CustomEvent("musicTimeUpdate", { detail: { currentTime: time } }));
    lastPlayedSecondsRef.current = time;
  }, []);

  const clearSeekRequest = useCallback(() => setSeekRequest(null), []);

  const handleEnded = useCallback(() => {
    if (repeatModeRef.current === "one" && currentTrackIdRef.current) {
      const q = queueRef.current;
      const trackToReplay = q.find(t => t.id === currentTrackIdRef.current) || currentTrack;
      if (trackToReplay) { loadAndPlayUrl(trackToReplay); return; }
    }
    playNext();
  }, [playNext, currentTrack, loadAndPlayUrl]);

  // 🟢 MEDIA SESSION — Centre de contrôle iOS/Android (lock screen)
  // Avec un <audio> natif, iOS reconnaît automatiquement la lecture et affiche
  // les contrôles sur l'écran de verrouillage sans configuration supplémentaire.
  // La MediaSession API permet de personnaliser les métadonnées et les boutons.
  useEffect(() => {
    if ('mediaSession' in navigator && currentTrack) {
      navigator.mediaSession.metadata = new MediaMetadata({
        title: currentTrack.title,
        artist: currentTrack.artist,
        album: 'HOUÉE',
        artwork: [
          {
            src: currentTrack.image || 'https://api.dicebear.com/9.x/shapes/png?seed=music',
            sizes: '512x512',
            type: 'image/png'
          }
        ]
      });

      navigator.mediaSession.playbackState = status === "playing" ? "playing" : "paused";

      const actionHandlers: [MediaSessionAction, () => void][] = [
        ['play', togglePlayPause],
        ['pause', () => setStatus("paused")],
        ['previoustrack', playPrev],
        ['nexttrack', playNext],
        ['stop', () => { setStatus("idle"); setPlayingUrl(null); }],
      ];

      for (const [action, handler] of actionHandlers) {
        try {
          navigator.mediaSession.setActionHandler(action, handler);
        } catch (e) {}
      }
    }
  }, [currentTrack, status, playNext, playPrev, togglePlayPause]);

  const contextValue = useMemo(() => ({
    currentTrack, status, playingUrl, duration, volume,
    isFullScreen, seekRequest, queue, isShuffle, repeatMode,
    sleepMode: sleepModeState, sleepSeconds, setSleepMode,
    playTrack, playNext, playPrev, toggleShuffle, toggleRepeat,
    togglePlayPause, setVolume, seek,
    onProgress: handleProgress,
    onDuration: setDuration,
    onEnded: handleEnded,
    setIsFullScreen, clearSeekRequest,
    isMusicLoaded
  }), [
    currentTrack, status, playingUrl, duration, volume,
    isFullScreen, seekRequest, queue, isShuffle, repeatMode,
    sleepModeState, sleepSeconds,
    playTrack, playNext, playPrev, setSleepMode, toggleShuffle, toggleRepeat,
    togglePlayPause, seek, handleProgress, handleEnded, clearSeekRequest,
    isMusicLoaded
  ]);

  return (
    <MusicContext.Provider value={contextValue}>
      {children}
    </MusicContext.Provider>
  );
}

export const useMusic = () => {
  const ctx = useContext(MusicContext);
  if (!ctx) throw new Error("useMusic must be used within MusicProvider");
  return ctx;
};