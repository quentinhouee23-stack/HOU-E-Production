// @ts-nocheck
"use client";

import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { usePlaylists } from "@/context/PlaylistContext";
import { useMusic } from "@/context/MusicContext";

export function PlaylistEditor({ playlist, isOpen, onClose }: any) {
  const { updatePlaylist, removeTrackFromPlaylist, addTrackToPlaylist } = usePlaylists();
  const { playTrack } = useMusic();
  const [search, setSearch] = useState("");
  const [results, setResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);

  if (!isOpen || !playlist) return null;

  const handleSearch = async () => {
    if (!search) return;
    setIsSearching(true);
    const res = await fetch(`/api/suggestions?theme=${encodeURIComponent(search)}`);
    const data = await res.json();
    setResults(data.suggestions || []);
    setIsSearching(false);
  };

  return (
    <motion.div 
      initial={{ opacity: 0 }} 
      animate={{ opacity: 1 }} 
      exit={{ opacity: 0 }}
      // ✅ FIX : grid place-items-center = centrage fiable sur tous les mobiles
      // Avant : "flex flex-col justify-end sm:justify-center" collait la modale en bas sur mobile
      className="fixed inset-0 z-[99999] grid place-items-center p-4"
    >
      <div className="absolute inset-0 bg-black/80 backdrop-blur-sm touch-none" onClick={onClose} />
      
      <motion.div
        initial={{ y: 30, opacity: 0, scale: 0.95 }}
        animate={{ y: 0, opacity: 1, scale: 1 }}
        exit={{ y: 30, opacity: 0, scale: 0.95 }}
        transition={{ type: "spring", damping: 25, stiffness: 300 }}
        className="relative w-full max-w-2xl bg-[#1c1c1e] border border-white/10 rounded-[32px] overflow-hidden flex flex-col max-h-[90dvh] shadow-2xl pointer-events-auto"
        onClick={(e) => e.stopPropagation()}
      >
        
        {/* EN-TÊTE FIXE */}
        <div className="p-6 border-b border-white/10 flex justify-between items-center bg-white/5 shrink-0 touch-none">
          <input 
            className="bg-transparent text-2xl font-black text-white outline-none border-b-2 border-transparent focus:border-[#1db954] transition-all truncate flex-1 mr-4"
            value={playlist.name}
            onChange={(e) => updatePlaylist(playlist.id, { name: e.target.value })}
            placeholder="Nom de la playlist"
          />
          <button 
            onClick={onClose} 
            className="w-10 h-10 hover:bg-white/10 rounded-full flex items-center justify-center text-white/50 hover:text-white transition-colors shrink-0"
          >
            ✕
          </button>
        </div>

        {/* CONTENU SCROLLABLE */}
        <div className="flex-1 overflow-y-auto overscroll-contain custom-scrollbar p-6 space-y-8">
          
          {/* Section : Mes Morceaux */}
          <div>
            <h4 className="text-xs font-bold uppercase tracking-widest text-[#1db954] mb-4">Morceaux ({playlist.tracks.length})</h4>
            <div className="space-y-2">
              {playlist.tracks.map((track: any, index: number) => (
                <div key={track.id} className="group flex items-center justify-between p-2 hover:bg-white/5 rounded-2xl transition-all border border-transparent hover:border-white/5 cursor-pointer">
                  <div className="flex items-center gap-3 overflow-hidden flex-1" onClick={() => playTrack(track, playlist.tracks)}>
                    <span className="text-xs font-bold text-white/30 w-4 text-right shrink-0">{index + 1}</span>
                    <img src={track.image} className="w-12 h-12 rounded-xl object-cover shadow-md shrink-0 pointer-events-none" />
                    <div className="overflow-hidden pointer-events-none">
                      <div className="text-sm font-bold text-white truncate group-hover:text-[#1db954] transition-colors">{track.title}</div>
                      <div className="text-xs font-medium text-white/50 truncate">{track.artist}</div>
                    </div>
                  </div>
                  <button 
                    onClick={(e) => { e.stopPropagation(); removeTrackFromPlaylist(playlist.id, track.id); }}
                    className="opacity-0 group-hover:opacity-100 px-4 py-2 text-xs font-bold text-red-400 hover:bg-red-500/20 rounded-xl transition-all shrink-0 ml-2"
                  >
                    Retirer
                  </button>
                </div>
              ))}
              {playlist.tracks.length === 0 && (
                <div className="text-center py-6 text-white/40 text-sm font-medium bg-white/5 rounded-2xl border border-white/5">
                  Aucun morceau. Ajoutes-en ci-dessous !
                </div>
              )}
            </div>
          </div>

          {/* Section : Ajouter de la musique */}
          <div className="pt-8 border-t border-white/10 pb-4">
            <h4 className="text-xs font-bold uppercase tracking-widest text-white/50 mb-4">Ajouter des titres</h4>
            <div className="flex gap-2 mb-6">
              <input 
                placeholder="Chercher un titre, un artiste..."
                className="flex-1 bg-white/5 border border-white/10 rounded-2xl px-5 py-3 text-sm font-medium text-white outline-none focus:border-[#1db954] transition-colors placeholder:text-white/30"
                value={search} 
                onChange={(e) => setSearch(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              />
              <button 
                onClick={handleSearch} 
                disabled={isSearching || !search.trim()} 
                className="bg-[#1db954] text-black px-6 py-3 rounded-2xl text-sm font-black hover:scale-105 transition-transform disabled:opacity-50 disabled:scale-100 shadow-[0_0_15px_rgba(29,185,84,0.2)]"
              >
                {isSearching ? "..." : "Trouver"}
              </button>
            </div>

            <div className="grid grid-cols-1 gap-2">
              {results.map((track: any) => (
                <div key={track.id} className="flex items-center justify-between p-2 bg-white/5 hover:bg-white/10 rounded-2xl transition-colors border border-white/5">
                  <div className="flex items-center gap-3 overflow-hidden">
                    <img src={track.image} className="w-10 h-10 rounded-xl object-cover shadow-sm shrink-0 pointer-events-none" />
                    <div className="overflow-hidden pointer-events-none">
                      <span className="text-sm font-bold text-white truncate block">{track.title}</span>
                      <span className="text-xs font-medium text-white/50 truncate block">{track.artist}</span>
                    </div>
                  </div>
                  <button 
                    onClick={() => addTrackToPlaylist(playlist.id, track)}
                    className="text-xs bg-white text-black px-4 py-2 rounded-full font-bold hover:scale-105 transition-transform shrink-0 ml-2"
                  >
                    Ajouter +
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}