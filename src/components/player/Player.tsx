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
  const [isPlaying, setIsPlaying] = useState(false);
  const playerRef = useRef<any>(null);
  const progressIntervalRef = useRef<any>(null);
  const isReadyRef = useRef(false);
  const pendingIdRef = useRef<string | null>(null);

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

  useEffect(() => {
    if (!isClient) return;

    const setupPlayer = () => {
      if (playerRef.current || !document.getElementById("yt-frame")) return;

      playerRef.current = new window.YT.Player("yt-frame", {
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
            if (playerRef.current?.setVolume) {
              playerRef.current.setVolume(Math.max(0, Math.min(100, volume * 100)));
            }
            if (pendingIdRef.current) {
              playerRef.current.loadVideoById(pendingIdRef.current);
            }
          },
          onStateChange: (event: any) => {
            // 0 = Terminé
            if (event.data === 0) {
              setIsPlaying(false);
              onEnded();
            }
            // 1 = En lecture
            if (event.data === 1) {
              setIsPlaying(true);
              const dur = playerRef.current.getDuration();
              if (dur && isFinite(dur)) {
                onDuration(dur);
              }
            }
            // 2 = En pause
            if (event.data === 2) {
              setIsPlaying(false);
            }
          },
          onError: (event: any) => {
            console.warn("[YT Error]:", event.data);
            if (event.data === 150 || event.data === 101) {
              setPlaybackError("Titre bloqué par les droits d'auteur sur mobile");
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

  // Progression
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

  // Changement de piste
  useEffect(() => {
    const videoId = extractVideoId(playingUrl);
    if (!videoId) return;

    pendingIdRef.current = videoId;

    if (!isReadyRef.current || !playerRef.current?.loadVideoById) return;

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

  // Déblocage tactile direct pour iOS
  const handleDirectPlay = () => {
    if (playerRef.current) {
      if (pendingIdRef.current) {
        playerRef.current.loadVideoById(pendingIdRef.current);
      }
      playerRef.current.playVideo();
    }
  };

  if (!isClient) return null;

  return (
    <>
      {/* Conteneur Iframe : dimensionné à 100% mais rendu discret sous les éléments */}
      <div
        style={{
          position: "fixed",
          bottom: "75px",
          left: "8px",
          width: "48px",
          height: "48px",
          borderRadius: "6px",
          overflow: "hidden",
          opacity: isPlaying ? 0.05 : 0.9,
          zIndex: 30,
          pointerEvents: isPlaying ? "none" : "auto",
          transition: "opacity 0.2s ease",
        }}
        onClick={handleDirectPlay}
      >
        <div id="yt-frame" style={{ width: "100%", height: "100%" }} />
      </div>
    </>
  );
}