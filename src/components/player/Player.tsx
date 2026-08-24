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
  const playerRef = useRef<any>(null);
  const progressIntervalRef = useRef<any>(null);
  const isReadyRef = useRef(false);
  const pendingVideoIdRef = useRef<string | null>(null);

  useEffect(() => {
    setIsClient(true);
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

  // Déblocage WebKit iOS au premier tap
  useEffect(() => {
    const unlockWebKit = () => {
      if (playerRef.current && isReadyRef.current) {
        try {
          playerRef.current.playVideo();
          if (status !== "playing") {
            playerRef.current.pauseVideo();
          }
        } catch {}
      }
      document.removeEventListener("touchstart", unlockWebKit);
      document.removeEventListener("click", unlockWebKit);
    };

    document.addEventListener("touchstart", unlockWebKit, { passive: true, once: true });
    document.addEventListener("click", unlockWebKit, { passive: true, once: true });

    return () => {
      document.removeEventListener("touchstart", unlockWebKit);
      document.removeEventListener("click", unlockWebKit);
    };
  }, [status]);

  // Initialisation du lecteur
  useEffect(() => {
    if (!isClient) return;

    const createPlayer = () => {
      if (playerRef.current || !document.getElementById("yt-stealth-player")) return;

      playerRef.current = new window.YT.Player("yt-stealth-player", {
        height: "100%",
        width: "100%",
        playerVars: {
          autoplay: 1,
          controls: 0,
          disablekb: 1,
          fs: 0,
          playsinline: 1,
          enablejsapi: 1,
          rel: 0,
          origin: window.location.origin,
        },
        events: {
          onReady: () => {
            isReadyRef.current = true;
            if (pendingVideoIdRef.current) {
              playerRef.current.loadVideoById(pendingVideoIdRef.current);
            }
          },
          onStateChange: (event: any) => {
            if (event.data === 0) {
              onEnded();
            }
            if (event.data === 1) {
              const dur = playerRef.current.getDuration();
              if (dur && isFinite(dur)) {
                onDuration(dur);
              }
            }
          },
          onError: (event: any) => {
            console.warn("[YT Player Error]", event.data);
            if (event.data === 150 || event.data === 101) {
              setPlaybackError("Titre indisponible en streaming mobile");
            } else {
              setPlaybackError(`Erreur de lecture (${event.data})`);
            }
          },
        },
      });
    };

    if (window.YT && window.YT.Player) {
      createPlayer();
    } else {
      window.onYouTubeIframeAPIReady = createPlayer;
      if (!document.querySelector('script[src*="youtube.com/iframe_api"]')) {
        const script = document.createElement("script");
        script.src = "https://www.youtube.com/iframe_api";
        document.body.appendChild(script);
      }
    }

    return () => {
      if (progressIntervalRef.current) clearInterval(progressIntervalRef.current);
    };
  }, [isClient]);

  // Suivi temps de lecture
  useEffect(() => {
    if (status === "playing") {
      progressIntervalRef.current = setInterval(() => {
        if (playerRef.current?.getCurrentTime && isReadyRef.current) {
          const currentTime = playerRef.current.getCurrentTime();
          onProgress({ playedSeconds: currentTime || 0 });
        }
      }, 500);
    } else {
      if (progressIntervalRef.current) clearInterval(progressIntervalRef.current);
    }

    return () => {
      if (progressIntervalRef.current) clearInterval(progressIntervalRef.current);
    };
  }, [status, onProgress]);

  // Chargement d'une nouvelle musique
  useEffect(() => {
    const videoId = extractVideoId(playingUrl);
    if (!videoId) return;

    pendingVideoIdRef.current = videoId;

    if (!isReadyRef.current || !playerRef.current?.loadVideoById) return;

    if (status === "playing") {
      playerRef.current.loadVideoById(videoId);
    } else {
      playerRef.current.cueVideoById(videoId);
    }
  }, [playingUrl]);

  // Contrôles Play / Pause
  useEffect(() => {
    if (!isReadyRef.current || !playerRef.current) return;

    if (status === "playing") {
      playerRef.current.playVideo?.();
    } else if (status === "paused") {
      playerRef.current.pauseVideo?.();
    }
  }, [status]);

  // Contrôle Volume
  useEffect(() => {
    if (isReadyRef.current && playerRef.current?.setVolume) {
      playerRef.current.setVolume(Math.max(0, Math.min(100, volume * 100)));
    }
  }, [volume]);

  // Seek
  useEffect(() => {
    if (seekRequest !== null && isReadyRef.current && playerRef.current?.seekTo) {
      playerRef.current.seekTo(seekRequest, true);
      clearSeekRequest();
    }
  }, [seekRequest, clearSeekRequest]);

  if (!isClient) return null;

  return (
    // Présent dans le DOM pour satisfaire WebKit iOS, mais placé sous l'UI et invisible à l'œil nu
    <div
      style={{
        position: "fixed",
        bottom: 0,
        left: 0,
        width: "2px",
        height: "2px",
        opacity: 0.01,
        pointerEvents: "none",
        zIndex: -1,
        overflow: "hidden",
      }}
    >
      <div id="yt-stealth-player" />
    </div>
  );
}