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
  const isAudioUnlocked = useRef(false);

  useEffect(() => {
    setIsClient(true);
  }, []);

  // 1. DÉVERROUILLAGE iOS : Obligatoire pour autoriser la lecture asynchrone
  useEffect(() => {
    const unlockAudio = () => {
      const audio = audioRef.current;
      if (audio && !isAudioUnlocked.current) {
        // Lecture d'un micro-fichier silencieux au premier tap de l'utilisateur
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

  // 2. EXTRACTION ID ET FLUX DIRECT
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

  // Appel direct à Cobalt depuis le client (contourne Vercel et les blocages IP)
  const fetchCobaltStream = async (videoId: string) => {
    try {
      const res = await fetch("https://api.cobalt.tools/api/json", {
        method: "POST",
        headers: {
          "Accept": "application/json",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          url: `https://www.youtube.com/watch?v=${videoId}`,
          isAudioOnly: true,
          aFormat: "mp3", // Format universel iPhone / PC
        }),
      });
      
      const data = await res.json();
      return data.url || null;
    } catch (error) {
      console.error("[Cobalt Fetch Error]", error);
      return null;
    }
  };

  // 3. LOGIQUE DE LECTURE
  useEffect(() => {
    const loadAndPlay = async () => {
      const audio = audioRef.current;
      if (!audio || !playingUrl) return;

      audio.pause();
      
      let finalStreamUrl = playingUrl;

      // Si c'est un morceau YouTube, on le convertit en MP3 direct via Cobalt
      if (!isDirectAudio(playingUrl)) {
        const videoId = extractVideoId(playingUrl);
        if (!videoId) return;
        
        const mp3Url = await fetchCobaltStream(videoId);
        if (!mp3Url) {
          setPlaybackError("Impossible de générer le flux audio.");
          return;
        }
        finalStreamUrl = mp3Url;
      }

      audio.src = finalStreamUrl;
      audio.load();

      if (status === "playing") {
        audio.play().catch((err) => {
          console.warn("[Autoplay iOS bloqué, attente interaction]", err);
          setPlaybackError("Appuyez sur Play pour lancer (sécurité iOS)");
        });
      }
    };

    loadAndPlay();
  }, [playingUrl]); // S'exécute uniquement au changement de musique

  // 4. CONTRÔLES (Play / Pause / Volume / Seek)
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
      onError={() => setPlaybackError("Erreur de flux réseau.")}
      style={{ display: "none" }}
    />
  );
}