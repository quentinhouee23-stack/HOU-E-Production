// @ts-nocheck
"use client";

import React, { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import type { Track } from "@/types";
import { motion, AnimatePresence } from "framer-motion";
import { 
  X, Flame, Mic2, Crown, Car, Coffee, Dumbbell, Radio, Star, 
  Wand2, Clock, Sparkles, ArrowLeft, Loader2, Music, CheckCircle2 
} from "lucide-react";
import { cn } from "@/lib/utils";

interface PlaylistWizardProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (playlistName: string, tracks: Track[]) => void;
}

const VIBES = [
  { id: "phonk", label: "Phonk", icon: Flame, query: "phonk drift" },
  { id: "rapfr", label: "Rap FR", icon: Mic2, query: "rap francais" },
  { id: "rapus", label: "Rap US", icon: Crown, query: "hip hop rap us" },
  { id: "voiture", label: "Voiture", icon: Car, query: "car music night drive" },
  { id: "chill", label: "Chill", icon: Coffee, query: "chill lofi" },
  { id: "muscu", label: "Muscu", icon: Dumbbell, query: "workout gym hard" },
  { id: "house", label: "House", icon: Radio, query: "house club" },
  { id: "pop", label: "Pop", icon: Star, query: "pop hits" },
];

const variants = {
  enter: { opacity: 0, x: 20, scale: 0.98 },
  center: { opacity: 1, x: 0, scale: 1 },
  exit: { opacity: 0, x: -20, scale: 0.98 }
};

export function PlaylistWizard({ isOpen, onClose, onSave }: PlaylistWizardProps) {
  const [step, setStep] = useState(1);
  
  const [selectedVibe, setSelectedVibe] = useState<any>(null);
  const [durationMin, setDurationMin] = useState(30); 
  const [discoveryMode, setDiscoveryMode] = useState(false); 
  
  const [isLoading, setIsLoading] = useState(false);
  const [suggestions, setSuggestions] = useState<Track[]>([]);
  const [totalTime, setTotalTime] = useState(0);

  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // 🟢 LE VERROU DE SCROLL : Bloque le fond quand la modale est ouverte
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    
    // Nettoyage de sécurité si le composant est détruit
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  const handleClose = () => {
    onClose();
    setTimeout(() => {
      setStep(1);
      setSelectedVibe(null);
      setDurationMin(30);
      setDiscoveryMode(false);
      setSuggestions([]);
    }, 300);
  };

  const generateSmartPlaylist = async () => {
    setIsLoading(true);
    setStep(3);

    try {
      const targetSeconds = durationMin * 60;
      const res = await fetch(`/api/smart-playlist?vibe=${encodeURIComponent(selectedVibe.query)}&duration=${targetSeconds}&discovery=${discoveryMode}`);
      const data = await res.json();
      
      if (data.tracks) {
        setSuggestions(data.tracks);
        setTotalTime(data.totalSeconds);
        setStep(4);
      }
    } catch (error) {
      console.error("Erreur génération :", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleFinalize = () => {
    const modeName = discoveryMode ? "Pépites" : "Mix";
    const finalName = `${selectedVibe.label} ${modeName} - ${durationMin}m`;
    onSave(finalName, suggestions);
    
    setStep(1);
    setSelectedVibe(null);
    setSuggestions([]);
  };

  const displayTotalTime = Math.round(totalTime / 60);

  const WizardContent = (
    <AnimatePresence>
      {isOpen && (
        <div 
          // 🟢 CENTRAGE ABSOLU : w-full h-[100dvh] + flex items-center justify-center pour centrer la modale
          className="fixed inset-0 z-[99999] flex items-center justify-center p-4 w-full h-[100dvh]"
        >
          {/* 🟢 FOND ABSORBANT : touch-none empêche le scroll baveux sur l'arrière-plan */}
          <div 
            className="absolute inset-0 bg-black/80 backdrop-blur-md touch-none"
            onClick={handleClose}
          />
          
          <motion.div 
            // 🟢 ANIMATION CENTRALE : On utilise scale au lieu de y: "100%" pour un effet de pop-up au centre
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.95, opacity: 0 }}
            transition={{ type: "spring", damping: 25, stiffness: 300 }}
            onClick={(e) => e.stopPropagation()}
            // 🟢 DESIGN UNIFIÉ : rounded-[32px] partout au lieu du tiroir (rounded-t), et max-h-[90dvh] pour ne pas déborder
            className="relative w-full max-w-sm sm:max-w-md bg-[#1c1c1e] rounded-[32px] border border-white/10 shadow-2xl flex flex-col max-h-[90dvh] overflow-hidden pointer-events-auto"
          >
            
            {/* Header Modale */}
            <div className="p-6 flex justify-between items-center shrink-0 border-b border-white/5 relative z-10 touch-none">
              <h2 className="text-2xl font-black text-white flex items-center gap-2">
                <Wand2 className="w-6 h-6 text-[#1db954]" /> Mix Magique
              </h2>
              <button 
                onClick={handleClose} 
                className="w-10 h-10 flex items-center justify-center rounded-full bg-white/10 hover:bg-white/20 transition-colors text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Content Area (Zone Scrollable de la modale) */}
            <div className="flex-1 overflow-x-hidden overflow-y-auto overscroll-contain custom-scrollbar px-6 py-6 relative">
              <AnimatePresence mode="wait">
                
                {/* STEP 1 : CHOIX DE LA VIBE */}
                {step === 1 && (
                  <motion.div 
                    key="step1" variants={variants} initial="enter" animate="center" exit="exit" transition={{ duration: 0.3 }}
                    className="space-y-6"
                  >
                    <div>
                      <h3 className="text-xl font-bold mb-1 text-white">Quelle est ta vibe ?</h3>
                      <p className="text-white/50 text-sm">On va te créer une ambiance sur mesure.</p>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-3 sm:gap-4">
                      {VIBES.map((vibe) => (
                        <button
                          key={vibe.id}
                          onClick={() => { setSelectedVibe(vibe); setStep(2); }}
                          className="p-4 sm:p-5 rounded-2xl bg-white/5 border border-white/10 hover:bg-[#1db954]/10 hover:border-[#1db954]/50 transition-all text-left flex flex-col items-start gap-3 group"
                        >
                          <div className="p-3 rounded-full bg-white/5 group-hover:bg-[#1db954]/20 transition-colors">
                            <vibe.icon className="w-6 h-6 text-white/50 group-hover:text-[#1db954] transition-colors" />
                          </div>
                          <span className="font-bold text-sm sm:text-base text-white group-hover:text-[#1db954] transition-colors w-full break-words">{vibe.label}</span>
                        </button>
                      ))}
                    </div>
                  </motion.div>
                )}

                {/* STEP 2 : PARAMETRES DU MIX */}
                {step === 2 && (
                  <motion.div 
                    key="step2" variants={variants} initial="enter" animate="center" exit="exit" transition={{ duration: 0.3 }}
                    className="space-y-8 flex flex-col min-h-full"
                  >
                    <div>
                      <button onClick={() => setStep(1)} className="text-white/50 text-sm font-bold hover:text-white flex items-center gap-1 mb-6 transition-colors">
                        <ArrowLeft className="w-4 h-4" /> Retour aux vibes
                      </button>
                      <h3 className="text-2xl font-black mb-2 text-white flex items-center gap-2">
                        Ajuste ton Mix <span className="text-[#1db954]">{selectedVibe?.label}</span>
                      </h3>
                      <p className="text-white/50 text-sm">Définis les règles, l'IA s'occupe du reste.</p>
                    </div>

                    <div className="space-y-4 flex-1">
                      <div className="bg-white/5 p-6 rounded-3xl border border-white/10">
                         <div className="flex justify-between items-end mb-6">
                           <span className="font-bold text-white flex items-center gap-2"><Clock className="w-5 h-5 text-white/50" /> Durée totale</span>
                           <span className="text-[#1db954] font-black text-2xl">{durationMin} min</span>
                         </div>
                         <input 
                           type="range" min="15" max="120" step="15"
                           value={durationMin} onChange={(e) => setDurationMin(Number(e.target.value))}
                           className="w-full accent-[#1db954] h-2 bg-white/10 rounded-full appearance-none outline-none"
                         />
                         <div className="flex justify-between text-xs font-bold text-white/40 mt-4 uppercase tracking-wider">
                           <span>Court</span>
                           <span>Long</span>
                         </div>
                      </div>

                      <button 
                        onClick={() => setDiscoveryMode(!discoveryMode)}
                        className={cn(
                          "w-full p-6 rounded-3xl border transition-all text-left relative overflow-hidden group",
                          discoveryMode ? "bg-[#1db954]/10 border-[#1db954]/50" : "bg-white/5 border-white/10 hover:bg-white/10"
                        )}
                      >
                         <div className="flex items-center justify-between relative z-10">
                           <div className="pr-4">
                             <span className={cn("font-black text-lg block mb-1 flex items-center gap-2", discoveryMode ? "text-[#1db954]" : "text-white")}>
                               <Sparkles className={cn("w-5 h-5", discoveryMode ? "text-[#1db954]" : "text-white/50")} /> Mode Pépites
                             </span>
                             <span className="text-xs text-white/50 leading-relaxed block">
                               Ignore les hits commerciaux pour te faire découvrir des sons rares.
                             </span>
                           </div>
                           <div className={cn("w-14 h-8 rounded-full flex items-center p-1 transition-colors shrink-0", discoveryMode ? 'bg-[#1db954]' : 'bg-white/20')}>
                             <div className={cn("w-6 h-6 rounded-full bg-white transition-transform shadow-sm", discoveryMode ? 'translate-x-6' : '')} />
                           </div>
                         </div>
                         {discoveryMode && <div className="absolute -right-4 -bottom-4 opacity-10 pointer-events-none"><Sparkles className="w-32 h-32 text-[#1db954]" /></div>}
                      </button>
                    </div>

                    <div className="pt-4 shrink-0 border-t border-white/5">
                      <button 
                        onClick={generateSmartPlaylist}
                        className="w-full bg-[#1db954] text-black font-black text-lg py-4 rounded-full hover:scale-[1.02] transition-transform shadow-[0_0_20px_rgba(29,185,84,0.3)] flex items-center justify-center gap-2"
                      >
                        <Wand2 className="w-5 h-5" /> Générer la magie
                      </button>
                    </div>
                  </motion.div>
                )}

                {/* STEP 3 : CHARGEMENT */}
                {step === 3 && isLoading && (
                  <motion.div 
                    key="step3" variants={variants} initial="enter" animate="center" exit="exit" transition={{ duration: 0.3 }}
                    className="flex flex-col items-center justify-center h-full py-20 space-y-8"
                  >
                    <div className="relative w-32 h-32 flex items-center justify-center">
                       <div className="absolute inset-0 border-4 border-transparent border-t-[#1db954] rounded-full animate-spin opacity-20"></div>
                       <div className="absolute inset-2 border-4 border-transparent border-l-[#1db954] rounded-full animate-spin-reverse"></div>
                       <Wand2 className="w-10 h-10 text-[#1db954] animate-pulse" />
                    </div>
                    <div className="text-center px-4">
                      <h3 className="font-black text-2xl text-white mb-2">L'IA prépare ton mix</h3>
                      <p className="text-[#1db954] font-medium text-sm animate-pulse">
                        {discoveryMode ? 'Recherche de pépites rares en cours...' : 'Alignement des fréquences...'}
                      </p>
                    </div>
                  </motion.div>
                )}

                {/* STEP 4 : RESULTAT */}
                {step === 4 && (
                  <motion.div 
                    key="step4" variants={variants} initial="enter" animate="center" exit="exit" transition={{ duration: 0.3 }}
                    className="space-y-6 flex flex-col min-h-full"
                  >
                    <div className="text-center bg-[#1db954]/10 p-8 rounded-3xl border border-[#1db954]/20 relative overflow-hidden">
                      <div className="absolute -top-10 -right-10 opacity-10 pointer-events-none"><Music className="w-40 h-40 text-[#1db954] rotate-12" /></div>
                      <CheckCircle2 className="w-12 h-12 text-[#1db954] mx-auto mb-4" />
                      <h3 className="text-3xl font-black text-white mb-2">Mix Parfait !</h3>
                      <p className="text-white/70 text-sm">
                        <span className="font-bold text-[#1db954]">{suggestions.length} titres</span> trouvés pour un total de <span className="font-bold text-white">{displayTotalTime} minutes</span>.
                      </p>
                    </div>
                    
                    <div className="flex-1 min-h-[20vh] bg-white/5 rounded-3xl border border-white/10 p-2 overflow-hidden flex flex-col">
                      <div className="p-4 pb-2 text-xs font-bold text-white/50 uppercase tracking-widest flex items-center justify-between">
                        <span>Aperçu des titres</span>
                      </div>
                      <div className="overflow-y-auto flex-1 px-2 pb-2 custom-scrollbar">
                        {suggestions.map((track, i) => (
                            <div key={track.id} className="flex items-center gap-3 p-2 hover:bg-white/5 rounded-xl transition-all">
                              <span className="w-5 text-xs font-bold text-white/30 text-right shrink-0">{i+1}</span>
                              <img src={track.image} className="w-10 h-10 object-cover rounded-lg shadow-md shrink-0" />
                              <div className="flex-1 min-w-0">
                                <span className="text-sm font-bold text-white truncate block">{track.title}</span>
                                <span className="text-xs text-white/50 truncate block">{track.artist}</span>
                              </div>
                              <span className="text-xs font-bold text-white/40 shrink-0 pr-2">{track.duration}</span>
                            </div>
                        ))}
                      </div>
                    </div>

                    <div className="pt-4 shrink-0 border-t border-white/5">
                      <button 
                        onClick={handleFinalize}
                        className="w-full bg-[#1db954] text-black font-black text-lg py-4 rounded-full hover:scale-[1.02] transition-transform shadow-[0_0_20px_rgba(29,185,84,0.3)] flex items-center justify-center gap-2"
                      >
                        <Music className="w-5 h-5" /> Sauvegarder la Playlist
                      </button>
                    </div>
                  </motion.div>
                )}

              </AnimatePresence>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );

  return mounted ? createPortal(WizardContent, document.body) : null;
}