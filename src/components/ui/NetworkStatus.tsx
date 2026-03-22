"use client";

import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { WifiOff } from "lucide-react";

export function NetworkStatus() {
  const [isOffline, setIsOffline] = useState(false);

  useEffect(() => {
    // 1. On vérifie l'état au moment où l'app s'ouvre
    if (typeof navigator !== "undefined") {
      setIsOffline(!navigator.onLine);
    }

    // 2. Les fonctions qui s'activent quand le réseau change
    const handleOnline = () => setIsOffline(false);
    const handleOffline = () => setIsOffline(true);

    // 3. On met le radar sur écoute
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    // 4. On nettoie si le composant est démonté
    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  return (
    <AnimatePresence>
      {isOffline && (
        <motion.div
          initial={{ opacity: 0, y: -50 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -50 }}
          transition={{ duration: 0.4, ease: "easeOut" }}
          className="fixed top-6 left-0 w-full z-[9999] flex justify-center p-4 pointer-events-none"
        >
          <div className="bg-red-500/90 backdrop-blur-md text-white px-6 py-3 rounded-full shadow-[0_15px_30px_rgba(239,68,68,0.4)] flex items-center gap-3 pointer-events-auto border border-red-400">
            <WifiOff className="w-5 h-5 animate-pulse" />
            <span className="font-bold text-sm tracking-wide">Connexion perdue - Mode Hors-ligne</span>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}