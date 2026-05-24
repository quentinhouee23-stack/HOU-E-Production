// @ts-nocheck
"use client";

import React, { useEffect, useRef, useState } from "react";
import { useMusic } from "@/context/MusicContext";

export function Player() {
  const { playingUrl: videoId, status, volume, onDuration, onProgress, onEnded, seekRequest, clearSeekRequest, playbackError, setPlaybackError } = useMusic();
  const [isClient, setIsClient] = useState(false);
  
  const playerContainerRef = useRef(null);
  const ytPlayerInstance = useRef(null);
  const progressInterval = useRef<NodeJS.Timeout | null>(null);
  const ghostAudioRef = useRef<HTMLAudioElement>(null);
  
  const isReady = useRef(false);
  const pendingVideoId = useRef<string | null>(null);

  const onEndedRef = useRef(onEnded);
  const onDurationRef = useRef(onDuration);
  const onProgressRef = useRef(onProgress);

  useEffect(() => { onEndedRef.current = onEnded; }, [onEnded]);
  useEffect(() => { onDurationRef.current = onDuration; }, [onDuration]);
  useEffect(() => { onProgressRef.current = onProgress; }, [onProgress]);

  useEffect(() => {
    setIsClient(true);

    const initPlayer = () => {
      ytPlayerInstance.current = new window.YT.Player(playerContainerRef.current, {
        width: "100", 
        height: "100",
        playerVars: {
          autoplay: 1, 
          controls: 0, 
          disablekb: 1, 
          fs: 0, 
          rel: 0, 
          modestbranding: 1,
          playsinline: 1, // Autorise la lecture sans passer en plein écran natif sur iOS
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
              const dur = event.target.getDuration();
              if (dur > 0) onDurationRef.current(dur);

              event.target.unMute();
              event.target.setVolume(volume * 100);

              if (progressInterval.current) clearInterval(progressInterval.current);
              progressInterval.current = setInterval(() => {
                const currentTime = event.target.getCurrentTime();
                onProgressRef.current({ playedSeconds: currentTime }); 
              }, 1000);
            } else {
              if (progressInterval.current) clearInterval(progressInterval.current);
            }
            
            if (event.data === window.YT.PlayerState.ENDED) {
              onEndedRef.current(); 
            }
          },
          onError: (event) => {
            console.error("YouTube Player Error", event.data);
            setPlaybackError("La vidéo a été bloquée par YouTube (droits d'auteur). Zapping...");
            setTimeout(() => {
              setPlaybackError(null);
              onEndedRef.current();
            }, 2000);
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

    return () => {
      if (progressInterval.current) clearInterval(progressInterval.current);
    };
  }, []);

  // 🟢 L'ASTUCE SONGSTERR : Force l'Audio fantôme pour maintenir la session lockscreen iOS
  useEffect(() => {
    const handleIOSUnlock = () => {
      if (ghostAudioRef.current && ghostAudioRef.current.paused) {
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
    <>
      {playbackError && (
        <div style={{
          position: "fixed", top: 0, left: 0, right: 0, zIndex: 99999,
          backgroundColor: "#ff0000", color: "#ffffff", padding: "15px",
          fontFamily: "monospace", fontSize: "14px", textAlign: "center",
          boxShadow: "0px 4px 10px rgba(0,0,0,0.5)"
        }}>
          <strong>🚨 {playbackError}</strong>
        </div>
      )}

      {/* 🟢 LA RUSE : L'iframe n'est PAS en display: none ! */}
      {/* Elle fait 1x1 pixel et est transparente. L'iPhone pense que c'est une vidéo légitime ! */}
      <div style={{
        position: "fixed",
        top: "0",
        left: "0",
        width: "1px",
        height: "1px",
        opacity: 0.01, 
        pointerEvents: "none",
        zIndex: 1, 
      }}>
        <div ref={playerContainerRef} />
      </div>

      {/* Leurre Audio pour l'écran de verrouillage */}
      <audio
        ref={ghostAudioRef}
        id="ghost-audio"
        src="data:audio/wav;base64,UklGRigAAABXQVZFZm10IBIAAAABAAEARKwAAIhYAQACABAAAABkYXRhAgAAAAEA"
        loop
        playsInline
      />
    </>
  );
}