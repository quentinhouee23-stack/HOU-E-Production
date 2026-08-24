// @ts-nocheck
"use client";

import React, { createContext, useCallback, useContext, useState, useRef, useEffect, useMemo } from "react";
import type { Track, PlayerStatus } from "@/types";
import { supabase } from "@/lib/supabase";
import { useAuth } from "./AuthContext";

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
  const playHistoryRef = useRef<string[]>([]);
  const currentTimeRef = useRef(0);
  const ytCacheRef = useRef<Record<string, string>>({});
  
  const repeatModeRef = useRef<"off" | "all" | "one">("off");
  const isShuffleRef = useRef(false);

  const playNextRef = useRef<() => void>(() => {});

  // Diffusion du morceau en cours sur le profil Supabase pour les amis
  const syncLiveToSupabase = useCallback(async (track: Track | null, isPlaying: boolean) => {
    if (!user) return;
    try {
      await supabase
        .from("profiles")
        .update({
          current_listening: isPlaying && track ? {
            id: track.id,
            title: track.title,
            artist: track.artist,
            image: track.image,
            updated_at: new Date().toISOString()
          } : null
        })
        .eq("id", user.id);
    } catch (err) {
      console.error("Erreur sync live Supabase :", err);
    }
  }, [user]);

  useEffect(() => {
    try {
      const savedVolume = localStorage.getItem("houee_volume");
      if (savedVolume) setVolumeState(parseFloat(savedVolume));
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
            syncLiveToSupabase(null, false);
            setSleepModeState(null);
            sleepModeRef.current = null;
            return null;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [status, sleepSeconds, syncLiveToSupabase]);

  const handleProgress = useCallback((state: any) => {
    currentTimeRef.current = state.playedSeconds || 0;
    window.dispatchEvent(new CustomEvent("musicTimeUpdate", {
      detail: { currentTime: currentTimeRef.current }
    }));
  }, []);

  const loadAndPlayUrl = useCallback(async (track: Track) => {
    setPlaybackError(null);
    setStatus("loading");
    setCurrentTrack(track);
    currentTrackIdRef.current = track.id;
    currentTimeRef.current = 0;

    try {
      let videoId = ytCacheRef.current[track.id];

      if (!videoId || !isValidYTId(videoId)) {
        const query = `${track.artist} ${track.title} audio -"full album" -"live"`;
        const resSearch = await fetch(`/api/youtube?q=${encodeURIComponent(query)}`);
        if (!resSearch.ok) throw new Error("Musique introuvable.");
        
        const dataSearch = await resSearch.json();
        if (dataSearch.videoId) {
           videoId = dataSearch.videoId;
           ytCacheRef.current[track.id] = videoId;
        } else {
           throw new Error("ID introuvable.");
        }
      }

      setPlayingUrl(`/api/stream?videoId=${videoId}&t=${Date.now()}`);
      setStatus("playing");
      syncLiveToSupabase(track, true);

    } catch (error: any) {
      setPlaybackError(error.message);
      setStatus("idle");
      syncLiveToSupabase(null, false);
      setTimeout(() => playNextRef.current(), 2000);
    }
  }, [syncLiveToSupabase]);

  const playTrack = useCallback(async (track: Track, newQueue?: Track[]) => {
    if (newQueue && newQueue.length > 0) {
      setQueue(newQueue);
      queueRef.current = newQueue;
      playHistoryRef.current = [track.id];
    } else {
      playHistoryRef.current.push(track.id);
    }
    await loadAndPlayUrl(track);
  }, [loadAndPlayUrl]);

  const playNext = useCallback(() => {
    const q = queueRef.current;
    if (q.length === 0) { 
      setStatus("idle"); 
      syncLiveToSupabase(null, false);
      return; 
    }
    
    let nextTrack: Track | undefined;
    const currentIndex = q.findIndex(t => t.id === currentTrackIdRef.current);
    
    if (currentIndex !== -1 && currentIndex + 1 < q.length) {
      nextTrack = q[currentIndex + 1];
    } else if (repeatModeRef.current === "all") {
      nextTrack = q[0];
    }
    
    if (nextTrack) loadAndPlayUrl(nextTrack);
    else {
      setStatus("idle");
      setPlayingUrl(null);
      syncLiveToSupabase(null, false);
    }
  }, [loadAndPlayUrl, syncLiveToSupabase]);

  useEffect(() => { playNextRef.current = playNext; }, [playNext]);

  const playPrev = useCallback(() => {
    const q = queueRef.current;
    if (currentTimeRef.current > 3 || q.length === 0) {
      setSeekRequest(0);
      return;
    }
    const currentIndex = q.findIndex(t => t.id === currentTrackIdRef.current);
    if (currentIndex > 0) {
      loadAndPlayUrl(q[currentIndex - 1]);
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
    if (status === "playing") {
      setStatus("paused");
      syncLiveToSupabase(null, false);
    } else if (!playingUrl && currentTrack) {
      loadAndPlayUrl(currentTrack);
    } else {
      setStatus("playing");
      if (currentTrack) syncLiveToSupabase(currentTrack, true);
    }
  }, [status, playingUrl, currentTrack, loadAndPlayUrl, syncLiveToSupabase]);

  const seek = useCallback((time: number) => setSeekRequest(time), []);
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

  const contextValue = useMemo(() => ({
    currentTrack, status, playingUrl, duration, volume, isFullScreen, seekRequest, queue, isShuffle, repeatMode,
    sleepMode: sleepModeState, sleepSeconds, playbackError,
    setPlaybackError, setSleepMode, playTrack, playNext, playPrev, toggleShuffle, toggleRepeat, togglePlayPause, setVolume, seek,
    onProgress: handleProgress, onDuration: setDuration, onEnded: handleEnded, setIsFullScreen, clearSeekRequest, isMusicLoaded
  }), [currentTrack, status, playingUrl, duration, volume, isFullScreen, seekRequest, queue, isShuffle, repeatMode, sleepModeState, sleepSeconds, playbackError, playTrack, playNext, playPrev, setSleepMode, toggleShuffle, toggleRepeat, togglePlayPause, seek, handleProgress, handleEnded, clearSeekRequest, isMusicLoaded]);

  return <MusicContext.Provider value={contextValue}>{children}</MusicContext.Provider>;
}

export const useMusic = () => {
  const ctx = useContext(MusicContext);
  if (!ctx) throw new Error("useMusic must be used within MusicProvider");
  return ctx;
};