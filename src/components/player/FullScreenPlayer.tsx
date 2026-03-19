// @ts-nocheck
"use client";

import React, { useState, useEffect } from "react";
import Image from "next/image"; // 🟢 IMPORT DU COMPOSANT OPTIMISÉ
import { useMusic } from "@/context/MusicContext";
import { motion, AnimatePresence } from "framer-motion";
import { Moon, X, Clock } from "lucide-react";

export function FullScreenPlayer() {
  const { 
    currentTrack, status, duration, 
    togglePlayPause, seek, isFullScreen, setIsFullScreen,
    playNext, playPrev, toggleShuffle, isShuffle,
    toggleRepeat, repeatMode,
    sleepMode, sleepSeconds, setSleepMode 
  } = useMusic();

  const [showSleepMenu, setShowSleepMenu] = useState(false);
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

  const formatTime = (seconds: number) => {
    if (!seconds || isNaN(seconds)) return "0:00";
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${s < 10 ? "0" : ""}${s}`;
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newTime = Number(e.target.value);
    setLocalTime(newTime);
    seek(newTime);
  };

  const handleSetTimer = (mode: any) => {
    setSleepMode(mode);
    setShowSleepMenu(false);
  };

  const progress = duration > 0 ? (localTime / duration) * 100 : 0;

  return (
    <AnimatePresence>
      {isFullScreen && currentTrack && (
        <motion.div 
          initial={{ y: "100%", opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: "100%", opacity: 0 }}
          transition={{ type: "spring", damping: 25, stiffness: 200 }}
          drag="y"
          dragConstraints={{ top: 0, bottom: 0 }}
          dragElastic={{ top: 0, bottom: 0.8 }}
          onDragEnd={(e, info) => {
            if (info.offset.y > 100 || info.velocity.y > 500) {
              setIsFullScreen(false);
            }
          }}
          className="fixed inset-0 z-[99999] bg-[#121212] flex flex-col h-[100dvh] overflow-hidden touch-pan-y"
        >
          {/* 🟢 FOND FLOU OPTIMISÉ */}
          <div className="absolute inset-0 opacity-20 blur-[100px] pointer-events-none scale-150">
            {currentTrack.image && (
              <Image 
                src={currentTrack.image} 
                alt="" 
                fill 
                className="object-cover" 
              />
            )}
          </div>

          <div className="relative z-10 flex flex-col h-full p-6 sm:p-10 max-w-lg mx-auto w-full">
            
            <div className="flex items-center justify-between mb-4 shrink-0">
              <button onClick={() => setIsFullScreen(false)} className="w-12 h-12 flex items-center justify-center rounded-full bg-white/5 hover:bg-white/10 text-white transition-colors">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg>
              </button>
              
              <div className="flex flex-col items-center pointer-events-none">
                <span className="text-xs font-bold uppercase tracking-widest text-white/50">Lecture en cours</span>
                {sleepSeconds !== null && (
                  <span className="text-[10px] font-bold text-purple-400 mt-1 flex items-center gap-1">
                    <Clock className="w-3 h-3" /> {formatTime(sleepSeconds)}
                  </span>
                )}
              </div>

              <button 
                onClick={() => setShowSleepMenu(true)} 
                className={`w-12 h-12 flex items-center justify-center rounded-full transition-colors ${sleepMode ? 'bg-purple-500/20 text-purple-400' : 'bg-white/5 hover:bg-white/10 text-white'}`}
              >
                <Moon className="w-5 h-5" />
              </button>
            </div>

            {/* 🟢 POCHETTE D'ALBUM OPTIMISÉE (ajout de 'relative' et 'priority') */}
            <div className="flex-1 min-h-0 flex items-center justify-center py-4 pointer-events-none">
              <div className="relative w-full h-full max-h-[400px] max-w-[400px] aspect-square bg-white/5 rounded-2xl shadow-[0_20px_50px_rgba(0,0,0,0.5)] overflow-hidden shrink-0">
                 {currentTrack.image ? (
                   <Image 
                     src={currentTrack.image} 
                     alt={currentTrack.title} 
                     fill
                     sizes="(max-width: 768px) 100vw, 400px"
                     priority // Dit au navigateur de charger ça instantanément
                     className="object-cover" 
                   />
                 ) : (
                   <div className="absolute inset-0 flex items-center justify-center text-6xl">🎵</div>
                 )}
              </div>
            </div>

            <div className="shrink-0 pb-6">
              <div className="overflow-hidden mb-6 pointer-events-none">
                <h1 className="text-2xl sm:text-3xl font-black mb-1 truncate text-white">{currentTrack.title}</h1>
                <p className="text-white/60 text-lg truncate">{currentTrack.artist}</p>
              </div>

              <div className="mb-8 group">
                <input 
                  type="range" min={0} max={duration || 100} value={localTime} onChange={handleSeek}
                  onPointerDown={(e) => e.stopPropagation()} 
                  className="w-full h-1.5 appearance-none rounded-full outline-none cursor-pointer bg-white/20"
                  style={{ background: `linear-gradient(to right, #1db954 ${progress}%, rgba(255,255,255,0.2) ${progress}%)` }}
                />
                <div className="flex justify-between text-xs text-white/50 mt-2 font-mono pointer-events-none">
                  <span>{formatTime(localTime)}</span>
                  <span>{formatTime(duration)}</span>
                </div>
              </div>

              <div className="flex items-center justify-between px-2 sm:px-6" onPointerDown={(e) => e.stopPropagation()}>
                <button onClick={toggleShuffle} className={`p-2 transition-colors ${isShuffle ? 'text-[#1db954]' : 'text-white/40 hover:text-white'}`}>
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="16 3 21 3 21 8"></polyline><line x1="4" y1="20" x2="21" y2="3"></line><polyline points="21 16 21 21 16 21"></polyline><line x1="15" y1="15" x2="21" y2="21"></line><line x1="4" y1="4" x2="9" y2="9"></line></svg>
                </button>

                <div className="flex items-center gap-6 sm:gap-8">
                  <button onClick={playPrev} className="text-white/80 hover:text-white transition-colors">
                    <svg width="32" height="32" viewBox="0 0 24 24" fill="currentColor"><polygon points="19 20 9 12 19 4 19 20"></polygon><line x1="5" y1="19" x2="5" y2="5" stroke="currentColor" strokeWidth="2"></line></svg>
                  </button>

                  <button onClick={togglePlayPause} className="w-20 h-20 flex items-center justify-center rounded-full bg-[#1db954] text-black hover:scale-105 transition-transform shadow-xl">
                    {status === "playing" ? (
                      <svg width="32" height="32" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16"></rect><rect x="14" y="4" width="4" height="16"></rect></svg>
                    ) : (
                      <svg width="32" height="32" viewBox="0 0 24 24" fill="currentColor" className="ml-2"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg>
                    )}
                  </button>

                  <button onClick={playNext} className="text-white/80 hover:text-white transition-colors">
                    <svg width="32" height="32" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 4 15 12 5 20 5 4"></polygon><line x1="19" y1="5" x2="19" y2="19" stroke="currentColor" strokeWidth="2"></line></svg>
                  </button>
                </div>

                <button onClick={toggleRepeat} className={`p-2 transition-colors ${repeatMode !== 'off' ? 'text-[#1db954]' : 'text-white/40 hover:text-white'}`}>
                  {repeatMode === "one" ? (
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="17 1 21 5 17 9"></polyline>
                      <path d="M3 11V9a4 4 0 0 1 4-4h14"></path>
                      <polyline points="7 23 3 19 7 15"></polyline>
                      <path d="M21 13v2a4 4 0 0 1-4 4H3"></path>
                      <text x="12" y="15" fontSize="8" textAnchor="middle" strokeWidth="1" stroke="none" fill="currentColor" fontFamily="sans-serif" fontWeight="bold">1</text>
                    </svg>
                  ) : (
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="17 1 21 5 17 9"></polyline>
                      <path d="M3 11V9a4 4 0 0 1 4-4h14"></path>
                      <polyline points="7 23 3 19 7 15"></polyline>
                      <path d="M21 13v2a4 4 0 0 1-4 4H3"></path>
                    </svg>
                  )}
                </button>
              </div>

            </div>
          </div>

          {/* OVERLAY DU MINUTEUR DE SOMMEIL */}
          <AnimatePresence>
            {showSleepMenu && (
              <div 
                className="absolute inset-0 z-[100000] flex items-end bg-black/60 backdrop-blur-sm" 
                onClick={() => setShowSleepMenu(false)}
                onPointerDown={(e) => e.stopPropagation()} 
              >
                <motion.div 
                  initial={{ y: "100%" }}
                  animate={{ y: 0 }}
                  exit={{ y: "100%" }}
                  transition={{ type: "spring", damping: 25, stiffness: 300 }}
                  onClick={(e) => e.stopPropagation()}
                  className="bg-[#1c1c1e] w-full rounded-t-[32px] p-6 pb-12 border-t border-white/10 shadow-2xl"
                >
                  <div className="flex items-center justify-between mb-6">
                    <h2 className="text-2xl font-black text-white">Minuteur</h2>
                    <button onClick={() => setShowSleepMenu(false)} className="w-10 h-10 bg-white/10 hover:bg-white/20 rounded-full flex items-center justify-center transition-colors text-white">
                      <X className="w-5 h-5" />
                    </button>
                  </div>
                  
                  <div className="space-y-2">
                    <button onClick={() => handleSetTimer("15")} className={`w-full flex items-center justify-between p-4 rounded-2xl font-bold transition-colors ${sleepMode === "15" ? "bg-purple-500 text-white" : "bg-white/5 text-white hover:bg-white/10"}`}>
                      15 minutes {sleepMode === "15" && <span>✓</span>}
                    </button>
                    <button onClick={() => handleSetTimer("30")} className={`w-full flex items-center justify-between p-4 rounded-2xl font-bold transition-colors ${sleepMode === "30" ? "bg-purple-500 text-white" : "bg-white/5 text-white hover:bg-white/10"}`}>
                      30 minutes {sleepMode === "30" && <span>✓</span>}
                    </button>
                    <button onClick={() => handleSetTimer("45")} className={`w-full flex items-center justify-between p-4 rounded-2xl font-bold transition-colors ${sleepMode === "45" ? "bg-purple-500 text-white" : "bg-white/5 text-white hover:bg-white/10"}`}>
                      45 minutes {sleepMode === "45" && <span>✓</span>}
                    </button>
                    <button onClick={() => handleSetTimer("60")} className={`w-full flex items-center justify-between p-4 rounded-2xl font-bold transition-colors ${sleepMode === "60" ? "bg-purple-500 text-white" : "bg-white/5 text-white hover:bg-white/10"}`}>
                      1 heure {sleepMode === "60" && <span>✓</span>}
                    </button>
                    <button onClick={() => handleSetTimer("playlistEnd")} className={`w-full flex items-center justify-between p-4 rounded-2xl font-bold transition-colors ${sleepMode === "playlistEnd" ? "bg-purple-500 text-white" : "bg-white/5 text-white hover:bg-white/10"}`}>
                      Fin de la playlist {sleepMode === "playlistEnd" && <span>✓</span>}
                    </button>

                    {sleepMode !== null && (
                      <button onClick={() => handleSetTimer(null)} className="w-full flex items-center justify-center p-4 mt-4 rounded-2xl font-bold transition-colors bg-red-500/10 text-red-500 hover:bg-red-500/20">
                        Désactiver le minuteur
                      </button>
                    )}
                  </div>
                </motion.div>
              </div>
            )}
          </AnimatePresence>

        </motion.div>
      )}
    </AnimatePresence>
  );
}