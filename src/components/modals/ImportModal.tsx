// @ts-nocheck
"use client";

import React, { useEffect, useState, useRef } from "react";
import { usePlaylists } from "@/context/PlaylistContext";
import { useMusic } from "@/context/MusicContext";
import { motion, AnimatePresence } from "framer-motion";

export function ImportModal() {
  const { playlists, updatePlaylist } = usePlaylists();
  
  const [detectedTrack, setDetectedTrack] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [step, setStep] = useState("loading"); 
  const [errorType, setErrorType] = useState(""); 
  const [manualInput, setManualInput] = useState("");

  useEffect(() => {
    if (showModal) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [showModal]);

  // 🟢 On écoute un signal venant de n'importe où dans l'app
  useEffect(() => {
    const handleTriggerImport = async () => {
      try {
        const text = await navigator.clipboard.readText();
        processLink(text);
      } catch (err) {
        // Si le navigateur refuse de lire le presse-papier
        setStep("error");
        setErrorType("clipboard_denied");
        setShowModal(true);
      }
    };

    window.addEventListener("triggerImportModal", handleTriggerImport);
    return () => window.removeEventListener("triggerImportModal", handleTriggerImport);
  }, []);

  const processLink = async (text) => {
    if (!text || (!text.includes("tiktok") && !text.includes("youtu"))) {
      setStep("error");
      setErrorType("invalid_link");
      setShowModal(true);
      return;
    }

    setShowModal(true);
    setStep("loading");

    try {
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
    <AnimatePresence>
      {showModal && (
        <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4 sm:p-6 w-full h-[100dvh]">
          <div className="absolute inset-0 bg-black/90 backdrop-blur-xl touch-none" onClick={closeModal} />
          <motion.div 
            initial={{ scale: 0.95, opacity: 0, y: 20 }} 
            animate={{ scale: 1, opacity: 1, y: 0 }} 
            exit={{ scale: 0.95, opacity: 0, y: 20 }}
            transition={{ type: "spring", damping: 25, stiffness: 300 }}
            className="relative bg-[#1c1c1e] w-full max-w-sm sm:max-w-md rounded-[32px] overflow-hidden border border-white/10 shadow-2xl pointer-events-auto max-h-[90dvh] flex flex-col"
          >
            
            {step === "loading" && (
              <div className="p-10 text-center flex flex-col items-center justify-center">
                <div className="w-16 h-16 border-4 border-[#1db954]/30 border-t-[#1db954] rounded-full animate-spin mb-6"></div>
                <h2 className="text-2xl font-black text-white mb-2">Analyse du lien...</h2>
              </div>
            )}

            {step === "confirm" && detectedTrack && (
              <div className="p-8 text-center overflow-y-auto custom-scrollbar">
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
              <div className="p-8 flex flex-col max-h-[70vh]">
                  <div className="flex justify-between items-center mb-6 shrink-0">
                    <h2 className="text-2xl font-black text-white">Tes Playlists</h2>
                    <button onClick={() => setStep("confirm")} className="text-white/40 text-sm hover:text-white transition-colors">Retour</button>
                  </div>
                  
                  <div className="space-y-3 overflow-y-auto pr-1 custom-scrollbar flex-1">
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
              <div className="p-8 text-center overflow-y-auto custom-scrollbar">
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
                ) : errorType === "invalid_link" ? (
                  <>
                    <h2 className="text-2xl font-black mb-2 text-white">Lien invalide</h2>
                    <p className="text-white/50 text-sm mb-6">
                      Assure-toi d'avoir copié un lien TikTok ou YouTube valide dans ton presse-papier.
                    </p>
                  </>
                ) : errorType === "clipboard_denied" ? (
                  <>
                    <h2 className="text-2xl font-black mb-2 text-white">Accès refusé</h2>
                    <p className="text-white/50 text-sm mb-6">
                      Ton téléphone empêche l'application de lire ton presse-papier. Cherche le son manuellement ci-dessous :
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
                    onKeyDown={(e) => e.key === 'Enter' && handleManualSearch()}
                  />
                </div>

                <div className="grid grid-cols-1 gap-3">
                  <button onClick={handleManualSearch} disabled={!manualInput} className="bg-[#1db954] text-black font-black py-4 rounded-2xl disabled:opacity-50 hover:bg-[#1ed760] transition-colors">
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
  );
}