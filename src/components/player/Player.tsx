"use client";

import React, { useEffect, useRef, useState } from "react";
import { useMusic } from "@/context/MusicContext";

export function Player() {
  const {
    playingUrl, status, volume,
    onDuration, onProgress, onEnded,
    seekRequest, clearSeekRequest,
    setPlaybackError
  } = useMusic();

  const audioRef = useRef<HTMLAudioElement>(null);
  const [isClient, setIsClient] = useState(false);

  useEffect(() => setIsClient(true), []);

  // 1. Chargement de la musique
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !playingUrl) return;

    audio.src = playingUrl;
    audio.load();

    if (status === "playing") {
      audio.play().catch((e) => {
        console.warn("Lecture bloquée:", e);
        setPlaybackError(e?.message ?? "Erreur de lecture");
      });
    }
  }, [playingUrl]);

  // 2. Play / Pause
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    if (status === "playing") {
      audio.play().catch(console.warn);
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

  if (!isClient) return null;

  return (
    <audio
      ref={audioRef}
      onTimeUpdate={() =>
        onProgress({ playedSeconds: audioRef.current?.currentTime ?? 0 })
      }
      onDurationChange={() => {
        const d = audioRef.current?.duration;
        if (d && isFinite(d)) onDuration(d);
      }}
      onEnded={onEnded}
      style={{ display: "none" }}
    />
  );
}