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
  const currentIdRef = useRef<string | null>(null);

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

  // Initialisation propre de l'API YouTube
  useEffect(() => {
    if (!isClient) return;

    const onYouTubeReady = () => {
      if (playerRef.current) return;

      playerRef.current = new window.YT.Player("yt-master-player", {
        height: "200",
        width: "200",
        videoId: "M7lc1UVf-VE", // Vidéo d'amorce standard pour instancier le moteur
        playerVars: {
          autoplay: 0,
          controls: 0,
          disablekb: 1,
          fs: 0,
          playsinline: 1,
          enablejsapi: 1,
          rel: 0,
        },
        events: {
          onReady: () => {
            isReadyRef.current = true;
            if (playerRef.current?.setVolume) {
              playerRef.current.setVolume(Math.max(0, Math.min(100, volume * 100)));
            }
            if (currentIdRef.current) {
              playerRef.current.loadVideoById(currentIdRef.current);
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
              setPlaybackError("Titre non diffusable sur lecteur externe.");
            } else {
              setPlaybackError(`Erreur (${event.data})`);
            }
          },
        },
      });
    };

    if (window.YT && window.YT.Player) {
      onYouTubeReady();
    } else {
      window.onYouTubeIframeAPIReady = onYouTubeReady;
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

  // Suivi de lecture
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

  // Détection du changement de musique
  useEffect(() => {
    const videoId = extractVideoId(playingUrl);
    if (!videoId) return;

    currentIdRef.current = videoId;

    if (!isReadyRef.current || !playerRef.current?.loadVideoById) return;

    playerRef.current.loadVideoById(videoId);
    if (status === "playing") {
      playerRef.current.playVideo();
    }
  }, [playingUrl]);

  // Play / Pause
  useEffect(() => {
    if (!isReadyRef.current || !playerRef.current) return;

    if (status === "playing") {
      playerRef.current.playVideo?.();
    } else if (status === "paused") {
      playerRef.current.pauseVideo?.();
    }
  }, [status]);

  // Volume
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
    // Dimensions réelles pour initialiser le moteur YouTube, mais placé derrière l'application
    <div
      style={{
        position: "fixed",
        bottom: 0,
        right: 0,
        width: "200px",
        height: "200px",
        zIndex: -999,
        opacity: 0.001,
        pointerEvents: "none",
      }}
    >
      <div id="yt-master-player" />
    </div>
  );
}