"use client";

import React, { useEffect, useRef, useState } from "react";
import { useMusic } from "@/context/MusicContext";

export function Player() {
  const {
    playingUrl, status, volume,
    onDuration, onProgress, onEnded,
    seekRequest, clearSeekRequest,
    setPlaybackError,
  } = useMusic();

  const audioRef = useRef<HTMLAudioElement>(null);
  const [isClient, setIsClient] = useState(false);
  const isReadyRef = useRef(false); // true quand l'audio a assez de données

  useEffect(() => setIsClient(true), []);

  // Chargement nouvelle URL
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !playingUrl) return;

    isReadyRef.current = false;

    audio.pause();
    audio.src = "";
    audio.load();

    audio.src = playingUrl;
    audio.preload = "auto"; // ← "auto" au lieu de "metadata" : charge tout de suite
    audio.load();

    // Si status est déjà "playing" au moment du chargement,
    // on laisse onCanPlayThrough déclencher le play
  }, [playingUrl]);

  // Play / Pause
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    if (status === "playing") {
      if (isReadyRef.current) {
        // Audio prêt → play immédiat
        audio.play().catch(console.warn);
      }
      // Sinon onCanPlayThrough va le faire dès que c'est prêt
    } else if (status === "paused") {
      audio.pause();
    }
  }, [status]);

  // Volume
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
      onCanPlayThrough={() => {
        // Déclenché quand assez de données sont chargées pour jouer sans interruption
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