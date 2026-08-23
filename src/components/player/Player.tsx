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
  const [needsTouchUnlock, setNeedsTouchUnlock] = useState(false);
  const playerRef = useRef<any>(null);
  const progressIntervalRef = useRef<any>(null);
  const isReadyRef = useRef(false);
  const targetVideoIdRef = useRef<string | null>(null);

  useEffect(() => {
    setIsClient(true);
  }, []);

  // Extraction robuste de l'ID vidéo (11 caractères)
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

  // 1. Initialisation de l'API YouTube dès le chargement initial
  useEffect(() => {
    if (!isClient) return;

    const init = () => {
      if (playerRef.current || !document.getElementById("yt-player-container")) return;

      playerRef.current = new window.YT.Player("yt-player-container", {
        height: "100%",
        width: "100%",
        playerVars: {
          autoplay: 0,
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
            if (targetVideoIdRef.current && status === "playing") {
              tryPlayVideo(targetVideoIdRef.current);
            }
          },
          onStateChange: (event: any) => {
            // 0 = Ended
            if (event.data === 0) {
              onEnded();
            }
            // 1 = Playing
            if (event.data === 1) {
              setNeedsTouchUnlock(false);
              const dur = playerRef.current.getDuration();
              if (dur && isFinite(dur)) {
                onDuration(dur);
              }
            }
          },
          onError: (event: any) => {
            console.warn("[YouTube Player error]:", event.data);
            if (event.data === 150 || event.data === 101) {
              setPlaybackError("Titre bloqué par le label pour l'intégration mobile.");
            } else {
              setPlaybackError(`Erreur lecture YouTube (code ${event.data})`);
            }
          },
        },
      });
    };

    if (window.YT && window.YT.Player) {
      init();
    } else {
      window.onYouTubeIframeAPIReady = init;
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

  // Fonction pour lancer la vidéo en gérant les restrictions iOS
  const tryPlayVideo = (id: string) => {
    if (!playerRef.current || !isReadyRef.current) return;

    try {
      playerRef.current.loadVideoById(id);
      const playPromise = playerRef.current.playVideo();
      if (playPromise && typeof playPromise.catch === "function") {
        playPromise.catch(() => {
          // L'autoplay asynchrone a été bloqué par Safari
          setNeedsTouchUnlock(true);
        });
      }
    } catch {
      setNeedsTouchUnlock(true);
    }
  };

  // 2. Réaction au changement de morceau
  useEffect(() => {
    const videoId = extractVideoId(playingUrl);
    if (!videoId) return;

    targetVideoIdRef.current = videoId;

    if (isReadyRef.current) {
      if (status === "playing") {
        tryPlayVideo(videoId);
      } else {
        playerRef.current?.cueVideoById(videoId);
      }
    }
  }, [playingUrl]);

  // 3. Play / Pause
  useEffect(() => {
    if (!isReadyRef.current || !playerRef.current) return;

    if (status === "playing") {
      try {
        playerRef.current.playVideo?.();
      } catch {
        setNeedsTouchUnlock(true);
      }
    } else if (status === "paused") {
      playerRef.current.pauseVideo?.();
      setNeedsTouchUnlock(false);
    }
  }, [status]);

  // 4. Suivi de progression
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

  // 5. Seek
  useEffect(() => {
    if (seekRequest !== null && isReadyRef.current && playerRef.current?.seekTo) {
      playerRef.current.seekTo(seekRequest, true);
      clearSeekRequest();
    }
  }, [seekRequest, clearSeekRequest]);

  // Déblocage explicite si iOS a bloqué l'autoplay après l'appel API async
  const handleManualUnlock = () => {
    if (playerRef.current) {
      if (targetVideoIdRef.current) {
        playerRef.current.loadVideoById(targetVideoIdRef.current);
      }
      playerRef.current.playVideo();
      setNeedsTouchUnlock(false);
    }
  };

  if (!isClient) return null;

  return (
    <>
      {/* Conteneur Iframe YouTube visible pour valider WebKit iOS */}
      <div
        style={{
          position: "fixed",
          bottom: "90px",
          right: "12px",
          width: "140px",
          height: "80px",
          borderRadius: "8px",
          overflow: "hidden",
          boxShadow: "0 4px 14px rgba(0,0,0,0.5)",
          zIndex: 40,
          backgroundColor: "#000",
        }}
      >
        <div id="yt-player-container" style={{ width: "100%", height: "100%" }} />
      </div>

      {/* Bouton de secours iOS (apparaît uniquement si Safari refuse l'autoplay async) */}
      {needsTouchUnlock && (
        <div
          style={{
            position: "fixed",
            bottom: "180px",
            left: "50%",
            transform: "translateX(-50%)",
            backgroundColor: "#22c55e",
            color: "#fff",
            padding: "10px 18px",
            borderRadius: "9999px",
            fontWeight: 600,
            fontSize: "14px",
            boxShadow: "0 4px 12px rgba(0,0,0,0.4)",
            cursor: "pointer",
            zIndex: 100,
          }}
          onClick={handleManualUnlock}
        >
          ▶ Appuyer pour démarrer l’audio sur iPhone
        </div>
      )}
    </>
  );
}