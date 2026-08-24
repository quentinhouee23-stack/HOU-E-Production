"use client";

import React, { useEffect, useRef, useState } from "react";
import { useMusic } from "@/context/MusicContext";

// Liste de secours d'instances Piped qui acceptent les requêtes navigateur (CORS)
const PIPED_INSTANCES = [
  "https://pipedapi.kavin.rocks",
  "https://pipedapi.smnz.de",
  "https://api.piped.privacydev.net",
  "https://pipedapi.tokhmi.xyz"
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

  const audioRef = useRef<HTMLAudioElement>(null);
  const [isClient, setIsClient] = useState(false);
  const isAudioUnlocked = useRef(false);

  useEffect(() => {
    setIsClient(true);
  }, []);

  // 1. DÉVERROUILLAGE iOS
  useEffect(() => {
    const unlockAudio = () => {
      const audio = audioRef.current;
      if (audio && !isAudioUnlocked.current) {
        audio.src = "data:audio/wav;base64,UklGRigAAABXQVZFZm10IBIAAAABAAEARKwAAIhYAQACABAAAABkYXRhAgAAAAEA";
        audio.play().then(() => {
          audio.pause();
          isAudioUnlocked.current = true;
        }).catch(() => {});
      }
      document.removeEventListener("touchstart", unlockAudio);
      document.removeEventListener("click", unlockAudio);
    };

    document.addEventListener("touchstart", unlockAudio, { passive: true, once: true });
    document.addEventListener("click", unlockAudio, { passive: true, once: true });

    return () => {
      document.removeEventListener("touchstart", unlockAudio);
      document.removeEventListener("click", unlockAudio);
    };
  }, []);

  // 2. EXTRACTION ET RÉSOLUTION DU FLUX AUDIO
  const isDirectAudio = (url: string | null): boolean => {
    if (!url) return false;
    return url.endsWith(".mp3") || url.endsWith(".m4a") || url.includes("dzcdn.net") || url.includes("audio-preview");
  };

  const extractVideoId = (input: string | null): string | null => {
    if (!input || isDirectAudio(input)) return null;
    if (input.length === 11 && !input.includes("/")) return input;
    const match = input.match(/(?:youtu\.be\/|v\/|embed\/|watch\?v=|\/stream\?videoId=)([^#&?]{11})/);
    return match ? match[1] : null;
  };

  const getAudioStream = async (videoId: string) => {
    for (const instance of PIPED_INSTANCES) {
      try {
        const res = await fetch(`${instance}/streams/${videoId}`);
        if (!res.ok) continue;
        
        const data = await res.json();
        const audioStreams = data.audioStreams || [];
        
        // On privilégie le format M4A/MP4, parfait pour Safari iOS et PC
        const bestAudio = audioStreams.find((s: any) => s.mimeType?.includes("audio/mp4")) || audioStreams[0];
        
        if (bestAudio?.url) return bestAudio.url;
      } catch (e) {
        continue; // Si l'instance est HS, on passe à la suivante
      }
    }
    return null;
  };

  // 3. LOGIQUE DE LECTURE (S'exécute au changement de titre)
  useEffect(() => {
    const loadAndPlay = async () => {
      const audio = audioRef.current;
      if (!audio || !playingUrl) return;

      audio.pause();
      let finalUrl = playingUrl;

      // Si c'est un lien YouTube, on récupère le flux direct M4A en arrière-plan
      if (!isDirectAudio(playingUrl)) {
        const videoId = extractVideoId(playingUrl);
        if (!videoId) return;

        const streamUrl = await getAudioStream(videoId);
        if (!streamUrl) {
          setPlaybackError("Les serveurs audio sont temporairement surchargés.");
          return;
        }
        finalUrl = streamUrl;
      }

      audio.src = finalUrl;
      audio.load();

      if (status === "playing") {
        audio.play().catch((err) => {
          console.warn("[Autoplay bloqué par iOS]", err);
          setPlaybackError("Appuyez sur Play pour lancer la musique");
        });
      }
    };

    loadAndPlay();
  }, [playingUrl]);

  // 4. CONTRÔLES BASIQUES (Play, Pause, Volume, Barre de temps)
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    if (status === "playing") {
      audio.play().catch(() => {});
    } else if (status === "paused") {
      audio.pause();
    }
  }, [status]);

  useEffect(() => {
    if (audioRef.current) audioRef.current.volume = Math.max(0, Math.min(1, volume));
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
      onTimeUpdate={() => onProgress({ playedSeconds: audioRef.current?.currentTime ?? 0 })}
      onDurationChange={() => {
        const d = audioRef.current?.duration;
        if (d && isFinite(d)) onDuration(d);
      }}
      onEnded={onEnded}
      onError={() => setPlaybackError("Erreur de réseau : flux audio interrompu")}
      style={{ display: "none" }}
    />
  );
}