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
  const activeTrackRef = useRef<string | null>(null);

  useEffect(() => {
    setIsClient(true);
  }, []);

  // Détecte si l'URL est un flux audio direct / MP3
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

  // Extraction d'ID YouTube
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

  // Déblocage tactile initial
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
      if (playerRef.current && isYtReadyRef.current) {
        try {
          playerRef.current.playVideo();
          if (status !== "playing") playerRef.current.pauseVideo();
        } catch {}
      }
      document.removeEventListener("touchstart", unlock);
      document.removeEventListener("click", unlock);
    };

    document.addEventListener("touchstart", unlock, { passive: true, once: true });
    document.addEventListener("click", unlock, { passive: true, once: true });

    return () => {
      document.removeEventListener("touchstart", unlock);
      document.removeEventListener("click", unlock);
    };
  }, [status]);

  // Initialisation Iframe YouTube
  useEffect(() => {
    if (!isClient) return;

    const setupPlayer = () => {
      if (playerRef.current || !document.getElementById("yt-engine")) return;

      playerRef.current = new window.YT.Player("yt-engine", {
        height: "100%",
        width: "100%",
        playerVars: {
          autoplay: 1,
          controls: 0,
          disablekb: 1,
          fs: 0,
          playsinline: 1,
          enablejsapi: 1,
          rel: 0,
          origin: window.location.origin,
        },
        events: {
          onReady: () => {
            isYtReadyRef.current = true;
            if (playerRef.current?.setVolume) {
              playerRef.current.setVolume(Math.max(0, Math.min(100, volume * 100)));
            }
            if (activeTrackRef.current && !isDirectAudio(activeTrackRef.current)) {
              const id = extractVideoId(activeTrackRef.current);
              if (id) playerRef.current.loadVideoById(id);
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
            console.warn("[YouTube API Error]", event.data);
            if (event.data === 150 || event.data === 101) {
              setPlaybackError("Titre indisponible en lecture intégrée.");
            } else {
              setPlaybackError(`Erreur lecture (${event.data})`);
            }
          },
        },
      });
    };

    if (window.YT && window.YT.Player) {
      setupPlayer();
    } else {
      window.onYouTubeIframeAPIReady = setupPlayer;
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

  // Suivi de progression pour YouTube
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

  // Changement de piste
  useEffect(() => {
    if (!playingUrl) return;
    activeTrackRef.current = playingUrl;

    if (isDirectAudio(playingUrl)) {
      if (playerRef.current?.pauseVideo) {
        playerRef.current.pauseVideo();
      }
      if (audioRef.current) {
        audioRef.current.src = playingUrl;
        audioRef.current.load();
        if (status === "playing") {
          audioRef.current.play().catch(() => {});
        }
      }
    } else {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.src = "";
      }
      const videoId = extractVideoId(playingUrl);
      if (videoId && isYtReadyRef.current && playerRef.current?.loadVideoById) {
        playerRef.current.loadVideoById(videoId);
        if (status === "playing") {
          playerRef.current.playVideo();
        }
      }
    }
  }, [playingUrl]);

  // Gestion Play / Pause
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
      {/* Moteur 1 : Aperçus et MP3 natifs */}
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
        style={{ display: "none" }}
      />

      {/* Moteur 2 : YouTube officiel en arrière-plan invisible */}
      <div
        style={{
          position: "fixed",
          bottom: 0,
          left: 0,
          width: "1px",
          height: "1px",
          opacity: 0.01,
          pointerEvents: "none",
          zIndex: -1,
        }}
      >
        <div id="yt-engine" />
      </div>
    </>
  );
}