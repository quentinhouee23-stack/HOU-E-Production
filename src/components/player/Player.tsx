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
        width: "10", 
        height: "10",
        playerVars: {
          autoplay: 1, 
          controls: 0, 
          disablekb: 1, 
          fs: 0, 
          rel: 0, 
          modestbranding: 1,
          playsinline: 1, // 🟢 INDISPENSABLE POUR IOS (Pas de plein écran forcé)
          enablejsapi: 1,
          origin: typeof window !== "undefined" ? window.location.origin : "http://localhost:3000"
        },
        events: {
          onReady: (event) => {
            // 🟢 HACK IOS : On s'assure que le lecteur est prêt à jouer avec le volume
            event.target.setVolume(volume * 100);
            
            // Si on a déjà une vidéo en attente quand le lecteur est prêt, on la charge
            if (videoId) {
              event.target.loadVideoById(videoId);
            }
          },
          onStateChange: (event) => {
            if (event.data === window.YT.PlayerState.PLAYING) {
              const duration = event.target.getDuration();
              if (duration > 0) onDurationRef.current(duration);

              // 🟢 SÉCURITÉ : On s'assure que la musique n'est pas muette quand elle démarre
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

  // 🟢 On s'assure de bien charger la nouvelle vidéo quand l'ID change
  useEffect(() => {
    if (ytPlayerInstance.current && ytPlayerInstance.current.loadVideoById && videoId) {
      ytPlayerInstance.current.loadVideoById(videoId);
    }
  }, [videoId]);

  useEffect(() => {
    if (ytPlayerInstance.current && ytPlayerInstance.current.playVideo) {
      if (status === "playing") {
        ytPlayerInstance.current.playVideo();
      } else if (status === "paused") {
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
    // 🟢 SÉCURITÉ IOS : On ne cache plus complètement l'IFrame hors écran, on la rend juste invisible.
    // Parfois Safari bloque les éléments situés à -1000px
    <div style={{ position: 'fixed', top: 0, left: 0, width: 1, height: 1, opacity: 0.01, pointerEvents: 'none', zIndex: -1 }}>
      <div ref={playerContainerRef}></div>
    </div>
  );
}