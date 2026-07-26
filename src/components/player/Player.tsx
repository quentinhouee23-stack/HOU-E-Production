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
  const hasUnlockedRef = useRef(false);

  useEffect(() => setIsClient(true), []);

  // Débloque l'élément <audio> au premier tap/clic : nécessaire sur mobile
  // car ton vrai play() arrive plus tard, après un fetch async (donc plus
  // "attaché" au geste utilisateur aux yeux du navigateur). Un play/pause
  // silencieux ici, lui, est bien dans la pile du geste, et ça suffit à
  // autoriser tous les play() programmatiques suivants pour cet élément.
  useEffect(() => {
    const unlock = () => {
      const audio = audioRef.current;
      if (audio && !hasUnlockedRef.current) {
        audio.muted = true;
        audio.play().then(() => {
          audio.pause();
          audio.muted = false;
          hasUnlockedRef.current = true;
        }).catch(() => {});
      }
      document.removeEventListener("touchstart", unlock);
      document.removeEventListener("click", unlock);
    };
    document.addEventListener("touchstart", unlock, { once: true });
    document.addEventListener("click", unlock, { once: true });
    return () => {
      document.removeEventListener("touchstart", unlock);
      document.removeEventListener("click", unlock);
    };
  }, []);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !playingUrl) return;

    audio.src = playingUrl;
    audio.load();

    if (status === "playing") {
      audio.play().catch((e) => {
        console.warn("play() bloqué:", e);
        setPlaybackError(e?.message ?? "Erreur de lecture");
      });
    }
  }, [playingUrl]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    if (status === "playing") {
      audio.play().catch((e) => {
        console.warn(e);
        setPlaybackError(e?.message ?? "Erreur de lecture");
      });
    } else if (status === "paused") {
      audio.pause();
    }
  }, [status]);

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
        console.warn("Erreur Audio:", err);
        setPlaybackError(err?.message || `Erreur audio (code ${err?.code})`);
      }}
      style={{ display: "none" }}
    />
  );
}