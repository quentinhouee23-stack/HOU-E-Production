// @ts-nocheck
"use client";

import React, { useEffect, useRef, useState } from "react";
import { useMusic } from "@/context/MusicContext";

export function Player() {
  const { playingUrl, status, volume, onDuration, onProgress, onEnded, seekRequest, clearSeekRequest } = useMusic();
  const [isClient, setIsClient] = useState(false);

  const playerContainerRef = useRef(null);
  const ytPlayerInstance = useRef(null);
  const progressInterval = useRef(null);

  const isReady = useRef(false);
  const pendingVideoId = useRef<string | null>(null);

  const onEndedRef = useRef(onEnded);
  const onDurationRef = useRef(onDuration);
  const onProgressRef = useRef(onProgress);

  useEffect(() => { onEndedRef.current = onEnded; }, [onEnded]);
  useEffect(() => { onDurationRef.current = onDuration; }, [onDuration]);
  useEffect(() => { onProgressRef.current = onProgress; }, [onProgress]);

  const videoId = playingUrl ? playingUrl.split("v=")[1]?.split("&")[0] : null;

  useEffect(() => {
    setIsClient(true);

    const initPlayer = () => {
      ytPlayerInstance.current = new window.YT.Player(playerContainerRef.current, {
        width: "2",
        height: "2",
        playerVars: {
          autoplay: 0,        // ← désactivé : on gère manuellement
          controls: 0,
          disablekb: 1,
          fs: 0,
          rel: 0,
          modestbranding: 1,
          playsinline: 1,     // ← indispensable iOS
          enablejsapi: 1,
          origin: typeof window !== "undefined" ? window.location.origin : "", // ← plus de localhost hardcodé
        },
        events: {
          onReady: (event) => {
            isReady.current = true;
            event.target.setVolume(volume * 100);

            if (pendingVideoId.current) {
              event.target.loadVideoById(pendingVideoId.current);
              pendingVideoId.current = null;
            } else if (videoId) {
              event.target.loadVideoById(videoId);
            }
          },
          onStateChange: (event) => {
            if (event.data === window.YT.PlayerState.PLAYING) {
              const duration = event.target.getDuration();
              if (duration > 0) onDurationRef.current(duration);

              event.target.unMute();
              event.target.setVolume(volume * 100);

              clearInterval(progressInterval.current);
              progressInterval.current = setInterval(() => {
                const currentTime = event.target.getCurrentTime();
                onProgressRef.current({ playedSeconds: currentTime });
              }, 1000);
            } else {
              clearInterval(progressInterval.current);
            }

            if (event.data === window.YT.PlayerState.ENDED) {
              onEndedRef.current();
            }
          },
          onError: () => onEndedRef.current(),
        },
      });
    };

    if (!window.YT) {
      const script = document.createElement("script");
      script.src = "https://www.youtube.com/iframe_api";
      document.body.appendChild(script);
      window.onYouTubeIframeAPIReady = initPlayer;
    } else if (window.YT?.Player && !ytPlayerInstance.current) {
      initPlayer();
    }

    return () => clearInterval(progressInterval.current);
  }, []);

  // iOS UNLOCK — reçoit le videoId directement depuis l'événement
  useEffect(() => {
    const handleIOSUnlock = (e: CustomEvent) => {
      const player = ytPlayerInstance.current;
      if (!player?.playVideo) return;

      const vId = e.detail?.videoId;
      if (vId) {
        // Cache hit : charge ET joue dans la fenêtre gestuelle iOS ✅
        player.loadVideoById(vId);
      } else {
        // Cache miss : warm-up seulement, loadVideoById viendra après le fetch
        player.playVideo();
      }
    };

    window.addEventListener("iosUnlock", handleIOSUnlock as EventListener);
    return () => window.removeEventListener("iosUnlock", handleIOSUnlock as EventListener);
  }, []);

  // Changement de vidéo
  useEffect(() => {
    const player = ytPlayerInstance.current;
    if (!videoId || !player?.loadVideoById || !isReady.current) {
      if (videoId) pendingVideoId.current = videoId;
      return;
    }
    player.loadVideoById(videoId);
  }, [videoId]);

  // Play / Pause
  useEffect(() => {
    const player = ytPlayerInstance.current;
    if (!player) return;
    if (status === "playing") player.playVideo?.();
    else if (status === "paused") player.pauseVideo?.();
  }, [status]);

  // Volume
  useEffect(() => {
    ytPlayerInstance.current?.setVolume?.(volume * 100);
  }, [volume]);

  // Seek
  useEffect(() => {
    if (seekRequest !== null) {
      ytPlayerInstance.current?.seekTo?.(seekRequest, true);
      clearSeekRequest();
    }
  }, [seekRequest, clearSeekRequest]);

  if (!isClient) return null;

  return (
    // 🟢 HACK VISUEL IOS : Le lecteur DOIT être "visible" pour que Safari autorise l'autoplay.
    // On le met en plein milieu de l'écran, taille 100x100, mais quasiment transparent (0.001).
    // Surtout pas de scale(0) ou de zIndex: -1 !
    <div style={{
      position: "fixed",
      top: "50%",
      left: "50%",
      transform: "translate(-50%, -50%)",
      width: "100px",
      height: "100px",
      opacity: 0.001, 
      pointerEvents: "none",
      zIndex: 1, 
    }}>
      <div ref={playerContainerRef} />
    </div>
  );
}