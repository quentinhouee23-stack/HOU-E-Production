// @ts-nocheck
"use client";

import React, { useEffect, useRef, useState, useCallback } from "react";
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
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // 🔑 On stocke tout dans des refs pour éviter les stale closures dans les handlers d'erreur
  const urlsRef = useRef<string[]>([]);
  const urlIndexRef = useRef(0);
  const statusRef = useRef(status);
  const onEndedRef = useRef(onEnded);
  const volumeRef = useRef(volume);

  // Synchronisation des refs avec les props
  useEffect(() => { statusRef.current = status; }, [status]);
  useEffect(() => { onEndedRef.current = onEnded; }, [onEnded]);
  useEffect(() => { volumeRef.current = volume; }, [volume]);

  useEffect(() => { setIsClient(true); }, []);

  // 🔧 Fonction centrale de chargement d'une URL dans l'audio
  const tryPlayUrl = useCallback((index: number) => {
    const audio = audioRef.current;
    const url = urlsRef.current[index];
    if (!audio || !url) return;

    console.log(`▶️ Chargement serveur ${index + 1}/${urlsRef.current.length} : ${url.substring(0, 60)}...`);

    audio.src = url;
    audio.load();

    if (statusRef.current === "playing") {
      const playPromise = audio.play();
      if (playPromise !== undefined) {
        playPromise.catch((err) => {
          // NotAllowedError = navigateur bloque l'autoplay (pas une erreur réseau)
          if (err.name !== "NotAllowedError") {
            console.warn(`⚠️ Play échoué sur serveur ${index + 1}:`, err.message);
          }
        });
      }
    }
  }, []);

  // 🎵 Quand l'URL de lecture change : on reparse les serveurs et on repart de zéro
  useEffect(() => {
    const urls = playingUrl ? playingUrl.split(",").filter(Boolean) : [];
    urlsRef.current = urls;
    urlIndexRef.current = 0;

    if (urls.length > 0) {
      tryPlayUrl(0);
    } else {
      // Plus de chanson → on coupe l'audio
      const audio = audioRef.current;
      if (audio) {
        audio.pause();
        audio.src = "";
      }
    }
  }, [playingUrl, tryPlayUrl]);

  // ⏯️ Contrôle Play / Pause (sans recharger l'URL)
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    if (status === "playing") {
      // Si l'audio a une source et est en pause, on joue
      if (audio.src && audio.paused) {
        audio.play().catch((err) => {
          if (err.name !== "NotAllowedError") {
            console.warn("Reprise échouée:", err.message);
          }
        });
      }
    } else if (status === "paused" || status === "idle") {
      if (!audio.paused) {
        audio.pause();
      }
    }
  }, [status]);

  // 🔊 Volume
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = Math.max(0, Math.min(1, volume));
    }
  }, [volume]);

  // ⏩ Seek (barre de progression)
  useEffect(() => {
    if (seekRequest !== null && audioRef.current) {
      audioRef.current.currentTime = seekRequest;
      clearSeekRequest();
    }
  }, [seekRequest, clearSeekRequest]);

  // 📱 iOS Unlock — déclenché par le premier geste utilisateur via MusicContext
  useEffect(() => {
    const handleIosUnlock = () => {
      const audio = audioRef.current;
      if (!audio) return;

      // Si on a déjà une source et qu'on doit jouer, on lance directement
      if (statusRef.current === "playing" && audio.src && audio.paused) {
        audio.play().catch(() => {});
        return;
      }

      // Sinon, on fait un "silent play" pour déverrouiller le contexte audio iOS
      const savedVolume = audio.volume;
      audio.volume = 0;
      audio.play()
        .then(() => {
          audio.pause();
          audio.volume = savedVolume;
          // Si on avait une vraie source à jouer, on relance
          if (statusRef.current === "playing" && audio.src) {
            audio.volume = savedVolume;
            audio.play().catch(() => {});
          }
        })
        .catch(() => {
          audio.volume = savedVolume;
        });
    };

    window.addEventListener("iosUnlock", handleIosUnlock);
    return () => window.removeEventListener("iosUnlock", handleIosUnlock);
  }, []);

  // 🌙 Retour depuis veille / arrière-plan (iOS + Android)
  useEffect(() => {
    const handleVisibilityChange = () => {
      const audio = audioRef.current;
      if (!audio) return;

      if (!document.hidden && statusRef.current === "playing" && audio.paused && audio.src) {
        console.log("📱 Retour au premier plan — reprise de la lecture");
        audio.play().catch(() => {});
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => document.removeEventListener("visibilitychange", handleVisibilityChange);
  }, []);

  // 🔄 Gestion des erreurs : fallback vers le serveur suivant
  const handleError = useCallback(() => {
    const currentIndex = urlIndexRef.current;
    const urls = urlsRef.current;

    console.error(`❌ Serveur ${currentIndex + 1}/${urls.length} inaccessible (blocage réseau probable)`);

    if (currentIndex < urls.length - 1) {
      const nextIndex = currentIndex + 1;
      urlIndexRef.current = nextIndex;
      console.log(`🔄 Tentative serveur de secours ${nextIndex + 1}/${urls.length}...`);
      tryPlayUrl(nextIndex);
    } else {
      console.error("💀 Tous les serveurs ont échoué — passage à la piste suivante dans 2s");
      setTimeout(() => {
        onEndedRef.current();
      }, 2000);
    }
  }, [tryPlayUrl]);

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
        const audio = audioRef.current;
        if (audio && audio.duration > 0 && isFinite(audio.duration)) {
          onDuration(audio.duration);
        }
      }}
      onEnded={onEnded}
      onError={handleError}
      style={{ display: "none" }}
    />
  );
}