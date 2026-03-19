// @ts-nocheck
"use client";

import React, { useState, useRef, useEffect, Suspense } from "react";
import Image from "next/image"; // 🟢 IMPORT DU COMPOSANT OPTIMISÉ
import { useSearchParams } from "next/navigation";
import { useMusic } from "@/context/MusicContext";
import { motion, AnimatePresence } from "framer-motion";
import { AddToPlaylistModal } from "@/components/ui/AddToPlaylistModal"; 
import { Search, Play, PlayCircle, PauseCircle, Plus, ArrowLeft, Mic2 } from "lucide-react"; 

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
  
  const { playTrack, status, togglePlayPause } = useMusic();
  const searchTimeout = useRef(null);

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

    setTimeout(() => {
      scrollRef.current?.scrollTo({ top: 0, behavior: "smooth" });
    }, 50);
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
    <div ref={scrollRef} className="h-[100dvh] w-full overflow-y-auto overflow-x-hidden bg-[#121212] text-white custom-scrollbar">
      <div className="p-6 pb-40 min-h-[100dvh]">
        <audio 
          ref={previewAudioRef} 
          onEnded={() => setPreviewUrl(null)} 
          preload="auto" 
        />

        <AddToPlaylistModal 
          track={trackToAdd} 
          isOpen={!!trackToAdd} 
          onClose={() => setTrackToAdd(null)} 
        />

        <AnimatePresence mode="wait">
          
          {/* ÉCRAN VIDE (AVANT RECHERCHE) */}
          {!selectedArtist && !selectedAlbum && urlQuery.length <= 2 && (
             <motion.div 
               initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
               className="flex flex-col items-center justify-center h-[60vh] text-center opacity-50"
             >
               <Search className="w-16 h-16 mb-6 text-white/50" />
               <h2 className="text-2xl font-black text-white">Prêt à écouter ?</h2>
               <p className="text-sm mt-2 max-w-xs">Touche la loupe dans la barre en bas pour trouver tes artistes, titres ou albums favoris.</p>
             </motion.div>
          )}

          {/* RÉSULTATS DE RECHERCHE */}
          {!selectedArtist && !selectedAlbum && urlQuery.length > 2 && (
            <motion.div key="results" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              {results.artists && results.artists.length > 0 && (
                <section className="mb-8">
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
            </motion.div>
          )}

          {/* VUE ARTISTE */}
          {selectedArtist && !selectedAlbum && (
            <motion.div key="artist" initial={{ opacity: 0, x: 50 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -50 }}>
              <button 
                onClick={() => {
                  setSelectedArtist(null);
                  window.dispatchEvent(new Event("openSearchNav"));
                  setTimeout(() => {
                    scrollRef.current?.scrollTo({ top: 0, behavior: "smooth" });
                  }, 50);
                }} 
                className="mb-6 text-[#1db954] font-bold flex items-center gap-2 hover:scale-105 transition-transform"
              >
                <ArrowLeft className="w-4 h-4" /> Retour à la recherche
              </button>
              
              <div className="flex items-center gap-6 mb-10">
                <Image 
                  src={selectedArtist.image || "https://api.dicebear.com/7.x/shapes/svg?seed=music"} 
                  alt={selectedArtist.name} 
                  width={160} 
                  height={160} 
                  className="w-32 h-32 sm:w-40 sm:h-40 rounded-full shadow-2xl border-4 border-white/10 object-cover" 
                />
                <div>
                  <span className="text-xs font-bold uppercase tracking-widest text-white/50 flex items-center gap-1">
                    <Mic2 className="w-3 h-3" /> Artiste vérifié
                  </span>
                  <h1 className="text-4xl sm:text-5xl font-black mt-2">{selectedArtist.name}</h1>
                </div>
              </div>

              <h2 className="text-xl font-bold mb-4">Populaires</h2>
              <div className="space-y-1 mb-10">
                {selectedArtist.topTracks?.map((track, i) => (
                  <div 
                    key={`${track.id}-${i}`} 
                    onClick={() => handlePlayFullTrack(track, selectedArtist.topTracks)}
                    className="flex items-center gap-4 p-3 hover:bg-white/10 rounded-xl transition-all group cursor-pointer"
                  >
                    <span className="w-6 text-white/30 text-sm text-right shrink-0">{i + 1}</span>
                    <Image 
                      src={track.image || "https://api.dicebear.com/7.x/shapes/svg?seed=music"} 
                      alt={track.title} 
                      width={40} 
                      height={40} 
                      className="rounded shadow-md object-cover shrink-0" 
                    />
                    
                    <div className="flex-1 overflow-hidden">
                      <div className={`text-sm font-bold truncate ${previewUrl === track.preview ? 'text-[#1db954]' : 'text-white'}`}>{track.title}</div>
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
            </motion.div>
          )}

          {/* VUE ALBUM */}
          {selectedAlbum && (
            <motion.div key="album" initial={{ opacity: 0, x: 50 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -50 }}>
              <button 
                onClick={() => {
                  setSelectedAlbum(null);
                  setTimeout(() => {
                    scrollRef.current?.scrollTo({ top: 0, behavior: "smooth" });
                  }, 50);
                }} 
                className="mb-6 text-[#1db954] font-bold flex items-center gap-2 hover:scale-105 transition-transform"
              >
                <ArrowLeft className="w-4 h-4" /> Retour à {selectedArtist?.name || "la recherche"}
              </button>
              
              <div className="flex items-end gap-6 mb-10 bg-gradient-to-b from-white/10 to-transparent p-6 rounded-3xl border border-white/5">
                <Image 
                  src={selectedAlbum.image || `https://api.deezer.com/album/${selectedAlbum.id}/image`} 
                  alt={selectedAlbum.title} 
                  width={224} 
                  height={224} 
                  className="w-40 h-40 sm:w-56 sm:h-56 rounded-xl shadow-2xl object-cover" 
                />
                <div className="pb-2">
                  <span className="text-xs font-bold uppercase tracking-widest text-white/50">Album</span>
                  <h1 className="text-3xl sm:text-5xl font-black mt-2 mb-4 line-clamp-2">{selectedAlbum.title}</h1>
                  <div className="flex items-center gap-2 text-sm text-white/70">
                     {selectedArtist?.image && (
                       <Image 
                         src={selectedArtist.image} 
                         alt={selectedArtist.name} 
                         width={24} 
                         height={24} 
                         className="rounded-full object-cover" 
                       />
                     )}
                     <span className="font-bold text-white">{selectedArtist?.name || selectedAlbum.artist || "Artiste"}</span>
                     <span>•</span>
                     <span>{selectedAlbum.year}</span>
                     <span>•</span>
                     <span>{selectedAlbum.tracks?.length || 0} titres</span>
                  </div>
                </div>
              </div>

              <div className="mb-8 pl-4">
                 <button 
                   onClick={() => handlePlayFullAlbum(selectedAlbum.tracks)}
                   className="w-14 h-14 flex items-center justify-center rounded-full bg-[#1db954] text-black hover:scale-105 transition-transform shadow-[0_0_20px_rgba(29,185,84,0.4)] pl-1"
                 >
                   <Play className="w-6 h-6" fill="currentColor" />
                 </button>
              </div>

              <div className="space-y-1">
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
                      <div className={`text-sm font-bold truncate transition-colors ${previewUrl === track.preview ? 'text-[#1db954]' : 'text-white group-hover:text-[#1db954]'}`}>
                        {track.title}
                      </div>
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
            </motion.div>
          )}

        </AnimatePresence>
      </div>
    </div>
  );
}

export default function SearchPage() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center min-h-screen text-[#1db954] text-2xl font-bold animate-pulse">
        Chargement...
      </div>
    }>
      <SearchContent />
    </Suspense>
  );
}