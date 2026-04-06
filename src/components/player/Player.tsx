// @ts-nocheck
"use client";

import React, { useEffect, useRef, useState } from "react";
import { useMusic } from "@/context/MusicContext";

export function Player() {
  const { playingUrl, status, volume, onDuration, onProgress, onEnded, seekRequest, clearSeekRequest } = useMusic();
  const [isClient, setIsClient] = useState(false);
  
  const audioRef = useRef<HTMLAudioElement>(null);
  const lastUrlRef = useRef<string | null>(null);

  useEffect(() => setIsClient(true), []);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !playingUrl) return;

    if (playingUrl === lastUrlRef.current) return;
    lastUrlRef.current = playingUrl;

    audio.src = playingUrl;
    audio.load();

    if (status === "playing") {
      audio.play().catch((err) => console.warn("Autoplay bloqué :", err));
    }
  }, [playingUrl]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !playingUrl) return;

    if (status === "playing") {
      audio.play().catch(() => {});
    } else if (status === "paused" || status === "idle") {
      audio.pause();
    }
  }, [status, playingUrl]);

  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = Math.max(0, Math.min(1, volume));
    }
  }, [volume]);

  useEffect(() => {
    if (seekRequest !== null && audioRef.current) {
      audioRef.current.currentTime = seekRequest;
      clearSeekRequest();
    }
  }, [seekRequest, clearSeekRequest]);

  // 🟢 Permet la lecture continue si on revient sur la page
  useEffect(() => {
    const handleVisibility = () => {
      const audio = audioRef.current;
      if (!document.hidden && status === "playing" && audio) {
        audio.play().catch(() => {});
      }
    };
    document.addEventListener("visibilitychange", handleVisibility);
    return () => document.removeEventListener("visibilitychange", handleVisibility);
  }, [status]);

  if (!isClient) return null;

  return (
    <audio
      ref={audioRef}
      playsInline
      preload="auto"
      data-main-player="true"
      onTimeUpdate={() => {
        if (audioRef.current) {
          onProgress({ playedSeconds: audioRef.current.currentTime });
        }
      }}
      onDurationChange={() => {
        if (audioRef.current && audioRef.current.duration > 0 && isFinite(audioRef.current.duration)) {
          onDuration(audioRef.current.duration);
        }
      }}
      onEnded={onEnded}
      onError={(e) => {
        console.error("Erreur du flux audio natif :", e);
        setTimeout(() => onEnded(), 2000); 
      }}
      style={{ display: "none" }}
    />
  );
}