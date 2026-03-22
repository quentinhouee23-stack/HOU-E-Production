// @ts-nocheck
"use client";

import React from "react";
import Link from "next/link";
import { useAuth } from "@/context/AuthContext";
import { motion } from "framer-motion";
import { User } from "lucide-react"; 

export function Header() {
  const { user } = useAuth();
  
  return (
    // 🟢 CORRECTION : pt-[env(safe-area-inset-top)] permet de glisser sous l'encoche
    <header className="fixed top-0 left-0 w-full z-[500] flex items-center justify-between px-4 sm:px-8 pb-4 pt-[calc(env(safe-area-inset-top)+1rem)] bg-[#121212]/95 backdrop-blur-md border-b border-white/5">
      
      <Link href="/" className="hover:opacity-80 transition-opacity">
        <h1 
          className="text-3xl text-white tracking-widest mt-1" 
          style={{ fontFamily: "'Dancing Script', 'Brush Script MT', cursive", fontWeight: 600 }}
        >
          HOUÉE
        </h1>
      </Link>
      
      <div className="flex items-center gap-4 mt-1">
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