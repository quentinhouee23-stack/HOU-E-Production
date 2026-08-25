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
    // 🟢 Utilisation des vrais noms de ton MusicContext
    currentTrack, 
    togglePlayPause,   
    playNext,     
    playPrev      
  } = useMusic();

  const [isClient, setIsClient] = useState(false);
  const audioRef = useRef<HTMLAudioElement>(null);
  const ytPlayerRef = useRef<any>(null);
  const ytReadyRef = useRef(false);
  const isUnlockedRef = useRef(false);
  const progressIntervalRef = useRef<any>(null);

  useEffect(() => {
    setIsClient(true);
  }, []);

  const isDirectAudio = (url: string | null) => {
    if (!url) return false;
    return url.includes(".mp3") || url.includes(".m4a") || url.includes("preview") || url.includes("dzcdn.net");
  };

  const getYTId = (url: string | null) => {
    if (!url || isDirectAudio(url)) return null;
    if (url.length === 11 && !url.includes("/")) return url;
    const m = url.match(/(?:youtu\.be\/|v\/|embed\/|watch\?v=|\?videoId=|&videoId=)([^#&?]{11})/);
    return m ? m[1] : null;
  };

  // 1. Déverrouillage iOS synchrone global
  useEffect(() => {
    const unlock = () => {
      if (isUnlockedRef.current) return;

      if (audioRef.current) {
        audioRef.current.play().catch(() => {});
        audioRef.current.pause();
      }

      if (ytReadyRef.current && ytPlayerRef.current && ytPlayerRef.current.playVideo) {
        try {
          ytPlayerRef.current.mute();
          ytPlayerRef.current.playVideo();
          ytPlayerRef.current.pauseVideo();
          ytPlayerRef.current.unMute();
          isUnlockedRef.current = true;
        } catch (e) {}
      }
    };

    const events = ["touchstart", "touchend", "click"];
    events.forEach(e => document.addEventListener(e, unlock, { once: true, passive: true }));

    return () => {
      events.forEach(e => document.removeEventListener(e, unlock));
    };
  }, []);

  // 2. Initialisation YouTube
  useEffect(() => {
    if (!isClient) return;

    const initYT = () => {
      if (ytPlayerRef.current || !document.getElementById("yt-frame-container")) return;
      
      ytPlayerRef.current = new window.YT.Player("yt-frame-container", {
        width: "250",
        height: "250",
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
              setPlaybackError("Titre bloqué en arrière-plan par le label.");
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
  }, [isClient]);

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

  // 🟢 8. MEDIA SESSION API (ÉCRAN DE VERROUILLAGE & ARRIÈRE-PLAN)
  useEffect(() => {
    if ("mediaSession" in navigator && currentTrack) {
      navigator.mediaSession.metadata = new window.MediaMetadata({
        title: currentTrack.title || "Titre inconnu",
        artist: currentTrack.artist || "Artiste inconnu",
        album: "HOUÉE",
        artwork: [
          { src: currentTrack.image || "/logo.png", sizes: "512x512", type: "image/png" }
        ]
      });

      navigator.mediaSession.setActionHandler("play", () => {
        if (togglePlayPause) togglePlayPause();
      });
      navigator.mediaSession.setActionHandler("pause", () => {
        if (togglePlayPause) togglePlayPause();
      });
      navigator.mediaSession.setActionHandler("previoustrack", () => {
        if (playPrev) playPrev();
      });
      navigator.mediaSession.setActionHandler("nexttrack", () => {
        if (playNext) playNext();
      });
      
      navigator.mediaSession.setActionHandler("seekto", (details) => {
        if (details.seekTime && onProgress) {
           if (isDirectAudio(playingUrl) && audioRef.current) {
             audioRef.current.currentTime = details.seekTime;
           } else if (ytReadyRef.current && ytPlayerRef.current?.seekTo) {
             ytPlayerRef.current.seekTo(details.seekTime, true);
           }
        }
      });
    }
    
    return () => {
      if ("mediaSession" in navigator) {
        navigator.mediaSession.setActionHandler("play", null);
        navigator.mediaSession.setActionHandler("pause", null);
        navigator.mediaSession.setActionHandler("previoustrack", null);
        navigator.mediaSession.setActionHandler("nexttrack", null);
        navigator.mediaSession.setActionHandler("seekto", null);
      }
    };
  }, [currentTrack, togglePlayPause, playNext, playPrev, playingUrl]);

  if (!isClient) return null;

  return (
    <>
      <audio ref={audioRef} playsInline preload="auto" onEnded={onEnded} style={{ display: "none" }} />
      <div
        style={{
          position: "fixed",
          top: 0,
          left: 0,
          width: "250px",
          height: "250px",
          pointerEvents: "none",
          zIndex: -50,
          clipPath: "inset(100%)"
        }}
      >
        <div id="yt-frame-container" />
      </div>
    </>
  );
}