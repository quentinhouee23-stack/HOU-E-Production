"use client";

import React, { useEffect, useRef, useState } from "react";
import { useMusic } from "@/context/MusicContext";

// Serveurs relais Invidious publics configurés pour proxy l'audio directement
const AUDIO_RELAYS = [
  "https://vid.puffyan.us",
  "https://inv.tux.pizza",
  "https://invidious.flokinet.to",
  "https://invidious.nerdvpn.de",
  "https://invidious.slipfox.xyz"
];

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
  const [relayIndex, setRelayIndex] = useState(0);
  const audioRef = useRef<HTMLAudioElement>(null);
  const isUnlockedRef = useRef(false);

  useEffect(() => setIsClient(true), []);

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

  // 1. Déverrouillage iOS
  useEffect(() => {
    const unlock = () => {
      if (audioRef.current && !isUnlockedRef.current) {
        audioRef.current.src = "data:audio/wav;base64,UklGRigAAABXQVZFZm10IBIAAAABAAEARKwAAIhYAQACABAAAABkYXRhAgAAAAEA";
        audioRef.current.play().then(() => {
          audioRef.current?.pause();
          isUnlockedRef.current = true;
        }).catch(() => {});
      }
      document.removeEventListener("touchstart", unlock);
      document.removeEventListener("click", unlock);
    };

    document.addEventListener("touchstart", unlock, { once: true, passive: true });
    document.addEventListener("click", unlock, { once: true, passive: true });

    return () => {
      document.removeEventListener("touchstart", unlock);
      document.removeEventListener("click", unlock);
    };
  }, []);

  // 2. Chargement de la piste
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !playingUrl) return;

    setRelayIndex(0); // On réinitialise le relais au premier de la liste
    audio.pause();

    if (isDirectAudio(playingUrl)) {
      audio.src = playingUrl;
    } else {
      const id = getYTId(playingUrl);
      if (id) {
        // itag=140 correspond au flux audio M4A universel
        audio.src = `${AUDIO_RELAYS[0]}/latest_version?id=${id}&itag=140`;
      }
    }

    audio.load();
    if (status === "playing") {
      audio.play().catch(() => {});
    }
  }, [playingUrl]); // S'exécute uniquement si le morceau change

  // 3. Système de bascule automatique si un relais tombe en panne
  const handleError = () => {
    const audio = audioRef.current;
    if (!audio || !playingUrl || isDirectAudio(playingUrl)) {
      setPlaybackError("Impossible de lire ce format audio.");
      return;
    }

    const id = getYTId(playingUrl);
    const nextIndex = relayIndex + 1;

    if (id && nextIndex < AUDIO_RELAYS.length) {
      setRelayIndex(nextIndex);
      audio.src = `${AUDIO_RELAYS[nextIndex]}/latest_version?id=${id}&itag=140`;
      audio.load();
      if (status === "playing") audio.play().catch(() => {});
    } else {
      setPlaybackError("Serveurs relais surchargés, réessayez plus tard.");
    }
  };

  // 4. Contrôles de base
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    if (status === "playing") audio.play().catch(() => {});
    else if (status === "paused") audio.pause();
  }, [status]);

  useEffect(() => {
    if (audioRef.current) audioRef.current.volume = Math.max(0, Math.min(1, volume));
  }, [volume]);

  useEffect(() => {
    if (seekRequest !== null && audioRef.current) {
      audioRef.current.currentTime = seekRequest;
      clearSeekRequest();
    }
  }, [seekRequest]);

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
      onError={handleError}
      style={{ display: "none" }}
    />
  );
}