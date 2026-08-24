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

  const [isClient, setIsClient] = useState(false);
  const audioRef = useRef<HTMLAudioElement>(null);
  const isUnlockedRef = useRef(false);

  useEffect(() => {
    setIsClient(true);
  }, []);

  const isDirectAudio = (url: string | null) => {
    if (!url) return false;
    return url.includes(".mp3") || url.includes(".m4a") || url.includes("preview") || url.includes("dzcdn.net");
  };

  const getYTId = (url: string | null) => {
    if (!url || isDirectAudio(url)) return null;
    if (url.length === 11 && !url.includes("/")) return url;
    const m = url.match(/(?:youtu\.be\/|v\/|embed\/|watch\?v=|\?videoId=|&videoId=)([^#&?]{11})/);
    return m ? m[1] : null;
  };

  // 1. Déverrouillage Apple (Safari/iOS) au premier tap
  useEffect(() => {
    const unlock = () => {
      if (isUnlockedRef.current || !audioRef.current) return;
      audioRef.current.src = "data:audio/wav;base64,UklGRigAAABXQVZFZm10IBIAAAABAAEARKwAAIhYAQACABAAAABkYXRhAgAAAAEA";
      audioRef.current.play().then(() => audioRef.current?.pause()).catch(() => {});
      isUnlockedRef.current = true;
    };

    const events = ["touchstart", "touchend", "click"];
    events.forEach(e => document.addEventListener(e, unlock, { once: true, passive: true }));
    return () => events.forEach(e => document.removeEventListener(e, unlock));
  }, []);

  // 2. Aiguillage et chargement de la musique
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !playingUrl) return;

    audio.pause();

    if (isDirectAudio(playingUrl)) {
      audio.src = playingUrl;
    } else {
      const videoId = getYTId(playingUrl);
      if (videoId) {
        // On fait appel à NOTRE API sécurisée
        audio.src = `/api/stream?videoId=${videoId}`;
      }
    }

    audio.load();
    if (status === "playing") {
      audio.play().catch(() => {
        setPlaybackError("Appuyez sur Play pour lancer (sécurité navigateur)");
      });
    }
  }, [playingUrl]);

  // 3. Play / Pause
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    
    if (status === "playing") {
      audio.play().catch(() => {});
    } else if (status === "paused") {
      audio.pause();
    }
  }, [status]);

  // 4. Volume
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = Math.max(0, Math.min(1, volume));
    }
  }, [volume]);

  // 5. Progression et Seek
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
      onTimeUpdate={() => onProgress({ playedSeconds: audioRef.current?.currentTime || 0 })}
      onDurationChange={() => {
        const d = audioRef.current?.duration;
        if (d && isFinite(d)) onDuration(d);
      }}
      onEnded={onEnded}
      onError={(e) => {
        console.error("Audio Playback Error");
        setPlaybackError("Impossible de lire ce format audio.");
      }}
      style={{ display: "none" }}
    />
  );
}