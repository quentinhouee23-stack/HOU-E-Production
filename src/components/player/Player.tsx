// @ts-nocheck
"use client";

import React, { useEffect, useRef, useState } from "react";
import { useMusic } from "@/context/MusicContext";

export function Player() {
  const { playingUrl, status, volume, onDuration, onProgress, onEnded, seekRequest, clearSeekRequest, playbackError, setPlaybackError } = useMusic();
  const [isClient, setIsClient] = useState(false);
  
  const audioRef = useRef<HTMLAudioElement>(null);
  const lastUrlRef = useRef<string | null>(null);

  useEffect(() => setIsClient(true), []);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !playingUrl) return;

    if (playingUrl === lastUrlRef.current) return;
    lastUrlRef.current = playingUrl;

    audio.src = playingUrl;
    audio.load();

    if (status === "playing") {
      audio.play().catch(() => {});
    }
  }, [playingUrl, status]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !playingUrl) return;

    if (status === "playing") {
      audio.play().catch(() => {});
    } else if (status === "paused" || status === "idle") {
      audio.pause();
    }
  }, [status, playingUrl]);

  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = Math.max(0, Math.min(1, volume));
    }
  }, [volume]);

  useEffect(() => {
    if (seekRequest !== null && audioRef.current) {
      audioRef.current.currentTime = seekRequest;
      clearSeekRequest();
    }
  }, [seekRequest, clearSeekRequest]);

  // 🟢 LE CHIEN DE GARDE (Watchdog) : Si la musique est lancée mais bloquée à 0:00 (serveur qui envoie 0 octet)
  useEffect(() => {
    let stallTimer: NodeJS.Timeout;
    
    if (status === "playing" && playingUrl) {
      stallTimer = setTimeout(() => {
        const audio = audioRef.current;
        // Si après 6 secondes on est toujours bloqué à 0
        if (audio && audio.currentTime === 0 && !audio.paused) {
          setPlaybackError("Le serveur ne répond pas (0 octet). Zapping automatique...");
          setTimeout(() => {
              setPlaybackError(null);
              onEnded(); // On skip proprement
          }, 1500);
        }
      }, 6000);
    }
    
    return () => clearTimeout(stallTimer);
  }, [status, playingUrl, onEnded, setPlaybackError]);

  useEffect(() => {
    const handleVisibility = () => {
      const audio = audioRef.current;
      if (!document.hidden && status === "playing" && audio) {
        audio.play().catch(() => {});
      }
    };
    document.addEventListener("visibilitychange", handleVisibility);
    return () => document.removeEventListener("visibilitychange", handleVisibility);
  }, [status]);

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

      <audio
        ref={audioRef}
        playsInline
        preload="auto"
        data-main-player="true"
        onTimeUpdate={() => {
          if (audioRef.current) onProgress({ playedSeconds: audioRef.current.currentTime });
        }}
        onDurationChange={() => {
          if (audioRef.current && audioRef.current.duration > 0 && isFinite(audioRef.current.duration)) {
            onDuration(audioRef.current.duration);
          }
        }}
        onEnded={onEnded}
        onError={() => {
          setPlaybackError("Erreur réseau ou fichier mort. Zapping automatique...");
          setTimeout(() => {
              setPlaybackError(null);
              onEnded();
          }, 1500);
        }}
        style={{ display: "none" }}
      />
    </>
  );
}