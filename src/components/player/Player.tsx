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
        width: "0",
        height: "0",
        playerVars: {
          autoplay: 1, controls: 0, disablekb: 1, fs: 0, rel: 0, modestbranding: 1,
          origin: typeof window !== "undefined" ? window.location.origin : "http://localhost:3000"
        },
        events: {
          onReady: (event) => {
            event.target.setVolume(volume * 100);
          },
          onStateChange: (event) => {
            if (event.data === window.YT.PlayerState.PLAYING) {
              const duration = event.target.getDuration();
              if (duration > 0) onDurationRef.current(duration);

              progressInterval.current = setInterval(() => {
                const currentTime = event.target.getCurrentTime();
                onProgressRef.current({ playedSeconds: currentTime }); // Le Context gère ça silencieusement maintenant !
              }, 1000);
            } else {
              clearInterval(progressInterval.current);
            }
            
            if (event.data === window.YT.PlayerState.ENDED) {
              onEndedRef.current(); 
            }
          },
          onError: (event) => {
            console.error("Erreur de lecture YouTube :", event.data);
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
    } else if (window.YT && window.YT.Player) {
      initPlayer();
    }

    return () => clearInterval(progressInterval.current);
  }, []);

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
    <div style={{ position: 'fixed', top: -1000, left: -1000, opacity: 0, pointerEvents: 'none' }}>
      <div ref={playerContainerRef}></div>
    </div>
  );
}