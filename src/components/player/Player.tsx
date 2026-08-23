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
  const hasUserInteractedRef = useRef(false);

  useEffect(() => {
    setIsClient(true);
  }, []);

  const getVideoId = (input: string | null): string | null => {
    if (!input) return null;
    if (input.length === 11 && !input.includes("/") && !input.includes("?")) {
      return input;
    }
    try {
      const parsedUrl = new URL(input, "https://dummy.local");
      const paramId = parsedUrl.searchParams.get("videoId") || parsedUrl.searchParams.get("v");
      if (paramId) return paramId;
    } catch {}
    const match = input.match(/(?:youtu\.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/);
    return match && match[1]?.length === 11 ? match[1] : null;
  };

  // 1. Déverrouillage audio pour iOS au premier tap n'importe où sur la page
  useEffect(() => {
    const unlockAudio = () => {
      hasUserInteractedRef.current = true;
      if (playerRef.current && isReadyRef.current) {
        try {
          playerRef.current.playVideo();
          if (status !== "playing") {
            playerRef.current.pauseVideo();
          }
        } catch {}
      }
      document.removeEventListener("touchstart", unlockAudio);
      document.removeEventListener("click", unlockAudio);
    };

    document.addEventListener("touchstart", unlockAudio, { passive: true });
    document.addEventListener("click", unlockAudio, { passive: true });

    return () => {
      document.removeEventListener("touchstart", unlockAudio);
      document.removeEventListener("click", unlockAudio);
    };
  }, [status]);

  // 2. Initialisation de l'API YouTube Iframe
  useEffect(() => {
    if (!isClient) return;

    const setupPlayer = () => {
      if (playerRef.current || !document.getElementById("yt-player-target")) return;

      playerRef.current = new window.YT.Player("yt-player-target", {
        height: "100%",
        width: "100%",
        playerVars: {
          autoplay: 1,
          controls: 0,
          disablekb: 1,
          fs: 0,
          playsinline: 1,
          enablejsapi: 1,
          origin: window.location.origin,
          rel: 0,
        },
        events: {
          onReady: () => {
            isReadyRef.current = true;
            if (playerRef.current?.setVolume) {
              playerRef.current.setVolume(Math.max(0, Math.min(100, volume * 100)));
            }
            const currentId = getVideoId(playingUrl);
            if (currentId && status === "playing") {
              playerRef.current.loadVideoById(currentId);
            }
          },
          onStateChange: (event: any) => {
            // 0 = ENDED
            if (event.data === 0) {
              onEnded();
            }
            // 1 = PLAYING
            if (event.data === 1) {
              const dur = playerRef.current.getDuration();
              if (dur && isFinite(dur)) {
                onDuration(dur);
              }
            }
          },
          onError: (event: any) => {
            console.warn("YouTube Player error:", event.data);
            if (event.data === 150 || event.data === 101) {
              setPlaybackError("Titre bloqué par YouTube pour l'intégration");
            } else {
              setPlaybackError(`Erreur de lecture (${event.data})`);
            }
          },
        },
      });
    };

    if (window.YT && window.YT.Player) {
      setupPlayer();
    } else {
      window.onYouTubeIframeAPIReady = setupPlayer;
      if (!document.querySelector('script[src*="youtube.com/iframe_api"]')) {
        const tag = document.createElement("script");
        tag.src = "https://www.youtube.com/iframe_api";
        document.body.appendChild(tag);
      }
    }

    return () => {
      if (progressIntervalRef.current) clearInterval(progressIntervalRef.current);
    };
  }, [isClient]);

  // 3. Suivi de progression
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

  // 4. Changement de morceau
  useEffect(() => {
    const videoId = getVideoId(playingUrl);
    if (!videoId || !isReadyRef.current || !playerRef.current?.loadVideoById) return;

    if (status === "playing") {
      playerRef.current.loadVideoById(videoId);
    } else {
      playerRef.current.cueVideoById(videoId);
    }
  }, [playingUrl]);

  // 5. Play / Pause
  useEffect(() => {
    if (!isReadyRef.current || !playerRef.current) return;

    if (status === "playing") {
      playerRef.current.playVideo?.();
    } else if (status === "paused") {
      playerRef.current.pauseVideo?.();
    }
  }, [status]);

  // 6. Volume
  useEffect(() => {
    if (isReadyRef.current && playerRef.current?.setVolume) {
      playerRef.current.setVolume(Math.max(0, Math.min(100, volume * 100)));
    }
  }, [volume]);

  // 7. Seek
  useEffect(() => {
    if (seekRequest !== null && isReadyRef.current && playerRef.current?.seekTo) {
      playerRef.current.seekTo(seekRequest, true);
      clearSeekRequest();
    }
  }, [seekRequest, clearSeekRequest]);

  if (!isClient) return null;

  return (
    <div
      style={{
        position: "fixed",
        bottom: 0,
        right: 0,
        width: "64px",
        height: "64px",
        opacity: 0.001,
        pointerEvents: "none",
        zIndex: -1,
      }}
    >
      <div id="yt-player-target" />
    </div>
  );
}