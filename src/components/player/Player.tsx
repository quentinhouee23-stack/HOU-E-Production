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
    playingUrl, status, volume,
    onDuration, onProgress, onEnded,
    seekRequest, clearSeekRequest,
    setPlaybackError
  } = useMusic();

  const [isClient, setIsClient] = useState(false);
  const playerRef = useRef<any>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const progressIntervalRef = useRef<any>(null);
  const isReadyRef = useRef(false);
  const currentVideoIdRef = useRef<string | null>(null);

  useEffect(() => setIsClient(true), []);

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

  // Chargement de l'API YouTube Iframe
  useEffect(() => {
    if (!isClient) return;

    if (!window.YT) {
      const tag = document.createElement("script");
      tag.src = "https://www.youtube.com/iframe_api";
      const firstScriptTag = document.getElementsByTagName("script")[0];
      firstScriptTag?.parentNode?.insertBefore(tag, firstScriptTag);
    }

    const initPlayer = () => {
      if (!containerRef.current || playerRef.current) return;

      playerRef.current = new window.YT.Player("youtube-hidden-player", {
        height: "200",
        width: "200",
        playerVars: {
          autoplay: 1,
          controls: 0,
          disablekb: 1,
          fs: 0,
          playsinline: 1, // Crucial pour iOS
          enablejsapi: 1,
          origin: typeof window !== "undefined" ? window.location.origin : "",
          rel: 0,
        },
        events: {
          onReady: () => {
            isReadyRef.current = true;
            if (playerRef.current?.setVolume) {
              playerRef.current.setVolume(Math.max(0, Math.min(100, volume * 100)));
            }
            if (currentVideoIdRef.current && status === "playing") {
              playerRef.current.loadVideoById(currentVideoIdRef.current);
            }
          },
          onStateChange: (event: any) => {
            // 0 = Ended
            if (event.data === 0) {
              onEnded();
            }
            // 1 = Playing
            if (event.data === 1) {
              const dur = playerRef.current.getDuration();
              if (dur && isFinite(dur)) {
                onDuration(dur);
              }
            }
          },
          onError: (event: any) => {
            console.warn("Erreur lecture YouTube:", event.data);
            if (event.data === 150 || event.data === 101) {
              setPlaybackError("Titre non autorisé à la lecture externe par YouTube");
            } else {
              setPlaybackError(`Erreur lecture (${event.data})`);
            }
          },
        },
      });
    };

    if (window.YT && window.YT.Player) {
      initPlayer();
    } else {
      window.onYouTubeIframeAPIReady = initPlayer;
    }

    return () => {
      if (progressIntervalRef.current) clearInterval(progressIntervalRef.current);
    };
  }, [isClient]);

  // Suivi régulier de la progression
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

  // Chargement et déclenchement de la piste
  useEffect(() => {
    const videoId = getVideoId(playingUrl);
    if (!videoId) return;

    currentVideoIdRef.current = videoId;

    if (!isReadyRef.current || !playerRef.current?.loadVideoById) return;

    if (status === "playing") {
      playerRef.current.loadVideoById({ videoId });
      playerRef.current.playVideo();
    } else {
      playerRef.current.cueVideoById({ videoId });
    }
  }, [playingUrl]);

  // Gestion Play / Pause
  useEffect(() => {
    if (!isReadyRef.current || !playerRef.current) return;

    if (status === "playing" && playerRef.current.playVideo) {
      playerRef.current.playVideo();
    } else if (status === "paused" && playerRef.current.pauseVideo) {
      playerRef.current.pauseVideo();
    }
  }, [status]);

  // Gestion du volume
  useEffect(() => {
    if (isReadyRef.current && playerRef.current?.setVolume) {
      playerRef.current.setVolume(Math.max(0, Math.min(100, volume * 100)));
    }
  }, [volume]);

  // Progression (seek)
  useEffect(() => {
    if (seekRequest !== null && isReadyRef.current && playerRef.current?.seekTo) {
      playerRef.current.seekTo(seekRequest, true);
      clearSeekRequest();
    }
  }, [seekRequest, clearSeekRequest]);

  if (!isClient) return null;

  // Iframe active mais invisible visuellement pour satisfaire le moteur WebKit iOS
  return (
    <div
      style={{
        position: "fixed",
        bottom: 0,
        right: 0,
        width: "1px",
        height: "1px",
        opacity: 0.01,
        pointerEvents: "none",
        zIndex: -1,
      }}
    >
      <div id="youtube-hidden-player" ref={containerRef} />
    </div>
  );
}