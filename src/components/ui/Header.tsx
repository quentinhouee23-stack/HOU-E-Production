// @ts-nocheck
"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { motion, AnimatePresence } from "framer-motion";
import { User, Activity } from "lucide-react"; 
import { supabase } from "@/lib/supabase";
import { createPortal } from "react-dom"; 

export function Header() {
  const { user } = useAuth();
  const [tokensUsed, setTokensUsed] = useState(0);
  
  const router = useRouter();
  const pathname = usePathname();
  const [isNavigating, setIsNavigating] = useState(false);
  const [mounted, setMounted] = useState(false); 
  
  // 🟢 On vérifie si on est sur le profil
  const isProfilePage = pathname === "/profile";
  
  useEffect(() => { setMounted(true); }, []);

  // Coupe l'overlay dès que la page a changé
  useEffect(() => { setIsNavigating(false); }, [pathname]);

  useEffect(() => {
    const fetchTokens = async () => {
      try {
        const today = new Date().toISOString().split('T')[0];
        const { data } = await supabase.from('api_usage').select('tokens').eq('date', today).single();
        if (data) setTokensUsed(data.tokens);
      } catch (e) { console.error(e); }
    };
    fetchTokens();
    const interval = setInterval(fetchTokens, 60000);
    return () => clearInterval(interval);
  }, []);

  const tokenPercentage = Math.min((tokensUsed / 10000) * 100, 100);
  const getProgressColor = () => {
    if (tokenPercentage < 50) return "bg-[#1db954]";
    if (tokenPercentage < 85) return "bg-orange-500";
    return "bg-red-500";
  };

  const handleProfileClick = (e: React.MouseEvent) => {
    e.preventDefault();
    if (isProfilePage) return; 
    
    setIsNavigating(true); // Phase 1 : Vol vers le centre
    
    setTimeout(() => {
      router.push("/profile"); // Phase 2 : Vol vers le haut du profil
    }, 600);
  };

  return (
    <>
      <header className="fixed top-0 left-0 w-full z-[500] flex items-center justify-between px-4 sm:px-8 pb-4 pt-[calc(env(safe-area-inset-top)+1rem)] bg-[#121212]/95 backdrop-blur-md border-b border-white/5">
        <Link href="/" className="hover:opacity-80 transition-opacity flex items-center gap-4 z-10">
          <h1 className="text-3xl text-white tracking-widest mt-1" style={{ fontFamily: "'Dancing Script', 'Brush Script MT', cursive", fontWeight: 600 }}>
            HOUÉE
          </h1>
        </Link>
        
        <div className="flex items-center gap-4 mt-1 z-10">
          {user && (
            <div className="flex flex-col items-end mr-2 cursor-help group" title={`${tokensUsed} / 10000 jetons utilisés aujourd'hui`}>
              <div className="flex items-center gap-1.5 mb-1">
                <Activity className="w-3 h-3 text-white/50 group-hover:text-white transition-colors" />
                <span className="text-[10px] text-white/50 font-mono font-bold group-hover:text-white transition-colors">API : {tokensUsed}</span>
              </div>
              <div className="w-20 h-1.5 bg-white/10 rounded-full overflow-hidden">
                <motion.div initial={{ width: 0 }} animate={{ width: `${tokenPercentage}%` }} className={`h-full rounded-full ${getProgressColor()}`} />
              </div>
            </div>
          )}

          {user ? (
            <Link href="/profile" onClick={handleProfileClick} className="flex items-center gap-3 rounded-full focus:outline-none group">
              <div className="relative w-10 h-10">
                {/* 🟢 Si on navigue OU qu'on est déjà sur le profil, le header cède son layoutId */}
                {!isNavigating && !isProfilePage ? (
                  <motion.div
                    layoutId="profile-avatar"
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    className="absolute inset-0 rounded-full overflow-hidden ring-1 ring-white/20 group-hover:ring-[#1db954] transition-all flex items-center justify-center bg-gradient-to-br from-[#1c1c1e] to-black shadow-lg z-20"
                  >
                    <span className="text-white text-xl translate-y-[1px] translate-x-[1px]" style={{ fontFamily: "'Dancing Script', 'Brush Script MT', cursive", fontWeight: 600 }}>H</span>
                  </motion.div>
                ) : (
                  <div className="absolute inset-0 rounded-full overflow-hidden ring-1 ring-white/20 transition-all flex items-center justify-center bg-gradient-to-br from-[#1c1c1e] to-black shadow-lg z-20 opacity-0" />
                )}
              </div>
            </Link>
          ) : (
            <Link href="/login" className="flex items-center gap-2 bg-white text-black hover:bg-gray-200 transition-colors px-5 py-2 rounded-full text-sm font-bold shadow-lg">
              <User className="w-4 h-4" /> Connexion
            </Link>
          )}
        </div>
      </header>

      {/* ─── L'OVERLAY DE TRANSIT (LE CENTRE) ───────────── */}
      {mounted && createPortal(
        <AnimatePresence>
          {isNavigating && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="fixed top-0 left-0 z-[999999] flex flex-col items-center justify-center bg-[#121212]/95 backdrop-blur-2xl touch-none"
              style={{ width: "100vw", height: "100dvh" }}
            >
               <motion.div
                 layoutId="profile-avatar" // 🟢 C'est ici que l'icône se pose en cours de route !
                 transition={{ type: "spring", stiffness: 200, damping: 25 }}
                 className="relative w-36 h-36 sm:w-48 sm:h-48 rounded-full ring-4 ring-[#1db954] flex items-center justify-center bg-gradient-to-br from-[#1c1c1e] to-black shadow-[0_0_80px_rgba(29,185,84,0.5)] overflow-hidden z-10"
               >
                 <div className="absolute inset-0 bg-gradient-to-t from-[#1db954]/20 to-transparent"></div>
                 <span className="relative text-white text-6xl sm:text-7xl translate-y-[2px] translate-x-[2px]" style={{ fontFamily: "'Dancing Script', 'Brush Script MT', cursive", fontWeight: 600 }}>H</span>
               </motion.div>
            </motion.div>
          )}
        </AnimatePresence>,
        document.body 
      )}
    </>
  );
}