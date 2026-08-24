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
  const hasUnlockedAudio = useRef(false);

  useEffect(() => {
    setIsClient(true);
  }, []);

  // Déverrouillage audio obligatoire pour iOS au tout premier tap
  useEffect(() => {
    const unlock = () => {
      const audio = audioRef.current;
      if (audio && !hasUnlockedAudio.current) {
        audio.src = "data:audio/wav;base64,UklGRigAAABXQVZFZm10IBIAAAABAAEARKwAAIhYAQACABAAAABkYXRhAgAAAAEA";
        audio.play().then(() => {
          audio.pause();
          hasUnlockedAudio.current = true;
        }).catch(() => {});
      }
      document.removeEventListener("touchstart", unlock);
      document.removeEventListener("click", unlock);
    };

    document.addEventListener("touchstart", unlock, { passive: true, once: true });
    document.addEventListener("click", unlock, { passive: true, once: true });

    return () => {
      document.removeEventListener("touchstart", unlock);
      document.removeEventListener("click", unlock);
    };
  }, []);

  const extractVideoId = (input: string | null): string | null => {
    if (!input) return null;
    if (input.length === 11 && !input.includes("/") && !input.includes("?")) {
      return input;
    }
    try {
      const url = new URL(input, "https://dummy.local");
      const paramId = url.searchParams.get("videoId") || url.searchParams.get("v");
      if (paramId && paramId.length === 11) return paramId;
    } catch {}
    const match = input.match(/(?:youtu\.be\/|v\/|embed\/|watch\?v=|\/stream\?videoId=)([^#&?]{11})/);
    return match ? match[1] : null;
  };

  // Chargement du flux audio direct
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !playingUrl) return;

    const videoId = extractVideoId(playingUrl);
    if (!videoId) return;

    // Utilisation d'un CDN audio Invidious direct pour l'élément <audio>
    const directStreamUrl = `https://invidious.privacydev.net/latest_version?id=${videoId}&itag=140`;

    audio.src = directStreamUrl;
    audio.load();

    if (status === "playing") {
      audio.play().catch((err) => {
        console.warn("Erreur lecture audio:", err);
        // Fallback sur instance secondaire si la première est occupée
        audio.src = `https://yt.artemislena.eu/latest_version?id=${videoId}&itag=140`;
        audio.load();
        audio.play().catch((e) => setPlaybackError("Appuyez sur play pour lancer la musique"));
      });
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

  // Contrôle Volume
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
      onError={() => {
        setPlaybackError("Flux audio indisponible, réessayez.");
      }}
      style={{ display: "none" }}
    />
  );
}