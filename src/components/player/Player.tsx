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

  // 🟢 LA RÉFÉRENCE DE L'AUDIO FANTÔME (Notre bouclier anti-veille)
  const ghostAudioRef = useRef<HTMLAudioElement>(null);
  
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
          autoplay: 0, 
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
              if (status === "playing") {
                event.target.loadVideoById(vidToLoad);
              } else {
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

      // 🟢 On lance l'audio fantôme et on le laisse tourner
      if (ghostAudioRef.current) {
        ghostAudioRef.current.play().catch(() => {});
      }
    };

    window.addEventListener("iosUnlock", handleIOSUnlock as EventListener);
    return () => window.removeEventListener("iosUnlock", handleIOSUnlock as EventListener);
  }, []);

  useEffect(() => {
    const player = ytPlayerInstance.current;
    if (!videoId || !player?.loadVideoById || !isReady.current) {
      if (videoId) pendingVideoId.current = videoId;
      return;
    }
    
    if (status === "playing") {
      player.loadVideoById(videoId);
    } else {
      player.cueVideoById(videoId);
    }
  }, [videoId]);

  // 🟢 SYNCHRONISATION DU LECTEUR ET DE L'AUDIO FANTÔME
  useEffect(() => {
    if (ytPlayerInstance.current && ytPlayerInstance.current.playVideo) {
      if (status === "playing") {
        ytPlayerInstance.current.playVideo();
        if (ghostAudioRef.current) {
          ghostAudioRef.current.play().catch(() => console.log("Ghost audio autoplay blocked"));
        }
      } else if (status === "paused" || status === "idle") {
        ytPlayerInstance.current.pauseVideo();
        if (ghostAudioRef.current) {
          ghostAudioRef.current.pause();
        }
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

  // 🟢 Forcer la reconnexion audio si le téléphone met brièvement l'app en pause
  useEffect(() => {
    const handleVisibility = () => {
      if (!document.hidden && status === "playing" && ytPlayerInstance.current?.playVideo) {
        ytPlayerInstance.current.playVideo();
        if (ghostAudioRef.current) ghostAudioRef.current.play().catch(() => {});
      }
    };
    document.addEventListener("visibilitychange", handleVisibility);
    return () => document.removeEventListener("visibilitychange", handleVisibility);
  }, [status]);

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
      
      {/*
        🟢 L'AUDIO FANTÔME
        - L'id="ghost-audio" est CRITIQUE : il permet au cleanup de MusicContext
          de l'exclure et de ne jamais le tuer lors d'un changement de piste.
        - Sans cet id, loadAndPlayUrl() tue cet élément à chaque chanson
          → session audio coupée → lecture stoppée en veille.
      */}
      <audio
        ref={ghostAudioRef}
        id="ghost-audio"
        src="data:audio/wav;base64,UklGRigAAABXQVZFZm10IBIAAAABAAEARKwAAIhYAQACABAAAABkYXRhAgAAAAEA"
        loop
        playsInline
      />
    </div>
  );
}