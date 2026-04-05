// @ts-nocheck
"use client";

import React, { useEffect, useRef, useState } from "react";
import { useMusic } from "@/context/MusicContext";

/*
  🟢 POURQUOI CE FICHIER A ÉTÉ ENTIÈREMENT RÉÉCRIT :
  
  L'ancien Player utilisait un iframe YouTube (YT.Player).
  iOS Safari bloque systématiquement la lecture audio des iframes cross-origin
  (youtube.com ≠ ton domaine) quand l'app passe en arrière-plan ou en veille.
  Le "ghost audio" ne peut pas contourner cette limitation système.

  La preview fonctionnait parce qu'elle utilise un <audio> natif avec une URL MP3
  directe. iOS supporte nativement le background playback pour les <audio> natifs.

  Solution : utiliser un <audio> natif avec l'URL audio directe fournie par
  l'API Invidious. Aucun hack, aucun ghost audio, aucun Web Audio API nécessaire.
  iOS gère ça nativement et parfaitement.
*/

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
  const lastUrlRef = useRef<string | null>(null);

  useEffect(() => setIsClient(true), []);

  // 🟢 Chargement d'une nouvelle URL audio
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !playingUrl) return;

    // On ne recharge que si l'URL a vraiment changé
    if (playingUrl === lastUrlRef.current) return;
    lastUrlRef.current = playingUrl;

    audio.src = playingUrl;
    audio.load();

    if (status === "playing") {
      audio.play().catch((err) => {
        console.warn("Autoplay bloqué :", err);
      });
    }
  }, [playingUrl]);

  // 🟢 Synchronisation play/pause
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !playingUrl) return;

    if (status === "playing") {
      // play() est idempotent — pas de problème à l'appeler si déjà en lecture
      audio.play().catch((err) => console.warn("play() bloqué :", err));
    } else if (status === "paused" || status === "idle") {
      audio.pause();
    }
  }, [status, playingUrl]);

  // 🟢 Volume
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = Math.max(0, Math.min(1, volume));
    }
  }, [volume]);

  // 🟢 Seek
  useEffect(() => {
    if (seekRequest !== null && audioRef.current) {
      audioRef.current.currentTime = seekRequest;
      clearSeekRequest();
    }
  }, [seekRequest, clearSeekRequest]);

  // 🟢 Reprise après retour au premier plan (lock screen, changement d'app)
  // Avec un <audio> natif, iOS gère déjà la reprise automatiquement via MediaSession.
  // Ce handler est un filet de sécurité supplémentaire.
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
      // 🟢 preload="auto" : le navigateur pré-charge le fichier audio
      // ce qui améliore la réactivité et réduit les coupures en faible réseau
      preload="auto"
      onTimeUpdate={() => {
        const audio = audioRef.current;
        if (audio) {
          onProgress({ playedSeconds: audio.currentTime });
        }
      }}
      onDurationChange={() => {
        const audio = audioRef.current;
        if (audio && audio.duration > 0 && isFinite(audio.duration)) {
          onDuration(audio.duration);
        }
      }}
      onEnded={onEnded}
      onError={(e) => {
        console.error("Erreur audio :", e);
        // En cas d'erreur (URL expirée, réseau...), on passe à la piste suivante
        onEnded();
      }}
      // Invisible mais présent dans le DOM pour que iOS le détecte correctement
      style={{ display: "none" }}
    />
  );
}