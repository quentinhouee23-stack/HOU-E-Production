// @ts-nocheck
"use client";

import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { usePlaylists } from "@/context/PlaylistContext";
import { X, Music } from "lucide-react";

export function AddToPlaylistModal({ track, isOpen, onClose }) {
  const { playlists, createPlaylist, updatePlaylist } = usePlaylists();
  const [newPlaylistName, setNewPlaylistName] = useState("");
  
  // 🟢 On sauvegarde le son en mémoire pour que la modale puisse se fermer en douceur
  const [cachedTrack, setCachedTrack] = useState(null);
  
  // 🟢 Bouclier anti-clic instantané (pour éviter la fermeture immédiate à l'ouverture)
  const [canClose, setCanClose] = useState(false);

  useEffect(() => {
    if (track) setCachedTrack(track);
  }, [track]);

  const currentTrack = track || cachedTrack;

  useEffect(() => {
    if (isOpen) {
      setCanClose(false);
      // On bloque la fermeture pendant un tiers de seconde à l'ouverture
      const timer = setTimeout(() => setCanClose(true), 300);
      return () => clearTimeout(timer);
    } else {
      setNewPlaylistName(""); 
    }
  }, [isOpen]);

  const safeClose = () => {
    if (canClose) onClose();
  };

  const handleAddToExisting = (playlistId) => {
    const targetPlaylist = playlists?.find((p) => p.id === playlistId);
    if (targetPlaylist && currentTrack) {
      const currentTracks = targetPlaylist.tracks || [];
      if (!currentTracks.find((t) => t.id === currentTrack.id)) {
        updatePlaylist(targetPlaylist.id, { tracks: [...currentTracks, currentTrack] });
      }
    }
    onClose(); 
  };

  const handleCreateNew = async () => {
    if (!newPlaylistName.trim() || !currentTrack) return;
    try {
      await createPlaylist(newPlaylistName.trim(), [currentTrack]);
      setNewPlaylistName(""); 
      onClose(); 
    } catch (err) {
      console.error("Erreur lors de la création de la playlist :", err);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter") {
      e.preventDefault(); 
      handleCreateNew();
    }
  };

  return (
    <AnimatePresence>
      {isOpen && currentTrack && (
        <>
          {/* 1. LE FOND SOMBRE (TOTALEMENT SÉPARÉ) */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={safeClose}
            className="fixed inset-0 z-[9998] bg-black/80 backdrop-blur-sm"
            style={{ touchAction: "none" }}
          />

          {/* 2. LA MODALE (FIXÉE EN BAS DE L'ÉCRAN) */}
          <motion.div
            initial={{ y: "100%" }}
            animate={{ y: "0%" }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", damping: 25, stiffness: 250 }}
            className="fixed bottom-0 left-0 right-0 z-[9999] w-full max-w-lg mx-auto bg-[#1c1c1e] rounded-t-[32px] flex flex-col shadow-2xl p-6 pb-[calc(env(safe-area-inset-bottom)+2rem)]"
            style={{ maxHeight: "85dvh" }}
          >
            {/* Décoration (Drag handle) */}
            <div className="w-12 h-1.5 bg-white/20 rounded-full mx-auto mt-2 mb-6 shrink-0" />

            {/* En-tête */}
            <div className="flex justify-between items-center mb-6 shrink-0">
              <div className="overflow-hidden pr-4">
                <h3 className="text-2xl font-black text-white">Ajouter à…</h3>
                <p className="text-sm text-[#1db954] truncate mt-1">{currentTrack.title}</p>
              </div>
              <button 
                onClick={safeClose} 
                className="w-10 h-10 bg-white/10 hover:bg-white/20 rounded-full flex items-center justify-center transition-colors shrink-0"
              >
                <X className="w-5 h-5 text-white" />
              </button>
            </div>

            {/* Liste des playlists existantes */}
            <div className="overflow-y-auto flex-1 mb-6 custom-scrollbar pr-2">
              {playlists && playlists.length > 0 ? (
                <div className="space-y-2">
                  {playlists.map((p) => (
                    <button
                      key={p.id}
                      onClick={() => handleAddToExisting(p.id)}
                      className="w-full flex items-center gap-4 p-3 rounded-2xl hover:bg-white/10 transition-colors text-left bg-white/5 border border-white/5 group"
                    >
                      <div className="w-12 h-12 bg-gradient-to-br from-[#1db954] to-black rounded-xl flex items-center justify-center overflow-hidden shrink-0">
                        {p.tracks?.[0]?.image ? (
                          <img src={p.tracks[0].image} className="w-full h-full object-cover" alt="Cover" />
                        ) : (
                          <Music className="w-5 h-5 text-white/50" />
                        )}
                      </div>
                      <div className="flex-1 truncate">
                        <p className="font-bold text-white group-hover:text-[#1db954] transition-colors truncate">{p.name}</p>
                        <p className="text-xs text-white/50">{p.tracks?.length || 0} titre(s)</p>
                      </div>
                    </button>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 opacity-50">
                  <p className="text-sm text-white">Tu n'as pas encore de playlist.</p>
                </div>
              )}
            </div>

            {/* Créer une nouvelle playlist */}
            <div className="shrink-0 border-t border-white/10 pt-6">
              <p className="text-sm font-bold text-white/70 mb-3">Nouvelle playlist :</p>
              <div className="flex gap-2">
                <input
                  id="new-playlist-input"
                  name="new-playlist-input"
                  type="text"
                  value={newPlaylistName}
                  onChange={(e) => setNewPlaylistName(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Nom de la playlist…"
                  className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-3 outline-none focus:border-[#1db954] text-white transition-colors"
                />
                <button
                  onClick={handleCreateNew}
                  disabled={!newPlaylistName.trim()}
                  className="bg-[#1db954] text-black font-bold px-6 py-3 rounded-xl disabled:opacity-50 hover:scale-105 disabled:hover:scale-100 transition-all flex items-center justify-center"
                >
                  Créer
                </button>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}