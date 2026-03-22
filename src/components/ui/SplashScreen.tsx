// @ts-nocheck
"use client";

import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { usePlaylists } from "@/context/PlaylistContext";
import { useMusic } from "@/context/MusicContext";

export function SplashScreen({ children }: { children: React.ReactNode }) {
  // 🟢 On surveille les 2 cerveaux de l'app !
  const { isLoaded: isPlaylistsLoaded } = usePlaylists();
  const { isMusicLoaded } = useMusic();
  
  const [showSplash, setShowSplash] = useState(true);
  const [minimumTimePassed, setMinimumTimePassed] = useState(false);
  const [appReady, setAppReady] = useState(false);

  useEffect(() => {
    // On s'assure que le splash reste au moins 1.2s
    const minTimer = setTimeout(() => {
      setMinimumTimePassed(true);
    }, 1200);

    // Failsafe 5s (au cas où le réseau galère)
    const maxTimer = setTimeout(() => {
      setShowSplash(false);
      setAppReady(true); 
    }, 5000);

    return () => {
      clearTimeout(minTimer);
      clearTimeout(maxTimer);
    };
  }, []);

  useEffect(() => {
    // 🟢 La double condition de sécurité : Playlists + Musique
    if (isPlaylistsLoaded && isMusicLoaded) {
      setAppReady(true);
    }
    
    if (isPlaylistsLoaded && isMusicLoaded && minimumTimePassed) {
      setShowSplash(false);
    }
  }, [isPlaylistsLoaded, isMusicLoaded, minimumTimePassed]);

  const bars = [0.4, 0.7, 1, 0.6, 0.9, 0.5, 0.8, 0.45, 0.75, 0.55];

  return (
    <>
      <AnimatePresence mode="wait">
        {showSplash && (
          <motion.div
            key="splash"
            initial={{ opacity: 1 }}
            exit={{ opacity: 0, scale: 1.05, filter: "blur(12px)" }}
            transition={{ duration: 0.8, ease: "easeInOut" }}
            className="fixed inset-0 z-[9999] flex flex-col items-center justify-center overflow-hidden"
            style={{ background: "#0c0c0f" }}
          >
            <div
              className="absolute rounded-full pointer-events-none"
              style={{
                width: 340,
                height: 340,
                background: "radial-gradient(circle, rgba(29,185,84,0.15) 0%, transparent 70%)",
                filter: "blur(40px)",
              }}
            />

            <motion.div
              initial={{ scale: 0.75, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ duration: 0.6, ease: [0.34, 1.56, 0.64, 1] }}
              className="relative w-36 h-36 mb-10 flex items-center justify-center"
            >
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 8, repeat: Infinity, ease: "linear" }}
                className="absolute inset-0 rounded-full"
                style={{
                  background: "conic-gradient(from 0deg, transparent 70%, rgba(29,185,84,0.6) 100%)",
                  padding: 2,
                  borderRadius: "50%",
                  WebkitMask: "radial-gradient(farthest-side, transparent calc(100% - 2px), black calc(100% - 2px))",
                  mask: "radial-gradient(farthest-side, transparent calc(100% - 2px), black calc(100% - 2px))",
                }}
              />

              <img
                src="/logo.png"
                alt="Logo App"
                className="relative z-10 w-24 h-24 object-contain"
                style={{ filter: "drop-shadow(0 0 24px rgba(29,185,84,0.4))" }}
              />
            </motion.div>

            <motion.h1
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3, duration: 0.5, ease: "easeOut" }}
              className="text-4xl font-black tracking-[0.25em] uppercase mb-1 text-white"
            >
              HOUÉE
            </motion.h1>

            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.45, duration: 0.5 }}
              className="text-xs tracking-[0.2em] uppercase mb-12"
              style={{ color: "rgba(255,255,255,0.3)" }}
            >
              Ta musique, tes règles
            </motion.p>

            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.6, duration: 0.5 }}
              className="flex items-end gap-[3px]"
              style={{ height: 28 }}
            >
              {bars.map((h, i) => (
                <motion.div
                  key={i}
                  className="w-[3px] rounded-full"
                  style={{ background: i % 3 === 0 ? "#1db954" : "rgba(255,255,255,0.25)" }}
                  animate={{ scaleY: [h, h * 0.4, h * 1.1, h * 0.6, h] }}
                  transition={{
                    duration: 1.2,
                    repeat: Infinity,
                    delay: i * 0.08,
                    ease: "easeInOut",
                  }}
                  transformOrigin="bottom"
                  initial={{ scaleY: h, height: 28, originY: 1 }}
                />
              ))}
            </motion.div>

            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: [0, 0.5, 0.3, 0.5] }}
              transition={{ delay: 0.8, duration: 2, repeat: Infinity }}
              className="absolute bottom-16 text-xs tracking-widest uppercase"
              style={{ color: "rgba(255,255,255,0.2)" }}
            >
              Chargement de ta vibe
            </motion.p>

          </motion.div>
        )}
      </AnimatePresence>

      {/* Rendu final 100% sécurisé */}
      {appReady && children}
    </>
  );
}