// @ts-nocheck
"use client";

import React, { useEffect, useState, useRef } from "react";
import { usePlaylists } from "@/context/PlaylistContext";
import { useMusic } from "@/context/MusicContext";
import { useAuth } from "@/context/AuthContext";
import { motion, AnimatePresence } from "framer-motion";

export function ImportModal() {
  const { playlists, updatePlaylist } = usePlaylists();
  const { status } = useMusic();
  const { user } = useAuth();
  
  const [detectedTrack, setDetectedTrack] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [step, setStep] = useState("loading"); 
  const [errorType, setErrorType] = useState(""); 
  const [manualInput, setManualInput] = useState("");
  
  const [showDetectBtn, setShowDetectBtn] = useState(false);
  
  const lastLinkRef = useRef("");

  // 🟢 Détecte si le mini-player est affiché (ajuste selon comment est construit ton status)
  // Si status contient des infos sur la musique, hasMiniPlayer sera true.
  const hasMiniPlayer = status && Object.keys(status).length > 0 && status !== "idle";

  const processLink = async (textToProcess = null) => {
    try {
      let text = textToProcess;
      
      if (!text) {
         text = await navigator.clipboard.readText();
      }
      
      if (!text || (!text.includes("tiktok") && !text.includes("youtu"))) {
        return;
      }

      setShowDetectBtn(false); 
      setShowModal(true);
      setStep("loading");
      lastLinkRef.current = text;

      const res = await fetch(`/api/import?url=${encodeURIComponent(text)}`);
      const data = await res.json();
      
      if (res.ok && data.track) {
        setDetectedTrack(data.track);
        setStep("confirm");
      } else {
        setErrorType(data.error || "protected_link");
        setStep("error");
      }
    } catch (err) {
      setStep("error");
      setErrorType("server_error");
    }
  };

  useEffect(() => {
    const checkClipboardSilently = async () => {
      try {
        const permission = await navigator.permissions.query({ name: 'clipboard-read' as any });
        
        if (permission.state === 'granted' || permission.state === 'prompt') {
            setShowDetectBtn(true);
        }
      } catch (err) {
         console.log("Erreur silencieuse presse-papier", err);
         setShowDetectBtn(true);
      }
    };

    const handleVisibility = () => {
      if (document.visibilityState === "visible") {
        setTimeout(checkClipboardSilently, 500);
      }
    };

    window.addEventListener("focus", checkClipboardSilently);
    document.addEventListener("visibilitychange", handleVisibility);
    
    checkClipboardSilently();

    return () => {
      window.removeEventListener("focus", checkClipboardSilently);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, []);

  const handleAddToPlaylist = (playlistId) => {
    const playlist = playlists.find(p => p.id === playlistId);
    if (playlist && detectedTrack) {
      const exists = playlist.tracks?.find(t => t.id === detectedTrack.id);
      if (!exists) {
        updatePlaylist(playlistId, { tracks: [...(playlist.tracks || []), detectedTrack] });
      }
      closeModal();
    }
  };

  const closeModal = () => {
    setShowModal(false);
    setTimeout(() => {
      setStep("loading");
      setDetectedTrack(null);
      setErrorType("");
      setShowDetectBtn(false); 
    }, 300);
  };

  const handleManualSearch = async () => {
    if (!manualInput) return;
    setStep("loading");
    try {
      const res = await fetch(`/api/search?q=${encodeURIComponent(manualInput)}`);
      const data = await res.json();
      if (data.tracks && data.tracks.length > 0) {
        setDetectedTrack(data.tracks[0]);
        setStep("confirm");
      } else {
        setErrorType("not_found");
        setStep("error");
      }
    } catch (e) {
      setErrorType("server_error");
      setStep("error");
    }
  };

  return (
    <>
      {/* 🟢 LE NOUVEAU BOUTON MAGIQUE (Swipeable & Dynamique) */}
      <AnimatePresence>
        {!showModal && showDetectBtn && (
          <motion.div
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 50, scale: 0.9 }}
            transition={{ type: "spring", stiffness: 300, damping: 25 }}
            // On ajuste la hauteur : bottom-36 si mini-player, bottom-24 s'il n'y est pas
            // pointer-events-none garantit qu'on peut cliquer à travers le conteneur transparent
            className={`fixed left-0 right-0 z-[9000] flex justify-center px-4 pointer-events-none transition-all duration-300 ${hasMiniPlayer ? 'bottom-[140px]' : 'bottom-[90px]'}`}
          >
            <motion.button
              drag="y"
              dragConstraints={{ top: 0, bottom: 0 }}
              dragElastic={0.4}
              onDragEnd={(e, info) => {
                // Si l'utilisateur glisse vers le bas de plus de 30px, on ferme le bouton
                if (info.offset.y > 30) {
                  setShowDetectBtn(false);
                }
              }}
              onClick={() => processLink()}
              // pointer-events-auto rend UNIQUEMENT ce petit bouton cliquable
              className="pointer-events-auto bg-[#1db954] text-black font-bold px-5 py-2.5 rounded-full shadow-[0_10px_25px_rgba(29,185,84,0.3)] flex items-center gap-2 hover:scale-105 active:scale-95 transition-transform"
            >
              <span className="text-lg">📋</span>
              <span className="text-sm">Lien détecté</span>
              <span className="text-black/50 text-xs ml-1 border-l border-black/20 pl-2 hidden sm:inline-block">Swipe ↓ pour ignorer</span>
            </motion.button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 🟢 LE RESTE DE LA MODALE (Inchangé) */}
      <AnimatePresence>
        {showModal && (
          <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4 sm:p-6 bg-black/90 backdrop-blur-xl">
            <motion.div 
              initial={{ y: 50, opacity: 0, scale: 0.9 }} 
              animate={{ y: 0, opacity: 1, scale: 1 }} 
              exit={{ y: 50, opacity: 0, scale: 0.9 }}
              className="bg-[#1c1c1e] w-full max-w-md rounded-[32px] overflow-hidden border border-white/10 shadow-2xl"
            >
              
              {step === "loading" && (
                <div className="p-10 text-center flex flex-col items-center justify-center">
                  <div className="w-16 h-16 border-4 border-[#1db954]/30 border-t-[#1db954] rounded-full animate-spin mb-6"></div>
                  <h2 className="text-2xl font-black text-white mb-2">Analyse du lien...</h2>
                </div>
              )}

              {step === "confirm" && detectedTrack && (
                <div className="p-8 text-center">
                  <div className="w-20 h-20 bg-gradient-to-tr from-[#1db954] to-[#1ed760] rounded-3xl flex items-center justify-center mx-auto mb-6 rotate-12 shadow-[0_0_30px_rgba(29,185,84,0.3)]">
                    <span className="text-4xl -rotate-12">🎵</span>
                  </div>
                  <h2 className="text-2xl font-black mb-2 text-white">Son trouvé !</h2>
                  
                  <div className="bg-white/5 p-4 rounded-2xl flex items-center gap-4 mb-8 text-left border border-white/10 mt-6">
                    <div className="w-16 h-16 rounded-lg overflow-hidden shrink-0 shadow-lg">
                      <img src={detectedTrack.image} className="w-full h-full object-cover" />
                    </div>
                    <div className="overflow-hidden flex-1">
                      <p className="font-bold text-white truncate">{detectedTrack.title}</p>
                      <p className="text-sm text-[#1db954] font-medium truncate">{detectedTrack.artist}</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 gap-3">
                    <button onClick={() => setStep("playlist")} className="bg-white text-black font-black py-4 rounded-2xl hover:scale-[1.02] active:scale-95 transition-all">
                      Ajouter à une playlist
                    </button>
                    <button onClick={closeModal} className="text-white/30 font-bold py-3 hover:text-white transition-colors">
                      Annuler
                    </button>
                  </div>
                </div>
              )}

              {step === "playlist" && (
                <div className="p-8 flex flex-col max-h-[85vh]">
                   <div className="flex justify-between items-center mb-6">
                     <h2 className="text-2xl font-black text-white">Tes Playlists</h2>
                     <button onClick={() => setStep("confirm")} className="text-white/40 text-sm">Retour</button>
                   </div>
                   
                   <div className="space-y-3 overflow-y-auto pr-1 custom-scrollbar">
                      {playlists.map(p => (
                        <button key={p.id} onClick={() => handleAddToPlaylist(p.id)} className="w-full flex items-center gap-4 p-3 rounded-2xl bg-white/5 hover:bg-[#1db954]/20 border border-white/5 transition-all text-left">
                          <div className="w-12 h-12 bg-black rounded-lg flex items-center justify-center overflow-hidden shrink-0">
                            {p.tracks?.[0]?.image ? <img src={p.tracks[0].image} className="w-full h-full object-cover" /> : "🎧"}
                          </div>
                          <span className="font-bold text-white truncate">{p.name}</span>
                        </button>
                      ))}
                   </div>
                </div>
              )}

              {step === "error" && (
                <div className="p-8 text-center">
                  <div className="w-20 h-20 bg-red-500/20 rounded-full flex items-center justify-center mx-auto mb-6">
                    <span className="text-4xl">⚠️</span>
                  </div>
                  
                  {errorType === "original_sound" ? (
                    <>
                      <h2 className="text-2xl font-black mb-2 text-white">Son Original</h2>
                      <p className="text-white/50 text-sm mb-6">
                        L'utilisateur a modifié ou créé ce son lui-même. TikTok ne fournit pas son vrai nom. Si tu le connais, tape-le ici :
                      </p>
                    </>
                  ) : (
                    <>
                      <h2 className="text-2xl font-black mb-2 text-white">Introuvable</h2>
                      <p className="text-white/50 text-sm mb-6">
                        Impossible d'extraire le son de ce lien. Tapez le nom de l'artiste ou du son ci-dessous :
                      </p>
                    </>
                  )}
                  
                  <div className="flex gap-2 mb-6">
                    <input 
                      type="text" 
                      value={manualInput}
                      onChange={(e) => setManualInput(e.target.value)}
                      placeholder="Ex: Titre ou Artiste..."
                      className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-3 outline-none focus:border-[#1db954] text-white"
                    />
                  </div>

                  <div className="grid grid-cols-1 gap-3">
                    <button onClick={handleManualSearch} disabled={!manualInput} className="bg-[#1db954] text-black font-black py-4 rounded-2xl disabled:opacity-50">
                      Chercher manuellement
                    </button>
                    <button onClick={closeModal} className="text-white/30 font-bold py-3 hover:text-white transition-colors">
                      Fermer
                    </button>
                  </div>
                </div>
              )}

            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
}