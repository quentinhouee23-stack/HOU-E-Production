"use client";

import React, { useEffect, useRef, useState } from "react";
import { useMusic } from "@/context/MusicContext";

declare global {
  interface Window {
    YT: any;
    onYouTubeIframeAPIReady: () => void;
  }
}

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
  const [fallbackStreamUrl, setFallbackStreamUrl] = useState<string | null>(null);
  
  const audioRef = useRef<HTMLAudioElement>(null);
  const ytPlayerRef = useRef<any>(null);
  const ytReadyRef = useRef(false);
  const isUnlockedRef = useRef(false);
  const progressIntervalRef = useRef<any>(null);

  // Utilisation de Refs pour éviter les "stale closures" dans l'API YouTube
  const playingUrlRef = useRef(playingUrl);
  const statusRef = useRef(status);
  const setPlaybackErrorRef = useRef(setPlaybackError);

  useEffect(() => { playingUrlRef.current = playingUrl; }, [playingUrl]);
  useEffect(() => { statusRef.current = status; }, [status]);
  useEffect(() => { setPlaybackErrorRef.current = setPlaybackError; }, [setPlaybackError]);
  useEffect(() => { setIsClient(true); }, []);

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

  // 1. Déverrouillage IOS : initialisation silencieuse au premier contact
  useEffect(() => {
    const unlock = () => {
      if (isUnlockedRef.current) return;
      if (audioRef.current) {
        audioRef.current.src = "data:audio/wav;base64,UklGRigAAABXQVZFZm10IBIAAAABAAEARKwAAIhYAQACABAAAABkYXRhAgAAAAEA";
        audioRef.current.play().then(() => {
          audioRef.current?.pause();
        }).catch(() => {});
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

  // 2. Résolveur de flux de secours pour les musiques bloquées (comme Calvin Harris)
  const resolveFallbackStream = async (videoId: string): Promise<string | null> => {
    const PIPED_APIS = [
      "https://pipedapi.kavin.rocks",
      "https://pipedapi.smnz.de",
      "https://pipedapi.adminforge.de",
      "https://piped-api.lunar.icu"
    ];

    for (const api of PIPED_APIS) {
      try {
        const res = await fetch(`${api}/streams/${videoId}`);
        if (!res.ok) continue;
        const data = await res.json();
        const audioStreams = data.audioStreams || [];
        // On récupère le format natif MP4/M4A idéal pour WebKit (iOS) et PC
        const bestAudio = audioStreams.find((s: any) => s.mimeType?.includes("audio/mp4")) || audioStreams[0];
        if (bestAudio?.url) return bestAudio.url;
      } catch (e) {
        console.warn(`Le relais API ${api} a échoué, essai du suivant...`);
      }
    }
    return `https://inv.tux.pizza/latest_version?id=${videoId}&itag=140`;
  };

  // 3. Initialisation de l'API Iframe YouTube
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
            const id = getYTId(playingUrlRef.current);
            if (id && statusRef.current === "playing") {
              ytPlayerRef.current.loadVideoById(id);
            }
          },
          onStateChange: (e: any) => {
            if (e.data === 0) onEnded();
            if (e.data === 1) {
              const d = ytPlayerRef.current.getDuration();
              if (d && isFinite(d)) onDuration(d);
            }
          },
          onError: async (e: any) => {
            // ERREUR 150 : Titre bloqué (ex: Calvin Harris). On extrait le flux audio via Piped.
            if (e.data === 150 || e.data === 101) {
              const currentId = getYTId(playingUrlRef.current);
              if (currentId) {
                const streamUrl = await resolveFallbackStream(currentId);
                if (streamUrl) {
                  setFallbackStreamUrl(streamUrl); // Déclenche le plan de secours natif
                } else {
                  if (setPlaybackErrorRef.current) setPlaybackErrorRef.current("Le titre est strictement protégé par le label de l'artiste.");
                }
              }
            } else {
              if (setPlaybackErrorRef.current) setPlaybackErrorRef.current(`Erreur source vidéo (${e.data})`);
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
  }, [isClient]);

  // 4. Gestion du changement de musique principal
  useEffect(() => {
    setFallbackStreamUrl(null); // On reset le plan de secours quand on change de titre
    if (!playingUrl) return;

    if (isDirectAudio(playingUrl)) {
      if (ytReadyRef.current && ytPlayerRef.current?.pauseVideo) ytPlayerRef.current.pauseVideo();
      if (audioRef.current && audioRef.current.src !== playingUrl) {
        audioRef.current.src = playingUrl;
        audioRef.current.load();
      }
    } else {
      if (audioRef.current) audioRef.current.pause();
      const videoId = getYTId(playingUrl);
      if (videoId && ytReadyRef.current && ytPlayerRef.current?.loadVideoById) {
        const currentUrl = ytPlayerRef.current.getVideoUrl?.() || "";
        if (!currentUrl.includes(videoId)) {
          ytPlayerRef.current.loadVideoById(videoId);
        }
      }
    }
  }, [playingUrl]);

  // 5. Activation du flux audio de secours (Fallback)
  useEffect(() => {
    if (fallbackStreamUrl && audioRef.current) {
      if (ytReadyRef.current && ytPlayerRef.current?.pauseVideo) {
        ytPlayerRef.current.pauseVideo(); // On coupe l'iframe définitivement pour ce titre
      }
      audioRef.current.src = fallbackStreamUrl;
      audioRef.current.load();
    }
  }, [fallbackStreamUrl]);

  // 6. Synchronisation Play / Pause globale
  useEffect(() => {
    if (isDirectAudio(playingUrl) || fallbackStreamUrl) {
      if (status === "playing") audioRef.current?.play().catch(() => {});
      else if (status === "paused") audioRef.current?.pause();
    } else {
      if (!ytReadyRef.current) return;
      if (status === "playing") ytPlayerRef.current?.playVideo?.();
      else if (status === "paused") ytPlayerRef.current?.pauseVideo?.();
    }
  }, [status, playingUrl, fallbackStreamUrl]);

  // 7. Suivi du temps de progression
  useEffect(() => {
    if (status === "playing") {
      progressIntervalRef.current = setInterval(() => {
        if (isDirectAudio(playingUrl) || fallbackStreamUrl) {
          if (audioRef.current) onProgress({ playedSeconds: audioRef.current.currentTime || 0 });
        } else {
          if (ytReadyRef.current && ytPlayerRef.current?.getCurrentTime) {
            onProgress({ playedSeconds: ytPlayerRef.current.getCurrentTime() || 0 });
          }
        }
      }, 500);
    }
    return () => clearInterval(progressIntervalRef.current);
  }, [status, playingUrl, fallbackStreamUrl]);

  // 8. Volume
  useEffect(() => {
    if (audioRef.current) audioRef.current.volume = Math.max(0, Math.min(1, volume));
    if (ytReadyRef.current && ytPlayerRef.current?.setVolume) {
      ytPlayerRef.current.setVolume(Math.max(0, Math.min(100, volume * 100)));
    }
  }, [volume]);

  // 9. Barre de recherche (Seek)
  useEffect(() => {
    if (seekRequest !== null) {
      if (isDirectAudio(playingUrl) || fallbackStreamUrl) {
        if (audioRef.current) audioRef.current.currentTime = seekRequest;
      } else if (ytReadyRef.current && ytPlayerRef.current?.seekTo) {
        ytPlayerRef.current.seekTo(seekRequest, true);
      }
      clearSeekRequest();
    }
  }, [seekRequest, fallbackStreamUrl, playingUrl]);

  if (!isClient) return null;

  return (
    <>
      <audio ref={audioRef} playsInline preload="auto" onEnded={onEnded} style={{ display: "none" }} />
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