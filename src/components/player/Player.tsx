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
        width: "100", 
        height: "100",
        playerVars: {
          autoplay: 0, // 🟢 SÉCURITÉ : On s'assure que l'autoplay brut est désactivé
          controls: 0, 
          disablekb: 1, 
          fs: 0, 
          rel: 0, 
          modestbranding: 1,
          playsinline: 1,
          enablejsapi: 1,
          origin: typeof window !== "undefined" ? window.location.origin : "http://localhost:3000"
        },
        events: {
          onReady: (event) => {
            isReady.current = true;
            event.target.setVolume(volume * 100);
            
            const vidToLoad = pendingVideoId.current || videoId;
            if (vidToLoad) {
              // 🟢 CORRECTION PC : On ne lance la vidéo QUE si le statut est déjà sur "playing"
              if (status === "playing") {
                event.target.loadVideoById(vidToLoad);
              } else {
                // cueVideoById charge la vidéo en fond sans la lancer
                event.target.cueVideoById(vidToLoad);
              }
              pendingVideoId.current = null;
            }
          },
          onStateChange: (event) => {
            if (event.data === window.YT.PlayerState.PLAYING) {
              const duration = event.target.getDuration();
              if (duration > 0) onDurationRef.current(duration);

              event.target.unMute();
              event.target.setVolume(volume * 100);

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
          onError: (event) => {
            onEndedRef.current(); 
          }
        }
      });
    };

    if (!window.YT) {
      const script = document.createElement("script");
      script.src = "https://www.youtube.com/iframe_api";
      document.body.appendChild(script);
      window.onYouTubeIframeAPIReady = initPlayer;
    } else if (window.YT && window.YT.Player && !ytPlayerInstance.current) {
      initPlayer();
    }

    return () => clearInterval(progressInterval.current);
  }, []);

  // HACK IOS
  useEffect(() => {
    const handleIOSUnlock = (e: CustomEvent) => {
      const player = ytPlayerInstance.current;
      if (!player?.playVideo) return;

      const vId = e.detail?.videoId;
      if (vId) {
        player.loadVideoById(vId);
      } else {
        player.playVideo();
      }
    };

    window.addEventListener("iosUnlock", handleIOSUnlock as EventListener);
    return () => window.removeEventListener("iosUnlock", handleIOSUnlock as EventListener);
  }, []);

  // Changement de vidéo géré par React
  useEffect(() => {
    const player = ytPlayerInstance.current;
    if (!videoId || !player?.loadVideoById || !isReady.current) {
      if (videoId) pendingVideoId.current = videoId;
      return;
    }
    
    // 🟢 CORRECTION PC : On prépare la vidéo sans la forcer si on est sur pause
    if (status === "playing") {
      player.loadVideoById(videoId);
    } else {
      player.cueVideoById(videoId);
    }
  }, [videoId]);

  useEffect(() => {
    if (ytPlayerInstance.current && ytPlayerInstance.current.playVideo) {
      if (status === "playing") {
        ytPlayerInstance.current.playVideo();
      } else if (status === "paused" || status === "idle") {
        ytPlayerInstance.current.pauseVideo();
      }
    }
  }, [status]);

  useEffect(() => {
    if (ytPlayerInstance.current && ytPlayerInstance.current.setVolume) {
      ytPlayerInstance.current.setVolume(volume * 100);
    }
  }, [volume]);

  useEffect(() => {
    if (seekRequest !== null && ytPlayerInstance.current && ytPlayerInstance.current.seekTo) {
      ytPlayerInstance.current.seekTo(seekRequest, true);
      clearSeekRequest();
    }
  }, [seekRequest, clearSeekRequest]);

  if (!isClient) return null;

  return (
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