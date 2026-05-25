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
  // Unlock : Lance le silence.mp3 au premier clic de l'utilisateur
  // ─────────────────────────────────────────────────────────────
  const unlockIOSAudio = () => {
    if (isUnlocked.current) return;
    isUnlocked.current = true;

    // On lance le fichier MP3 silencieux. 
    // Il va tourner en boucle infinie et forcer iOS à garder le canal audio ouvert.
    if (ghostAudioRef.current) {
      ghostAudioRef.current.volume = 1;
      ghostAudioRef.current.play().catch(() => {
        isUnlocked.current = false; // Si ça rate, on réessaiera au prochain clic
      });
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
        width: "10", // Pas 1x1, parfois iOS bloque les iframes trop petites
        height: "10",
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
              // Sécurité : On s'assure que le silence tourne toujours quand la musique joue
              if (ghostAudioRef.current && ghostAudioRef.current.paused) {
                 ghostAudioRef.current.play().catch(() => {});
              }

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
  // visibilitychange — Le contre-braquage contre iOS
  // ─────────────────────────────────────────────────────────────
  useEffect(() => {
    const handleVisibility = () => {
      // 1. Quand l'application passe en arrière-plan (écran verrouillé ou changement d'app)
      if (document.visibilityState === "hidden") {
        // YouTube force souvent la pause ici. On le force à reprendre la lecture après 100ms
        if (status === "playing" && ytPlayerInstance.current?.playVideo) {
          setTimeout(() => {
             ytPlayerInstance.current.playVideo();
          }, 100);
        }
      }

      // 2. Quand on revient sur l'application
      if (document.visibilityState === "visible") {
        if (ghostAudioRef.current && ghostAudioRef.current.paused) {
          ghostAudioRef.current.play().catch(() => {});
        }
        const player = ytPlayerInstance.current;
        if (status === "playing" && player?.getPlayerState && player.getPlayerState() !== window.YT?.PlayerState?.PLAYING) {
          setTimeout(() => {
            if (player?.playVideo) player.playVideo();
          }, 300);
        }
      }
    };

    document.addEventListener("visibilitychange", handleVisibility);
    return () => document.removeEventListener("visibilitychange", handleVisibility);
  }, [status]);

  // ─────────────────────────────────────────────────────────────
  // Initialisation globale de l'audio fantôme
  // ─────────────────────────────────────────────────────────────
  useEffect(() => {
    const handle = () => unlockIOSAudio();
    // Le Custom Event envoyé par ton bouton Play
    window.addEventListener("iosUnlock", handle as EventListener);
    // On ratisse large : n'importe quel clic sur l'écran débloquera le silence.mp3
    document.addEventListener("touchstart", handle, { once: true });
    document.addEventListener("click", handle, { once: true });
    
    return () => {
      window.removeEventListener("iosUnlock", handle as EventListener);
      document.removeEventListener("touchstart", handle);
      document.removeEventListener("click", handle);
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

      {/* Conteneur iframe YouTube invisible 
        IMPORTANT : On utilise des pixels réels (10x10) et non 1x1.
      */}
      <div style={{
        position: "fixed", top: 0, left: 0,
        width: "10px", height: "10px",
        opacity: 0.01, pointerEvents: "none", zIndex: -1,
      }}>
        <div id="youtube-player-div" />
      </div>

      {/* Ghost audio — Ton fichier MP3 silencieux en boucle.
        IL NE FAUT SURTOUT PAS METTRE `display: "none"` SINON APPLE LE TUE.
        On le cache avec CSS pour le rendre imperceptible.
      */}
      <audio
        ref={ghostAudioRef}
        src="/silence.mp3"
        loop
        playsInline
        style={{
          position: "absolute",
          width: "1px",
          height: "1px",
          opacity: 0.01,
          pointerEvents: "none",
          zIndex: -10
        }}
      />
    </>
  );
}