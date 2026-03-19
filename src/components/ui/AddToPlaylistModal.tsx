// @ts-nocheck
"use client";

import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { usePlaylists } from "@/context/PlaylistContext";

export function AddToPlaylistModal({ track, isOpen, onClose }) {
  const { playlists, createPlaylist, updatePlaylist } = usePlaylists();
  const [newPlaylistName, setNewPlaylistName] = useState("");

  if (!isOpen || !track) return null;

  const handleAddToExisting = (playlistId) => {
    const targetPlaylist = playlists.find((p) => p.id === playlistId);
    if (targetPlaylist && !targetPlaylist.tracks?.find((t) => t.id === track.id)) {
      updatePlaylist(targetPlaylist.id, { tracks: [...(targetPlaylist.tracks || []), track] });
    }
    onClose();
  };

  // 🟢 CORRECTION DU BOUTON "CRÉER"
  const handleCreateNew = async () => {
    // Si le champ est vide, on annule
    if (!newPlaylistName.trim()) return;

    try {
      // On lance la création
      await createPlaylist(newPlaylistName.trim(), [track]);
      
      // On réinitialise et on ferme
      setNewPlaylistName(""); 
      onClose(); 
    } catch (err) {
      console.error("Erreur lors de la création de la playlist :", err);
    }
  };

  // 🟢 Écoute de la touche "Entrée" sur l'input pour créer la playlist
  const handleKeyDown = (e) => {
    if (e.key === "Enter") {
      e.preventDefault(); // Bloque le rechargement de page
      handleCreateNew();
    }
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: 100 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 100 }}
        className="fixed inset-0 z-[2000] flex flex-col justify-end bg-black/60 backdrop-blur-sm"
        onClick={onClose} 
      >
        <div 
          className="bg-[#181818] w-full rounded-t-3xl p-6 pb-12 shadow-2xl border-t border-white/10 max-h-[80vh] flex flex-col"
          onClick={(e) => e.stopPropagation()} 
        >
          <div className="flex justify-between items-center mb-6 shrink-0">
            <div className="overflow-hidden pr-4">
              <h3 className="text-2xl font-black text-white">Ajouter à…</h3>
              <p className="text-xs text-white/50 truncate mt-1">Son : {track.title}</p>
            </div>
            <button onClick={onClose} className="text-white/50 hover:text-white bg-white/5 w-8 h-8 rounded-full flex items-center justify-center shrink-0">✕</button>
          </div>

          <div className="overflow-y-auto flex-1 pr-2 mb-6 custom-scrollbar">
            {playlists && playlists.length > 0 ? (
              <div className="space-y-2">
                {playlists.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => handleAddToExisting(p.id)}
                    className="w-full flex items-center gap-4 p-3 rounded-xl hover:bg-white/10 transition-colors text-left bg-white/5 border border-white/5"
                  >
                    <div className="w-12 h-12 bg-gradient-to-br from-[#1db954] to-black rounded-md flex items-center justify-center overflow-hidden shrink-0">
                      {p.tracks?.[0]?.image ? <img src={p.tracks[0].image} className="w-full h-full object-cover" /> : "🎵"}
                    </div>
                    <div className="flex-1 truncate">
                      <p className="font-bold text-white truncate">{p.name}</p>
                      <p className="text-xs text-white/50">{p.tracks?.length || 0} titre(s)</p>
                    </div>
                  </button>
                ))}
              </div>
            ) : (
              <p className="text-white/50 text-center py-4">Aucune playlist existante.</p>
            )}
          </div>

          <div className="shrink-0 border-t border-white/10 pt-6">
            <p className="text-sm font-bold text-white/70 mb-3">Ou créer une nouvelle :</p>
            
            {/* 🟢 On utilise une `div` normale au lieu d'un `form` pour éviter les bugs de rechargement */}
            <div className="flex gap-2">
              <input
                type="text"
                value={newPlaylistName}
                onChange={(e) => setNewPlaylistName(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Nom de la playlist…"
                className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 outline-none focus:border-[#1db954] text-white"
              />
              <button
                onClick={handleCreateNew}
                disabled={!newPlaylistName.trim()}
                className="bg-[#1db954] text-black font-bold px-6 py-3 rounded-xl disabled:opacity-50 transition-opacity"
              >
                Créer
              </button>
            </div>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}