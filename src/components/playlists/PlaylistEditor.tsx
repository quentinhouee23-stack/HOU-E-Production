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
      initial={{ opacity: 0, y: 50 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 50 }}
      className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-md"
    >
      <div className="w-full max-w-2xl bg-white/10 backdrop-blur-2xl border border-white/20 rounded-[32px] overflow-hidden flex flex-col max-h-[85vh] shadow-2xl">
        
        {/* Header */}
        <div className="p-6 border-b border-white/10 flex justify-between items-center bg-white/5">
          <input 
            className="bg-transparent text-2xl font-bold text-white outline-none border-b border-transparent focus:border-[#1db954] transition-all"
            value={playlist.name}
            onChange={(e) => updatePlaylist(playlist.id, { name: e.target.value })}
          />
          <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-full text-white/50 hover:text-white">✕</button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-8">
          {/* Section : Mes Morceaux */}
          <div>
            <h4 className="text-sm font-bold uppercase tracking-widest text-[#1db954] mb-4">Morceaux ({playlist.tracks.length})</h4>
            <div className="space-y-2">
              {playlist.tracks.map((track: any, index: number) => (
                <div key={track.id} className="group flex items-center justify-between p-2 hover:bg-white/5 rounded-xl transition-all">
                  <div className="flex items-center gap-3" onClick={() => playTrack(track)}>
                    <span className="text-xs text-white/30 w-4">{index + 1}</span>
                    <img src={track.image} className="w-10 h-10 rounded-md object-cover" />
                    <div>
                      <div className="text-sm font-medium text-white">{track.title}</div>
                      <div className="text-xs text-white/50">{track.artist}</div>
                    </div>
                  </div>
                  <button 
                    onClick={() => removeTrackFromPlaylist(playlist.id, track.id)}
                    className="opacity-0 group-hover:opacity-100 p-2 text-red-400 hover:bg-red-500/10 rounded-lg transition-all"
                  >
                    Retirer
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Section : Ajouter de la musique */}
          <div className="pt-6 border-t border-white/10">
            <h4 className="text-sm font-bold uppercase tracking-widest text-white/50 mb-4">Ajouter des titres</h4>
            <div className="flex gap-2 mb-4">
              <input 
                placeholder="Chercher un titre ou un artiste..."
                className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-sm text-white outline-none focus:border-[#1db954]"
                value={search} onChange={(e) => setSearch(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              />
              <button onClick={handleSearch} className="bg-white text-black px-4 py-2 rounded-xl text-sm font-bold">
                {isSearching ? "..." : "Trouver"}
              </button>
            </div>

            <div className="grid grid-cols-1 gap-2">
              {results.map((track: any) => (
                <div key={track.id} className="flex items-center justify-between p-2 bg-white/5 rounded-xl">
                  <div className="flex items-center gap-3">
                    <img src={track.image} className="w-8 h-8 rounded object-cover" />
                    <span className="text-xs font-medium text-white truncate max-w-[150px]">{track.title}</span>
                  </div>
                  <button 
                    onClick={() => addTrackToPlaylist(playlist.id, track)}
                    className="text-[10px] bg-[#1db954] text-black px-3 py-1 rounded-full font-bold"
                  >
                    Ajouter +
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
}