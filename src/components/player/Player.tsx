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

  // Chargement de l'API YouTube
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
          rel: 0,
        },
        events: {
          onReady: () => {
            isReadyRef.current = true;
            const currentId = getVideoId(playingUrl);
            if (currentId && status === "playing") {
              playerRef.current.loadVideoById(currentId);
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
            console.warn("YouTube Player error:", event.data);
            if (event.data === 150 || event.data === 101) {
              setPlaybackError("Titre restreint par le label sur mobile");
            } else {
              setPlaybackError(`Erreur lecture (${event.data})`);
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

  // Suivi de la progression
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

  // Changement de morceau
  useEffect(() => {
    const videoId = getVideoId(playingUrl);
    if (!videoId || !isReadyRef.current || !playerRef.current?.loadVideoById) return;

    if (status === "playing") {
      playerRef.current.loadVideoById(videoId);
    } else {
      playerRef.current.cueVideoById(videoId);
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

  // Volume (bureau uniquement, ignoré silencieusement par iOS)
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
    <div
      style={{
        position: "fixed",
        bottom: "80px",
        right: "12px",
        width: "120px",
        height: "68px",
        borderRadius: "8px",
        overflow: "hidden",
        boxShadow: "0 4px 12px rgba(0,0,0,0.3)",
        zIndex: 50,
        backgroundColor: "#000",
      }}
    >
      <div id="yt-player-target" style={{ width: "100%", height: "100%" }} />
    </div>
  );
}