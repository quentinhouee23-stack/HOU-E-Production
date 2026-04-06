// @ts-nocheck
"use client";

import React, { useEffect, useRef, useState } from "react";
import { useMusic } from "@/context/MusicContext";

export function Player() {
  const { playingUrl, status, volume, onDuration, onProgress, onEnded, seekRequest, clearSeekRequest, playbackError, setPlaybackError, handleAudioError } = useMusic();
  const [isClient, setIsClient] = useState(false);
  
  const audioRef = useRef<HTMLAudioElement>(null);
  const lastUrlRef = useRef<string | null>(null);

  useEffect(() => setIsClient(true), []);

  // 🟢 L'ASTUCE ANTI-BLOCAGE IOS
  // On écoute le signal "iosUnlock" envoyé quand tu cliques sur la musique.
  // On joue immédiatement un son vierge pour dire à Apple "Je suis un lecteur actif ! Ne me bloque pas !".
  useEffect(() => {
    const handleUnlock = () => {
      if (audioRef.current && audioRef.current.paused) {
        const oldSrc = audioRef.current.src;
        if (!oldSrc || oldSrc === "" || oldSrc === window.location.href) {
           audioRef.current.src = "data:audio/wav;base64,UklGRigAAABXQVZFZm10IBIAAAABAAEARKwAAIhYAQACABAAAABkYXRhAgAAAAEA";
        }
        audioRef.current.play().catch(() => {});
      }
    };
    window.addEventListener("iosUnlock", handleUnlock as EventListener);
    return () => window.removeEventListener("iosUnlock", handleUnlock as EventListener);
  }, []);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !playingUrl) return;

    if (playingUrl === lastUrlRef.current) return;
    lastUrlRef.current = playingUrl;

    audio.src = playingUrl;
    audio.load();

    if (status === "playing") {
      audio.play().catch((err) => {
        console.warn("Autoplay silencieux bloqué");
      });
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
          backgroundColor: "#ff0000", color: "#ffffff", padding: "20px",
          fontFamily: "monospace", fontSize: "14px", wordWrap: "break-word",
          boxShadow: "0px 4px 10px rgba(0,0,0,0.5)"
        }}>
          <h3 style={{ margin: "0 0 10px 0", fontWeight: "bold" }}>🚨 ÉTAT LECTURE</h3>
          <p style={{ margin: "0 0 15px 0" }}>{playbackError}</p>
          <button 
            onClick={() => {
                setPlaybackError(null);
                onEnded(); 
            }} 
            style={{ backgroundColor: "#000", color: "#fff", padding: "10px 15px", border: "none", borderRadius: "5px", fontWeight: "bold" }}
          >
            Fermer et Suivant
          </button>
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
        onError={(e) => {
          // Si un serveur Invidious est radin ou lent, on appelle le Cerveau pour changer immédiatement !
          handleAudioError();
        }}
        style={{ display: "none" }}
      />
    </>
  );
}