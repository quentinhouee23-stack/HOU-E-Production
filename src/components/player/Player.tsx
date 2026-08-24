"use client";

import React, { useEffect, useRef, useState } from "react";
import { useMusic } from "@/context/MusicContext";

declare global {
  interface Window {
    YT: any;
    onYouTubeIframeAPIReady: () => void;
  }
}

// Serveurs relais pour contourner les musiques bloquées par les labels
const AUDIO_RELAYS = [
  "https://vid.puffyan.us",
  "https://inv.tux.pizza",
  "https://invidious.flokinet.to",
  "https://invidious.nerdvpn.de"
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
  const [fallback, setFallback] = useState({ url: "", active: false, index: 0 });
  
  const audioRef = useRef<HTMLAudioElement>(null);
  const ytPlayerRef = useRef<any>(null);
  const ytReadyRef = useRef(false);
  const isUnlockedRef = useRef(false);
  const progressIntervalRef = useRef<any>(null);

  useEffect(() => {
    setIsClient(true);
  }, []);

  // Détection des formats natifs
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

  // 1. Réinitialisation du lecteur à chaque changement de piste
  useEffect(() => {
    setFallback({ url: playingUrl || "", active: false, index: 0 });
  }, [playingUrl]);

  // 2. Déverrouillage iOS global
  useEffect(() => {
    const unlock = () => {
      if (isUnlockedRef.current) return;
      if (audioRef.current) {
        audioRef.current.play().catch(() => {});
        audioRef.current.pause();
      }
      if (ytReadyRef.current && ytPlayerRef.current && ytPlayerRef.current.playVideo) {
        try {
          ytPlayerRef.current.mute();
          ytPlayerRef.current.playVideo();
          ytPlayerRef.current.pauseVideo();
          ytPlayerRef.current.unMute();
          isUnlockedRef.current = true;
        } catch (e) {}
      }
    };

    const events = ["touchstart", "touchend", "click"];
    events.forEach(e => document.addEventListener(e, unlock, { once: true, passive: true }));
    return () => events.forEach(e => document.removeEventListener(e, unlock));
  }, []);

  // 3. Initialisation YouTube
  useEffect(() => {
    if (!isClient) return;

    const initYT = () => {
      if (ytPlayerRef.current || !document.getElementById("yt-frame-container")) return;
      
      ytPlayerRef.current = new window.YT.Player("yt-frame-container", {
        width: "250",
        height: "250",
        playerVars: { autoplay: 0, controls: 0, disablekb: 1, fs: 0, playsinline: 1, rel: 0, modestbranding: 1 },
        events: {
          onReady: () => {
            ytReadyRef.current = true;
            ytPlayerRef.current.setVolume(Math.max(0, Math.min(100, volume * 100)));
            // Si une musique attend d'être lancée
            if (fallback.url && !fallback.active && !isDirectAudio(fallback.url)) {
              const id = getYTId(fallback.url);
              if (id) {
                ytPlayerRef.current.loadVideoById(id);
                if (status === "playing") ytPlayerRef.current.playVideo();
              }
            }
          },
          onStateChange: (e: any) => {
            if (e.data === 0) onEnded();
            if (e.data === 1) {
              const d = ytPlayerRef.current.getDuration();
              if (d && isFinite(d)) onDuration(d);
            }
          },
          onError: (e: any) => {
            // ERREUR 150/101 : Titre bloqué par le label. On active automatiquement le relais audio de secours !
            if (e.data === 150 || e.data === 101) {
              console.warn("Titre bloqué par les droits d'auteur, bascule sur les serveurs relais...");
              setFallback(prev => ({ ...prev, active: true, index: 0 }));
            } else {
              setPlaybackError(`Erreur vidéo YouTube (${e.data})`);
            }
          }
        }
      });
    };

    if (window.YT && window.YT.Player) {
      initYT();
    } else {
      window.onYouTubeIframeAPIReady = initYT;
      if (!document.getElementById("yt-api-script")) {
        const s = document.createElement("script");
        s.id = "yt-api-script";
        s.src = "https://www.youtube.com/iframe_api";
        document.body.appendChild(s);
      }
    }
  }, [isClient, volume]); // eslint-disable-line

  // 4. Chargement & Aiguillage Automatique
  useEffect(() => {
    if (!fallback.url) return;
    
    if (isDirectAudio(fallback.url) || fallback.active) {
      // Moteur Natif HTML5 (Aperçus OU Fallback Relais)
      if (ytReadyRef.current && ytPlayerRef.current?.pauseVideo) {
        ytPlayerRef.current.pauseVideo();
      }
      
      if (audioRef.current) {
        let targetSrc = fallback.url;
        if (fallback.active) {
          const id = getYTId(fallback.url);
          targetSrc = `${AUDIO_RELAYS[fallback.index]}/latest_version?id=${id}&itag=140`;
        }

        if (audioRef.current.src !== targetSrc) {
          audioRef.current.src = targetSrc;
          audioRef.current.load();
          if (status === "playing") {
            audioRef.current.play().catch(() => {});
          }
        }
      }
    } else {
      // Moteur YouTube Officiel
      if (audioRef.current) audioRef.current.pause();
      
      const videoId = getYTId(fallback.url);
      if (videoId && ytReadyRef.current && ytPlayerRef.current?.loadVideoById) {
        const currentUrl = ytPlayerRef.current.getVideoUrl?.() || "";
        if (!currentUrl.includes(videoId)) {
          ytPlayerRef.current.loadVideoById(videoId);
        }
        if (status === "playing") ytPlayerRef.current.playVideo();
      }
    }
  }, [fallback, status]);

  // 5. Gestion des pannes de relais (si la musique de secours plante)
  const handleAudioError = () => {
    if (fallback.active) {
      if (fallback.index + 1 < AUDIO_RELAYS.length) {
        setFallback(prev => ({ ...prev, index: prev.index + 1 })); // Passe au serveur suivant
      } else {
        if (setPlaybackError) setPlaybackError("Musique strictement protégée et serveurs de secours pleins.");
      }
    }
  };

  // 6. Play/Pause
  useEffect(() => {
    if (!fallback.url) return;
    if (isDirectAudio(fallback.url) || fallback.active) {
      if (status === "playing") audioRef.current?.play().catch(() => {});
      else if (status === "paused") audioRef.current?.pause();
    } else {
      if (!ytReadyRef.current) return;
      if (status === "playing") ytPlayerRef.current?.playVideo?.();
      else if (status === "paused") ytPlayerRef.current?.pauseVideo?.();
    }
  }, [status, fallback]);

  // 7. Progression, Volume et Seek
  useEffect(() => {
    if (status === "playing") {
      progressIntervalRef.current = setInterval(() => {
        if (isDirectAudio(fallback.url) || fallback.active) {
          if (audioRef.current) onProgress({ playedSeconds: audioRef.current.currentTime || 0 });
        } else {
          if (ytReadyRef.current && ytPlayerRef.current?.getCurrentTime) {
            onProgress({ playedSeconds: ytPlayerRef.current.getCurrentTime() || 0 });
          }
        }
      }, 500);
    }
    return () => clearInterval(progressIntervalRef.current);
  }, [status, fallback, onProgress]);

  useEffect(() => {
    if (audioRef.current) audioRef.current.volume = Math.max(0, Math.min(1, volume));
    if (ytReadyRef.current && ytPlayerRef.current?.setVolume) {
      ytPlayerRef.current.setVolume(Math.max(0, Math.min(100, volume * 100)));
    }
  }, [volume]);

  useEffect(() => {
    if (seekRequest !== null) {
      if (isDirectAudio(fallback.url) || fallback.active) {
        if (audioRef.current) audioRef.current.currentTime = seekRequest;
      } else if (ytReadyRef.current && ytPlayerRef.current?.seekTo) {
        ytPlayerRef.current.seekTo(seekRequest, true);
      }
      clearSeekRequest();
    }
  }, [seekRequest, fallback, clearSeekRequest]);

  if (!isClient) return null;

  return (
    <>
      <audio ref={audioRef} playsInline preload="auto" onEnded={onEnded} onError={handleAudioError} style={{ display: "none" }} />
      <div
        style={{
          position: "fixed",
          top: 0,
          left: 0,
          width: "250px",
          height: "250px",
          pointerEvents: "none",
          zIndex: -50,
          clipPath: "inset(100%)"
        }}
      >
        <div id="yt-frame-container" />
      </div>
    </>
  );
}