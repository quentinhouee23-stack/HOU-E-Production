// @ts-nocheck
"use client";

import React, { useEffect, useRef } from "react";
import { useMusic } from "@/context/MusicContext";

export function Player() {
  const {
    playingUrl, status, volume,
    onDuration, onProgress, onEnded,
    seekRequest, clearSeekRequest,
    playbackError, setPlaybackError,
  } = useMusic();

  const audioRef = useRef<HTMLAudioElement>(null);

  const onEndedRef = useRef(onEnded);
  const onDurationRef = useRef(onDuration);
  const onProgressRef = useRef(onProgress);
  const statusRef = useRef(status);

  useEffect(() => { onEndedRef.current = onEnded; }, [onEnded]);
  useEffect(() => { onDurationRef.current = onDuration; }, [onDuration]);
  useEffect(() => { onProgressRef.current = onProgress; }, [onProgress]);
  useEffect(() => { statusRef.current = status; }, [status]);

  // ─────────────────────────────────────────────────────────────
  // Attache les événements audio une seule fois
  // ─────────────────────────────────────────────────────────────
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const handleDuration = () => {
      if (audio.duration && !isNaN(audio.duration)) {
        onDurationRef.current(audio.duration);
      }
    };

    const handleTimeUpdate = () => {
      onProgressRef.current({ playedSeconds: audio.currentTime });
      // Met à jour MediaSession position (écran verrouillé)
      if ("mediaSession" in navigator && navigator.mediaSession.setPositionState && audio.duration > 0) {
        try {
          navigator.mediaSession.setPositionState({
            duration: audio.duration,
            playbackRate: 1,
            position: audio.currentTime,
          });
        } catch (e) {}
      }
    };

    const handleEnded = () => onEndedRef.current();

    const handleError = () => {
      console.error("Audio error", audio.error);
      setPlaybackError("Erreur de lecture. Zapping...");
      setTimeout(() => {
        setPlaybackError(null);
        onEndedRef.current();
      }, 2000);
    };

    const handleCanPlay = () => {
      if (statusRef.current === "playing") {
        audio.play().catch(() => {});
      }
    };

    audio.addEventListener("durationchange", handleDuration);
    audio.addEventListener("timeupdate", handleTimeUpdate);
    audio.addEventListener("ended", handleEnded);
    audio.addEventListener("error", handleError);
    audio.addEventListener("canplay", handleCanPlay);

    return () => {
      audio.removeEventListener("durationchange", handleDuration);
      audio.removeEventListener("timeupdate", handleTimeUpdate);
      audio.removeEventListener("ended", handleEnded);
      audio.removeEventListener("error", handleError);
      audio.removeEventListener("canplay", handleCanPlay);
    };
  }, []);

  // ─────────────────────────────────────────────────────────────
  // Nouvelle URL audio → charge et joue
  // ─────────────────────────────────────────────────────────────
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    if (!playingUrl) {
      audio.pause();
      audio.src = "";
      return;
    }

    audio.src = playingUrl;
    audio.load();

    if (status === "playing") {
      // Petit délai : iOS a besoin d'un tick après load()
      const t = setTimeout(() => {
        audio.play().catch((e) => {
          console.error("Play error:", e);
          setPlaybackError("Lecture impossible. Zapping...");
          setTimeout(() => {
            setPlaybackError(null);
            onEndedRef.current();
          }, 2000);
        });
      }, 100);
      return () => clearTimeout(t);
    }
  }, [playingUrl]);

  // ─────────────────────────────────────────────────────────────
  // Play / Pause
  // ─────────────────────────────────────────────────────────────
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !playingUrl) return;

    if (status === "playing") {
      audio.play().catch(() => {});
    } else {
      audio.pause();
    }
  }, [status]);

  // ─────────────────────────────────────────────────────────────
  // Volume
  // ─────────────────────────────────────────────────────────────
  useEffect(() => {
    if (audioRef.current) audioRef.current.volume = volume;
  }, [volume]);

  // ─────────────────────────────────────────────────────────────
  // Seek
  // ─────────────────────────────────────────────────────────────
  useEffect(() => {
    if (seekRequest !== null && audioRef.current) {
      audioRef.current.currentTime = seekRequest;
      clearSeekRequest();
    }
  }, [seekRequest, clearSeekRequest]);

  return (
    <>
      {playbackError && (
        <div style={{
          position: "fixed", top: 0, left: 0, right: 0, zIndex: 99999,
          backgroundColor: "#ff0000", color: "#fff", padding: "15px",
          fontFamily: "monospace", fontSize: "14px", textAlign: "center",
          boxShadow: "0px 4px 10px rgba(0,0,0,0.5)",
        }}>
          <strong>🚨 {playbackError}</strong>
        </div>
      )}

      {/*
        L'élément audio natif — iOS le laisse jouer en arrière-plan
        et écran verrouillé, contrairement à l'iframe YouTube.
      */}
      <audio
        ref={audioRef}
        playsInline
        preload="metadata"
        style={{ display: "none" }}
      />
    </>
  );
}