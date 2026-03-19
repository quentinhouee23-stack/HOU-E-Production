// @ts-nocheck
"use client";

import React, { useEffect, useState, useRef } from "react";
import Image from "next/image"; // 🟢 IMPORT DU COMPOSANT OPTIMISÉ
import { Header } from "@/components/ui/Header";
import { usePlaylists } from "@/context/PlaylistContext";
import { useMusic } from "@/context/MusicContext";
import { useAuth } from "@/context/AuthContext";
import { supabase } from "@/lib/supabase";
import { motion, AnimatePresence } from "framer-motion";
import { 
  Calendar, Flame, Disc3, ListMusic, Play, PlayCircle, 
  PauseCircle, Plus, ArrowLeft, Clock, ExternalLink 
} from "lucide-react"; 
import Link from "next/link";
import { AddToPlaylistModal } from "@/components/ui/AddToPlaylistModal";

export default function HomePage() {
  const { user } = useAuth();
  const { playlists } = usePlaylists();
  const { playTrack, status, togglePlayPause } = useMusic();
  
  const scrollRef = useRef<HTMLDivElement>(null);

  const previewAudioRef = useRef(null);
  const [previewUrl, setPreviewUrl] = useState(null);

  const [greeting, setGreeting] = useState("Bonjour");
  const [newsFeed, setNewsFeed] = useState([]);
  const [isLoadingFeed, setIsLoadingFeed] = useState(true);
  const [recentAlbums, setRecentAlbums] = useState([]);
  
  const [selectedAlbum, setSelectedAlbum] = useState(null);
  const [trackToAdd, setTrackToAdd] = useState(null); 

  const [releases, setReleases] = useState([]);
  const [isLoadingReleases, setIsLoadingReleases] = useState(true);

  const [friendsActivity, setFriendsActivity] = useState([]);

  useEffect(() => {
    const hour = new Date().getHours();
    setGreeting(hour < 18 ? "Bonjour" : "Bonsoir");

    try {
      const savedAlbums = JSON.parse(localStorage.getItem("recentAlbums") || "[]");
      setRecentAlbums(savedAlbums);
    } catch (e) {
      console.error(e);
    }

    const loadNews = async () => {
      try {
        const res = await fetch(`/api/news`);
        const data = await res.json();
        if (data.news) setNewsFeed(data.news);
      } catch (error) {
        console.error("Erreur chargement du feed", error);
      } finally {
        setIsLoadingFeed(false);
      }
    };

    const loadReleases = async () => {
      try {
        const res = await fetch(`/api/releases`);
        const data = await res.json();
        if (data.albums) setReleases(data.albums);
      } catch (error) {
        console.error("Erreur chargement des nouveautés", error);
      } finally {
        setIsLoadingReleases(false);
      }
    };

    loadNews();
    loadReleases();
  }, []);

  useEffect(() => {
    const loadFriendsActivity = async () => {
      if (!user) return;
      const { data, error } = await supabase
        .from('friends')
        .select(`
          status,
          sender:user_id_1 ( id, username, current_listening ),
          receiver:user_id_2 ( id, username, current_listening )
        `)
        .eq('status', 'accepted')
        .or(`user_id_1.eq.${user.id},user_id_2.eq.${user.id}`);

      if (error) return;

      const activity = [];
      data?.forEach(rel => {
        if (!rel.sender || !rel.receiver) return;
        const isSender = rel.sender.id === user.id;
        const friend = isSender ? rel.receiver : rel.sender;
        if (friend.current_listening && friend.current_listening.title) {
          activity.push(friend);
        }
      });
      setFriendsActivity(activity);
    };

    if (user) {
      loadFriendsActivity();
    }
  }, [user]);

  useEffect(() => {
    const handleReset = () => {
      setSelectedAlbum(null);
      if (previewAudioRef.current) previewAudioRef.current.pause();
      setPreviewUrl(null);
      setTimeout(() => {
        scrollRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
      }, 50);
    };
    window.addEventListener("resetHomeView", handleReset);
    return () => window.removeEventListener("resetHomeView", handleReset);
  }, []);

  const viewAlbum = async (album) => {
    if (album.status === "upcoming" || !album.id) return; 

    try {
      const res = await fetch(`/api/album?id=${album.id}`);
      const data = await res.json();
      
      if (data && data.tracks && data.tracks.length > 0) {
        const completeAlbum = { ...album, tracks: data.tracks };
        setSelectedAlbum(completeAlbum);
        
        setTimeout(() => {
          scrollRef.current?.scrollTo({ top: 0, behavior: "smooth" });
        }, 50);

        const history = JSON.parse(localStorage.getItem("recentAlbums") || "[]");
        const newHistory = history.filter((a) => a.id !== album.id);
        newHistory.unshift(completeAlbum);
        
        localStorage.setItem("recentAlbums", JSON.stringify(newHistory.slice(0, 8)));
        setRecentAlbums(newHistory.slice(0, 8));
      } else {
        console.warn("L'album est vide ou introuvable sur l'API Deezer.");
      }
    } catch (e) {
      console.error("Erreur lors de l'ouverture de l'album", e);
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
    if (previewAudioRef.current) previewAudioRef.current.pause();
    setPreviewUrl(null);
    playTrack(track, trackList);
  };

  const handlePlayFullAlbum = (tracks) => {
    if (!tracks || tracks.length === 0) return;
    if (previewAudioRef.current) previewAudioRef.current.pause();
    setPreviewUrl(null);
    playTrack(tracks[0], tracks);
  };

  const mixedLibrary = [
    ...playlists.map(p => ({ ...p, isAlbum: false })),
    ...recentAlbums.map(a => ({ ...a, isAlbum: true, name: a.title }))
  ].slice(0, 4);

  const timeAgo = (dateString) => {
    const now = new Date();
    const published = new Date(dateString);
    const diffHours = Math.round((now - published) / (1000 * 60 * 60));
    if (diffHours === 0) return "À l'instant";
    if (diffHours === 1) return "Il y a 1 heure";
    if (diffHours > 24) return `Il y a ${Math.round(diffHours / 24)} jours`;
    return `Il y a ${diffHours} heures`;
  };

  return (
    <div ref={scrollRef} className="h-[100dvh] w-full overflow-y-auto overflow-x-hidden bg-[#121212] text-white custom-scrollbar">
      
      <audio ref={previewAudioRef} onEnded={() => setPreviewUrl(null)} preload="auto" />
      
      <AddToPlaylistModal 
        track={trackToAdd} 
        isOpen={!!trackToAdd} 
        onClose={() => setTrackToAdd(null)} 
      />

      <div className="pb-32 min-h-[100dvh]">
        <Header />
        
        <AnimatePresence mode="wait">
          {!selectedAlbum ? (
            <motion.div 
              key="home" 
              initial={{ opacity: 0 }} 
              animate={{ opacity: 1 }} 
              exit={{ opacity: 0, x: -50 }}
              className="px-4 sm:px-6 pt-6 space-y-10 max-w-5xl mx-auto"
            >
              
              <section>
                <motion.h1 
                  initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} 
                  className="text-3xl font-black mb-6 tracking-tight"
                >
                  {greeting}
                </motion.h1>

                {friendsActivity.length > 0 && (
                  <div className="mb-6">
                    <h2 className="text-sm font-bold text-white/70 mb-3 flex items-center gap-2 uppercase tracking-wider">
                      En direct chez tes amis <span className="w-2 h-2 rounded-full bg-[#1db954] animate-pulse"></span>
                    </h2>
                    <div className="flex gap-3 overflow-x-auto pb-2 custom-scrollbar snap-x">
                      {friendsActivity.map((friend, i) => (
                         <div key={i} className="min-w-[160px] max-w-[200px] bg-white/5 rounded-2xl p-3 flex items-center gap-3 border border-white/5 snap-start hover:bg-white/10 transition-colors">
                           <div className="relative w-10 h-10 rounded-full bg-[#1db954]/20 flex items-center justify-center text-[#1db954] font-bold shrink-0 uppercase">
                             {friend.username.charAt(0)}
                             <Image 
                               src={friend.current_listening.image || "https://api.dicebear.com/7.x/shapes/svg?seed=music"} 
                               alt="" 
                               width={20} 
                               height={20} 
                               className="absolute -bottom-1 -right-1 rounded-full border border-[#121212] object-cover" 
                             />
                           </div>
                           <div className="flex-1 overflow-hidden">
                             <p className="text-[10px] text-[#1db954] font-bold truncate">{friend.username}</p>
                             <p className="text-xs text-white font-bold truncate">{friend.current_listening.title}</p>
                             <p className="text-[9px] text-white/50 truncate">{friend.current_listening.artist}</p>
                           </div>
                         </div>
                      ))}
                    </div>
                  </div>
                )}

                {mixedLibrary.length > 0 ? (
                  <div className="grid grid-cols-2 gap-3 sm:gap-4">
                    {mixedLibrary.map((item, i) => (
                      <motion.div 
                        initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: i * 0.05 }}
                        key={`lib-${item.id || i}`} 
                        onClick={() => {
                          if (item.isAlbum) {
                             viewAlbum(item);
                          } else {
                             handlePlayFullTrack(item.tracks[0], item.tracks);
                          }
                        }}
                        className="flex items-center bg-white/5 hover:bg-white/20 transition-colors rounded-md overflow-hidden cursor-pointer group shadow-sm"
                      >
                        <div className="w-14 h-14 sm:w-16 sm:h-16 bg-gradient-to-br from-[#1db954]/80 to-[#121212] flex-shrink-0 relative flex items-center justify-center">
                           {item.tracks?.[0]?.image || item.image ? (
                             <Image 
                               src={item.isAlbum ? item.image : item.tracks[0].image} 
                               alt="" 
                               fill
                               sizes="64px"
                               className="object-cover" 
                             />
                           ) : (
                             <ListMusic className="w-6 h-6 text-white/50" />
                           )}
                           <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                             <Play className="w-6 h-6 text-white fill-current ml-1" />
                           </div>
                        </div>
                        <div className="px-3 flex-1 overflow-hidden">
                          <h3 className="font-bold text-sm text-white truncate">{item.name}</h3>
                          {item.isAlbum && <p className="text-[10px] text-white/50 uppercase">Album</p>}
                        </div>
                      </motion.div>
                    ))}
                  </div>
                ) : (
                  <div className="bg-white/5 border border-white/10 rounded-2xl p-6 text-center">
                    <p className="text-white/50 mb-4">Cherche des albums ou crée des mix pour les voir ici.</p>
                    <Link href="/search" className="bg-white text-black px-6 py-2 rounded-full font-bold hover:scale-105 transition-transform inline-block">Explorer</Link>
                  </div>
                )}
              </section>

              <section>
                <div className="flex items-center gap-2 mb-4">
                  <h2 className="text-2xl font-black">Sorties & Exclus</h2>
                  <Disc3 className="w-6 h-6 text-[#1db954] hover:rotate-180 transition-transform duration-700" />
                </div>
                
                {isLoadingReleases ? (
                  <div className="flex gap-4 overflow-x-hidden pb-4">
                    {[1, 2, 3, 4].map(n => (
                      <div key={n} className="min-w-[140px] sm:min-w-[160px] aspect-square rounded-2xl bg-white/5 animate-pulse"></div>
                    ))}
                  </div>
                ) : (
                  <div className="flex gap-4 overflow-x-auto pb-4 custom-scrollbar snap-x">
                    {releases.map((album, i) => (
                      <motion.div 
                        initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.1 }}
                        key={`release-${album.id}-${i}`} 
                        onClick={() => viewAlbum(album)}
                        className="min-w-[140px] sm:min-w-[160px] snap-start group cursor-pointer flex flex-col"
                      >
                        <div className="relative aspect-square rounded-2xl overflow-hidden mb-3 shadow-lg bg-gradient-to-br from-white/10 to-white/5">
                          
                          {album.status === "new" && (
                            <>
                              <Image 
                                src={album.image || "https://api.dicebear.com/7.x/shapes/svg?seed=music"} 
                                alt={album.title} 
                                fill
                                sizes="(max-width: 640px) 140px, 160px"
                                className="object-cover group-hover:scale-105 transition-transform duration-500" 
                              />
                              <div className="absolute top-2 left-2 bg-[#1db954] text-black text-[10px] font-bold px-2 py-1 rounded-md uppercase tracking-wider shadow-md">
                                Nouveau
                              </div>
                            </>
                          )}

                          {album.status === "upcoming" && (
                            <>
                              <div className="w-full h-full bg-gradient-to-tr from-purple-900/80 to-black flex flex-col items-center justify-center opacity-90 group-hover:opacity-100 transition-opacity">
                                <Clock className="w-8 h-8 mb-2 text-white/80" />
                                <span className="text-white font-bold text-xs bg-black/50 px-2 py-1 rounded-md mt-1 shadow-md text-center">{album.date}</span>
                              </div>
                              <div className="absolute inset-0 bg-black/40 backdrop-blur-[1px] pointer-events-none"></div>
                              <div className="absolute top-2 left-2 bg-purple-500 text-white text-[10px] font-bold px-2 py-1 rounded-md uppercase tracking-wider shadow-md">
                                À venir
                              </div>
                            </>
                          )}
                        </div>
                        
                        <h3 className="font-bold text-sm text-white truncate group-hover:text-[#1db954] transition-colors">{album.title}</h3>
                        <p className="text-xs text-white/50 truncate">{album.artist}</p>
                        
                        <div className="mt-1.5 flex flex-col gap-1.5 items-start">
                          {album.genre && (
                            <span className="bg-white/10 text-white/80 text-[9px] px-2 py-0.5 rounded-full font-bold uppercase tracking-widest border border-white/5">
                              {album.genre}
                            </span>
                          )}
                          
                          {album.status === "new" && (
                            <p className="text-[10px] text-white/40 flex items-center gap-1 font-medium">
                              <Calendar className="w-3 h-3" /> Sorti le {album.date}
                            </p>
                          )}
                        </div>
                      </motion.div>
                    ))}
                  </div>
                )}
              </section>

              <section>
                <div className="flex items-center gap-2 mb-6 border-t border-white/10 pt-8">
                  <h2 className="text-2xl font-black">Fil d'actualité</h2>
                  <Flame className="w-6 h-6 text-orange-500" />
                </div>

                {isLoadingFeed ? (
                  <div className="space-y-4">
                    {[1, 2, 3].map(n => <div key={n} className="bg-white/5 rounded-2xl h-40 animate-pulse"></div>)}
                  </div>
                ) : (
                  <div className="flex flex-col gap-5">
                    {newsFeed.map((post, i) => (
                      <motion.div 
                        initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.1 }}
                        key={post.id} 
                        className="bg-[#181818] border border-white/5 rounded-2xl p-5 hover:bg-[#202020] transition-colors group"
                      >
                        <div className="flex flex-col gap-3">
                          <div className="flex items-center gap-2">
                            <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-purple-500 to-blue-500 flex items-center justify-center text-xs font-bold shadow-md">
                              {post.source.charAt(0)}
                            </div>
                            <div>
                              <p className="text-xs font-bold text-white leading-none">{post.source}</p>
                              <p className="text-[10px] text-white/40 mt-1">{timeAgo(post.date)}</p>
                            </div>
                          </div>
                          
                          <div>
                            <h3 className="font-bold text-base text-white leading-tight mb-2 group-hover:text-[#1db954] transition-colors">
                              {post.title}
                            </h3>
                            <p className="text-sm text-white/70 line-clamp-3 leading-relaxed">
                              {post.snippet || "Découvre les détails de cette actualité musicale en cliquant sur le lien ci-dessous..."}
                            </p>
                          </div>
                          
                          <div className="mt-2 pt-4 border-t border-white/10 flex justify-end">
                            <a 
                              href={post.link} 
                              target="_blank" 
                              rel="noopener noreferrer"
                              className="text-[#1db954] text-sm font-bold flex items-center gap-1.5 hover:scale-105 transition-transform"
                            >
                              Voir l'article complet <ExternalLink className="w-4 h-4" />
                            </a>
                          </div>
                        </div>
                      </motion.div>
                    ))}
                  </div>
                )}
              </section>
            </motion.div>
          ) : (

            <motion.div 
              key="album-view" 
              initial={{ opacity: 0, x: 50 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -50 }}
              className="px-4 sm:px-6 pt-6 max-w-5xl mx-auto"
            >
              <button onClick={() => {
                setSelectedAlbum(null);
                if (previewAudioRef.current) previewAudioRef.current.pause();
                setPreviewUrl(null);
                setTimeout(() => {
                  scrollRef.current?.scrollTo({ top: 0, behavior: "smooth" });
                }, 50);
              }} className="mb-6 text-[#1db954] font-bold flex items-center gap-2 hover:scale-105 transition-transform">
                <ArrowLeft className="w-4 h-4" /> Retour à l'accueil
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
                     <span className="font-bold text-white">{selectedAlbum.artist || "Artiste"}</span>
                     <span>•</span>
                     <span>{selectedAlbum.tracks?.length || 0} titres</span>
                  </div>
                </div>
              </div>

              <div className="mb-8 pl-4">
                 <button 
                   onClick={() => handlePlayFullAlbum(selectedAlbum.tracks)}
                   className="w-14 h-14 flex items-center justify-center rounded-full bg-[#1db954] text-black hover:scale-105 transition-transform shadow-xl text-2xl pl-1"
                 >
                   ▶
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
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}