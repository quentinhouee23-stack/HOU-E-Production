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
  const [progress, setProgress] = useState(5); // Le chargement commence à 5%

  // 🟢 1. SIMULATION DU CHARGEMENT VISUEL
  useEffect(() => {
    // La vague monte aléatoirement jusqu'à 85-90% pour faire patienter l'utilisateur
    const interval = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 85) {
          clearInterval(interval);
          return 85;
        }
        return prev + (Math.random() * 12);
      });
    }, 150);

    // Failsafe : au bout de 6 secondes, on force l'ouverture quoiqu'il arrive
    const maxTimer = setTimeout(() => {
      setAppReady(true);
      setShowSplash(false);
    }, 6000);

    return () => {
      clearInterval(interval);
      clearTimeout(maxTimer);
    };
  }, []);

  // 🟢 2. DÉTECTION DU VRAI CHARGEMENT (LE CERVEAU DE L'APP)
  useEffect(() => {
    if (isPlaylistsLoaded && isMusicLoaded) {
      setProgress(100); // On force la vague au maximum
      setAppReady(true); // 🚀 OPTIMISATION : On commence à dessiner l'app en arrière-plan MAINTENANT
      
      // On laisse la vague briller à 100% pendant une demi-seconde avant de retirer le rideau
      setTimeout(() => {
        setShowSplash(false);
      }, 600);
    }
  }, [isPlaylistsLoaded, isMusicLoaded]);

  // 🎵 Configuration architecturale de la vague (Amplitude de chaque barre)
  const waveHeights = [12, 20, 35, 55, 80, 110, 140, 160, 140, 110, 80, 55, 35, 20, 12];

  return (
    <>
      <AnimatePresence mode="wait">
        {showSplash && (
          <motion.div
            key="splash"
            initial={{ opacity: 1 }}
            exit={{ opacity: 0, scale: 1.05, filter: "blur(10px)" }}
            transition={{ duration: 0.7, ease: "easeInOut" }}
            className="fixed inset-0 z-[9999] flex flex-col items-center justify-center overflow-hidden"
            style={{ background: "#0c0c0f" }}
          >
            {/* Lueur verte en arrière-plan qui grandit avec le chargement */}
            <motion.div
              className="absolute rounded-full pointer-events-none"
              animate={{
                scale: progress / 100,
                opacity: (progress / 100) * 0.4
              }}
              transition={{ ease: "easeOut", duration: 0.3 }}
              style={{
                width: 400,
                height: 400,
                background: "radial-gradient(circle, rgba(29,185,84,1) 0%, transparent 70%)",
                filter: "blur(50px)",
              }}
            />

            {/* 🎵 LA VAGUE MUSICALE QUI MONTE */}
            <div className="relative z-10 flex items-end justify-center gap-1.5 sm:gap-2 h-48 mb-8">
              {waveHeights.map((maxHeight, i) => {
                // On calcule la hauteur actuelle de la barre en fonction du pourcentage global
                const currentHeight = Math.max(4, maxHeight * (progress / 100));
                
                return (
                  <motion.div
                    key={i}
                    className="w-2 sm:w-3 rounded-full bg-[#1db954]"
                    animate={{
                      height: currentHeight,
                      opacity: 0.2 + (progress / 100) * 0.8,
                      // Si on est à 100%, on fait une petite impulsion (bounce)
                      scaleY: progress === 100 ? [1, 1.15, 1] : 1,
                    }}
                    transition={{
                      height: { type: "spring", stiffness: 120, damping: 15 },
                      scaleY: { duration: 0.3, delay: i * 0.02 }, // Effet d'onde de gauche à droite sur le bounce
                    }}
                    style={{ transformOrigin: "bottom" }}
                  />
                );
              })}
            </div>

            {/* 🟢 CORRECTION ICI : Remplacement de </motion.div> par </motion.h1> */}
            <motion.h1
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2, duration: 0.5 }}
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
                transition={{ type: "spring", stiffness: 100, damping: 20 }}
              />
            </motion.div>

          </motion.div>
        )}
      </AnimatePresence>

      {/* L'application est injectée dans le DOM dès que appReady est true, même si le splash est encore en train de disparaître au-dessus ! */}
      {appReady && children}
    </>
  );
}