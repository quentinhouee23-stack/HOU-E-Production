// @ts-nocheck
"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { Header } from "@/components/ui/Header";
import { usePlaylists } from "@/context/PlaylistContext";
import { motion, AnimatePresence, useAnimation, useMotionValue, useTransform } from "framer-motion";

const CATEGORIES = [
  { id: "tout",  label: "🎲 Mix Total" },
  { id: "rapfr", label: "🎤 Rap FR"    },
  { id: "rapus", label: "🇺🇸 Rap US"   },
  { id: "phonk", label: "🏎️ Phonk"    },
  { id: "pop",   label: "🌟 Pop Hits"  },
  { id: "chill", label: "☕ Chill"     },
  { id: "afro",  label: "🌍 Afrobeat"  },
];

// 🟢 CORRECTION 3 : Le Frontend ne vérifie plus le ".mp3", il vérifie juste qu'il y a un lien http
function hasValidPreview(track) {
  return (
    typeof track.preview === "string" &&
    track.preview.startsWith("http")
  );
}

export default function DiscoverPage() {
  const { playlists, createPlaylist, updatePlaylist } = usePlaylists();

  const [tracks,          setTracks]          = useState([]);
  const [currentIndex,    setCurrentIndex]    = useState(0);
  const [isLoading,       setIsLoading]       = useState(true);
  const [isAudioBlocked,  setIsAudioBlocked]  = useState(false);
  const [activeModal,     setActiveModal]     = useState("none");
  const [newPlaylistName, setNewPlaylistName] = useState("");
  const [hasSwiped,       setHasSwiped]       = useState(false);
  const [activeCategory,  setActiveCategory]  = useState("tout");
  const [audioProgress,   setAudioProgress]   = useState(0);
  const [isPlaying,       setIsPlaying]       = useState(false);
  const [isMounted,       setIsMounted]       = useState(false);

  const audioRef     = useRef(null);
  const progressRef  = useRef(null);

  const controls    = useAnimation();
  const dragX       = useMotionValue(0);
  const likeOpacity = useTransform(dragX, [20, 120],   [0, 1]);
  const skipOpacity = useTransform(dragX, [-20, -120], [0, 1]);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  const fetchDiscoveryTracks = async (categoryId = "tout", retryCount = 0) => {
    setIsLoading(true);
    setAudioProgress(0);
    setIsPlaying(false);
    try {
      const res  = await fetch(`/api/discover?vibe=${categoryId}`);
      const data = await res.json();

      if (data.tracks?.length > 0) {
        const rejected = JSON.parse(localStorage.getItem("rejectedTracks") || "[]");
        const filtered = data.tracks.filter((t) => hasValidPreview(t) && !rejected.includes(t.id));

        // 🟢 CORRECTION 4 : Évite la boucle infinie. Si on a rejeté trop de sons, on s'arrête après 2 essais
        if (filtered.length === 0) {
          if (retryCount < 2) {
             setTimeout(() => fetchDiscoveryTracks(categoryId, retryCount + 1), 500);
          } else {
             setTracks([]); // Affichera "Tu as tout vu" au lieu de boucler à l'infini
             setIsLoading(false);
          }
          return;
        }
        setTracks(filtered);
        setCurrentIndex(0);
      } else {
        if (categoryId !== "tout" && retryCount < 1) fetchDiscoveryTracks("tout", retryCount + 1);
      }
    } catch (e) {
      console.error("Erreur de chargement", e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isMounted) fetchDiscoveryTracks("tout");
    return () => {
      if (audioRef.current) audioRef.current.pause();
      clearInterval(progressRef.current);
    };
  }, [isMounted]); // On retire fetchDiscoveryTracks des dépendances pour ne pas le rappeler

  const activeTrack = tracks[currentIndex];

  useEffect(() => {
    if (activeTrack) {
      try {
        controls.set({ x: 0, opacity: 1, rotate: 0 });
      } catch (e) {}
    }
  }, [activeTrack, controls]);

  useEffect(() => {
    clearInterval(progressRef.current);
    setAudioProgress(0);
    setIsPlaying(false);

    if (!audioRef.current || !activeTrack) return;

    if (activeModal !== "none") {
      audioRef.current.volume = 0.2;
      return;
    }

    const audio  = audioRef.current;
    audio.src    = activeTrack.preview;
    audio.volume = 0.8;

    const playPromise = audio.play();
    if (playPromise !== undefined) {
      playPromise
        .then(() => {
          setIsAudioBlocked(false);
          setIsPlaying(true);
          progressRef.current = setInterval(() => {
            if (audio.duration > 0) {
              setAudioProgress((audio.currentTime / audio.duration) * 100);
            }
          }, 250);
        })
        .catch((err) => {
          if (err.name === "NotAllowedError") {
            setIsAudioBlocked(true);
          } else if (err.name !== "AbortError") {
            console.warn("Erreur audio silencieuse, attente d'action utilisateur :", err.name);
            setIsPlaying(false);
          }
        });
    }

    return () => {
      clearInterval(progressRef.current);
      audio.pause();
    };
  }, [currentIndex, activeTrack, activeModal]);

  const goToNext = useCallback(() => {
    clearInterval(progressRef.current);
    setAudioProgress(0);
    setIsPlaying(false);
    dragX.set(0);

    if (audioRef.current) {
        audioRef.current.pause();
    }

    if (currentIndex + 1 >= tracks.length) {
      fetchDiscoveryTracks(activeCategory);
    } else {
      setCurrentIndex((prev) => prev + 1);
    }
  }, [currentIndex, tracks.length, activeCategory, dragX]);

  const handleSwipeIntent = (direction) => {
    setActiveModal(direction);
    controls.start({ x: 0, opacity: 1, rotate: 0 });
  };

  const confirmSwipe = async (direction, actionData) => {
    setActiveModal("none");
    setNewPlaylistName("");
    setHasSwiped(true);

    await controls.start({
      x: direction === "right" ? 350 : -350,
      opacity: 0,
      rotate:  direction === "right" ? 18 : -18,
      transition: { duration: 0.28, ease: "easeIn" },
    });

    if (direction === "right") {
      if (actionData.type === "existing") {
        const pl = playlists.find((p) => p.id === actionData.id);
        if (pl && !pl.tracks.find((t) => t.id === activeTrack.id))
          updatePlaylist(pl.id, { tracks: [...pl.tracks, activeTrack] });
      } else if (actionData.type === "new") {
        createPlaylist(actionData.name, [activeTrack]);
      }
    } else if (direction === "left") {
      if (actionData === "skip") {
        const rejected = JSON.parse(localStorage.getItem("rejectedTracks") || "[]");
        if (!rejected.includes(activeTrack.id)) {
          rejected.push(activeTrack.id);
          localStorage.setItem("rejectedTracks", JSON.stringify(rejected));
        }
      } else if (actionData === "keep") {
        const name = "Garder sous la main";
        const pl   = playlists.find((p) => p.name === name);
        if (!pl) createPlaylist(name, [activeTrack]);
        else if (!pl.tracks.find((t) => t.id === activeTrack.id))
          updatePlaylist(pl.id, { tracks: [...pl.tracks, activeTrack] });
      }
    }

    goToNext();
  };

  const cancelSwipe = () => { setActiveModal("none"); setNewPlaylistName(""); };

  const onDragEnd = (_, info) => {
    dragX.set(0);
    if      (info.offset.x >  110) handleSwipeIntent("right");
    else if (info.offset.x < -110) handleSwipeIntent("left");
    else controls.start({ x: 0, opacity: 1, rotate: 0 });
  };

  const unlockAudio = () => {
    setIsAudioBlocked(false);
    if (!audioRef.current || !activeTrack) return;
    audioRef.current.play()
      .then(() => {
        setIsPlaying(true);
        progressRef.current = setInterval(() => {
          const a = audioRef.current;
          if (a?.duration > 0) setAudioProgress((a.currentTime / a.duration) * 100);
        }, 250);
      })
      .catch(() => {});
  };

  const handleCategoryChange = (catId) => {
    if (catId === activeCategory) return;
    setActiveCategory(catId);
    fetchDiscoveryTracks(catId);
  };

  if (!isMounted) return null;

  return (
    <div className="min-h-[100dvh] text-white flex flex-col relative pb-20 overflow-hidden bg-[#0e0e0e]">
      <Header />

      <AnimatePresence>
        {isAudioBlocked && !isLoading && activeModal === "none" && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={unlockAudio}
            className="fixed inset-0 z-[999] flex flex-col items-center justify-center bg-black/80 backdrop-blur-md cursor-pointer">
            <span className="text-6xl mb-4 animate-bounce">🔇</span>
            <h3 className="text-2xl font-black text-white text-center px-4">Son bloqué</h3>
            <p className="text-white/70 mt-2 text-center px-6">Touche n'importe où pour activer la musique</p>
            <button className="mt-8 bg-[#1db954] text-black px-8 py-3 rounded-full font-bold animate-pulse shadow-[0_0_30px_rgba(29,185,84,0.5)]">
              Activer le son
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      <audio 
        ref={audioRef} 
        preload="auto"
        onEnded={() => { 
          clearInterval(progressRef.current); 
          setAudioProgress(100); 
          setIsPlaying(false); 
        }} 
      />

      {/* Modal droit */}
      <AnimatePresence>
        {activeModal === "right" && (
          <motion.div initial={{ opacity: 0, y: 100 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 100 }}
            className="fixed inset-0 z-[1000] flex flex-col justify-end bg-black/60 backdrop-blur-sm">
            <div className="bg-[#181818] w-full rounded-t-3xl p-6 pb-12 shadow-2xl border-t border-white/10 max-h-[80vh] flex flex-col">
              <div className="flex justify-between items-center mb-6 shrink-0">
                <h3 className="text-2xl font-black">Ajouter à…</h3>
                <button onClick={cancelSwipe} className="text-white/50 hover:text-white bg-white/5 w-8 h-8 rounded-full flex items-center justify-center">✕</button>
              </div>
              <div className="overflow-y-auto flex-1 pr-2 mb-6 custom-scrollbar">
                {playlists.length > 0 ? (
                  <div className="space-y-2">
                    {playlists.map((p) => (
                      <button key={p.id} onClick={() => confirmSwipe("right", { type: "existing", id: p.id })}
                        className="w-full flex items-center gap-4 p-3 rounded-xl hover:bg-white/10 transition-colors text-left bg-white/5 border border-white/5">
                        <div className="w-12 h-12 bg-gradient-to-br from-[#1db954] to-black rounded-md flex items-center justify-center overflow-hidden shrink-0">
                          {p.tracks?.[0]?.image ? <img src={p.tracks[0].image} className="w-full h-full object-cover" /> : "🎵"}
                        </div>
                        <div className="flex-1 truncate">
                          <p className="font-bold truncate">{p.name}</p>
                          <p className="text-xs text-white/50">{p.tracks.length} titre(s)</p>
                        </div>
                      </button>
                    ))}
                  </div>
                ) : <p className="text-white/50 text-center py-4">Aucune playlist existante.</p>}
              </div>
              <div className="shrink-0 border-t border-white/10 pt-6">
                <p className="text-sm font-bold text-white/70 mb-3">Ou créer une nouvelle :</p>
                <div className="flex gap-2">
                  <input type="text" value={newPlaylistName} onChange={(e) => setNewPlaylistName(e.target.value)}
                    placeholder="Nom de la playlist…"
                    className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 outline-none focus:border-[#1db954] text-white" />
                  <button onClick={() => newPlaylistName.trim() && confirmSwipe("right", { type: "new", name: newPlaylistName.trim() })}
                    disabled={!newPlaylistName.trim()}
                    className="bg-[#1db954] text-black font-bold px-6 py-3 rounded-xl disabled:opacity-50">Créer</button>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Modal gauche */}
      <AnimatePresence>
        {activeModal === "left" && (
          <motion.div initial={{ opacity: 0, y: 100 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 100 }}
            className="fixed inset-0 z-[1000] flex flex-col justify-end bg-black/60 backdrop-blur-sm">
            <div className="bg-[#181818] w-full rounded-t-3xl p-6 pb-12 shadow-2xl border-t border-white/10">
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-2xl font-black">Que faire ?</h3>
                <button onClick={cancelSwipe} className="text-white/50 hover:text-white bg-white/5 w-8 h-8 rounded-full flex items-center justify-center">✕</button>
              </div>
              <div className="space-y-4">
                <button onClick={() => confirmSwipe("left", "skip")}
                  className="w-full flex items-center justify-center gap-3 p-4 rounded-xl bg-red-500/10 text-red-500 font-bold border border-red-500/20 hover:bg-red-500/20 transition-colors">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                  Je ne suis pas intéressé
                </button>
                <button onClick={() => confirmSwipe("left", "keep")}
                  className="w-full flex items-center justify-center gap-3 p-4 rounded-xl bg-blue-500/10 text-blue-400 font-bold border border-blue-500/20 hover:bg-blue-500/20 transition-colors">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/></svg>
                  Garder sous la main
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main */}
      <div className="flex-1 flex flex-col items-center justify-center px-4 pt-2 pb-6 overflow-hidden relative">

        <div className="w-full max-w-sm flex gap-2 overflow-x-auto pb-4 pt-2 z-10 shrink-0 snap-x custom-scrollbar">
          {CATEGORIES.map((cat) => (
            <button key={cat.id}
              onClick={() => handleCategoryChange(cat.id)}
              className={`shrink-0 snap-start px-4 py-2 rounded-full text-sm font-bold transition-all border ${
                activeCategory === cat.id
                  ? "bg-[#1db954] text-black border-[#1db954]"
                  : "bg-white/5 text-white/70 border-white/10 hover:bg-white/10"
              }`}>{cat.label}</button>
          ))}
        </div>

        <AnimatePresence>
          {!hasSwiped && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto", marginBottom: 24 }}
              exit={{ opacity: 0, height: 0, marginBottom: 0 }}
              className="text-center z-10 shrink-0 overflow-hidden">
              <h1 className="text-3xl font-black tracking-tight mt-4">Découverte</h1>
              <p className="text-white/50 text-sm mt-1">Glisse à droite pour garder, à gauche pour passer.</p>
            </motion.div>
          )}
        </AnimatePresence>

        <motion.div layout className="relative w-full max-w-sm flex-1 max-h-[550px] flex items-center justify-center">

          {isLoading && (
            <div className="w-full h-full rounded-3xl bg-white/5 animate-pulse border border-white/10 flex items-center justify-center flex-col gap-4">
              <span className="text-4xl animate-bounce">🎧</span>
              <span className="text-[#1db954] font-bold text-sm">Mixage en cours…</span>
            </div>
          )}

          {!isLoading && currentIndex >= tracks.length && (
            <div className="text-center space-y-4 z-10">
              <span className="text-6xl">🎉</span>
              <h2 className="text-2xl font-bold">Tu as tout vu !</h2>
              <button onClick={() => fetchDiscoveryTracks(activeCategory)}
                className="mt-4 bg-[#1db954] text-black px-6 py-3 rounded-full font-bold hover:scale-105 transition-transform">
                Recharger des sons
              </button>
            </div>
          )}

          {!isLoading && activeTrack && currentIndex < tracks.length && (
            <AnimatePresence mode="wait">
              <motion.div
                key={activeTrack.id}
                drag="x"
                dragConstraints={{ left: 0, right: 0 }}
                dragElastic={0.18}
                style={{ x: dragX }}
                onDrag={(_, info) => dragX.set(info.offset.x)}
                onDragEnd={onDragEnd}
                animate={controls}
                whileDrag={{ scale: 1.03, cursor: "grabbing" }}
                className="absolute inset-0 w-full h-full rounded-3xl shadow-2xl overflow-hidden cursor-grab touch-none border border-white/10 bg-[#121212] flex flex-col"
                style={{ touchAction: "none" }}>

                <div className="absolute inset-0 opacity-40 blur-xl scale-110 pointer-events-none"
                  style={{ backgroundImage: `url(${activeTrack.image})`, backgroundSize: "cover", backgroundPosition: "center" }} />

                <motion.div className="absolute inset-0 pointer-events-none z-20 rounded-3xl"
                  style={{ opacity: likeOpacity, background: "linear-gradient(135deg, rgba(29,185,84,0.35) 0%, transparent 60%)" }} />
                <motion.div className="absolute inset-0 pointer-events-none z-20 rounded-3xl"
                  style={{ opacity: skipOpacity, background: "linear-gradient(225deg, rgba(239,68,68,0.35) 0%, transparent 60%)" }} />

                <motion.div className="absolute top-6 left-5 z-30 bg-[#1db954] text-black font-black text-lg px-4 py-1.5 rounded-xl rotate-[-12deg] border-2 border-black/20"
                  style={{ opacity: likeOpacity }}>SAVE ♥</motion.div>
                <motion.div className="absolute top-6 right-5 z-30 bg-red-500 text-white font-black text-lg px-4 py-1.5 rounded-xl rotate-[12deg] border-2 border-black/20"
                  style={{ opacity: skipOpacity }}>SKIP ✕</motion.div>

                <div className="absolute inset-0 flex flex-col p-4 sm:p-6 z-10 bg-gradient-to-b from-transparent via-black/40 to-black/95">
                  <div className="flex-1 flex items-center justify-center py-2 min-h-0">
                    <img src={activeTrack.image} alt={activeTrack.title}
                      className="h-full max-h-[240px] aspect-square object-cover rounded-2xl shadow-[0_20px_50px_rgba(0,0,0,0.5)] pointer-events-none" />
                  </div>

                  <div className="shrink-0 pb-3">
                    <div className="flex items-center gap-2 mb-3">
                      <div className="flex-1 h-1 bg-white/10 rounded-full overflow-hidden">
                        <div className="h-full bg-[#1db954] rounded-full transition-all duration-300"
                          style={{ width: `${audioProgress}%` }} />
                      </div>
                      <span className="text-[10px] font-bold text-white/40 tabular-nums shrink-0">{activeTrack.duration}</span>
                    </div>
                    <h2 className="text-2xl sm:text-3xl font-black text-white leading-tight mb-1 truncate pointer-events-none">
                      {activeTrack.title}
                    </h2>
                    <p className="text-base sm:text-lg text-white/70 truncate pointer-events-none">
                      {activeTrack.artist}
                    </p>
                  </div>

                  <div className="flex items-center justify-between pt-3 border-t border-white/10 shrink-0 pb-2">
                    <button onClick={() => handleSwipeIntent("left")}
                      className="w-14 h-14 sm:w-16 sm:h-16 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-red-500 hover:bg-red-500/10 hover:border-red-500/50 hover:scale-110 transition-all shadow-lg relative z-20">
                      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                    </button>

                    <div className="flex items-end gap-[3px] h-5">
                      {isPlaying
                        ? [0,1,2,3].map((i) => (
                          <span key={i} className="w-1 bg-[#1db954] rounded-sm block"
                            style={{ 
                              height: "100%", 
                              animation: `barBounce 0.8s ease-in-out ${i * 0.15}s infinite alternate` 
                            }} 
                          />
                        ))
                        : <span className="text-white/20 text-lg">♪</span>
                      }
                    </div>

                    <button onClick={() => handleSwipeIntent("right")}
                      className="w-14 h-14 sm:w-16 sm:h-16 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-[#1db954] hover:bg-[#1db954]/10 hover:border-[#1db954]/50 hover:scale-110 transition-all shadow-lg relative z-20">
                      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>
                    </button>
                  </div>
                </div>
              </motion.div>
            </AnimatePresence>
          )}
        </motion.div>
      </div>

      <style dangerouslySetInnerHTML={{__html: `
        @keyframes barBounce {
          from { transform: scaleY(0.3); }
          to   { transform: scaleY(1); }
        }
      `}} />
    </div>
  );
}