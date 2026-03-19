// @ts-nocheck
"use client";

import React, { useState } from "react";
import type { Track } from "@/types";

interface PlaylistWizardProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (playlistName: string, tracks: Track[]) => void;
}

const VIBES = [
  { id: "phonk", label: "🏎️ Phonk", query: "phonk drift" },
  { id: "rapfr", label: "🎤 Rap FR", query: "rap francais" },
  { id: "rapus", label: "🇺🇸 Rap US", query: "hip hop rap us" },
  { id: "voiture", label: "🚗 Voiture", query: "car music night drive" },
  { id: "chill", label: "☕ Chill", query: "chill lofi" },
  { id: "muscu", label: "💪 Muscu", query: "workout gym hard" },
  { id: "house", label: "🪩 House", query: "house club" },
  { id: "pop", label: "🌟 Pop", query: "pop hits" },
];

export function PlaylistWizard({ isOpen, onClose, onSave }: PlaylistWizardProps) {
  const [step, setStep] = useState(1);
  
  const [selectedVibe, setSelectedVibe] = useState<any>(null);
  const [durationMin, setDurationMin] = useState(30); 
  const [discoveryMode, setDiscoveryMode] = useState(false); 
  
  const [isLoading, setIsLoading] = useState(false);
  const [suggestions, setSuggestions] = useState<Track[]>([]);
  const [totalTime, setTotalTime] = useState(0);

  if (!isOpen) return null;

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
    const finalName = `${selectedVibe.label.replace(/[^a-zA-ZÀ-ÿ\s]/g, "").trim()} ${modeName} - ${durationMin}m`;
    onSave(finalName, suggestions);
    
    setStep(1);
    setSelectedVibe(null);
    setSuggestions([]);
  };

  const displayTotalTime = Math.round(totalTime / 60);

  return (
    <div className="fixed inset-0 z-[99999] flex items-end sm:items-center justify-center p-4 bg-black/80 backdrop-blur-xl transition-all">
      <div className="w-full max-w-xl bg-gradient-to-b from-[#282828] to-[#121212] border border-white/10 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        
        <div className="p-6 pb-4 flex justify-between items-center border-b border-white/5">
          <h2 className="text-xl font-black text-white tracking-tight flex items-center gap-2">
            <span className="text-[#1db954]">✨</span> Smart Mix
          </h2>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-full bg-white/10 text-white/50 hover:text-white hover:bg-white/20 transition-all">
            ✕
          </button>
        </div>

        <div className="p-6 overflow-y-auto flex-1 text-white custom-scrollbar">
          
          {step === 1 && (
            <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
              <div>
                <h3 className="text-2xl font-bold mb-2">Quelle est ta vibe ?</h3>
                <p className="text-[#b3b3b3] text-sm">On va te créer une ambiance sur mesure.</p>
              </div>
              
              <div className="grid grid-cols-2 gap-3">
                {VIBES.map((vibe) => (
                  <button
                    key={vibe.id}
                    onClick={() => { setSelectedVibe(vibe); setStep(2); }}
                    className="p-4 rounded-2xl bg-white/5 border border-white/10 hover:bg-white/10 hover:border-[#1db954] hover:shadow-[0_0_15px_rgba(29,185,84,0.2)] transition-all text-left group"
                  >
                    <span className="font-bold text-base block group-hover:text-[#1db954] transition-colors">{vibe.label}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-8 animate-in fade-in slide-in-from-right-8 duration-500">
              <button onClick={() => setStep(1)} className="text-[#1db954] text-sm font-bold hover:underline">← Changer de vibe</button>
              
              <div>
                <h3 className="text-2xl font-bold mb-1">Ajuste ton Mix <span className="text-[#1db954]">{selectedVibe?.label}</span></h3>
                <p className="text-[#b3b3b3] text-sm mb-6">On remplit la playlist selon tes critères.</p>

                <div className="mb-8 bg-white/5 p-5 rounded-2xl border border-white/10">
                   <div className="flex justify-between mb-4">
                     <span className="font-bold">Durée totale</span>
                     <span className="text-[#1db954] font-black">{durationMin} min</span>
                   </div>
                   <input 
                     type="range" min="15" max="120" step="15"
                     value={durationMin} onChange={(e) => setDurationMin(Number(e.target.value))}
                     className="w-full accent-[#1db954]"
                   />
                   <div className="flex justify-between text-xs text-white/40 mt-2">
                     <span>Trajet court (15m)</span>
                     <span>Long run (2h)</span>
                   </div>
                </div>

                <div className="bg-white/5 p-5 rounded-2xl border border-white/10 flex items-center justify-between cursor-pointer" onClick={() => setDiscoveryMode(!discoveryMode)}>
                   <div>
                     <span className="font-bold block mb-1">Mode Pépites Cachées</span>
                     <span className="text-xs text-white/50">L'IA ignore les hits commerciaux pour te faire découvrir des sons incroyables.</span>
                   </div>
                   <div className={`w-14 h-7 rounded-full flex items-center p-1 transition-colors ${discoveryMode ? 'bg-[#1db954]' : 'bg-white/20'}`}>
                      <div className={`w-5 h-5 rounded-full bg-white transition-transform ${discoveryMode ? 'translate-x-7' : ''}`} />
                   </div>
                </div>
              </div>

              <button 
                onClick={generateSmartPlaylist}
                className="w-full bg-[#1db954] text-black font-black text-lg py-4 rounded-full hover:scale-105 transition-transform shadow-[0_0_20px_rgba(29,185,84,0.4)]"
              >
                Générer la magie ✨
              </button>
            </div>
          )}

          {step === 3 && isLoading && (
            <div className="flex flex-col items-center justify-center py-20 space-y-6">
              <div className="relative w-24 h-24 flex items-center justify-center">
                 <div className="absolute inset-0 border-4 border-transparent border-t-[#1db954] rounded-full animate-spin"></div>
                 <div className="absolute inset-2 border-4 border-transparent border-b-[#1db954] opacity-50 rounded-full animate-spin-reverse"></div>
                 <span className="text-2xl">🎧</span>
              </div>
              <div className="text-center">
                <p className="font-bold text-lg mb-1">L'IA fouille le catalogue...</p>
                <p className="text-[#1db954] text-sm animate-pulse">{discoveryMode ? 'Recherche de pépites rares...' : 'Calcul de la durée...'}</p>
              </div>
            </div>
          )}

          {step === 4 && (
            <div className="space-y-6 animate-in zoom-in-95 duration-500">
              <div className="text-center bg-[#1db954]/10 p-6 rounded-2xl border border-[#1db954]/20">
                <h3 className="text-3xl font-black text-[#1db954] mb-2">Mix Parfait !</h3>
                <p className="text-white/80 font-medium">
                  {suggestions.length} titres trouvés pour un total de <span className="font-bold text-white">{displayTotalTime} minutes</span>.
                </p>
              </div>
              
              <div className="space-y-2 max-h-[30vh] overflow-y-auto pr-2 custom-scrollbar">
                {suggestions.map((track, i) => (
                    <div key={track.id} className="flex items-center gap-4 p-2 hover:bg-white/5 rounded-xl transition-all">
                      <span className="w-4 text-xs text-white/30 text-right">{i+1}</span>
                      <img src={track.image} className="w-10 h-10 object-cover rounded shadow-md" />
                      <div className="flex-1 overflow-hidden">
                        <span className="text-sm font-bold truncate text-white block">{track.title}</span>
                        <span className="text-xs text-[#b3b3b3] truncate block">{track.artist}</span>
                      </div>
                      <span className="text-xs text-white/50">{track.duration}</span>
                    </div>
                ))}
              </div>

              <div className="pt-2">
                <button 
                  onClick={handleFinalize}
                  className="w-full bg-[#1db954] text-black font-black text-lg py-4 rounded-full hover:scale-[1.02] transition-transform shadow-[0_0_20px_rgba(29,185,84,0.3)]"
                >
                  Ajouter à ma bibliothèque
                </button>
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}