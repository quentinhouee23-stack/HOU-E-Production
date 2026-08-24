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
  const playerRef = useRef<any>(null);
  const progressIntervalRef = useRef<any>(null);
  const isYtReadyRef = useRef(false);
  const currentYtIdRef = useRef<string | null>(null);

  // Détermine si le titre courant est un flux audio direct (ex: preview Deezer/MP3) ou une vidéo YouTube
  const isDirectAudio = (url: string | null): boolean => {
    if (!url) return false;
    return (
      url.endsWith(".mp3") ||
      url.endsWith(".m4a") ||
      url.includes("dzcdn.net") ||
      url.includes("audio-preview") ||
      url.includes(".mp3?")
    );
  };

  const extractVideoId = (input: string | null): string | null => {
    if (!input || isDirectAudio(input)) return null;
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

  useEffect(() => {
    setIsClient(true);
  }, []);

  // Déblocage audio WebKit iOS pour l'élément <audio> natif
  useEffect(() => {
    const unlock = () => {
      const audio = audioRef.current;
      if (audio) {
        audio.muted = true;
        audio.play().then(() => {
          audio.pause();
          audio.muted = false;
        }).catch(() => {});
      }
      document.removeEventListener("touchstart", unlock);
      document.removeEventListener("click", unlock);
    };

    document.addEventListener("touchstart", unlock, { once: true });
    document.addEventListener("click", unlock, { once: true });

    return () => {
      document.removeEventListener("touchstart", unlock);
      document.removeEventListener("click", unlock);
    };
  }, []);

  // Initialisation du player YouTube
  useEffect(() => {
    if (!isClient) return;

    const onYouTubeReady = () => {
      if (playerRef.current) return;

      playerRef.current = new window.YT.Player("yt-master-player", {
        height: "200",
        width: "200",
        playerVars: {
          autoplay: 1,
          controls: 0,
          disablekb: 1,
          fs: 0,
          playsinline: 1,
          enablejsapi: 1,
          rel: 0,
        },
        events: {
          onReady: () => {
            isYtReadyRef.current = true;
            if (playerRef.current?.setVolume) {
              playerRef.current.setVolume(Math.max(0, Math.min(100, volume * 100)));
            }
            if (currentYtIdRef.current) {
              playerRef.current.loadVideoById(currentYtIdRef.current);
            }
          },
          onStateChange: (event: any) => {
            if (event.data === 0) onEnded();
            if (event.data === 1) {
              const dur = playerRef.current.getDuration();
              if (dur && isFinite(dur)) onDuration(dur);
            }
          },
          onError: (event: any) => {
            console.warn("[YT Player Error]", event.data);
            if (event.data === 150 || event.data === 101) {
              setPlaybackError("Titre bloqué par YouTube pour l'intégration mobile.");
            } else {
              setPlaybackError(`Erreur lecture (${event.data})`);
            }
          },
        },
      });
    };

    if (window.YT && window.YT.Player) {
      onYouTubeReady();
    } else {
      window.onYouTubeIframeAPIReady = onYouTubeReady;
      if (!document.querySelector('script[src*="youtube.com/iframe_api"]')) {
        const script = document.createElement("script");
        script.src = "https://www.youtube.com/iframe_api";
        document.body.appendChild(script);
      }
    }

    return () => {
      if (progressIntervalRef.current) clearInterval(progressIntervalRef.current);
    };
  }, [isClient]);

  // Suivi temps de lecture pour YouTube
  useEffect(() => {
    if (status === "playing" && !isDirectAudio(playingUrl)) {
      progressIntervalRef.current = setInterval(() => {
        if (playerRef.current?.getCurrentTime && isYtReadyRef.current) {
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
  }, [status, playingUrl, onProgress]);

  // Changement de piste : aiguillage entre balise <audio> et YouTube Iframe
  useEffect(() => {
    if (!playingUrl) return;

    if (isDirectAudio(playingUrl)) {
      // Cas 1 : Aperçu ou flux direct MP3
      if (playerRef.current?.pauseVideo) {
        playerRef.current.pauseVideo();
      }
      if (audioRef.current) {
        audioRef.current.src = playingUrl;
        audioRef.current.load();
        if (status === "playing") {
          audioRef.current.play().catch((e) => console.warn("Audio direct play error:", e));
        }
      }
    } else {
      // Cas 2 : Vidéo YouTube
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.src = "";
      }
      const videoId = extractVideoId(playingUrl);
      if (!videoId) return;

      currentYtIdRef.current = videoId;
      if (isYtReadyRef.current && playerRef.current?.loadVideoById) {
        playerRef.current.loadVideoById(videoId);
        if (status === "playing") {
          playerRef.current.playVideo();
        }
      }
    }
  }, [playingUrl]);

  // Play / Pause
  useEffect(() => {
    if (isDirectAudio(playingUrl)) {
      const audio = audioRef.current;
      if (!audio) return;
      if (status === "playing") {
        audio.play().catch(() => {});
      } else if (status === "paused") {
        audio.pause();
      }
    } else {
      if (!isYtReadyRef.current || !playerRef.current) return;
      if (status === "playing") {
        playerRef.current.playVideo?.();
      } else if (status === "paused") {
        playerRef.current.pauseVideo?.();
      }
    }
  }, [status, playingUrl]);

  // Volume
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = Math.max(0, Math.min(1, volume));
    }
    if (isYtReadyRef.current && playerRef.current?.setVolume) {
      playerRef.current.setVolume(Math.max(0, Math.min(100, volume * 100)));
    }
  }, [volume]);

  // Seek
  useEffect(() => {
    if (seekRequest !== null) {
      if (isDirectAudio(playingUrl) && audioRef.current) {
        audioRef.current.currentTime = seekRequest;
      } else if (isYtReadyRef.current && playerRef.current?.seekTo) {
        playerRef.current.seekTo(seekRequest, true);
      }
      clearSeekRequest();
    }
  }, [seekRequest, clearSeekRequest, playingUrl]);

  if (!isClient) return null;

  return (
    <>
      {/* Moteur 1 : Balise native pour les flux directs et aperçus */}
      <audio
        ref={audioRef}
        playsInline
        preload="auto"
        onTimeUpdate={() =>
          onProgress({ playedSeconds: audioRef.current?.currentTime ?? 0 })
        }
        onDurationChange={() => {
          const d = audioRef.current?.duration;
          if (d && isFinite(d)) onDuration(d);
        }}
        onEnded={onEnded}
        onError={(e) => {
          console.warn("Erreur Audio Direct:", e);
        }}
        style={{ display: "none" }}
      />

      {/* Moteur 2 : Iframe YouTube officielle */}
      <div
        style={{
          position: "fixed",
          bottom: 0,
          right: 0,
          width: "200px",
          height: "200px",
          zIndex: -999,
          opacity: 0.001,
          pointerEvents: "none",
        }}
      >
        <div id="yt-master-player" />
      </div>
    </>
  );
}