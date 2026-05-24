// @ts-nocheck
"use client";

import React, { useEffect, useRef, useState } from "react";
import { useMusic } from "@/context/MusicContext";

export function Player() {
  const {
    playingUrl: videoId, status, volume,
    onDuration, onProgress, onEnded,
    seekRequest, clearSeekRequest,
    playbackError, setPlaybackError
  } = useMusic();

  const [isClient, setIsClient] = useState(false);

  const ytPlayerInstance = useRef<any>(null);
  const progressInterval = useRef<NodeJS.Timeout | null>(null);
  const ghostAudioRef = useRef<HTMLAudioElement>(null);
  // ── Web Audio API ──
  const audioCtxRef = useRef<AudioContext | null>(null);
  const silenceNodeRef = useRef<ScriptProcessorNode | null>(null);

  const isReady = useRef(false);
  const pendingVideoId = useRef<string | null>(null);
  const isUnlocked = useRef(false);

  const onEndedRef = useRef(onEnded);
  const onDurationRef = useRef(onDuration);
  const onProgressRef = useRef(onProgress);

  useEffect(() => { onEndedRef.current = onEnded; }, [onEnded]);
  useEffect(() => { onDurationRef.current = onDuration; }, [onDuration]);
  useEffect(() => { onProgressRef.current = onProgress; }, [onProgress]);

  // ─────────────────────────────────────────────────────────────
  // Unlock : démarre AudioContext + ghost audio au premier geste
  // ─────────────────────────────────────────────────────────────
  const unlockIOSAudio = () => {
    if (isUnlocked.current) return;
    isUnlocked.current = true;

    // 1. Web Audio API — oscillateur silencieux (maintient la session audio)
    try {
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      audioCtxRef.current = ctx;

      // ScriptProcessor avec buffer vide = silence parfait, session active
      const processor = ctx.createScriptProcessor(256, 1, 1);
      processor.onaudioprocess = () => {}; // silence
      processor.connect(ctx.destination);
      silenceNodeRef.current = processor;

      if (ctx.state === "suspended") ctx.resume().catch(() => {});
    } catch (e) {}

    // 2. Ghost audio HTML
    if (ghostAudioRef.current) {
      ghostAudioRef.current.play().catch(() => {});
    }
  };

  // ─────────────────────────────────────────────────────────────
  // Init YouTube IFrame API
  // ─────────────────────────────────────────────────────────────
  useEffect(() => {
    setIsClient(true);

    const initPlayer = () => {
      if (!document.getElementById("youtube-player-div")) return;

      ytPlayerInstance.current = new window.YT.Player("youtube-player-div", {
        width: "1",
        height: "1",
        playerVars: {
          autoplay: 1, controls: 0, disablekb: 1, fs: 0,
          rel: 0, modestbranding: 1, playsinline: 1, enablejsapi: 1,
          origin: typeof window !== "undefined" ? window.location.origin : "",
        },
        events: {
          onReady: (event: any) => {
            isReady.current = true;
            event.target.setVolume(volume * 100);
            const vidToLoad = pendingVideoId.current || videoId;
            if (vidToLoad) {
              if (status === "playing") event.target.loadVideoById(vidToLoad);
              else event.target.cueVideoById(vidToLoad);
              pendingVideoId.current = null;
            }
          },
          onStateChange: (event: any) => {
            const YT = window.YT.PlayerState;
            if (event.data === YT.PLAYING) {
              const dur = event.target.getDuration();
              if (dur > 0) onDurationRef.current(dur);
              event.target.unMute();
              event.target.setVolume(volume * 100);

              if (progressInterval.current) clearInterval(progressInterval.current);
              progressInterval.current = setInterval(() => {
                onProgressRef.current({ playedSeconds: event.target.getCurrentTime() });
              }, 1000);
            } else {
              if (progressInterval.current) clearInterval(progressInterval.current);
            }
            if (event.data === YT.ENDED) onEndedRef.current();
          },
          onError: (event: any) => {
            console.error("YouTube Player Error", event.data);
            setPlaybackError("Vidéo bloquée par YouTube. Zapping...");
            setTimeout(() => {
              setPlaybackError(null);
              onEndedRef.current();
            }, 2000);
          },
        },
      });
    };

    if (!window.YT) {
      const script = document.createElement("script");
      script.src = "https://www.youtube.com/iframe_api";
      document.body.appendChild(script);
      window.onYouTubeIframeAPIReady = initPlayer;
    } else if (!ytPlayerInstance.current) {
      initPlayer();
    }

    return () => {
      if (progressInterval.current) clearInterval(progressInterval.current);
    };
  }, []);

  // ─────────────────────────────────────────────────────────────
  // visibilitychange — reprend le player quand l'app revient
  // ─────────────────────────────────────────────────────────────
  useEffect(() => {
    const handleVisibility = () => {
      if (document.visibilityState === "visible") {
        // Réveille l'AudioContext si suspendu (iOS le suspend parfois)
        const ctx = audioCtxRef.current;
        if (ctx && ctx.state === "suspended") ctx.resume().catch(() => {});

        // Réveille le ghost audio si arrêté
        if (ghostAudioRef.current && ghostAudioRef.current.paused) {
          ghostAudioRef.current.play().catch(() => {});
        }

        // Si le YT player s'est mis en pause tout seul en arrière-plan,
        // on le relance si le status applicatif est "playing"
        const player = ytPlayerInstance.current;
        if (player?.getPlayerState && player.getPlayerState() !== window.YT?.PlayerState?.PLAYING) {
          // On relit via un court délai (iOS a besoin d'un tick)
          setTimeout(() => {
            if (player?.playVideo) player.playVideo();
          }, 300);
        }
      }
    };

    document.addEventListener("visibilitychange", handleVisibility);
    // pagehide : déclenché sur iOS quand on verrouille l'écran
    window.addEventListener("pagehide", () => {
      // Rien à faire, on laisse tourner
    });

    return () => document.removeEventListener("visibilitychange", handleVisibility);
  }, []);

  // ─────────────────────────────────────────────────────────────
  // iosUnlock event (déclenché depuis MusicContext au playTrack)
  // ─────────────────────────────────────────────────────────────
  useEffect(() => {
    const handle = () => unlockIOSAudio();
    window.addEventListener("iosUnlock", handle as EventListener);
    // Aussi sur le premier tap/click global
    window.addEventListener("touchstart", handle, { once: true });
    window.addEventListener("pointerdown", handle, { once: true });
    return () => {
      window.removeEventListener("iosUnlock", handle as EventListener);
    };
  }, []);

  // ─────────────────────────────────────────────────────────────
  // Charge/joue la vidéo quand videoId ou status change
  // ─────────────────────────────────────────────────────────────
  useEffect(() => {
    const player = ytPlayerInstance.current;
    if (!videoId || !player?.loadVideoById || !isReady.current) {
      if (videoId) pendingVideoId.current = videoId;
      return;
    }
    if (status === "playing") player.loadVideoById(videoId);
    else player.cueVideoById(videoId);
  }, [videoId, status]);

  useEffect(() => {
    const player = ytPlayerInstance.current;
    if (player?.playVideo) {
      if (status === "playing") player.playVideo();
      else if (status === "paused" || status === "idle") player.pauseVideo();
    }
  }, [status]);

  useEffect(() => {
    if (ytPlayerInstance.current?.setVolume) {
      ytPlayerInstance.current.setVolume(volume * 100);
    }
  }, [volume]);

  useEffect(() => {
    if (seekRequest !== null && ytPlayerInstance.current?.seekTo) {
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
          backgroundColor: "#ff0000", color: "#fff", padding: "15px",
          fontFamily: "monospace", fontSize: "14px", textAlign: "center",
        }}>
          <strong>🚨 {playbackError}</strong>
        </div>
      )}

      {/* Conteneur iframe YouTube invisible */}
      <div style={{
        position: "fixed", top: 0, left: 0,
        width: "1px", height: "1px",
        opacity: 0.01, pointerEvents: "none", zIndex: -1,
      }}>
        <div id="youtube-player-div" />
      </div>

      {/* Ghost audio — vrai fichier MP3 silencieux en boucle */}
      <audio
        ref={ghostAudioRef}
        src="/silence.mp3"
        loop
        playsInline
        style={{ display: "none" }}
      />
    </>
  );
}