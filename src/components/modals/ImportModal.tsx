// @ts-nocheck
"use client";

import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { usePlaylists } from "@/context/PlaylistContext";
import { X, Download, AlertCircle, CheckCircle2, Search, Loader2 } from "lucide-react";

export function ImportModal() {
  const { createPlaylist } = usePlaylists();
  
  const [isOpen, setIsOpen] = useState(false);
  const [url, setUrl] = useState("");
  const [status, setStatus] = useState<"idle" | "scraping" | "searching" | "saving" | "success" | "error">("idle");
  const [errorMessage, setErrorMessage] = useState("");
  
  const [progress, setProgress] = useState(0);
  const [currentTrackName, setCurrentTrackName] = useState("");
  const [stats, setStats] = useState({ total: 0, found: 0 });

  useEffect(() => {
    const handleOpen = () => {
      setIsOpen(true);
      setStatus("idle");
      setUrl("");
      setProgress(0);
    };
    window.addEventListener("openImportModal", handleOpen);
    return () => window.removeEventListener("openImportModal", handleOpen);
  }, []);

  const handleClose = () => {
    if (status === "scraping" || status === "searching" || status === "saving") {
      const confirmClose = window.confirm("L'importation est en cours. Veux-tu vraiment annuler ?");
      if (!confirmClose) return;
    }
    setIsOpen(false);
  };

  const startImport = async () => {
    if (!url.includes("spotify.com")) {
      setStatus("error");
      setErrorMessage("Veuillez entrer un lien de playlist Spotify valide.");
      return;
    }

    setStatus("scraping");
    setErrorMessage("");
    setProgress(0);

    try {
      const scrapeRes = await fetch(`/api/import-spotify?url=${encodeURIComponent(url)}`);
      const scrapeData = await scrapeRes.json();

      if (!scrapeRes.ok) {
        throw new Error(scrapeData.error || "Erreur lors de la lecture de la playlist.");
      }

      const spotifyTracks = scrapeData.tracks;
      const playlistName = scrapeData.name;
      
      if (!spotifyTracks || spotifyTracks.length === 0) {
        throw new Error("La playlist semble vide ou illisible.");
      }

      setStats({ total: spotifyTracks.length, found: 0 });
      setStatus("searching");

      const matchedTracks = [];
      
      for (let i = 0; i < spotifyTracks.length; i++) {
        const track = spotifyTracks[i];
        setCurrentTrackName(`${track.title} - ${track.artist}`);
        
        const cleanTitle = track.title.replace(/\([^)]*\)/g, '').replace(/\[[^\]]*\]/g, '').trim();
        const searchQuery = `${cleanTitle} ${track.artist}`;
        
        try {
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 4000);

          const searchRes = await fetch(`/api/search?q=${encodeURIComponent(searchQuery)}`, {
            signal: controller.signal
          });
          
          clearTimeout(timeoutId);
          
          if (searchRes.ok) {
            const searchData = await searchRes.json();
            if (searchData.tracks && searchData.tracks.length > 0) {
              matchedTracks.push(searchData.tracks[0]); 
              setStats(prev => ({ ...prev, found: prev.found + 1 }));
            }
          }
        } catch (err) {
          console.warn("Son ignoré (timeout ou introuvable) :", searchQuery);
        }

        setProgress(Math.round(((i + 1) / spotifyTracks.length) * 100));
      }

      // ÉTAPE DE SAUVEGARDE
      setStatus("saving");
      setCurrentTrackName("Finalisation de la playlist...");
      
      // Petit délai visuel sympa pour l'utilisateur
      await new Promise(resolve => setTimeout(resolve, 800));

      if (matchedTracks.length > 0) {
        const cleanTracksToSave = matchedTracks.map((t: any) => ({
          id: t.id ? t.id.toString() : Date.now().toString() + Math.random().toString(),
          title: t.title || "Inconnu",
          artist: t.artist || "Inconnu",
          image: t.image || "",
          duration: t.duration || "0:00",
          preview: t.preview || ""
        }));

        // 🟢 LA MAGIE EST ICI : Le Fire & Forget !
        // On NE MET PLUS de "await" devant createPlaylist.
        // L'app lance la sauvegarde en arrière-plan sans attendre la réponse de la base de données.
        createPlaylist(`🎵 ${playlistName}`, cleanTracksToSave).catch(e => {
          console.error("Erreur silencieuse de sauvegarde en arrière-plan :", e);
        });

        // Et on affiche le succès instantanément à l'utilisateur !
        setStatus("success");
      } else {
        throw new Error("Aucun titre de cette playlist n'a pu être converti.");
      }

    } catch (error: any) {
      setStatus("error");
      setErrorMessage(error.message || "Une erreur inattendue est survenue.");
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div 
          className="fixed inset-0 z-[100000] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 sm:p-6"
          onClick={handleClose}
        >
          <motion.div 
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ type: "spring", damping: 25, stiffness: 300 }}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md bg-[#181818] border border-white/10 rounded-[32px] overflow-hidden shadow-2xl flex flex-col"
          >
            <div className="flex items-center justify-between p-6 pb-4 border-b border-white/5">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-[#1db954]/20 text-[#1db954] flex items-center justify-center">
                  <Download className="w-5 h-5" />
                </div>
                <h2 className="text-xl font-black text-white">Import Spotify</h2>
              </div>
              <button 
                onClick={handleClose}
                className="w-8 h-8 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center text-white/50 hover:text-white transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 flex flex-col gap-6">
              
              {status === "idle" || status === "error" ? (
                <>
                  <p className="text-sm text-white/70">
                    Colle le lien d'une playlist Spotify publique. Nous allons l'analyser et la recréer instantanément dans ta bibliothèque.
                  </p>

                  <div className="flex flex-col gap-2">
                    <input 
                      type="url" 
                      placeholder="https://open.spotify.com/playlist/..." 
                      value={url}
                      onChange={(e) => setUrl(e.target.value)}
                      autoFocus
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-4 text-sm text-white outline-none focus:border-[#1db954] transition-colors"
                      onKeyDown={(e) => e.key === 'Enter' && url.length > 10 && startImport()}
                    />
                    {status === "error" && (
                      <div className="flex items-center gap-2 text-red-400 text-xs mt-1 bg-red-500/10 p-3 rounded-lg border border-red-500/20">
                        <AlertCircle className="w-4 h-4 shrink-0" />
                        <p>{errorMessage}</p>
                      </div>
                    )}
                  </div>

                  <button 
                    onClick={startImport}
                    disabled={!url.includes("spotify.com")}
                    className="w-full bg-[#1db954] text-black font-black py-4 rounded-xl hover:scale-[1.02] transition-transform disabled:opacity-50 disabled:hover:scale-100 shadow-[0_0_20px_rgba(29,185,84,0.3)] mt-2"
                  >
                    Lancer l'importation
                  </button>
                </>
              ) : status === "success" ? (
                <div className="flex flex-col items-center justify-center py-6 text-center">
                  <motion.div 
                    initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: "spring", damping: 12 }}
                    className="w-20 h-20 bg-[#1db954]/20 rounded-full flex items-center justify-center text-[#1db954] mb-6"
                  >
                    <CheckCircle2 className="w-10 h-10" />
                  </motion.div>
                  <h3 className="text-2xl font-black text-white mb-2">Import terminé !</h3>
                  <p className="text-white/60 mb-6">
                    {stats.found} titres sur {stats.total} ont été trouvés et ajoutés à ta nouvelle playlist.
                  </p>
                  <button 
                    onClick={() => {
                      handleClose();
                      window.dispatchEvent(new Event("resetPlaylistsView")); 
                    }}
                    className="w-full bg-white/10 hover:bg-white/20 text-white font-bold py-4 rounded-xl transition-colors"
                  >
                    Voir ma bibliothèque
                  </button>
                </div>
              ) : (
                <div className="flex flex-col py-4">
                  <div className="flex justify-between text-sm font-bold text-white mb-2">
                    <span>
                      {status === "scraping" ? "Lecture de Spotify..." : 
                       status === "saving" ? "Création de la playlist..." : 
                       "Conversion des titres..."}
                    </span>
                    <span className="text-[#1db954]">{progress}%</span>
                  </div>
                  
                  <div className="w-full h-3 bg-white/10 rounded-full overflow-hidden mb-6 relative">
                    <motion.div 
                      className="absolute top-0 left-0 h-full bg-[#1db954]"
                      initial={{ width: 0 }}
                      animate={{ width: `${progress}%` }}
                      transition={{ ease: "linear" }}
                    />
                  </div>

                  {(status === "searching" || status === "saving") && (
                    <div className="bg-white/5 border border-white/10 rounded-xl p-4 flex items-center gap-4">
                      <div className="relative w-8 h-8 flex items-center justify-center shrink-0">
                        <div className="absolute inset-0 border-2 border-white/10 border-t-[#1db954] rounded-full animate-spin" />
                        {status === "saving" ? <Loader2 className="w-4 h-4 text-[#1db954] animate-spin" /> : <Search className="w-3 h-3 text-[#1db954]" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[10px] text-white/50 uppercase font-bold tracking-wider mb-1">
                          {status === "saving" ? "Finalisation" : "Recherche en cours"}
                        </p>
                        <p className="text-sm text-white font-bold truncate">{currentTrackName || "..."}</p>
                      </div>
                    </div>
                  )}

                  <p className="text-xs text-center text-white/40 mt-6">
                    Cette opération peut prendre une minute. Ne ferme pas cette fenêtre.
                  </p>
                </div>
              )}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}