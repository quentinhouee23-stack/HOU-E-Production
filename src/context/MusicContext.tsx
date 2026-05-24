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
  playbackError: string | null;
  setPlaybackError: (err: string | null) => void;
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

const isValidYTId = (id: string | null | undefined) => typeof id === "string" && id.length === 11;

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
  const [playbackError, setPlaybackError] = useState<string | null>(null);
  
  const sleepModeRef = useRef<SleepMode>(null);
  const queueRef = useRef<Track[]>([]);
  const currentTrackIdRef = useRef<string | null>(null);
  const isShuffleRef = useRef(false);
  const repeatModeRef = useRef<"off" | "all" | "one">("off");
  const playHistoryRef = useRef<string[]>([]);
  const currentTimeRef = useRef(0);
  const ytCacheRef = useRef<Record<string, string>>({});
  
  const playNextRef = useRef<() => void>(() => {});

  const unlockAudio = useCallback(() => {
    if (typeof window === "undefined") return;
    window.dispatchEvent(new CustomEvent("iosUnlock"));
  }, []);

  useEffect(() => {
    try {
      let currentCache = {};
      const savedCache = localStorage.getItem("stream_yt_cache");
      if (savedCache) {
        const rawCache = JSON.parse(savedCache);
        for (const key in rawCache) {
          if (isValidYTId(rawCache[key])) currentCache[key] = rawCache[key];
        }
        ytCacheRef.current = currentCache;
      }
      const savedVolume = localStorage.getItem("houee_volume");
      if (savedVolume) setVolumeState(parseFloat(savedVolume));
      const savedTrack = localStorage.getItem("houee_last_track");
      if (savedTrack) {
        const parsedTrack = JSON.parse(savedTrack);
        setCurrentTrack(parsedTrack);
        currentTrackIdRef.current = parsedTrack.id;
      }
      const savedQueue = localStorage.getItem("houee_last_queue");
      if (savedQueue) {
        setQueue(JSON.parse(savedQueue));
        queueRef.current = JSON.parse(savedQueue);
      }
    } catch (e) {} finally {
      setIsMusicLoaded(true);
    }
  }, []);

  const setVolume = useCallback((v: number) => {
    setVolumeState(v);
    localStorage.setItem("houee_volume", v.toString());
  }, []);

  useEffect(() => {
    if (isMusicLoaded && currentTrack) localStorage.setItem("houee_last_track", JSON.stringify(currentTrack));
  }, [currentTrack, isMusicLoaded]);

  useEffect(() => {
    if (isMusicLoaded) localStorage.setItem("houee_last_queue", JSON.stringify(queue));
  }, [queue, isMusicLoaded]);

  const saveToCache = useCallback((trackId: string, videoId: string) => {
    if (!isValidYTId(videoId)) return;
    ytCacheRef.current[trackId] = videoId;
    try {
      localStorage.setItem("stream_yt_cache", JSON.stringify(ytCacheRef.current));
    } catch (e) {}
  }, []);

  const setSleepMode = useCallback((mode: SleepMode) => {
    setSleepModeState(mode);
    sleepModeRef.current = mode;
    if (mode === "playlistEnd") setSleepSeconds(null);
    else if (mode) setSleepSeconds(parseInt(mode) * 60);
    else setSleepSeconds(null);
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

  const handleProgress = useCallback((state: any) => {
    currentTimeRef.current = state.playedSeconds || 0;
    if ('mediaSession' in navigator && navigator.mediaSession.setPositionState && duration > 0) {
      try {
        navigator.mediaSession.setPositionState({
          duration: duration,
          playbackRate: 1,
          position: currentTimeRef.current,
        });
      } catch (e) {}
    }
    window.dispatchEvent(new CustomEvent("musicTimeUpdate", {
      detail: { currentTime: currentTimeRef.current }
    }));
  }, [duration]);

  const prefetchNextLogic = useCallback(() => {
    const q = queueRef.current;
    if (q.length === 0) return;
    let nextTrack: Track | undefined;
    if (isShuffleRef.current) {
      const unplayed = q.filter(t => !playHistoryRef.current.includes(t.id) && t.id !== currentTrackIdRef.current);
      if (unplayed.length > 0) nextTrack = unplayed[Math.floor(Math.random() * unplayed.length)];
    } else {
      const currentIndex = q.findIndex(t => t.id === currentTrackIdRef.current);
      if (currentIndex !== -1 && currentIndex + 1 < q.length) nextTrack = q[currentIndex + 1];
      else if (repeatModeRef.current === "all") nextTrack = q[0];
    }
  }, []);

  const loadAndPlayUrl = useCallback(async (track: Track) => {
    setPlaybackError(null);
    setStatus("loading");
    setCurrentTrack(track);
    currentTrackIdRef.current = track.id;
    currentTimeRef.current = 0;
    unlockAudio();

    try {
      let videoId = ytCacheRef.current[track.id];
      if (!videoId || !isValidYTId(videoId)) {
        const query = `${track.artist} ${track.title} audio -"full album" -"live"`;
        const res = await fetch(`/api/youtube?q=${encodeURIComponent(query)}`);
        if (!res.ok) throw new Error("Musique introuvable.");
        
        const data = await res.json();
        if (data.videoId) {
           videoId = data.videoId;
           saveToCache(track.id, videoId);
        } else {
           throw new Error("ID introuvable.");
        }
      }

      setPlayingUrl(videoId);
      setStatus("playing");
      prefetchNextLogic();

    } catch (error) {
      setPlaybackError(error.message);
      setStatus("idle");
      setTimeout(() => playNextRef.current(), 2000);
    }
  }, [prefetchNextLogic, saveToCache, unlockAudio]);

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

  const playNext = useCallback(() => {
    const q = queueRef.current;
    if (q.length === 0) {
      setStatus("idle");
      return;
    }
    let nextTrack: Track | undefined;
    if (isShuffleRef.current) {
      const unplayed = q.filter(t => !playHistoryRef.current.includes(t.id));
      if (unplayed.length === 0) {
        if (repeatModeRef.current === "off") return;
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
        }
      }
    }
    if (nextTrack) loadAndPlayUrl(nextTrack);
  }, [loadAndPlayUrl]);

  useEffect(() => { playNextRef.current = playNext; }, [playNext]);

  const playPrev = useCallback(() => {
    const q = queueRef.current;
    if (currentTimeRef.current > 3 || q.length === 0) {
      setSeekRequest(0);
      return;
    }
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
    const nextMode = repeatModeRef.current === "off" ? "all" : repeatModeRef.current === "all" ? "one" : "off";
    repeatModeRef.current = nextMode;
    setRepeatMode(nextMode);
  }, []);

  const togglePlayPause = useCallback(() => {
    unlockAudio(); 
    if (status === "playing") setStatus("paused");
    else if (!playingUrl && currentTrack) loadAndPlayUrl(currentTrack);
    else setStatus("playing");
  }, [status, playingUrl, currentTrack, loadAndPlayUrl, unlockAudio]);

  const seek = useCallback((time: number) => {
    setSeekRequest(time);
    window.dispatchEvent(new CustomEvent("musicTimeUpdate", { detail: { currentTime: time } }));
  }, []);

  const clearSeekRequest = useCallback(() => setSeekRequest(null), []);

  const handleEnded = useCallback(() => {
    if (repeatModeRef.current === "one" && currentTrackIdRef.current) {
      const trackToReplay = queueRef.current.find(t => t.id === currentTrackIdRef.current) || currentTrack;
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
        artwork: [{ src: currentTrack.image || 'https://api.dicebear.com/9.x/shapes/png?seed=music', sizes: '512x512', type: 'image/png' }]
      });
      navigator.mediaSession.playbackState = status === "playing" ? "playing" : "paused";
      const actionHandlers = [
        ['play', togglePlayPause], ['pause', () => setStatus("paused")],
        ['previoustrack', playPrev], ['nexttrack', playNext],
      ];
      for (const [action, handler] of actionHandlers) {
        try { navigator.mediaSession.setActionHandler(action, handler); } catch (e) {}
      }
    }
  }, [currentTrack, status, playNext, playPrev, togglePlayPause]);

  const contextValue = useMemo(() => ({
    currentTrack, status, playingUrl, duration, volume, isFullScreen, seekRequest, queue, isShuffle, repeatMode,
    sleepMode: sleepModeState, sleepSeconds, playbackError,
    setPlaybackError, setSleepMode, playTrack, playNext, playPrev, toggleShuffle, toggleRepeat, togglePlayPause, setVolume, seek,
    onProgress: handleProgress, onDuration: setDuration, onEnded: handleEnded, setIsFullScreen, clearSeekRequest, isMusicLoaded
  }), [currentTrack, status, playingUrl, duration, volume, isFullScreen, seekRequest, queue, isShuffle, repeatMode, sleepModeState, sleepSeconds, playbackError, playTrack, playNext, playPrev, setSleepMode, toggleShuffle, toggleRepeat, togglePlayPause, seek, handleProgress, handleEnded, isMusicLoaded]);

  return <MusicContext.Provider value={contextValue}>{children}</MusicContext.Provider>;
}

export const useMusic = () => {
  const ctx = useContext(MusicContext);
  if (!ctx) throw new Error("useMusic must be used within MusicProvider");
  return ctx;
};