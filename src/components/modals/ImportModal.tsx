// @ts-nocheck
"use client";

import React, { useEffect, useState, useRef, useCallback } from "react";
import { usePlaylists } from "@/context/PlaylistContext";
import { useMusic } from "@/context/MusicContext";
import { useAuth } from "@/context/AuthContext";
import { motion, AnimatePresence } from "framer-motion";

export function ImportModal() {
  const { playlists, updatePlaylist } = usePlaylists();
  const { status, currentTrack } = useMusic();
  const { user } = useAuth();
  
  const [detectedTrack, setDetectedTrack] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [step, setStep] = useState("loading"); 
  const [errorType, setErrorType] = useState(""); 
  const [manualInput, setManualInput] = useState("");
  
  const [showDetectBtn, setShowDetectBtn] = useState(false);
  
  const lastLinkRef = useRef("");
  const initialMount = useRef(true);
  const hideTimeoutRef = useRef(null);
  const isArmedRef = useRef(false); // 🟢 Permet de savoir si le piège du "Premier Tap" est actif

  const hasMiniPlayer = currentTrack !== null;

  // Bloque le scroll du fond quand la modale s'ouvre
  useEffect(() => {
    if (showModal) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [showModal]);

  const processLink = async (textToProcess = null) => {
    if (hideTimeoutRef.current) clearTimeout(hideTimeoutRef.current);

    try {
      let text = textToProcess;
      
      if (!text) {
         text = await navigator.clipboard.readText();
      }
      
      if (!text || (!text.includes("tiktok") && !text.includes("youtu"))) {
        setShowDetectBtn(false);
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

  // 🟢 LA LOGIQUE DU PRESSE-PAPIER
  const checkClipboard = useCallback(async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text && (text.includes("tiktok") || text.includes("youtu")) && text !== lastLinkRef.current) {
        setShowDetectBtn(true);
      } else {
        setShowDetectBtn(false);
      }
    } catch (err) {
      // Échec de la lecture (souvent car le navigateur refuse sans interaction)
      setShowDetectBtn(false);
    }
  }, []);

  // 🟢 LE HACK "PREMIER TAP" POUR IOS / ANDROID
  useEffect(() => {
    // 1. La fonction qui s'exécute au premier clic
    const handleFirstTap = () => {
      if (isArmedRef.current) {
        checkClipboard();
        isArmedRef.current = false; // On désarme le piège
      }
    };

    // 2. Ce qui se passe quand l'application revient au premier plan
    const handleVisibility = () => {
      if (document.visibilityState === "visible") {
        if (initialMount.current) {
          initialMount.current = false;
          return;
        }

        // On essaie d'abord la méthode "douce" (qui marche sur PC)
        navigator.permissions?.query({ name: 'clipboard-read' as any })
          .then(permission => {
            if (permission.state === 'granted') {
              checkClipboard();
            } else {
              // Si la permission n'est pas accordée par défaut (cas des mobiles), on arme le piège
              isArmedRef.current = true;
            }
          })
          .catch(() => {
            // Safari ne supporte parfois pas permissions.query, donc on arme le piège par sécurité
            isArmedRef.current = true;
          });
      }
    };

    // 3. On attache nos écouteurs
    window.addEventListener("pointerdown", handleFirstTap, { passive: true }); // Écoute le moindre touché
    document.addEventListener("visibilitychange", handleVisibility);
    window.addEventListener("focus", handleVisibility);

    setTimeout(() => { initialMount.current = false; }, 1000);

    return () => {
      window.removeEventListener("pointerdown", handleFirstTap);
      document.removeEventListener("visibilitychange", handleVisibility);
      window.removeEventListener("focus", handleVisibility);
    };
  }, [checkClipboard]);

  useEffect(() => {
    if (showDetectBtn) {
      hideTimeoutRef.current = setTimeout(() => {
        setShowDetectBtn(false);
      }, 8000);
    }
    return () => {
      if (hideTimeoutRef.current) clearTimeout(hideTimeoutRef.current);
    };
  }, [showDetectBtn]);

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
      <AnimatePresence>
        {!showModal && showDetectBtn && (
          <motion.div
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 50, scale: 0.9 }}
            transition={{ type: "spring", stiffness: 300, damping: 25 }}
            className={`fixed left-0 right-0 z-[9000] flex justify-center px-4 pointer-events-none transition-all duration-300 ${hasMiniPlayer ? 'bottom-[160px]' : 'bottom-[100px]'}`}
          >
            <motion.button
              drag="y"
              dragConstraints={{ top: 0, bottom: 0 }}
              dragElastic={0.4}
              onDragEnd={(e, info) => {
                if (info.offset.y > 30) {
                  setShowDetectBtn(false);
                }
              }}
              onClick={() => processLink()}
              className="pointer-events-auto bg-[#1db954] text-black font-bold px-5 py-2.5 rounded-full shadow-[0_10px_25px_rgba(29,185,84,0.3)] flex items-center gap-2 hover:scale-105 active:scale-95 transition-transform"
            >
              <span className="text-lg">📋</span>
              <span className="text-sm">Coller un lien ?</span>
              <span className="text-black/50 text-xs ml-1 border-l border-black/20 pl-2 hidden sm:inline-block">Swipe ↓ pour ignorer</span>
            </motion.button>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showModal && (
          <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4 sm:p-6 w-full h-[100dvh]">
            <div className="absolute inset-0 bg-black/90 backdrop-blur-xl touch-none" onClick={closeModal} />
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }} 
              animate={{ scale: 1, opacity: 1 }} 
              exit={{ scale: 0.95, opacity: 0 }}
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