"use client";

import { useMemo, useState } from "react";
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

  const buttonClassName = useMemo(() => {
    if (variant === "ghost") {
      return "inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-white/10 hover:bg-white/15 border border-white/10 text-sm font-medium";
    }
    return "inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 text-sm font-semibold";
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

  return (
    <>
      <button type="button" className={buttonClassName} onClick={() => setOpen(true)}>
        <Plus className="w-4 h-4" />
        Créer une playlist
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-end sm:items-center justify-center"
          >
            <div
              className="absolute inset-0 bg-black/60"
              onClick={() => setOpen(false)}
            />
            <motion.div
              initial={{ y: 30, opacity: 0, scale: 0.98 }}
              animate={{ y: 0, opacity: 1, scale: 1 }}
              exit={{ y: 30, opacity: 0, scale: 0.98 }}
              transition={{ type: "spring", damping: 22, stiffness: 260 }}
              className="relative w-full sm:w-[520px] m-3 rounded-2xl liquid-glass-inner"
            >
              <div className="p-4 border-b border-white/10 flex items-center justify-between">
                <h3 className="text-base font-bold">Nouvelle playlist</h3>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="p-2 rounded-xl hover:bg-white/10"
                  aria-label="Fermer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="p-4 space-y-3">
                <div>
                  <label className="text-xs text-foreground/70">Nom</label>
                  <input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Ex: Mes favoris 2026"
                    className="mt-1 w-full px-4 py-3 rounded-2xl bg-white/5 border border-white/10 placeholder:text-foreground/40 focus:outline-none focus:ring-2 focus:ring-primary/50"
                    autoFocus
                  />
                </div>
                <div>
                  <label className="text-xs text-foreground/70">Description (optionnel)</label>
                  <input
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Ex: Pour le sport, la route, le chill..."
                    className="mt-1 w-full px-4 py-3 rounded-2xl bg-white/5 border border-white/10 placeholder:text-foreground/40 focus:outline-none focus:ring-2 focus:ring-primary/50"
                  />
                </div>
                {error && <p className="text-sm text-red-400">{error}</p>}
                <div className="flex justify-end gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => setOpen(false)}
                    className="px-4 py-2 rounded-xl bg-white/10 hover:bg-white/15 border border-white/10 text-sm font-medium"
                  >
                    Annuler
                  </button>
                  <button
                    type="button"
                    onClick={onCreate}
                    className="px-4 py-2 rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 text-sm font-semibold"
                  >
                    Créer
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

