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

  useEffect(() => setIsClient(true), []);

  // Extraction du videoId (supporte ID direct, URL YouTube, ou paramètre ?videoId=)
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
    return match && match[1].length === 11 ? match[1] : null;
  };

  // Chargement du script YouTube Iframe API
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

      playerRef.current = new window.YT.Player(containerRef.current, {
        height: "1",
        width: "1",
        playerVars: {
          autoplay: 0,
          controls: 0,
          disablekb: 1,
          fs: 0,
          playsinline: 1,
          rel: 0,
        },
        events: {
          onReady: () => {
            isReadyRef.current = true;
            if (playerRef.current?.setVolume) {
              playerRef.current.setVolume(volume * 100);
            }
          },
          onStateChange: (event: any) => {
            // YT.PlayerState.ENDED === 0
            if (event.data === 0) {
              onEnded();
            }
            // YT.PlayerState.PLAYING === 1
            if (event.data === 1) {
              const dur = playerRef.current.getDuration();
              if (dur && isFinite(dur)) {
                onDuration(dur);
              }
            }
          },
          onError: (event: any) => {
            console.warn("Erreur lecteur YouTube:", event.data);
            setPlaybackError(`Erreur lecture YouTube (code ${event.data})`);
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

  // Suivi de progression du temps de lecture
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

  // Chargement et lecture lors du changement de piste
  useEffect(() => {
    const videoId = getVideoId(playingUrl);
    if (!videoId || !isReadyRef.current || !playerRef.current?.loadVideoById) return;

    playerRef.current.loadVideoById(videoId);

    if (status === "playing") {
      playerRef.current.playVideo();
    } else {
      playerRef.current.pauseVideo();
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

  // Gestion du volume (0 à 100 pour YouTube API)
  useEffect(() => {
    if (isReadyRef.current && playerRef.current?.setVolume) {
      playerRef.current.setVolume(Math.max(0, Math.min(1, volume)) * 100);
    }
  }, [volume]);

  // Gestion de la barre de progression (seek)
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
        top: -9999,
        left: -9999,
        width: "1px",
        height: "1px",
        opacity: 0,
        pointerEvents: "none",
      }}
    >
      <div ref={containerRef} />
    </div>
  );
}