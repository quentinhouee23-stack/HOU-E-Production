// @ts-nocheck
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
  } = useMusic();

  const [isClient, setIsClient] = useState(false);
  const audioRef = useRef<HTMLAudioElement>(null);
  
  // 🟢 LECTEUR INTELLIGENT : Gestion de la liste des serveurs de secours
  const [urlIndex, setUrlIndex] = useState(0);
  const audioUrls = playingUrl ? playingUrl.split(',') : [];
  const currentAudioUrl = audioUrls[urlIndex] || "";

  useEffect(() => setIsClient(true), []);

  // Remet le compteur de serveurs à zéro à chaque nouvelle chanson
  useEffect(() => {
    setUrlIndex(0);
  }, [playingUrl]);

  // Chargement du lien
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !currentAudioUrl) return;

    audio.src = currentAudioUrl;
    audio.load();

    if (status === "playing") {
      audio.play().catch((err) => console.warn("Autoplay bloqué :", err));
    }
  }, [currentAudioUrl]);

  // Play / Pause
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !currentAudioUrl) return;

    if (status === "playing") {
      audio.play().catch(() => {});
    } else if (status === "paused" || status === "idle") {
      audio.pause();
    }
  }, [status, currentAudioUrl]);

  // Volume
  useEffect(() => {
    if (audioRef.current) audioRef.current.volume = Math.max(0, Math.min(1, volume));
  }, [volume]);

  // Barre de progression (Seek)
  useEffect(() => {
    if (seekRequest !== null && audioRef.current) {
      audioRef.current.currentTime = seekRequest;
      clearSeekRequest();
    }
  }, [seekRequest, clearSeekRequest]);

  // Éveil depuis l'écran de verrouillage
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
        if (audioRef.current) onProgress({ playedSeconds: audioRef.current.currentTime });
      }}
      onDurationChange={() => {
        if (audioRef.current && audioRef.current.duration > 0 && isFinite(audioRef.current.duration)) {
          onDuration(audioRef.current.duration);
        }
      }}
      onEnded={onEnded}
      onError={(e) => {
        console.error(`❌ Serveur ${urlIndex + 1} échoué. Cause : blocage réseau.`);
        
        // 🟢 MAGIE : Si un serveur échoue, on glisse discrètement vers le suivant !
        if (urlIndex < audioUrls.length - 1) {
          console.log(`🔄 Essai du serveur de secours ${urlIndex + 2}...`);
          setUrlIndex((prev) => prev + 1);
        } else {
          console.error("💀 Tous les serveurs ont échoué, on zappe la chanson.");
          // Délai de 2 secondes pour éviter la boucle infinie de skip !
          setTimeout(() => onEnded(), 2000);
        }
      }}
      style={{ display: "none" }}
    />
  );
}