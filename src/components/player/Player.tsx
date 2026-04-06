// @ts-nocheck
"use client";

import React, { useEffect, useRef, useState } from "react";
import { useMusic } from "@/context/MusicContext";

export function Player() {
  const { playingUrl, status, volume, onDuration, onProgress, onEnded, seekRequest, clearSeekRequest } = useMusic();
  const [isClient, setIsClient] = useState(false);
  
  // 🟢 L'ÉTAT QUI VA AFFICHER L'ERREUR SUR TON TÉLÉPHONE
  const [debugError, setDebugError] = useState<string | null>(null);
  
  const audioRef = useRef<HTMLAudioElement>(null);
  const lastUrlRef = useRef<string | null>(null);

  useEffect(() => setIsClient(true), []);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !playingUrl) return;

    if (playingUrl === lastUrlRef.current) return;
    lastUrlRef.current = playingUrl;

    // Nouvelle musique = on efface l'ancienne erreur
    setDebugError(null);

    audio.src = playingUrl;
    audio.load();

    if (status === "playing") {
      audio.play().catch((err) => {
        console.warn("Autoplay bloqué :", err);
        setDebugError(`Autoplay bloqué par iOS. Demande d'interaction utilisateur.`);
      });
    }
  }, [playingUrl]);

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
      {/* 🚨 LE PANNEAU ROUGE DE DÉBOGAGE POUR TON TÉLÉPHONE 🚨 */}
      {debugError && (
        <div style={{
          position: "fixed", top: 0, left: 0, right: 0, zIndex: 99999,
          backgroundColor: "#ff0000", color: "#ffffff", padding: "20px",
          fontFamily: "monospace", fontSize: "14px", wordWrap: "break-word"
        }}>
          <h3 style={{ margin: "0 0 10px 0", fontWeight: "bold" }}>🚨 ERREUR AUDIO IOS</h3>
          <p style={{ margin: "0 0 15px 0" }}>{debugError}</p>
          <div style={{ fontSize: "10px", opacity: 0.8, marginBottom: "15px" }}>
            URL: {playingUrl}
          </div>
          <button 
            onClick={() => {
                setDebugError(null);
                onEnded(); // On force le passage au suivant manuellement
            }} 
            style={{ backgroundColor: "#000", color: "#fff", padding: "10px 15px", border: "none", borderRadius: "5px" }}
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
          // 🟢 ANALYSE EXACTE DE CE QUI BLOQUE L'IPHONE
          let errCode = audioRef.current?.error?.code;
          let errMsg = "Erreur inconnue";
          if (errCode === 1) errMsg = "Processus annulé par iOS (MEDIA_ERR_ABORTED)";
          if (errCode === 2) errMsg = "Coupure réseau ou blocage CORS (MEDIA_ERR_NETWORK)";
          if (errCode === 3) errMsg = "Fichier corrompu (MEDIA_ERR_DECODE)";
          if (errCode === 4) errMsg = "Format non supporté par Apple. Lien mort ou WebM (MEDIA_ERR_SRC_NOT_SUPPORTED)";
          
          setDebugError(errMsg);
          
          // J'ai enlevé le "setTimeout(onEnded, 2000)" pour que ça ne zappe plus tout seul, 
          // ce qui te laissera le temps de lire l'erreur à l'écran !
        }}
        style={{ display: "none" }}
      />
    </>
  );
}