// @ts-nocheck
"use client";

import React, { useEffect, useState, useRef } from "react";
import Image from "next/image"; 
import { Header } from "@/components/ui/Header";
import { usePlaylists } from "@/context/PlaylistContext";
import { useMusic } from "@/context/MusicContext";
import { useAuth } from "@/context/AuthContext";
import { supabase } from "@/lib/supabase";
import { motion, AnimatePresence, useAnimation } from "framer-motion";
import { 
  Calendar, Flame, Disc3, ListMusic, Play, PlayCircle, 
  PauseCircle, Plus, ArrowLeft, Clock, ExternalLink, Newspaper, Music, Radio, Mic2
} from "lucide-react"; 
import Link from "next/link";
import { AddToPlaylistModal } from "@/components/ui/AddToPlaylistModal";

// 🟢 Utilitaire pour calculer la date du dernier vendredi à minuit
const getMidnightLastFriday = () => {
  const d = new Date();
  const day = d.getDay();
  const diffToFriday = (day + 7 - 5) % 7;
  
  d.setDate(d.getDate() - diffToFriday);
  d.setHours(0, 0, 0, 0); 
  
  return d.getTime(); 
};

export default function HomePage() {
  const { user } = useAuth();
  const { playlists } = usePlaylists();
  const { playTrack, status, togglePlayPause, currentTrack } = useMusic();

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

  const scrollRef = useRef<HTMLDivElement>(null);
  const hasMiniPlayer = currentTrack !== null;

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
        if (data.news) {
          // 🟢 LA CORRECTION : On greffe un 'styleIndex' permanent à chaque article
          // pour que sa couleur voyage avec lui lors du swipe.
          const newsWithStyles = data.news.map((item, index) => ({
            ...item,
            styleIndex: index
          }));
          setNewsFeed(newsWithStyles);
        }
      } catch (error) {
        console.error("Erreur chargement du feed", error);
      } finally {
        setIsLoadingFeed(false);
      }
    };

    const loadReleases = async () => {
      try {
        const lastFriday = getMidnightLastFriday();
        const cachedReleases = localStorage.getItem("cachedReleases");
        const cachedDate = localStorage.getItem("cachedReleasesDate");

        if (cachedReleases && cachedDate && Number(cachedDate) >= lastFriday) {
          setReleases(JSON.parse(cachedReleases));
          setIsLoadingReleases(false);
          return;
        }

        const res = await fetch(`/api/releases`);
        const data = await res.json();
        
        if (data.albums) {
          setReleases(data.albums);
          localStorage.setItem("cachedReleases", JSON.stringify(data.albums));
          localStorage.setItem("cachedReleasesDate", Date.now().toString());
        }
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

  const getCleanSnippet = (post) => {
    let rawText = post.snippet || post.content || post.description || "";
    let cleanText = rawText.replace(/<[^>]*>?/gm, '').trim();
    if (!cleanText || cleanText === post.title.trim()) {
      return "Clique pour lire l'article complet et découvrir toutes les informations exclusives.";
    }
    return cleanText;
  };

  // 🟢 On utilise l'index permanent pour attribuer la couleur
  const getCardStyle = (index) => {
    const gradients = [
      "bg-gradient-to-br from-purple-900 via-[#121212] to-black",
      "bg-gradient-to-br from-emerald-900 via-[#121212] to-black",
      "bg-gradient-to-br from-blue-900 via-[#121212] to-black",
      "bg-gradient-to-br from-rose-900 via-[#121212] to-black",
      "bg-gradient-to-br from-amber-900 via-[#121212] to-black",
    ];
    return gradients[index % gradients.length];
  };

  // 🟢 On utilise l'index permanent pour attribuer l'icône
  const getWatermarkIcon = (index) => {
    const icons = [Newspaper, Music, Flame, Radio, Mic2];
    const IconComponent = icons[index % icons.length];
    return <IconComponent className="absolute -right-10 -bottom-10 w-64 h-64 text-white/[0.03] rotate-12 pointer-events-none" />;
  };

  const handleDragEnd = (event, info) => {
    if (info.offset.x > 80 || info.offset.x < -80) {
      setNewsFeed((prevFeed) => {
        const newFeed = [...prevFeed];
        const swipedCard = newFeed.shift(); 
        newFeed.push(swipedCard); 
        return newFeed;
      });
    }
  };

  return (
    <div className="fixed inset-0 w-full h-[100dvh] bg-[#121212] text-white overflow-hidden flex flex-col z-0">
      
      <audio ref={previewAudioRef} onEnded={() => setPreviewUrl(null)} preload="auto" />
      
      <AddToPlaylistModal 
        track={trackToAdd} 
        isOpen={!!trackToAdd} 
        onClose={() => setTrackToAdd(null)} 
      />

      {!selectedAlbum && <Header />}
        
      <AnimatePresence mode="wait">
        {!selectedAlbum ? (
          <motion.div 
            key="home" 
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, x: -50 }}
            ref={scrollRef}
            className="flex-1 w-full overflow-y-auto overflow-x-hidden custom-scrollbar px-4 sm:px-6 pt-[calc(env(safe-area-inset-top)+7rem)]"
            style={{ paddingBottom: hasMiniPlayer ? '160px' : '100px' }}
          >
            <div className="max-w-5xl mx-auto space-y-10">
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

              {/* 🟢 SECTION FIL D'ACTUALITÉ */}
              <section className="mb-8">
                <div className="flex items-center gap-2 mb-6 border-t border-white/10 pt-8">
                  <h2 className="text-2xl font-black">Fil d'actualité</h2>
                  <Flame className="w-6 h-6 text-orange-500" />
                </div>

                <p className="text-xs text-white/50 mb-4 text-center">Glisse pour passer à la suivante</p>

                {isLoadingFeed ? (
                  <div className="w-full h-[400px] bg-white/5 rounded-3xl animate-pulse border border-white/5 max-w-sm mx-auto"></div>
                ) : (
                  <div className="relative w-full max-w-sm mx-auto h-[420px] flex items-end justify-center perspective-[1000px]">
                    {newsFeed.map((post, i) => {
                      if (i > 3) return null;

                      const finalSnippet = getCleanSnippet(post);
                      const isFront = i === 0;
                      
                      // 🟢 On utilise l'ID de style permanent pour que la couleur reste attachée à la carte
                      const styleId = post.styleIndex !== undefined ? post.styleIndex : i;
                      const cardGradient = getCardStyle(styleId);

                      return (
                        <motion.div 
                          key={post.id}
                          initial={{ opacity: 0, scale: 0.8, y: 50 }}
                          animate={{ 
                            opacity: 1 - i * 0.2, 
                            scale: 1 - i * 0.05, 
                            y: -i * 25, 
                            zIndex: 10 - i 
                          }}
                          transition={{ type: "spring", stiffness: 300, damping: 20 }}
                          drag={isFront ? "x" : false}
                          dragConstraints={{ left: 0, right: 0 }}
                          onDragEnd={handleDragEnd}
                          className={`absolute w-full h-[380px] rounded-3xl overflow-hidden shadow-[0_10px_30px_rgba(0,0,0,0.8)] border border-white/10 ${cardGradient} ${isFront ? 'cursor-grab active:cursor-grabbing' : ''}`}
                        >
                          {/* 🟢 L'icône garde elle aussi son styleIndex permanent */}
                          {getWatermarkIcon(styleId)}

                          <div className="absolute inset-0 p-6 flex flex-col justify-between pointer-events-none">
                            
                            <div className="flex items-start justify-between gap-2">
                              <span className="bg-white/10 backdrop-blur-md text-white text-[10px] font-bold px-3 py-1.5 rounded-full uppercase tracking-wider border border-white/10">
                                {post.source}
                              </span>
                              <span className="text-[10px] font-bold text-white/50">
                                {timeAgo(post.date)}
                              </span>
                            </div>
                            
                            <div>
                              <h3 className="font-black text-2xl text-white leading-tight mb-4 drop-shadow-md">
                                {post.title}
                              </h3>
                              
                              <p className="text-sm text-white/70 line-clamp-4 leading-relaxed font-medium">
                                {finalSnippet}
                              </p>
                            </div>

                            {isFront && (
                              <button 
                                onPointerDown={(e) => e.stopPropagation()} 
                                onClick={() => window.open(post.link, "_blank", "noopener,noreferrer")}
                                className="pointer-events-auto bg-white hover:bg-gray-200 text-black text-sm font-black py-3.5 rounded-xl flex items-center justify-center gap-2 transition-colors w-full mt-4 shadow-lg"
                              >
                                Lire l'article <ExternalLink className="w-4 h-4" />
                              </button>
                            )}
                          </div>
                        </motion.div>
                      );
                    })}
                  </div>
                )}
              </section>
            </div>
          </motion.div>
        ) : (
          <motion.div 
            key="album-view" 
            initial={{ opacity: 0, x: 50 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -50 }}
            className="absolute inset-0 w-full h-[100dvh] bg-[#121212] z-40 flex flex-col overflow-hidden"
          >
            <div className="shrink-0 px-4 pt-[calc(env(safe-area-inset-top)+1rem)] pb-4 bg-[#121212] z-50 touch-none border-b border-white/5">
              <div className="max-w-5xl mx-auto flex flex-col w-full">
                <button 
                  onClick={() => {
                    setSelectedAlbum(null);
                    if (previewAudioRef.current) previewAudioRef.current.pause();
                    setPreviewUrl(null);
                    setTimeout(() => {
                      window.scrollTo({ top: 0, behavior: "smooth" });
                    }, 50);
                  }} 
                  className="w-10 h-10 mb-4 flex items-center justify-center bg-white/10 hover:bg-white/20 rounded-full transition-colors pointer-events-auto shrink-0"
                >
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
                      <span className="font-bold text-white truncate">{selectedAlbum.artist || "Artiste"}</span>
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

            <div 
              ref={scrollRef}
              className="flex-1 w-full overflow-y-auto overflow-x-hidden overscroll-contain touch-pan-y pointer-events-auto custom-scrollbar px-4"
              style={{ paddingBottom: hasMiniPlayer ? '160px' : '100px' }}
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