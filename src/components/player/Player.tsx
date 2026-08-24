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
  const audioRef = useRef<HTMLAudioElement>(null);
  const ytPlayerRef = useRef<any>(null);
  const ytReadyRef = useRef(false);
  const progressIntervalRef = useRef<any>(null);

  useEffect(() => setIsClient(true), []);

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

  // 1. Initialisation Iframe YouTube
  useEffect(() => {
    if (!isClient) return;

    const initYT = () => {
      if (ytPlayerRef.current || !document.getElementById("yt-frame")) return;
      ytPlayerRef.current = new window.YT.Player("yt-frame", {
        width: "100",
        height: "100",
        playerVars: { autoplay: 0, controls: 0, disablekb: 1, fs: 0, playsinline: 1 },
        events: {
          onReady: () => {
            ytReadyRef.current = true;
            ytPlayerRef.current.setVolume(volume * 100);
            
            // Lancer la lecture si un morceau est déjà en attente
            if (playingUrl && !isDirectAudio(playingUrl)) {
              const id = getYTId(playingUrl);
              if (id) {
                ytPlayerRef.current.loadVideoById(id);
                if (status === "playing") ytPlayerRef.current.playVideo();
              }
            }
          },
          onStateChange: (e: any) => {
            if (e.data === 0) onEnded();
            if (e.data === 1) {
              const d = ytPlayerRef.current.getDuration();
              if (d) onDuration(d);
            }
          },
          onError: (e: any) => {
            if (setPlaybackError) {
              setPlaybackError(`Erreur de lecture (${e.data})`);
            }
          }
        }
      });
    };

    if (window.YT && window.YT.Player) {
      initYT();
    } else {
      window.onYouTubeIframeAPIReady = initYT;
      if (!document.getElementById("yt-script")) {
        const s = document.createElement("script");
        s.id = "yt-script";
        s.src = "https://www.youtube.com/iframe_api";
        document.head.appendChild(s);
      }
    }
  }, [isClient]);

  // 2. Déverrouillage de sécurité iOS
  useEffect(() => {
    const unlock = () => {
      if (audioRef.current) {
        audioRef.current.play().catch(() => {});
        audioRef.current.pause();
      }
      if (ytReadyRef.current && ytPlayerRef.current) {
        ytPlayerRef.current.mute();
        ytPlayerRef.current.playVideo();
        ytPlayerRef.current.pauseVideo();
        ytPlayerRef.current.unMute();
      }
    };
    
    const onClick = () => {
      unlock();
      if (ytReadyRef.current) {
        document.removeEventListener("click", onClick);
        document.removeEventListener("touchstart", onClick);
      }
    };
    
    document.addEventListener("click", onClick);
    document.addEventListener("touchstart", onClick);
    
    return () => {
      document.removeEventListener("click", onClick);
      document.removeEventListener("touchstart", onClick);
    };
  }, []);

  // 3. Gestion de la piste active
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
        else audioRef.current.pause();
      }
    } else {
      if (audioRef.current) audioRef.current.pause();
      const videoId = getYTId(playingUrl);
      
      if (videoId && ytReadyRef.current) {
        const currentUrl = ytPlayerRef.current.getVideoUrl?.() || "";
        if (!currentUrl.includes(videoId)) {
          ytPlayerRef.current.loadVideoById(videoId);
        }
        if (status === "playing") ytPlayerRef.current.playVideo();
        else ytPlayerRef.current.pauseVideo();
      }
    }
  }, [playingUrl, status]);

  // 4. Barre de progression
  useEffect(() => {
    if (status === "playing") {
      progressIntervalRef.current = setInterval(() => {
        if (isDirectAudio(playingUrl) && audioRef.current) {
          onProgress({ playedSeconds: audioRef.current.currentTime });
        } else if (ytReadyRef.current && ytPlayerRef.current?.getCurrentTime) {
          onProgress({ playedSeconds: ytPlayerRef.current.getCurrentTime() });
        }
      }, 500);
    }
    return () => clearInterval(progressIntervalRef.current);
  }, [status, playingUrl]);

  // 5. Volume et Barre de recherche temporelle (Seek)
  useEffect(() => {
    if (audioRef.current) audioRef.current.volume = volume;
    if (ytReadyRef.current && ytPlayerRef.current?.setVolume) {
      ytPlayerRef.current.setVolume(volume * 100);
    }
  }, [volume]);

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

  return (
    <>
      {/* Lecteur MP3 natif */}
      <audio ref={audioRef} playsInline onEnded={onEnded} style={{ display: "none" }} />
      
      {/* Lecteur YouTube : Dimensionné pour WebKit, mais camouflé derrière l'UI */}
      <div
        style={{
          position: "fixed",
          top: 0,
          left: 0,
          width: "100px",
          height: "100px",
          opacity: 0.01,
          pointerEvents: "none",
          zIndex: -9999
        }}
      >
        <div id="yt-frame" />
      </div>
    </>
  );
}