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
  const [engine, setEngine] = useState<"none" | "youtube" | "native">("none");
  const [nativeSrc, setNativeSrc] = useState<string | null>(null);
  const [ytId, setYtId] = useState<string | null>(null);
  const [ytReady, setYtReady] = useState(false);

  const audioRef = useRef<HTMLAudioElement>(null);
  const ytPlayerRef = useRef<any>(null);
  const ytReadyRef = useRef(false);
  const isUnlockedRef = useRef(false);
  const progressIntervalRef = useRef<any>(null);

  // Refs pour les callbacks asynchrones YT (évite les stale closures)
  const playingUrlRef = useRef(playingUrl);
  const setPlaybackErrorRef = useRef(setPlaybackError);

  useEffect(() => { playingUrlRef.current = playingUrl; }, [playingUrl]);
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

  // 1. Déverrouillage iOS
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
          setTimeout(() => {
            ytPlayerRef.current.pauseVideo();
            ytPlayerRef.current.unMute();
          }, 50);
        } catch (e) {}
      }
      isUnlockedRef.current = true;
    };

    const events = ["touchstart", "touchend", "click"];
    events.forEach(e => document.addEventListener(e, unlock, { once: true, passive: true }));
    return () => events.forEach(e => document.removeEventListener(e, unlock));
  }, []);

  // 2. Résolveur de flux M4A pour les musiques bloquées
  const resolveFallbackStream = async (videoId: string): Promise<string | null> => {
    const PIPED_APIS = [
      "https://pipedapi.kavin.rocks",
      "https://pipedapi.smnz.de",
      "https://api.piped.privacydev.net",
      "https://pipedapi.tokhmi.xyz",
      "https://pipedapi.adminforge.de"
    ];

    for (const api of PIPED_APIS) {
      try {
        const res = await fetch(`${api}/streams/${videoId}`);
        if (!res.ok) continue;
        const data = await res.json();
        const audioStreams = data.audioStreams || [];
        const bestAudio = audioStreams.find((s: any) => s.mimeType?.includes("audio/mp4")) || audioStreams[0];
        if (bestAudio?.url) return bestAudio.url;
      } catch (e) {
        // Continue vers le prochain serveur
      }
    }
    return null;
  };

  // 3. Initialisation de l'API YouTube
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
            setYtReady(true);
            ytPlayerRef.current.setVolume(Math.max(0, Math.min(100, volume * 100)));
          },
          onStateChange: (e: any) => {
            if (e.data === 0) onEnded();
            if (e.data === 1) {
              const d = ytPlayerRef.current.getDuration();
              if (d && isFinite(d)) onDuration(d);
            }
          },
          onError: async (e: any) => {
            if (e.data === 150 || e.data === 101) {
              const currentId = getYTId(playingUrlRef.current);
              if (currentId) {
                const streamUrl = await resolveFallbackStream(currentId);
                if (streamUrl) {
                  setNativeSrc(streamUrl);
                  setEngine("native");
                } else {
                  if (setPlaybackErrorRef.current) setPlaybackErrorRef.current("Titre protégé et relais de secours inaccessibles.");
                }
              }
            } else {
              if (setPlaybackErrorRef.current) setPlaybackErrorRef.current(`Erreur YT (${e.data})`);
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

  // 4. Aiguillage lors du changement de titre
  useEffect(() => {
    if (!playingUrl) {
      setEngine("none");
      return;
    }
    if (isDirectAudio(playingUrl)) {
      setNativeSrc(playingUrl);
      setEngine("native");
    } else {
      const id = getYTId(playingUrl);
      if (id) {
        setYtId(id);
        setEngine("youtube"); // Toujours tenter YouTube en premier
      }
    }
  }, [playingUrl]);

  // 5. Exécution du moteur actif (Play/Pause/Load)
  useEffect(() => {
    if (engine === "native") {
      if (ytReadyRef.current && ytPlayerRef.current?.pauseVideo) {
        ytPlayerRef.current.pauseVideo();
      }
      const audio = audioRef.current;
      if (audio && nativeSrc) {
        if (audio.src !== nativeSrc) {
          audio.src = nativeSrc;
          audio.load();
        }
        if (status === "playing") {
          audio.play().catch(() => {});
        } else if (status === "paused") {
          audio.pause();
        }
      }
    } else if (engine === "youtube") {
      if (audioRef.current) audioRef.current.pause();
      
      if (ytReady && ytPlayerRef.current?.loadVideoById && ytId) {
        const currentUrl = ytPlayerRef.current.getVideoUrl?.() || "";
        if (!currentUrl.includes(ytId)) {
          ytPlayerRef.current.loadVideoById(ytId);
        }
        if (status === "playing") {
          ytPlayerRef.current.playVideo();
        } else if (status === "paused") {
          ytPlayerRef.current.pauseVideo();
        }
      }
    }
  }, [engine, nativeSrc, ytId, status, ytReady]);

  // 6. Synchronisation de la progression
  useEffect(() => {
    if (status === "playing") {
      progressIntervalRef.current = setInterval(() => {
        if (engine === "native" && audioRef.current) {
          onProgress({ playedSeconds: audioRef.current.currentTime || 0 });
        } else if (engine === "youtube" && ytReady && ytPlayerRef.current?.getCurrentTime) {
          onProgress({ playedSeconds: ytPlayerRef.current.getCurrentTime() || 0 });
        }
      }, 500);
    }
    return () => clearInterval(progressIntervalRef.current);
  }, [status, engine, ytReady, onProgress]);

  // 7. Volume
  useEffect(() => {
    if (audioRef.current) audioRef.current.volume = Math.max(0, Math.min(1, volume));
    if (ytReady && ytPlayerRef.current?.setVolume) {
      ytPlayerRef.current.setVolume(Math.max(0, Math.min(100, volume * 100)));
    }
  }, [volume, ytReady]);

  // 8. Barre de recherche temporelle (Seek)
  useEffect(() => {
    if (seekRequest !== null) {
      if (engine === "native" && audioRef.current) {
        audioRef.current.currentTime = seekRequest;
      } else if (engine === "youtube" && ytReady && ytPlayerRef.current?.seekTo) {
        ytPlayerRef.current.seekTo(seekRequest, true);
      }
      clearSeekRequest();
    }
  }, [seekRequest, engine, ytReady, clearSeekRequest]);

  if (!isClient) return null;

  return (
    <>
      <audio 
        ref={audioRef} 
        playsInline 
        preload="auto" 
        onEnded={onEnded} 
        onError={() => {
          if (engine === "native" && !isDirectAudio(playingUrlRef.current)) {
            if (setPlaybackError) setPlaybackError("Le flux audio de secours a été interrompu.");
          }
        }}
        style={{ display: "none" }} 
      />
      
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