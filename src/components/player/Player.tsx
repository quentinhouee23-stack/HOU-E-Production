"use client";

import React, { useEffect, useRef, useState } from "react";
import { useMusic } from "@/context/MusicContext";

export function Player() {
  const {
    currentTrack,
    playingUrl, status, volume,
    onDuration, onProgress, onEnded,
    seekRequest, clearSeekRequest,
    setPlaybackError, 
    playNext, playPrev, togglePlayPause
  } = useMusic();

  const audioRef = useRef<HTMLAudioElement>(null);
  const [isClient, setIsClient] = useState(false);
  const isReadyRef = useRef(false);

  useEffect(() => setIsClient(true), []);

  // 1. Chargement de l'URL
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !playingUrl) return;

    isReadyRef.current = false;
    audio.pause();
    audio.src = "";
    audio.load();

    audio.src = playingUrl;
    audio.preload = "auto";
    audio.load();
  }, [playingUrl]);

  // 2. Play / Pause
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    if (status === "playing") {
      if (isReadyRef.current) {
        audio.play().catch(console.warn);
      }
    } else if (status === "paused") {
      audio.pause();
    }
  }, [status]);

  // 3. Volume
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = Math.max(0, Math.min(1, volume));
    }
  }, [volume]);

  // 4. Seek (Avancer/Reculer)
  useEffect(() => {
    if (seekRequest !== null && audioRef.current) {
      audioRef.current.currentTime = seekRequest;
      clearSeekRequest();
    }
  }, [seekRequest, clearSeekRequest]);

  // 5. Arrière-plan pour téléphone (Mode Spotify)
  useEffect(() => {
    if ('mediaSession' in navigator && currentTrack) {
      // On force le type pour éviter l'erreur de "thumbnail", "image_url" ou "cover"
      const trackImage = (currentTrack as any).image_url 
        || (currentTrack as any).thumbnail 
        || (currentTrack as any).cover 
        || 'https://api.dicebear.com/7.x/shapes/png?seed=music';

      navigator.mediaSession.metadata = new MediaMetadata({
        title: currentTrack.title,
        artist: currentTrack.artist,
        artwork: [
          { src: trackImage, sizes: '512x512', type: 'image/png' }
        ]
      });

      navigator.mediaSession.setActionHandler('play', () => {
        audioRef.current?.play();
        togglePlayPause();
      });
      navigator.mediaSession.setActionHandler('pause', () => {
        audioRef.current?.pause();
        togglePlayPause();
      });
      navigator.mediaSession.setActionHandler('previoustrack', () => playPrev());
      navigator.mediaSession.setActionHandler('nexttrack', () => playNext());
    }
  }, [currentTrack, playNext, playPrev, togglePlayPause]);

  if (!isClient) return null;

  return (
    <audio
      ref={audioRef}
      playsInline
      preload="auto"
      onCanPlayThrough={() => {
        isReadyRef.current = true;
        if (status === "playing") {
          audioRef.current?.play().catch(console.warn);
        }
      }}
      onTimeUpdate={() =>
        onProgress({ playedSeconds: audioRef.current?.currentTime ?? 0 })
      }
      onDurationChange={() => {
        const d = audioRef.current?.duration;
        if (d && isFinite(d)) onDuration(d);
      }}
      onEnded={onEnded}
      onError={(e) => {
        const code = (e.target as HTMLAudioElement).error?.code;
        const msg =
          code === 4 ? "Format audio non supporté."
          : code === 2 ? "Erreur réseau."
          : "Erreur audio inconnue.";
        setPlaybackError(msg);
      }}
      style={{ position: "absolute", width: "1px", height: "1px", opacity: 0.01, pointerEvents: "none", bottom: 0 }}
    />
  );
}