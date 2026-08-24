"use client";

import React, { useEffect, useRef, useState } from "react";
import { useMusic } from "@/context/MusicContext";

export function Player() {
  const {
    playingUrl,
    status,
    volume,
    onDuration,
    onProgress,
    onEnded,
    seekRequest,
    clearSeekRequest,
    setPlaybackError,
  } = useMusic();

  const audioRef = useRef<HTMLAudioElement>(null);
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
  }, []);

  // Résolution de la source audio (Aperçu direct OU proxy de stream)
  const resolveAudioSrc = (url: string | null): string | null => {
    if (!url) return null;
    
    // Si c'est déjà un flux direct MP3/M4A/Preview
    if (
      url.endsWith(".mp3") ||
      url.endsWith(".m4a") ||
      url.includes("dzcdn.net") ||
      url.includes("audio-preview") ||
      url.includes(".mp3?")
    ) {
      return url;
    }

    // Extraction de l'ID vidéo si présent
    let videoId = url;
    if (url.includes("videoId=")) {
      videoId = new URL(url, "https://dummy.local").searchParams.get("videoId") || url;
    } else if (url.includes("v=")) {
      videoId = new URL(url, "https://dummy.local").searchParams.get("v") || url;
    }

    if (videoId && videoId.length === 11) {
      return `/api/stream?videoId=${videoId}`;
    }

    return url;
  };

  // Chargement et lecture
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !playingUrl) return;

    const streamSrc = resolveAudioSrc(playingUrl);
    if (!streamSrc) return;

    audio.src = streamSrc;
    audio.load();

    if (status === "playing") {
      const playPromise = audio.play();
      if (playPromise !== undefined) {
        playPromise.catch((err) => {
          console.warn("[Audio Playback Error]", err);
        });
      }
    }
  }, [playingUrl]);

  // Contrôles Play / Pause
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    if (status === "playing") {
      audio.play().catch(() => {});
    } else if (status === "paused") {
      audio.pause();
    }
  }, [status]);

  // Gestion du volume
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = Math.max(0, Math.min(1, volume));
    }
  }, [volume]);

  // Seek
  useEffect(() => {
    if (seekRequest !== null && audioRef.current) {
      audioRef.current.currentTime = seekRequest;
      clearSeekRequest();
    }
  }, [seekRequest, clearSeekRequest]);

  if (!isClient) return null;

  return (
    <audio
      ref={audioRef}
      playsInline
      preload="auto"
      onTimeUpdate={() =>
        onProgress({ playedSeconds: audioRef.current?.currentTime ?? 0 })
      }
      onDurationChange={() => {
        const d = audioRef.current?.duration;
        if (d && isFinite(d)) onDuration(d);
      }}
      onEnded={onEnded}
      onError={(e) => {
        const err = (e.target as HTMLAudioElement).error;
        console.warn("Erreur de flux audio:", err);
      }}
      style={{ display: "none" }}
    />
  );
}