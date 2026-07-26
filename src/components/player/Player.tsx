"use client";

import React, { useEffect, useRef, useState } from "react";
import { useMusic } from "@/context/MusicContext";

export function Player() {
  const {
    currentTrack,
    playingUrl, status, volume,
    onDuration, onProgress, onEnded,
    seekRequest, clearSeekRequest,
    setPlaybackError, 
    playNext, playPrev, togglePlayPause
  } = useMusic();

  const audioRef = useRef<HTMLAudioElement>(null);
  const [isClient, setIsClient] = useState(false);
  const isReadyRef = useRef(false);
  const hasUnlockedRef = useRef(false); // Garde en mémoire si le téléphone est débloqué

  useEffect(() => setIsClient(true), []);

  // === LA MAGIE POUR MOBILE : DÉBLOQUER L'AUDIO ===
  useEffect(() => {
    const unlockAudio = () => {
      if (audioRef.current && !hasUnlockedRef.current) {
        // On lance et on met en pause instantanément pour obtenir l'autorisation d'Apple/Google
        audioRef.current.play().then(() => {
          audioRef.current?.pause();
          hasUnlockedRef.current = true;
        }).catch(() => {});

        document.removeEventListener('touchstart', unlockAudio);
        document.removeEventListener('click', unlockAudio);
      }
    };

    document.addEventListener('touchstart', unlockAudio, { once: true });
    document.addEventListener('click', unlockAudio, { once: true });

    return () => {
      document.removeEventListener('touchstart', unlockAudio);
      document.removeEventListener('click', unlockAudio);
    };
  }, []);

    // Chargement de l'URL
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !playingUrl) return;

    isReadyRef.current = false;
    audio.src = playingUrl;
    audio.load();

    if (status === "playing") {
      audio.play().catch(e => {
        console.warn("Lecture bloquée par le navigateur:", e);
        setPlaybackError(e?.message ?? String(e));
      });
    }
  }, [playingUrl]);

  // Play / Pause
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    if (status === "playing") {
      audio.play().catch(e => {
        console.warn(e);
        setPlaybackError(e?.message ?? String(e));
      });
    } else if (status === "paused") {
      audio.pause();
    }
    }, [status]);
    
  // 3. Volume
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = Math.max(0, Math.min(1, volume));
    }
  }, [volume]);

  // 4. Seek (Avancer/Reculer)
  useEffect(() => {
    if (seekRequest !== null && audioRef.current) {
      audioRef.current.currentTime = seekRequest;
      clearSeekRequest();
    }
  }, [seekRequest, clearSeekRequest]);

  // 5. Arrière-plan pour téléphone (Mode Spotify)
  useEffect(() => {
    if ('mediaSession' in navigator && currentTrack) {
      const trackImage = (currentTrack as any).image_url 
        || (currentTrack as any).thumbnail 
        || (currentTrack as any).cover 
        || 'https://api.dicebear.com/7.x/shapes/png?seed=music';

      navigator.mediaSession.metadata = new MediaMetadata({
        title: currentTrack.title,
        artist: currentTrack.artist,
        artwork: [
          { src: trackImage, sizes: '512x512', type: 'image/png' }
        ]
      });

      navigator.mediaSession.setActionHandler('play', () => {
        audioRef.current?.play();
        togglePlayPause();
      });
      navigator.mediaSession.setActionHandler('pause', () => {
        audioRef.current?.pause();
        togglePlayPause();
      });
      navigator.mediaSession.setActionHandler('previoustrack', () => playPrev());
      navigator.mediaSession.setActionHandler('nexttrack', () => playNext());
    }
  }, [currentTrack, playNext, playPrev, togglePlayPause]);

  if (!isClient) return null;

  return (
    <audio
      ref={audioRef}
      playsInline // <-- CRUCIAL pour iPhone, empêche Safari de bloquer la lecture
      preload="auto"
      onCanPlayThrough={() => {
        isReadyRef.current = true;
        if (status === "playing") {
          audioRef.current?.play().catch(console.warn);
        }
      }}
      onTimeUpdate={() =>
        onProgress({ playedSeconds: audioRef.current?.currentTime ?? 0 })
      }
      onDurationChange={() => {
        const d = audioRef.current?.duration;
        if (d && isFinite(d)) onDuration(d);
      }}
      onEnded={onEnded}
      onError={(e) => {
        const err = (e.target as HTMLAudioElement).error;
        console.warn("Erreur Audio Mobile:", err);
        setPlaybackError(err?.message || `Erreur audio (code ${err?.code})`);
      }}
      style={{ position: "absolute", width: "1px", height: "1px", opacity: 0.01, pointerEvents: "none", bottom: 0 }}
    />
  );
}