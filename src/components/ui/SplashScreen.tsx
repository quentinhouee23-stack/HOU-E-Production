// @ts-nocheck
"use client";

import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { usePlaylists } from "@/context/PlaylistContext";
import { useMusic } from "@/context/MusicContext";

export function SplashScreen({ children }: { children: React.ReactNode }) {
  const { isLoaded: isPlaylistsLoaded } = usePlaylists();
  const { isMusicLoaded } = useMusic();
  
  const [showSplash, setShowSplash] = useState(true);
  const [appReady, setAppReady] = useState(false);
  const [progress, setProgress] = useState(20);

  useEffect(() => {
    // 🚀 CHARGEMENT RAPIDE : Monte très vite à 90%
    const interval = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 90) {
          clearInterval(interval);
          return 90;
        }
        return prev + 25;
      });
    }, 80);

    // Failsafe réduit à 2 secondes max au lieu de 6 secondes
    const maxTimer = setTimeout(() => {
      setProgress(100);
      setAppReady(true);
      setShowSplash(false);
    }, 2000);

    return () => {
      clearInterval(interval);
      clearTimeout(maxTimer);
    };
  }, []);

  useEffect(() => {
    if (isPlaylistsLoaded && isMusicLoaded) {
      setProgress(100);
      setAppReady(true); 
      
      // Disparition ultra-rapide (200ms au lieu de 600ms) dès que c'est prêt
      setTimeout(() => {
        setShowSplash(false);
      }, 200);
    }
  }, [isPlaylistsLoaded, isMusicLoaded]);

  const waveHeights = [12, 20, 35, 55, 80, 110, 140, 160, 140, 110, 80, 55, 35, 20, 12];

  return (
    <>
      <AnimatePresence mode="wait">
        {showSplash && (
          <motion.div
            key="splash"
            initial={{ opacity: 1 }}
            exit={{ opacity: 0, scale: 1.02 }}
            transition={{ duration: 0.3, ease: "easeInOut" }}
            className="fixed inset-0 z-[9999] flex flex-col items-center justify-center overflow-hidden"
            style={{ background: "#0c0c0f" }}
          >
            <motion.div
              className="absolute rounded-full pointer-events-none"
              animate={{
                scale: progress / 100,
                opacity: (progress / 100) * 0.4
              }}
              transition={{ ease: "easeOut", duration: 0.2 }}
              style={{
                width: 400,
                height: 400,
                background: "radial-gradient(circle, rgba(29,185,84,1) 0%, transparent 70%)",
                filter: "blur(50px)",
              }}
            />

            <div className="relative z-10 flex items-end justify-center gap-1.5 sm:gap-2 h-48 mb-8">
              {waveHeights.map((maxHeight, i) => {
                const currentHeight = Math.max(4, maxHeight * (progress / 100));
                
                return (
                  <motion.div
                    key={i}
                    className="w-2 sm:w-3 rounded-full bg-[#1db954]"
                    animate={{
                      height: currentHeight,
                      opacity: 0.2 + (progress / 100) * 0.8,
                    }}
                    transition={{
                      height: { type: "spring", stiffness: 200, damping: 15 },
                    }}
                    style={{ transformOrigin: "bottom" }}
                  />
                );
              })}
            </div>

            <motion.h1
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1, duration: 0.3 }}
              className="relative z-10 text-3xl font-black tracking-[0.3em] uppercase mb-2 text-white"
            >
              HOUÉE
            </motion.h1>

            <motion.div
              className="relative z-10 h-1 w-32 bg-white/10 rounded-full overflow-hidden mt-4"
            >
              <motion.div 
                className="h-full bg-[#1db954]"
                animate={{ width: `${progress}%` }}
                transition={{ type: "spring", stiffness: 200, damping: 25 }}
              />
            </motion.div>

          </motion.div>
        )}
      </AnimatePresence>

      {appReady && children}
    </>
  );
}