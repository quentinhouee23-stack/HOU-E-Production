"use client";

import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";

export function SplashScreen({ children }: { children: React.ReactNode }) {
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Laisse l'écran de chargement affiché pendant 2 secondes
    const timer = setTimeout(() => {
      setIsLoading(false);
    }, 2000);

    return () => clearTimeout(timer);
  }, []);

  return (
    <>
      <AnimatePresence mode="wait">
        {isLoading && (
          <motion.div
            key="splash"
            initial={{ opacity: 1 }}
            exit={{ opacity: 0, scale: 1.1, filter: "blur(10px)" }}
            transition={{ duration: 0.8, ease: "easeInOut" }}
            // 🟢 MODIFICATION : Le fond passe au gris très clair de ton image, et le texte en noir profond
            className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-[#f4f5f6] text-[#121212]"
          >
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ duration: 0.5, ease: "easeOut" }}
              className="relative w-40 h-40 mb-8"
            >
              {/* Effet de lueur (passé en sombre subtil pour contraster avec le fond clair) */}
              <div className="absolute inset-0 bg-black/5 blur-3xl rounded-full animate-pulse"></div>
              
              {/* Ton logo */}
              <img 
                src="/logo.png" 
                alt="Logo App" 
                className="relative z-10 w-full h-full object-contain drop-shadow-[0_15px_30px_rgba(0,0,0,0.15)]"
              />
            </motion.div>

            <motion.h1 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3, duration: 0.5 }}
              className="text-3xl font-black tracking-widest uppercase mb-4"
            >
              Chuuut
            </motion.h1>

            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.6, duration: 0.5 }}
              // 🟢 MODIFICATION : Texte grisé et spinner vert pour bien ressortir sur le fond blanc
              className="flex items-center gap-2 text-black/50 text-sm font-medium"
            >
              <div className="w-4 h-4 border-2 border-black/10 border-t-[#1db954] rounded-full animate-spin"></div>
              Chargement de ta vibe...
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Le reste de ton application s'affiche derrière et se révèle à la fin */}
      {children}
    </>
  );
}