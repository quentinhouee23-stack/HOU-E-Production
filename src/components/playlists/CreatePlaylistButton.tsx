// @ts-nocheck
"use client";

import { useMemo, useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { Plus, X } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { usePlaylists } from "@/context/PlaylistContext";

interface CreatePlaylistButtonProps {
  variant?: "primary" | "ghost";
}

export function CreatePlaylistButton({ variant = "primary" }: CreatePlaylistButtonProps) {
  const { createPlaylist } = usePlaylists();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [error, setError] = useState<string | null>(null);

  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [open]);

  const buttonClassName = useMemo(() => {
    if (variant === "ghost") {
      return "inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-white/10 hover:bg-white/15 border border-white/10 text-sm font-medium";
    }
    return "inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-[#1db954] text-black hover:bg-[#1ed760] hover:scale-105 transition-transform text-sm font-bold shadow-md";
  }, [variant]);

  const onCreate = () => {
    setError(null);
    try {
      createPlaylist({ name, description: description || undefined });
      setName("");
      setDescription("");
      setOpen(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Impossible de créer la playlist.");
    }
  };

  const ModalContent = (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          // ✅ FIX : grid place-items-center = centrage fiable sur tous les mobiles
          className="fixed inset-0 z-[99999] grid place-items-center p-4"
        >
          <div
            className="absolute inset-0 bg-black/80 backdrop-blur-sm touch-none"
            onClick={() => setOpen(false)}
          />
          <motion.div
            initial={{ y: 30, opacity: 0, scale: 0.95 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: 30, opacity: 0, scale: 0.95 }}
            transition={{ type: "spring", damping: 25, stiffness: 300 }}
            className="relative w-full max-w-sm sm:w-[520px] bg-[#1c1c1e] rounded-3xl border border-white/10 shadow-2xl flex flex-col max-h-[90dvh]"
          >
            <div className="p-5 border-b border-white/10 flex items-center justify-between shrink-0">
              <h3 className="text-lg font-black text-white">Nouvelle playlist</h3>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="w-8 h-8 flex items-center justify-center rounded-full bg-white/10 hover:bg-white/20 text-white/50 hover:text-white transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            
            <div className="p-5 space-y-4 overflow-y-auto overscroll-contain flex-1 custom-scrollbar">
              <div>
                <label className="text-xs font-bold text-white/50 uppercase tracking-widest ml-1">Nom</label>
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Ex: Mes favoris 2026"
                  className="mt-2 w-full px-5 py-4 rounded-2xl bg-white/5 border border-white/10 placeholder:text-white/30 focus:outline-none focus:border-[#1db954] text-white transition-colors font-medium"
                  autoFocus
                  onKeyDown={(e) => e.key === 'Enter' && onCreate()}
                />
              </div>
              <div>
                <label className="text-xs font-bold text-white/50 uppercase tracking-widest ml-1">Description (optionnel)</label>
                <input
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Ex: Pour le sport, la route..."
                  className="mt-2 w-full px-5 py-4 rounded-2xl bg-white/5 border border-white/10 placeholder:text-white/30 focus:outline-none focus:border-[#1db954] text-white transition-colors font-medium"
                  onKeyDown={(e) => e.key === 'Enter' && onCreate()}
                />
              </div>
              {error && <p className="text-sm text-red-400 font-bold">{error}</p>}
            </div>

            <div className="p-5 pt-2 flex justify-end gap-3 shrink-0 border-t border-white/10">
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="px-6 py-3 rounded-full bg-white/5 hover:bg-white/10 text-white font-bold transition-colors text-sm"
              >
                Annuler
              </button>
              <button
                type="button"
                onClick={onCreate}
                disabled={!name.trim()}
                className="px-8 py-3 rounded-full bg-[#1db954] text-black hover:scale-105 disabled:opacity-50 disabled:scale-100 font-black transition-transform shadow-[0_0_15px_rgba(29,185,84,0.3)] text-sm"
              >
                Créer
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );

  return (
    <>
      <button type="button" className={buttonClassName} onClick={() => setOpen(true)}>
        <Plus className="w-4 h-4" />
        Créer une playlist
      </button>
      {mounted && createPortal(ModalContent, document.body)}
    </>
  );
}