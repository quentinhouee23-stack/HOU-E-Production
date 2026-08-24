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
  const [isMobile, setIsMobile] = useState(false);
  
  const audioRef = useRef<HTMLAudioElement>(null);
  const ytPlayerRef = useRef<any>(null);
  const ytReadyRef = useRef(false);
  const isUnlockedRef = useRef(false);
  const progressIntervalRef = useRef<any>(null);

  useEffect(() => {
    setIsClient(true);
    // Détection basique pour adapter le camouflage (sans casser l'hydratation Next.js)
    setIsMobile(/iPhone|iPad|iPod|Android/i.test(navigator.userAgent));
  }, []);

  const isDirectAudio = (url: string | null) => {
    if (!url) return false;
    return url.includes(".mp3") || url.includes(".m4a") || url.includes("preview");
  };

  const getYTId = (url: string | null) => {
    if (!url || isDirectAudio(url)) return null;
    if (url.length === 11 && !url.includes("/")) return url;
    const m = url.match(/(?:youtu\.be\/|v\/|embed\/|watch\?v=|\?videoId=|&videoId=)([^#&?]{11})/);
    return m ? m[1] : null;
  };

  // 1. Déverrouillage strict
  useEffect(() => {
    const unlockBothPlayers = () => {
      if (isUnlockedRef.current) return;

      if (audioRef.current) {
        audioRef.current.play().catch(() => {});
        audioRef.current.pause();
      }

      if (ytReadyRef.current && ytPlayerRef.current && ytPlayerRef.current.getPlayerState) {
        try {
          ytPlayerRef.current.mute();
          ytPlayerRef.current.playVideo();
          setTimeout(() => {
            ytPlayerRef.current.pauseVideo();
            ytPlayerRef.current.unMute();
            isUnlockedRef.current = true;
          }, 50);
        } catch (e) {}
      }
    };

    window.addEventListener("touchstart", unlockBothPlayers, { once: true, passive: true });
    window.addEventListener("click", unlockBothPlayers, { once: true, passive: true });

    return () => {
      window.removeEventListener("touchstart", unlockBothPlayers);
      window.removeEventListener("click", unlockBothPlayers);
    };
  }, []);

  // 2. Initialisation YouTube
  useEffect(() => {
    if (!isClient) return;

    const initYT = () => {
      if (ytPlayerRef.current || !document.getElementById("yt-frame-container")) return;
      
      ytPlayerRef.current = new window.YT.Player("yt-frame-container", {
        // Dimensions adaptées selon l'appareil pour passer les sécurités sans alerter les Adblockers PC
        width: isMobile ? "250" : "100",
        height: isMobile ? "250" : "100",
        playerVars: { 
          autoplay: 0, 
          controls: 0, 
          disablekb: 1, 
          fs: 0, 
          playsinline: 1, 
          rel: 0,
          modestbranding: 1
        },
        events: {
          onReady: () => {
            ytReadyRef.current = true;
            ytPlayerRef.current.setVolume(Math.max(0, Math.min(100, volume * 100)));
            
            const id = getYTId(playingUrl);
            if (id && status === "playing") {
              ytPlayerRef.current.loadVideoById(id);
            }
          },
          onStateChange: (e: any) => {
            if (e.data === 0) onEnded();
            if (e.data === 1) {
              const d = ytPlayerRef.current.getDuration();
              if (d && isFinite(d)) onDuration(d);
            }
          },
          onError: (e: any) => {
            if (e.data === 150 || e.data === 101) {
              setPlaybackError("Titre bloqué en arrière-plan.");
            } else {
              setPlaybackError(`Erreur source (${e.data})`);
            }
          }
        }
      });
    };

    if (window.YT && window.YT.Player) {
      initYT();
    } else {
      window.onYouTubeIframeAPIReady = initYT;
      if (!document.getElementById("yt-api-script")) {
        const s = document.createElement("script");
        s.id = "yt-api-script";
        s.src = "https://www.youtube.com/iframe_api";
        document.body.appendChild(s);
      }
    }
  }, [isClient, isMobile]);

  // 3. Changement de musique
  useEffect(() => {
    if (!playingUrl) return;

    if (isDirectAudio(playingUrl)) {
      if (ytReadyRef.current && ytPlayerRef.current?.pauseVideo) {
        ytPlayerRef.current.pauseVideo();
      }
      if (audioRef.current) {
        if (audioRef.current.src !== playingUrl) {
          audioRef.current.src = playingUrl;
          audioRef.current.load();
        }
        if (status === "playing") audioRef.current.play().catch(() => {});
      }
    } else {
      if (audioRef.current) audioRef.current.pause();
      
      const videoId = getYTId(playingUrl);
      if (videoId && ytReadyRef.current && ytPlayerRef.current?.loadVideoById) {
        ytPlayerRef.current.loadVideoById(videoId);
        if (status === "playing") ytPlayerRef.current.playVideo();
      }
    }
  }, [playingUrl]);

  // 4. Play/Pause
  useEffect(() => {
    if (isDirectAudio(playingUrl)) {
      if (status === "playing") audioRef.current?.play().catch(() => {});
      else if (status === "paused") audioRef.current?.pause();
    } else {
      if (!ytReadyRef.current) return;
      if (status === "playing") ytPlayerRef.current?.playVideo?.();
      else if (status === "paused") ytPlayerRef.current?.pauseVideo?.();
    }
  }, [status]);

  // 5. Suivi du temps
  useEffect(() => {
    if (status === "playing") {
      progressIntervalRef.current = setInterval(() => {
        if (isDirectAudio(playingUrl) && audioRef.current) {
          onProgress({ playedSeconds: audioRef.current.currentTime || 0 });
        } else if (ytReadyRef.current && ytPlayerRef.current?.getCurrentTime) {
          onProgress({ playedSeconds: ytPlayerRef.current.getCurrentTime() || 0 });
        }
      }, 500);
    }
    return () => clearInterval(progressIntervalRef.current);
  }, [status, playingUrl]);

  // 6. Volume
  useEffect(() => {
    if (audioRef.current) audioRef.current.volume = Math.max(0, Math.min(1, volume));
    if (ytReadyRef.current && ytPlayerRef.current?.setVolume) {
      ytPlayerRef.current.setVolume(Math.max(0, Math.min(100, volume * 100)));
    }
  }, [volume]);

  // 7. Seek
  useEffect(() => {
    if (seekRequest !== null) {
      if (isDirectAudio(playingUrl) && audioRef.current) {
        audioRef.current.currentTime = seekRequest;
      } else if (ytReadyRef.current && ytPlayerRef.current?.seekTo) {
        ytPlayerRef.current.seekTo(seekRequest, true);
      }
      clearSeekRequest();
    }
  }, [seekRequest]);

  if (!isClient) return null;

  // Styles dynamiques pour satisfaire les PC (Adblockers) et iOS (WebKit)
  const containerStyle: React.CSSProperties = isMobile
    ? {
        position: "fixed",
        top: "50%",
        left: "50%",
        transform: "translate(-50%, -50%)",
        width: "250px",
        height: "250px",
        opacity: 0.001,
        pointerEvents: "none",
        zIndex: -50,
        overflow: "hidden"
      }
    : {
        position: "fixed",
        bottom: 0,
        left: "-9999px",
        width: "100px",
        height: "100px",
        opacity: 1, 
        pointerEvents: "none",
        zIndex: -1
      };

  return (
    <>
      <audio ref={audioRef} playsInline preload="auto" onEnded={onEnded} style={{ display: "none" }} />
      <div style={containerStyle}>
        <div id="yt-frame-container" />
      </div>
    </>
  );
}