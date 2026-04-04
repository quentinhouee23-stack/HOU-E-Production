// @ts-nocheck
"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/context/AuthContext";
import { motion } from "framer-motion";
import { User, Activity } from "lucide-react"; 
import { supabase } from "@/lib/supabase";

export function Header() {
  const { user } = useAuth();
  const [tokensUsed, setTokensUsed] = useState(0);
  
  useEffect(() => {
    const fetchTokens = async () => {
      try {
        const today = new Date().toISOString().split('T')[0];
        const { data } = await supabase.from('api_usage').select('tokens').eq('date', today).single();
        if (data) {
          setTokensUsed(data.tokens);
        }
      } catch (e) {
        console.error("Erreur lecture tokens", e);
      }
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

  return (
    <header className="fixed top-0 left-0 w-full z-[500] flex items-center justify-between px-4 sm:px-8 pb-4 pt-[calc(env(safe-area-inset-top)+1rem)] bg-[#121212]/95 backdrop-blur-md border-b border-white/5">
      
      <Link href="/" className="hover:opacity-80 transition-opacity flex items-center gap-4">
        <h1 
          className="text-3xl text-white tracking-widest mt-1" 
          style={{ fontFamily: "'Dancing Script', 'Brush Script MT', cursive", fontWeight: 600 }}
        >
          HOUÉE
        </h1>
      </Link>
      
      <div className="flex items-center gap-4 mt-1">
        
        {/* 🟢 CORRECTION : Retrait du "hidden sm:flex" pour l'afficher sur mobile */}
        {user && (
          <div className="flex flex-col items-end mr-2 cursor-help group" title={`${tokensUsed} / 10000 jetons utilisés aujourd'hui`}>
            <div className="flex items-center gap-1.5 mb-1">
              <Activity className="w-3 h-3 text-white/50 group-hover:text-white transition-colors" />
              <span className="text-[10px] text-white/50 font-mono font-bold group-hover:text-white transition-colors">
                API : {tokensUsed}
              </span>
            </div>
            <div className="w-20 h-1.5 bg-white/10 rounded-full overflow-hidden">
              <motion.div 
                initial={{ width: 0 }}
                animate={{ width: `${tokenPercentage}%` }}
                className={`h-full rounded-full ${getProgressColor()}`}
              />
            </div>
          </div>
        )}

        {user ? (
          <Link href="/profile" className="flex items-center gap-3 rounded-full focus:outline-none group">
            <motion.span
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              className="relative w-10 h-10 rounded-full overflow-hidden ring-1 ring-white/20 group-hover:ring-[#1db954] transition-all flex items-center justify-center bg-gradient-to-br from-[#1c1c1e] to-black shadow-lg"
            >
              <span 
                className="text-white text-xl translate-y-[1px] translate-x-[1px]" 
                style={{ fontFamily: "'Dancing Script', 'Brush Script MT', cursive", fontWeight: 600 }}
              >
                H
              </span>
            </motion.span>
          </Link>
        ) : (
          <Link href="/login" className="flex items-center gap-2 bg-white text-black hover:bg-gray-200 transition-colors px-5 py-2 rounded-full text-sm font-bold shadow-lg">
            <User className="w-4 h-4" />
            Connexion
          </Link>
        )}
      </div>
    </header>
  );
}