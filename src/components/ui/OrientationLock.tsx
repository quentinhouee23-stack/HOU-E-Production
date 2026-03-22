"use client";

import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Smartphone } from "lucide-react";

export function OrientationLock() {
  const [isLandscape, setIsLandscape] = useState(false);

  useEffect(() => {
    const checkOrientation = () => {
      // On considère paysage si la largeur est plus grande que la hauteur ET que c'est un mobile
      const landscape = window.innerWidth > window.innerHeight && window.innerWidth < 1024;
      setIsLandscape(landscape);
    };

    window.addEventListener("resize", checkOrientation);
    window.addEventListener("orientationchange", checkOrientation);
    checkOrientation();

    return () => {
      window.removeEventListener("resize", checkOrientation);
      window.removeEventListener("orientationchange", checkOrientation);
    };
  }, []);

  return (
    <AnimatePresence>
      {isLandscape && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[100000] bg-[#0e0e0e] flex flex-col items-center justify-center text-center p-10"
        >
          <motion.div
            animate={{ rotate: [0, -90, 0] }}
            transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
            className="mb-8 text-[#1db954]"
          >
            <Smartphone size={80} strokeWidth={1.5} />
          </motion.div>
          
          <h2 className="text-2xl font-black text-white mb-4 uppercase tracking-tighter">
            Mode Portrait uniquement
          </h2>
          <p className="text-white/50 max-w-xs leading-relaxed">
            HOUÉE est conçue pour être utilisée verticalement. Retourne ton téléphone pour continuer l'expérience.
          </p>

          <div className="absolute bottom-10">
            <h1 className="text-xl text-white/20 tracking-widest font-bold uppercase">HOUÉE</h1>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}