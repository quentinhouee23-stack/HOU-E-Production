// @ts-nocheck
"use client";

import React, { useState, useEffect } from "react";
import Image from "next/image"; // 🟢 Images optimisées
import { useMusic } from "@/context/MusicContext";
import { Play, Pause, SkipBack, SkipForward, Maximize2, ListMusic } from "lucide-react"; 

export function MiniPlayer() {
  const { currentTrack, status, duration, togglePlayPause, playNext, playPrev, seek, setIsFullScreen } = useMusic();
  const [localTime, setLocalTime] = useState(0);

  useEffect(() => {
    const handleTimeUpdate = (e: any) => {
      setLocalTime(e.detail.currentTime);
    };
    window.addEventListener("musicTimeUpdate", handleTimeUpdate);
    return () => window.removeEventListener("musicTimeUpdate", handleTimeUpdate);
  }, []);

  useEffect(() => {
    setLocalTime(0);
  }, [currentTrack?.id]);

  if (!currentTrack) return null;

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newTime = Number(e.target.value);
    setLocalTime(newTime);
    seek(newTime);
  };

  const progress = duration > 0 ? (localTime / duration) * 100 : 0;

  return (
    <div 
      className="fixed bottom-24 left-4 right-4 z-40 cursor-pointer rounded-2xl bg-[#1c1c1e]/95 backdrop-blur-xl border border-white/5 shadow-[0_15px_35px_rgba(0,0,0,0.5)] transition-all duration-300 group overflow-hidden"
      onClick={(e) => {
        const target = e.target as HTMLElement;
        const isInteractive = target.closest('button') || target.tagName === 'INPUT';
        if (!isInteractive) {
          setIsFullScreen(true);
        }
      }}
    >
      {/* 🟢 BARRE DE SON FIXE ET ÉPAISSE EN HAUT */}
      <div className="absolute top-0 left-0 w-full h-1.5 bg-white/10 z-40">
        <div 
          className="h-full bg-[#1db954]"
          style={{ width: `${progress}%` }}
        />
        {/* Zone de clic invisible élargie pour mobile */}
        <input 
          type="range" 
          min={0} 
          max={duration || 100} 
          value={localTime} 
          onChange={handleSeek}
          className="absolute -top-2 left-0 w-full h-6 opacity-0 cursor-pointer z-50"
        />
      </div>
      
      {/* On ajoute un peu de margin-top (mt-1.5) pour ne pas coller à la barre */}
      <div className="flex items-center justify-between px-3 sm:px-4 py-2 sm:py-3 mt-1.5">
        <div className="flex items-center gap-3 overflow-hidden flex-1">
          <div className="w-10 h-10 sm:w-12 sm:h-12 bg-white/5 rounded-md flex-shrink-0 overflow-hidden shadow-md relative flex items-center justify-center">
            {currentTrack.image ? (
              <Image 
                src={currentTrack.image} 
                alt={currentTrack.title} 
                fill
                sizes="48px"
                className="object-cover" 
              />
            ) : (
              <ListMusic className="w-5 h-5 text-white/40" />
            )}
          </div>
          <div className="flex flex-col overflow-hidden pr-2">
            <span className="font-bold text-sm text-white truncate">{currentTrack.title}</span>
            <span className="text-xs text-white/60 truncate">{currentTrack.artist}</span>
          </div>
        </div>

        <div className="flex items-center gap-1 sm:gap-2 shrink-0">
          <button 
            onClick={(e) => { e.stopPropagation(); playPrev(); }}
            className="w-10 h-10 flex items-center justify-center text-white/60 hover:text-white transition-colors"
          >
            <SkipBack className="w-5 h-5 fill-current" />
          </button>

          <button 
            onClick={(e) => { e.stopPropagation(); togglePlayPause(); }}
            className="w-12 h-12 flex-shrink-0 flex items-center justify-center rounded-full bg-white text-black hover:scale-105 transition-transform shadow-lg"
          >
            {status === "playing" ? (
               <Pause className="w-5 h-5 fill-current" />
            ) : (
               <Play className="w-5 h-5 fill-current ml-1" />
            )}
          </button>

          <button 
            onClick={(e) => { e.stopPropagation(); playNext(); }}
            className="w-10 h-10 flex items-center justify-center text-white/60 hover:text-white transition-colors"
          >
            <SkipForward className="w-5 h-5 fill-current" />
          </button>

          <button 
            onClick={(e) => { e.stopPropagation(); setIsFullScreen(true); }}
            className="w-10 h-10 items-center justify-center text-white/40 hover:text-white transition-colors opacity-0 group-hover:opacity-100 hidden md:flex ml-1"
            title="Plein écran"
          >
            <Maximize2 className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}