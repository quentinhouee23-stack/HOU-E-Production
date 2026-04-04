// @ts-nocheck
"use client";

import React, { useState, useRef, useEffect, Suspense } from "react";
import Image from "next/image"; 
import { useSearchParams } from "next/navigation";
import { useMusic } from "@/context/MusicContext";
import { motion, AnimatePresence } from "framer-motion";
import { AddToPlaylistModal } from "@/components/ui/AddToPlaylistModal"; 
import { Search, Play, PlayCircle, PauseCircle, Plus, ArrowLeft, Mic2, Clock } from "lucide-react"; 

function SearchContent() {
  const searchParams = useSearchParams();
  const urlQuery = searchParams.get("q") || ""; 

  const scrollRef = useRef<HTMLDivElement>(null);

  const [results, setResults] = useState({ tracks: [], artists: [] });
  const [selectedArtist, setSelectedArtist] = useState(null);
  const [selectedAlbum, setSelectedAlbum] = useState(null);
  
  const [previewUrl, setPreviewUrl] = useState(null);
  const previewAudioRef = useRef(null);

  const [trackToAdd, setTrackToAdd] = useState(null); 
  
  const { playTrack, status, togglePlayPause, currentTrack } = useMusic();
  const searchTimeout = useRef(null);

  const hasMiniPlayer = currentTrack !== null;

  // 🟢 MOTEUR BÉTON ARMÉ : Écoute du clavier virtuel (Visual Viewport API)
  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;

    const handleResize = () => {
      // Calcule la hauteur physique prise par le clavier
      const keyboardHeight = window.innerHeight - vv.height;
      
      // Injecte la hauteur dans une variable globale utilisable PARTOUT (y compris dans ta Nav Barre !)
      document.documentElement.style.setProperty('--keyboard-height', `${Math.max(0, keyboardHeight)}px`);
    };

    // Écoute ultra-rapide (60 FPS) sans lag de transition
    vv.addEventListener("resize", handleResize);
    vv.addEventListener("scroll", handleResize);

    // Initialisation
    handleResize();

    return () => {
      vv.removeEventListener("resize", handleResize);
      vv.removeEventListener("scroll", handleResize);
    };
  }, []);

  // LE VERROU : Bloque le scroll du fond quand la modale AddToPlaylist s'ouvre
  useEffect(() => {
    if (typeof document !== 'undefined' && document.body) {
      document.body.style.overflow = !!trackToAdd ? 'hidden' : '';
    }
    return () => { 
      if (typeof document !== 'undefined' && document.body) {
        document.body.style.overflow = ''; 
      }
    };
  }, [trackToAdd]);

  useEffect(() => {
    if (searchTimeout.current) {
      clearTimeout(searchTimeout.current);
    }

    if (urlQuery.length > 2) {
      searchTimeout.current = setTimeout(async () => {
        try {
          const res = await fetch(`/api/search?q=${encodeURIComponent(urlQuery)}`);
          const data = await res.json();
          setResults(data);
        } catch (e) {
          console.error("Erreur API de recherche :", e);
        }
      }, 300); 
    } else {
      setResults({ tracks: [], artists: [] });
    }
  }, [urlQuery]);

  const viewArtist = async (artist) => {
    setSelectedAlbum(null);
    window.dispatchEvent(new Event("closeSearchNav"));

    const res = await fetch(`/api/artist?id=${artist.id}`);
    const data = await res.json();
    setSelectedArtist({ ...artist, topTracks: data.topTracks, albums: data.albums });
  };

  const viewAlbum = async (album) => {
    const res = await fetch(`/api/album?id=${album.id}`);
    const data = await res.json();
    const completeAlbum = { ...album, tracks: data.tracks };
    setSelectedAlbum(completeAlbum);

    setTimeout(() => {
      scrollRef.current?.scrollTo({ top: 0, behavior: "smooth" });
    }, 50);

    try {
      const history = JSON.parse(localStorage.getItem("recentAlbums") || "[]");
      const newHistory = history.filter((a) => a.id !== album.id);
      newHistory.unshift(completeAlbum);
      localStorage.setItem("recentAlbums", JSON.stringify(newHistory.slice(0, 4))); 
    } catch (e) {
      console.error("Erreur sauvegarde album", e);
    }
  };

  const togglePreview = (e, url) => {
    e.stopPropagation(); 
    
    if (!url) {
      alert("❌ Aucun extrait de 30s disponible pour ce titre.");
      return;
    }

    if (previewUrl === url) {
      previewAudioRef.current?.pause();
      setPreviewUrl(null);
    } else {
      if (status === "playing") {
        togglePlayPause(); 
      }
      setPreviewUrl(url);
      
      if (previewAudioRef.current) {
        previewAudioRef.current.src = url;
        previewAudioRef.current.play().catch(err => console.error("Autoplay bloqué", err));
      }
    }
  };

  const handlePlayFullTrack = (track, trackList) => {
    if (previewAudioRef.current) {
      previewAudioRef.current.pause();
    }
    setPreviewUrl(null);
    playTrack(track, trackList);
  };

  const handlePlayFullAlbum = (tracks) => {
    if (!tracks || tracks.length === 0) return;
    if (previewAudioRef.current) {
      previewAudioRef.current.pause();
    }
    setPreviewUrl(null);
    playTrack(tracks[0], tracks);
  };

  return (
    <div className="fixed inset-0 w-full h-[100dvh] bg-[#121212] text-white overflow-hidden flex flex-col z-0">
      
      <audio ref={previewAudioRef} onEnded={() => setPreviewUrl(null)} preload="auto" />

      <AddToPlaylistModal 
        track={trackToAdd} 
        isOpen={!!trackToAdd} 
        onClose={() => setTrackToAdd(null)} 
      />

      <AnimatePresence mode="wait">
        
        {/* ==========================================
            VUE 1 : RÉSULTATS DE LA RECHERCHE (SCROLLABLE)
            ========================================== */}
        {!selectedArtist && !selectedAlbum && (
          <motion.div 
            key="results-view" 
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            ref={scrollRef}
            className="flex-1 w-full overflow-y-auto overflow-x-hidden custom-scrollbar px-6 pt-[calc(env(safe-area-inset-top)+2rem)]"
            // 🟢 L'intégration du clavier : On additionne la hauteur normale + la hauteur dynamique du clavier
            style={{ paddingBottom: `calc(${hasMiniPlayer ? '160px' : '100px'} + var(--keyboard-height, 0px))` }}
          >
            {urlQuery.length <= 2 ? (
              <div className="flex flex-col items-center justify-center h-[60vh] text-center opacity-50">
                <Search className="w-16 h-16 mb-6 text-white/50" />
                <h2 className="text-2xl font-black text-white">Prêt à écouter ?</h2>
                <p className="text-sm mt-2 max-w-xs">Touche la loupe dans la barre en bas pour trouver tes artistes, titres ou albums favoris.</p>
              </div>
            ) : (
              <div className="max-w-5xl mx-auto space-y-8">
                {results.artists && results.artists.length > 0 && (
                  <section>
                    <h2 className="text-xl font-bold mb-4">Artistes</h2>
                    <div className="flex gap-4 overflow-x-auto pb-4 custom-scrollbar">
                      {results.artists.map((artist, i) => (
                        <div 
                          key={`${artist.id}-${i}`} 
                          onClick={() => viewArtist(artist)}
                          className="min-w-[140px] p-4 bg-white/5 rounded-2xl border border-white/10 hover:bg-white/10 cursor-pointer transition-all flex flex-col items-center"
                        >
                          <Image 
                            src={artist.image || "https://api.dicebear.com/7.x/shapes/svg?seed=music"} 
                            alt={artist.name} 
                            width={96} 
                            height={96} 
                            className="rounded-full object-cover mb-3 shadow-xl" 
                          />
                          <span className="text-sm font-bold text-center truncate w-full">{artist.name}</span>
                          <span className="text-[10px] text-white/40 uppercase mt-1 flex items-center gap-1">
                            <Mic2 className="w-3 h-3" /> Artiste
                          </span>
                        </div>
                      ))}
                    </div>
                  </section>
                )}

                {results.tracks && results.tracks.length > 0 && (
                  <section>
                    <h2 className="text-xl font-bold mb-4">Titres</h2>
                    <div className="space-y-2">
                      {results.tracks.map((track, i) => (
                        <div 
                          key={`${track.id}-${i}`} 
                          onClick={() => handlePlayFullTrack(track, results.tracks)}
                          className="flex items-center justify-between p-3 bg-white/5 hover:bg-white/10 rounded-xl border border-white/5 transition-all group cursor-pointer"
                        >
                          <div className="flex items-center gap-4 flex-1 overflow-hidden">
                            <Image 
                              src={track.image || "https://api.dicebear.com/7.x/shapes/svg?seed=music"} 
                              alt={track.title} 
                              width={48} 
                              height={48} 
                              className="rounded-lg object-cover shrink-0" 
                            />
                            <div className="flex-1 truncate">
                              <div className={`font-bold text-sm truncate ${previewUrl === track.preview ? 'text-[#1db954]' : 'text-white'}`}>{track.title}</div>
                              <div className="text-xs text-white/50 truncate">{track.artist}</div>
                            </div>
                          </div>

                          <div className="flex items-center gap-3 shrink-0 ml-2">
                            <button 
                              onClick={(e) => togglePreview(e, track.preview)}
                              className={`w-10 h-10 flex items-center justify-center rounded-full border ${previewUrl === track.preview ? 'border-[#1db954] text-[#1db954] bg-[#1db954]/10' : 'border-white/20 text-white/70 hover:bg-white/10 hover:text-white hover:border-white'} transition-all`}
                            >
                              {previewUrl === track.preview ? <PauseCircle className="w-5 h-5" /> : <PlayCircle className="w-5 h-5" />}
                            </button>
                            
                            <button 
                              onClick={(e) => { e.stopPropagation(); setTrackToAdd(track); }}
                              className="w-10 h-10 flex items-center justify-center rounded-full text-white/50 hover:bg-white/10 hover:text-white transition-all text-xl"
                            >
                              <Plus className="w-5 h-5" />
                            </button>

                            <button className="w-10 h-10 rounded-full bg-[#1db954] text-black flex items-center justify-center hover:scale-105 transition-transform shadow-md">
                              <Play className="w-4 h-4 ml-0.5" fill="currentColor" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </section>
                )}
                
                {results.tracks?.length === 0 && results.artists?.length === 0 && (
                   <div className="text-center mt-20 opacity-50 flex flex-col items-center">
                     <Search className="w-12 h-12 mb-4" />
                     <p className="text-lg font-bold">Aucun résultat trouvé pour "{urlQuery}"</p>
                     <p className="text-sm mt-1">Essaie avec un autre mot-clé.</p>
                   </div>
                )}
              </div>
            )}
          </motion.div>
        )}

        {/* ==========================================
            VUE 2 : DÉTAIL D'ARTISTE (ANTI-SCROLL BAVEUX)
            ========================================== */}
        {selectedArtist && !selectedAlbum && (
          <motion.div 
            key="artist" 
            initial={{ opacity: 0, x: 50 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -50 }}
            className="absolute inset-0 w-full h-[100dvh] bg-[#121212] z-40 flex flex-col overflow-hidden"
          >
            {/* EN TÊTE FIXE */}
            <div className="shrink-0 pt-[calc(env(safe-area-inset-top)+1rem)] px-4 pb-4 z-50 bg-[#121212] touch-none border-b border-white/5">
              <div className="max-w-5xl mx-auto flex flex-col w-full">
                <button 
                  onClick={() => {
                    setSelectedArtist(null);
                    window.dispatchEvent(new Event("openSearchNav"));
                  }} 
                  className="w-10 h-10 mb-4 flex items-center justify-center bg-white/10 hover:bg-white/20 rounded-full transition-colors pointer-events-auto shrink-0"
                >
                  <ArrowLeft className="w-5 h-5 text-white" />
                </button>
                
                <div className="flex items-center gap-4 bg-gradient-to-r from-white/5 to-transparent p-3 rounded-2xl border border-white/5 relative overflow-hidden pointer-events-auto">
                  <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-full shadow-lg overflow-hidden border-2 border-white/10 flex-shrink-0 z-10 relative flex items-center justify-center">
                    <Image 
                      src={selectedArtist.image || "https://api.dicebear.com/7.x/shapes/svg?seed=music"} 
                      alt={selectedArtist.name} 
                      fill 
                      className="object-cover pointer-events-none" 
                    />
                  </div>
                  <div className="z-10 flex-1 min-w-0">
                    <span className="text-[10px] font-bold uppercase tracking-widest text-white/50 flex items-center gap-1">
                      <Mic2 className="w-3 h-3" /> Artiste
                    </span>
                    <h1 className="text-xl sm:text-2xl font-black mb-1 truncate w-full text-white">{selectedArtist.name}</h1>
                  </div>
                </div>
              </div>
            </div>

            {/* ZONE SCROLLABLE */}
            <div 
              className="flex-1 w-full overflow-y-auto overflow-x-hidden overscroll-contain touch-pan-y pointer-events-auto custom-scrollbar px-4"
              style={{ paddingBottom: `calc(${hasMiniPlayer ? '160px' : '100px'} + var(--keyboard-height, 0px))` }}
            >
              <div className="max-w-5xl mx-auto pt-6">
                <h2 className="text-xl font-bold mb-4">Populaires</h2>
                <div className="space-y-1 mb-10">
                  {selectedArtist.topTracks?.map((track, i) => (
                    <div 
                      key={`${track.id}-${i}`} 
                      onClick={() => handlePlayFullTrack(track, selectedArtist.topTracks)}
                      className="flex items-center gap-4 p-3 hover:bg-white/10 rounded-xl transition-all group cursor-pointer"
                    >
                      <span className="w-6 text-white/30 text-sm text-right shrink-0">{i + 1}</span>
                      <Image src={track.image || "https://api.dicebear.com/7.x/shapes/svg?seed=music"} alt="" width={40} height={40} className="rounded shadow-md object-cover shrink-0 pointer-events-none" />
                      <div className="flex-1 overflow-hidden">
                        <div className={`text-sm font-bold truncate ${previewUrl === track.preview ? 'text-[#1db954]' : 'text-white group-hover:text-[#1db954]'}`}>{track.title}</div>
                      </div>
                      <div className="flex items-center gap-3 shrink-0">
                        <div className="text-xs text-white/40 hidden sm:block"><Clock className="w-3 h-3 inline mr-1"/>{track.duration}</div>
                        <button 
                          onClick={(e) => togglePreview(e, track.preview)}
                          className={`w-8 h-8 flex items-center justify-center rounded-full border ${previewUrl === track.preview ? 'border-[#1db954] text-[#1db954]' : 'border-white/20 text-white/70 hover:bg-white/10'} transition-all`}
                        >
                          {previewUrl === track.preview ? <PauseCircle className="w-4 h-4" /> : <PlayCircle className="w-4 h-4" />}
                        </button>
                        <button 
                          onClick={(e) => { e.stopPropagation(); setTrackToAdd(track); }}
                          className="w-8 h-8 flex items-center justify-center rounded-full text-white/50 hover:bg-white/10 hover:text-white transition-all text-xl"
                        >
                          <Plus className="w-5 h-5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>

                <h2 className="text-xl font-bold mb-4">Discographie</h2>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                  {selectedArtist.albums?.map((album, i) => (
                    <div 
                      key={`${album.id}-${i}`} 
                      onClick={() => viewAlbum(album)}
                      className="bg-white/5 p-4 rounded-2xl hover:bg-white/10 transition-colors cursor-pointer group"
                    >
                      <div className="relative mb-3 shadow-lg rounded-xl overflow-hidden aspect-square">
                         <Image 
                           src={album.image || "https://api.dicebear.com/7.x/shapes/svg?seed=music"} 
                           alt={album.title} 
                           fill
                           sizes="(max-width: 640px) 50vw, (max-width: 768px) 33vw, (max-width: 1024px) 25vw, 20vw"
                           className="object-cover group-hover:scale-105 transition-transform duration-300" 
                         />
                      </div>
                      <h3 className="font-bold text-sm truncate text-white">{album.title}</h3>
                      <p className="text-xs text-white/50">{album.year} • Album</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </motion.div>
        )}

        {/* ==========================================
            VUE 3 : DÉTAIL D'ALBUM (ANTI-SCROLL BAVEUX)
            ========================================== */}
        {selectedAlbum && (
          <motion.div 
            key="album" 
            initial={{ opacity: 0, x: 50 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -50 }}
            className="absolute inset-0 w-full h-[100dvh] bg-[#121212] z-40 flex flex-col overflow-hidden"
          >
            {/* EN TÊTE FIXE */}
            <div className="shrink-0 px-4 pt-[calc(env(safe-area-inset-top)+1rem)] pb-4 bg-[#121212] z-50 touch-none border-b border-white/5">
              <div className="max-w-5xl mx-auto flex flex-col w-full">
                <button onClick={() => {
                  setSelectedAlbum(null);
                  if (previewAudioRef.current) previewAudioRef.current.pause();
                  setPreviewUrl(null);
                  setTimeout(() => scrollRef.current?.scrollTo({ top: 0, behavior: "smooth" }), 50);
                }} className="w-10 h-10 mb-4 flex items-center justify-center bg-white/10 hover:bg-white/20 rounded-full transition-colors pointer-events-auto shrink-0">
                  <ArrowLeft className="w-5 h-5 text-white" />
                </button>
                
                <div className="flex items-center gap-4 bg-gradient-to-r from-white/5 to-transparent p-3 rounded-2xl border border-white/5 relative overflow-hidden pointer-events-auto">
                  <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-lg shadow-lg overflow-hidden bg-white/10 flex-shrink-0 z-10 relative flex items-center justify-center">
                    <Image 
                      src={selectedAlbum.image || `https://api.deezer.com/album/${selectedAlbum.id}/image`} 
                      alt={selectedAlbum.title}
                      fill
                      sizes="(max-width: 640px) 80px, 96px"
                      className="object-cover pointer-events-none" 
                    />
                  </div>
                  
                  <div className="z-10 flex-1 min-w-0">
                    <span className="text-[10px] font-bold uppercase tracking-widest text-white/50">Album</span>
                    <h1 className="text-xl sm:text-2xl font-black mb-1 truncate w-full text-white">{selectedAlbum.title}</h1>
                    <div className="flex items-center gap-2 text-xs text-white/70">
                      <span className="font-bold text-white truncate">{selectedArtist?.name || selectedAlbum.artist || "Artiste"}</span>
                      <span>•</span>
                      <span>{selectedAlbum.tracks?.length || 0} titres</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 w-full pointer-events-auto mt-4">
                  <button 
                    onClick={() => handlePlayFullAlbum(selectedAlbum.tracks)}
                    className="w-10 h-10 shrink-0 flex items-center justify-center rounded-full bg-[#1db954] text-black hover:scale-105 transition-transform shadow-md"
                  >
                    <Play className="w-4 h-4 ml-1" fill="currentColor" />
                  </button>
                </div>
              </div>
            </div>

            {/* ZONE SCROLLABLE */}
            <div 
              ref={scrollRef}
              className="flex-1 w-full overflow-y-auto overflow-x-hidden overscroll-contain touch-pan-y pointer-events-auto custom-scrollbar px-4"
              style={{ paddingBottom: `calc(${hasMiniPlayer ? '160px' : '100px'} + var(--keyboard-height, 0px))` }}
            >
              <div className="max-w-5xl mx-auto pt-2 space-y-1">
                <div className="flex items-center gap-4 p-2 mb-2 border-b border-white/10 text-xs font-bold uppercase tracking-widest text-white/50">
                    <span className="w-8 text-center">#</span>
                    <span className="flex-1">Titre</span>
                    <span className="mr-4">Actions</span>
                </div>
                {selectedAlbum.tracks?.map((track, i) => (
                  <div 
                    key={`${track.id}-${i}`} 
                    onClick={() => handlePlayFullTrack(track, selectedAlbum.tracks)}
                    className="flex items-center gap-4 p-3 hover:bg-white/10 rounded-xl transition-all group cursor-pointer"
                  >
                    <span className="w-8 text-white/30 text-sm text-center shrink-0">{i + 1}</span>
                    <div className="flex-1 overflow-hidden">
                      <div className={`text-sm font-bold truncate transition-colors ${previewUrl === track.preview ? 'text-[#1db954]' : 'text-white group-hover:text-[#1db954]'}`}>{track.title}</div>
                      <div className="text-xs text-white/50">{track.artist}</div>
                    </div>
                    
                    <div className="flex items-center gap-3 shrink-0">
                      <div className="text-xs text-white/40 hidden sm:block">{track.duration}</div>
                      <button 
                        onClick={(e) => togglePreview(e, track.preview)}
                        className={`w-8 h-8 flex items-center justify-center rounded-full border ${previewUrl === track.preview ? 'border-[#1db954] text-[#1db954]' : 'border-white/20 text-white/70 hover:bg-white/10'} transition-all`}
                      >
                        {previewUrl === track.preview ? <PauseCircle className="w-4 h-4" /> : <PlayCircle className="w-4 h-4" />}
                      </button>
                      <button 
                        onClick={(e) => { e.stopPropagation(); setTrackToAdd(track); }}
                        className="w-8 h-8 flex items-center justify-center rounded-full text-white/50 hover:bg-white/10 hover:text-white transition-all text-xl"
                      >
                        <Plus className="w-5 h-5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default function SearchPage() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center min-h-screen text-[#1db954] text-2xl font-bold animate-pulse bg-[#121212]">
        Chargement...
      </div>
    }>
      <SearchContent />
    </Suspense>
  );
}