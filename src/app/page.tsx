// @ts-nocheck
"use client";

import React, { useState, useRef, useEffect } from "react";
import Image from "next/image"; 
import { Header } from "@/components/ui/Header";
import { usePlaylists } from "@/context/PlaylistContext";
import { PlaylistWizard } from "@/components/playlists/PlaylistWizard";
import { useMusic } from "@/context/MusicContext";
import { useAuth } from "@/context/AuthContext";
import { supabase } from "@/lib/supabase";
import { motion, AnimatePresence, Reorder, useDragControls } from "framer-motion";
import { 
  ListMusic, Plus, Play, Users, UserPlus, X, Trash2, GripVertical, 
  Download, ArrowLeft, Wand2, Search, Edit2, PlayCircle, PauseCircle, 
  CheckCircle2, AlertCircle, Clock, Flame, Mic2, Crown, Car, Coffee, Dumbbell, Radio, Star, Loader2, Pin
} from "lucide-react"; 
import type { Track } from "@/types";
import { AddToPlaylistModal } from "@/components/ui/AddToPlaylistModal";
import { cn } from "@/lib/utils";

const VIBES = [
  { id: "phonk", label: "Phonk", icon: Flame, query: "phonk drift" },
  { id: "rapfr", label: "Rap FR", icon: Mic2, query: "rap francais" },
  { id: "rapus", label: "Rap US", icon: Crown, query: "hip hop rap us" },
  { id: "voiture", label: "Voiture", icon: Car, query: "car music night drive" },
  { id: "chill", label: "Chill", icon: Coffee, query: "chill lofi" },
  { id: "muscu", label: "Muscu", icon: Dumbbell, query: "workout gym hard" },
  { id: "house", label: "House", icon: Radio, query: "house club" },
  { id: "pop", label: "Pop", icon: Star, query: "pop hits" },
];

function DraggableTrackItem({ track, handleRemoveTrack }: { track: any, handleRemoveTrack: any }) {
  const dragControls = useDragControls();

  return (
    <Reorder.Item 
      value={track} 
      dragListener={false}
      dragControls={dragControls}
      className="relative overflow-hidden rounded-xl bg-red-500 shadow-md touch-pan-y"
    >
      <div className="absolute right-0 top-0 bottom-0 w-24 flex flex-col items-center justify-center text-white font-bold text-xs gap-1">
        <Trash2 className="w-5 h-5" /> Supprimer
      </div>
      
      <motion.div 
        drag="x" 
        dragConstraints={{ left: -80, right: 0 }} 
        dragElastic={0.1}
        onDragEnd={(e, info) => {
          if (info.offset.x < -60) handleRemoveTrack(track?.id);
        }}
        className="relative flex items-center gap-4 p-3 bg-[#1c1c1e] z-10 border border-white/5"
      >
        <div 
          onPointerDown={(e) => dragControls.start(e)}
          style={{ touchAction: "none" }}
          className="w-6 text-white/30 flex justify-center hover:text-white transition-colors cursor-grab active:cursor-grabbing"
        >
          <GripVertical className="w-5 h-5" />
        </div>
        
        <Image 
          src={track?.image || "https://api.dicebear.com/7.x/shapes/svg?seed=music"} 
          alt="" 
          width={40} 
          height={40} 
          className="rounded shadow-md object-cover shrink-0 pointer-events-none" 
        />
        <div className="flex-1 overflow-hidden pointer-events-none">
          <div className="text-sm font-bold truncate text-white">{track?.title}</div>
          <div className="text-xs text-white/50">{track?.artist}</div>
        </div>
      </motion.div>
    </Reorder.Item>
  );
}

export default function PlaylistsPage() {
  const { playlists, createPlaylist, deletePlaylist, updatePlaylist, shareWithFriend } = usePlaylists();
  const { playTrack, currentTrack, status, togglePlayPause } = useMusic();
  const { user } = useAuth();
  
  const hasMiniPlayer = currentTrack !== null;
  const scrollRef = useRef<HTMLDivElement>(null);

  const previewAudioRef = useRef(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  
  const [dynamicPreviews, setDynamicPreviews] = useState({});
  const [isLoadingPreview, setIsLoadingPreview] = useState(null);

  const [isWizardOpen, setIsWizardOpen] = useState(false);
  const [activePlaylist, setActivePlaylist] = useState<any>(null);
  
  const [viewMode, setViewMode] = useState("view"); 
  const [editName, setEditName] = useState("");
  const [editSearch, setEditSearch] = useState("");
  const [editResults, setEditResults] = useState([]);
  const searchTimeout = useRef(null);

  const [pinnedTracks, setPinnedTracks] = useState<string[]>([]);
  const [refreshVibe, setRefreshVibe] = useState(null);
  const [refreshDuration, setRefreshDuration] = useState(30);

  const [showShareModal, setShowShareModal] = useState(false);
  const [myFriends, setMyFriends] = useState([]);

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newPlaylistName, setNewPlaylistName] = useState("");

  const [trackToAdd, setTrackToAdd] = useState(null);

  const [importState, setImportState] = useState({ active: false, progress: 0, text: "", status: "loading", message: "" });
  
  const [showSpotifyImportModal, setShowSpotifyImportModal] = useState(false);
  const [spotifyUrlInput, setSpotifyUrlInput] = useState("");

  const toggleNav = (show: boolean) => {
    if (show) {
      window.dispatchEvent(new Event("showNav"));
      window.dispatchEvent(new Event("showMiniPlayer"));
    } else {
      window.dispatchEvent(new Event("hideNav"));
      window.dispatchEvent(new Event("hideMiniPlayer"));
    }
  };

  // Restauration de la barre dès le montage du composant ou quand aucune modale n'est active
  useEffect(() => {
    if (!activePlaylist && !isWizardOpen && !showShareModal && !showCreateModal && !showSpotifyImportModal && !trackToAdd && !importState.active) {
      toggleNav(true);
    }
  }, [activePlaylist, isWizardOpen, showShareModal, showCreateModal, showSpotifyImportModal, trackToAdd, importState.active]);

  useEffect(() => {
    toggleNav(true);
    return () => {
      toggleNav(true);
    };
  }, []);

  const isAnyModalOpen = isWizardOpen || showShareModal || showCreateModal || showSpotifyImportModal || !!trackToAdd || importState.active;
  
  useEffect(() => {
    if (typeof document !== 'undefined' && document.body) {
      document.body.style.overflow = isAnyModalOpen ? 'hidden' : '';
    }
    return () => { 
      if (typeof document !== 'undefined' && document.body) {
        document.body.style.overflow = ''; 
      }
    };
  }, [isAnyModalOpen]);

  const loadFriends = async () => {
    if (!user) return;
    const { data } = await supabase
      .from('friends')
      .select('id, sender:user_id_1(id, username, avatar_url), receiver:user_id_2(id, username, avatar_url)')
      .eq('status', 'accepted')
      .or(`user_id_1.eq.${user.id},user_id_2.eq.${user.id}`);

    const friendsList = [];
    data?.forEach(rel => {
      if (!rel.sender || !rel.receiver) return;
      const isSender = rel.sender.id === user.id;
      friendsList.push(isSender ? rel.receiver : rel.sender);
    });
    setMyFriends(friendsList.filter(Boolean));
  };

  const openShareModal = () => {
    loadFriends();
    setShowShareModal(true);
    toggleNav(false); 
  };

  const handleShare = async (friendId) => {
    if (!activePlaylist?.id || !friendId) return;
    await shareWithFriend(activePlaylist.id, friendId);
    alert("Playlist partagée avec succès !");
    setShowShareModal(false);
    toggleNav(true); 
  };

  const handleCreate = async () => {
    if (newPlaylistName.trim().length > 0) {
      await createPlaylist(newPlaylistName.trim());
      setShowCreateModal(false);
      setNewPlaylistName("");
      toggleNav(true); 
    }
  };

  const handleSaveWizard = async (name: string, tracks: Track[]) => {
    await createPlaylist(name, tracks);
    setIsWizardOpen(false);
    toggleNav(true); 
  };

  const executeSpotifyImport = async () => {
    if (!spotifyUrlInput.includes("spotify")) {
      alert("Ce lien ne semble pas être un lien Spotify valide.");
      return;
    }

    setShowSpotifyImportModal(false); 
    setImportState({ active: true, progress: 0, text: "Analyse du lien...", status: "loading", message: "" }); 

    try {
      const scrapeRes = await fetch(`/api/import-spotify?url=${encodeURIComponent(spotifyUrlInput)}`);
      const scrapeData = await scrapeRes.json();

      if (!scrapeRes.ok) throw new Error(scrapeData.error || "Erreur d'analyse du lien.");

      const tracksToSearch = scrapeData.tracks || [];
      const playlistName = scrapeData.name || "Import Spotify";

      if (tracksToSearch.length === 0) throw new Error("La playlist est vide ou introuvable.");

      const matchedTracks = [];
      
      for (let i = 0; i < tracksToSearch.length; i++) {
        const track = tracksToSearch[i];
        setImportState({ 
          active: true, 
          progress: Math.round((i / tracksToSearch.length) * 100), 
          text: `Recherche : ${track.title}`,
          status: "loading"
        });
        
        const cleanTitle = track.title.replace(/\([^)]*\)/g, '').replace(/\[[^\]]*\]/g, '').trim();
        const searchQuery = `${cleanTitle} ${track.artist || ""}`.trim();

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
            }
          }
        } catch (err) {}
      }

      if (matchedTracks.length > 0) {
        const cleanTracksToSave = matchedTracks.map((t: any) => ({
          id: t.id ? t.id.toString() : (Date.now() + Math.random()).toString(),
          title: t.title || "Inconnu",
          artist: t.artist || "Inconnu",
          image: t.image || "",
          duration: t.duration || "0:00",
          preview: t.preview || ""
        }));

        const saved = await createPlaylist(playlistName, cleanTracksToSave);

        if (saved) {
          setImportState({ 
            active: true, 
            progress: 100, 
            text: "Terminé !", 
            status: "success", 
            message: `${matchedTracks.length} titres ont été importés avec succès dans ta nouvelle playlist "${playlistName}".` 
          });
        } else {
          setImportState({ 
            active: true, 
            progress: 100, 
            text: "Erreur", 
            status: "error", 
            message: "Impossible d'enregistrer la playlist sur le serveur." 
          });
        }
      } else {
        setImportState({ 
          active: true, 
          progress: 100, 
          text: "Échec", 
          status: "error", 
          message: "Aucun titre n'a pu être converti depuis ce lien." 
        });
      }
    } catch (error) {
      setImportState({ 
        active: true, 
        progress: 0, 
        text: "Erreur", 
        status: "error", 
        message: error.message 
      });
    }
  };

  const closeImportProgress = () => {
    setImportState({ active: false, progress: 0, text: "", status: "loading", message: "" });
    setSpotifyUrlInput("");
    toggleNav(true);
  };

  useEffect(() => {
    if (activePlaylist && playlists && playlists.length > 0) {
      const updatedMatch = playlists.filter(Boolean).find(p => p?.id === activePlaylist?.id);
      if (updatedMatch) setActivePlaylist(updatedMatch);
    }
  }, [playlists]);

  useEffect(() => {
    const handleReset = () => {
      setActivePlaylist(null);
      setViewMode("view");
      toggleNav(true);
      if (previewAudioRef.current) previewAudioRef.current.pause();
      setPreviewUrl(null);
      setTimeout(() => {
        scrollRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
      }, 50);
    };
    window.addEventListener("resetPlaylistsView", handleReset);
    return () => window.removeEventListener("resetPlaylistsView", handleReset);
  }, []);

  const openPlaylist = (p: any) => {
    if (!p) return;
    setActivePlaylist(p);
    setEditName(p.name || "");
    setViewMode("view");
    setTimeout(() => {
      scrollRef.current?.scrollTo({ top: 0, behavior: "smooth" });
    }, 50);
  };

  const handleRemoveTrack = async (trackId: string) => {
    if (!activePlaylist?.tracks || !activePlaylist?.id) return;
    const newTracks = activePlaylist.tracks.filter((t: any) => t?.id !== trackId);
    await updatePlaylist(activePlaylist.id, { tracks: newTracks });
  };

  const handleSearchAdd = (e: any) => {
    const val = e.target.value;
    setEditSearch(val);
    if (searchTimeout.current) clearTimeout(searchTimeout.current);
    
    if (val.length > 2) {
      searchTimeout.current = setTimeout(async () => {
        try {
          const res = await fetch(`/api/search?q=${encodeURIComponent(val)}`);
          if (!res.ok) throw new Error("Route non trouvée ou erreur API");
          const data = await res.json();
          setEditResults(data.tracks || []);
        } catch (error) {
          console.error("Erreur de recherche :", error);
          setEditResults([]);
        }
      }, 400);
    } else {
      setEditResults([]);
    }
  };

  const handleAddTrack = async (track: Track) => {
    if (!track || !activePlaylist?.id) return;
    const currentTracks = activePlaylist.tracks || [];
    if (currentTracks.find((t: any) => t?.id === track.id)) return;
    const newTracks = [...currentTracks, track];
    await updatePlaylist(activePlaylist.id, { tracks: newTracks });
  };

  const handleRename = async () => {
    if (activePlaylist && user && activePlaylist.owner_id === user.id) {
      await updatePlaylist(activePlaylist.id, { name: editName });
    }
  };

  const togglePin = (trackId: string) => {
    if (pinnedTracks.includes(trackId)) {
      setPinnedTracks(pinnedTracks.filter(id => id !== trackId));
    } else {
      setPinnedTracks([...pinnedTracks, trackId]);
    }
  };

  const executeRefresh = async () => {
    setViewMode("refresh_loading");
    const currentTracks = activePlaylist?.tracks || [];
    const keptTracks = currentTracks.filter((t: any) => t && t.id && pinnedTracks.includes(t.id));
    const keptSeconds = keptTracks.reduce((acc: number, t: any) => acc + (t.seconds || 180), 0);
    const targetSeconds = refreshDuration * 60;
    const neededSeconds = targetSeconds - keptSeconds;

    let finalTracks = [...keptTracks];

    if (neededSeconds > 60 && refreshVibe) {
      try {
        const res = await fetch(`/api/smart-playlist?vibe=${encodeURIComponent(refreshVibe.query)}&duration=${neededSeconds}&discovery=true`);
        const data = await res.json();
        if (data.tracks) finalTracks = [...keptTracks, ...data.tracks];
      } catch (e) {
        console.error("Erreur smart-playlist :", e);
      }
    }

    if (activePlaylist?.id) {
      await updatePlaylist(activePlaylist.id, { tracks: finalTracks });
    }
    
    setPinnedTracks([]);
    setRefreshVibe(null);
    setViewMode("view");
  };

  const handleReorder = async (newOrder: Track[]) => {
    if (!activePlaylist?.id) return;
    const updated = { ...activePlaylist, tracks: newOrder };
    setActivePlaylist(updated);
    await updatePlaylist(activePlaylist.id, { tracks: newOrder });
  };

  const togglePreview = async (e, track) => {
    e.stopPropagation(); 
    
    let url = track.preview || dynamicPreviews[track.id];

    if (!url && track.id) {
      setIsLoadingPreview(track.id); 
      try {
        const res = await fetch(`/api/track?id=${track.id}`);
        const data = await res.json();
        
        if (data.preview) {
          url = data.preview;
          setDynamicPreviews(prev => ({ ...prev, [track.id]: data.preview }));
        }
      } catch (err) {
        console.error("Erreur récupération extrait :", err);
      }
      setIsLoadingPreview(null); 
    }

    if (!url) {
      alert("Aucun extrait disponible pour ce titre.");
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

  const handlePlayFullPlaylist = (tracks) => {
    if (!tracks || tracks.length === 0) return;
    if (previewAudioRef.current) previewAudioRef.current.pause();
    setPreviewUrl(null);
    playTrack(tracks[0], tracks);
  };

  const isOwner = activePlaylist?.owner_id === user?.id;

  return (
    <div className="fixed inset-0 w-full h-[100dvh] bg-[#121212] text-white overflow-hidden flex flex-col z-0">
      
      <audio ref={previewAudioRef} onEnded={() => setPreviewUrl(null)} preload="auto" />

      <AddToPlaylistModal 
        track={trackToAdd} 
        isOpen={!!trackToAdd} 
        onClose={() => { setTrackToAdd(null); toggleNav(true); }} 
      />

      {!activePlaylist && <Header />}

      <AnimatePresence mode="wait">
        {!activePlaylist ? (
          <motion.div 
            key="grid" 
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} 
            ref={scrollRef}
            className="flex-1 w-full overflow-y-auto overflow-x-hidden custom-scrollbar pt-[calc(env(safe-area-inset-top)+7rem)] px-6"
            style={{ paddingBottom: hasMiniPlayer ? '160px' : '100px' }}
          >
            <div className="max-w-5xl mx-auto">
              <div className="mb-8 flex flex-col sm:flex-row sm:items-end justify-between gap-4 w-full">
                <div className="flex-1 min-w-0 pr-4">
                  <h1 className="text-4xl font-black tracking-tight leading-tight break-words">Ma Bibliothèque</h1>
                  <p className="text-white/50 text-sm mt-2">Gère tes sons et tes mix.</p>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <button 
                    onClick={() => { setShowSpotifyImportModal(true); toggleNav(false); }} 
                    disabled={importState.active}
                    className="bg-[#1db954]/20 hover:bg-[#1db954]/30 p-3 rounded-full transition-colors text-[#1db954] shadow-[0_0_15px_rgba(29,185,84,0.2)] disabled:opacity-50"
                    title="Importer une playlist Spotify"
                  >
                    <Download className="w-6 h-6" />
                  </button>
                  <button 
                    onClick={() => { setShowCreateModal(true); toggleNav(false); }}
                    className="bg-white/10 hover:bg-white/20 p-3 rounded-full transition-colors text-white"
                    title="Créer une nouvelle playlist"
                  >
                    <Plus className="w-6 h-6" />
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <button 
                  onClick={() => { setIsWizardOpen(true); toggleNav(false); }} 
                  className="h-32 rounded-2xl border border-[#1db954]/30 bg-gradient-to-br from-[#1db954]/10 to-[#121212] hover:border-[#1db954]/60 hover:from-[#1db954]/20 transition-all p-5 flex items-center justify-between gap-4 group relative overflow-hidden shadow-lg w-full text-left"
                >
                  <div className="absolute -right-4 -bottom-4 opacity-10 group-hover:opacity-20 group-hover:scale-110 transition-all duration-500 pointer-events-none">
                    <Wand2 className="w-32 h-32 text-[#1db954]" />
                  </div>
                  <div className="flex flex-col z-10 flex-1 min-w-0">
                    <span className="font-black text-white text-xl leading-tight mb-1 truncate w-full">Mix Magique</span>
                    <span className="text-xs font-medium text-[#1db954]">Généré par IA</span>
                  </div>
                  <div className="w-12 h-12 rounded-full bg-[#1db954] flex items-center justify-center text-black group-hover:scale-110 transition-transform shadow-md z-10 shrink-0">
                    <Wand2 className="w-6 h-6" />
                  </div>
                </button>

                {playlists?.filter(Boolean).map((playlist) => (
                  <div key={`pl-${playlist?.id}`} onClick={() => openPlaylist(playlist)} className="h-32 rounded-2xl bg-white/5 hover:bg-white/10 border border-white/5 p-4 flex items-center justify-between group transition-all cursor-pointer relative overflow-hidden w-full">
                    <div className="flex items-center gap-4 flex-1 overflow-hidden">
                      <div className="w-20 h-20 rounded-xl bg-gradient-to-br from-[#1db954] to-[#121212] flex items-center justify-center flex-shrink-0 shadow-lg relative overflow-hidden">
                        {playlist?.tracks?.[0]?.image ? (
                          <Image 
                            src={playlist.tracks[0].image} 
                            alt="" 
                            fill
                            sizes="80px"
                            className="object-cover" 
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center bg-black/20">
                            <ListMusic className="w-8 h-8 text-white/50" />
                          </div>
                        )}
                        {playlist?.is_shared && (
                          <div className="absolute top-1 right-1 bg-[#1db954] text-black p-1 rounded-full shadow-lg">
                            <Users className="w-3 h-3" />
                          </div>
                        )}
                      </div>
                      <div className="flex flex-col flex-1 min-w-0">
                        <h3 className="text-lg font-bold text-white truncate w-full">{playlist?.name}</h3>
                        <p className="text-xs text-white/50">{playlist?.tracks?.length || 0} titres</p>
                        {playlist?.is_shared && <p className="text-[10px] text-[#1db954] font-bold mt-1 uppercase">Partagée</p>}
                      </div>
                    </div>
                    
                    <button 
                      onClick={(e) => { e.stopPropagation(); if (playlist?.tracks?.[0]) handlePlayFullPlaylist(playlist.tracks); }}
                      className="w-12 h-12 flex items-center justify-center rounded-full bg-[#1db954] text-black hover:scale-105 transition-transform shadow-xl opacity-0 group-hover:opacity-100 shrink-0"
                    >
                      <Play className="w-5 h-5 ml-1" fill="currentColor" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </motion.div>

        ) : (

          <motion.div 
            key="detail" 
            initial={{ opacity: 0, x: 50 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -50 }} 
            className="absolute inset-0 w-full h-[100dvh] bg-[#121212] z-40 flex flex-col overflow-hidden"
          >
            <div className="shrink-0 pt-[calc(env(safe-area-inset-top)+1rem)] px-4 pb-2 z-50 bg-[#121212] touch-none">
              <button 
                onClick={() => {
                  setActivePlaylist(null); 
                  setViewMode("view");
                  toggleNav(true);
                  if (previewAudioRef.current) previewAudioRef.current.pause();
                  setPreviewUrl(null);
                }} 
                className="w-10 h-10 flex items-center justify-center bg-white/10 hover:bg-white/20 rounded-full transition-colors pointer-events-auto"
              >
                <ArrowLeft className="w-5 h-5 text-white" />
              </button>
            </div>

            {viewMode !== "refresh_vibe" && viewMode !== "refresh_loading" && (
              <div className="shrink-0 px-4 pb-4 bg-[#121212] z-30 border-b border-white/5 shadow-sm touch-none">
                <div className="max-w-5xl mx-auto flex flex-col gap-4">
                  <div className="flex items-center gap-4 bg-gradient-to-r from-white/5 to-transparent p-3 rounded-2xl border border-white/5 relative overflow-hidden">
                    <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-lg shadow-lg overflow-hidden bg-white/10 flex-shrink-0 z-10 relative flex items-center justify-center">
                      {activePlaylist?.tracks?.[0]?.image ? (
                        <Image src={activePlaylist.tracks[0].image} alt="" fill sizes="(max-width: 640px) 80px, 96px" className="object-cover pointer-events-none" />
                      ) : (
                        <ListMusic className="w-8 h-8 text-white/20" />
                      )}
                    </div>
                    <div className="z-10 flex-1 min-w-0">
                      {viewMode === "edit" && isOwner ? (
                        <input value={editName} onChange={(e) => setEditName(e.target.value)} onBlur={handleRename} 
                          className="text-xl sm:text-2xl font-black mb-1 bg-transparent border-b border-[#1db954] outline-none w-full text-white pointer-events-auto" />
                      ) : (
                        <h1 className="text-xl sm:text-2xl font-black mb-1 truncate w-full text-white" title={activePlaylist?.name}>{activePlaylist?.name}</h1>
                      )}
                      <div className="text-xs text-white/50 flex items-center gap-2">
                        {activePlaylist?.is_shared && <Users className="w-3 h-3 text-[#1db954]" />}
                        <span className="truncate">{isOwner ? "Par toi" : "Partagée"} • {activePlaylist?.tracks?.length || 0} titres</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 w-full pointer-events-auto">
                    {viewMode === "view" && (
                      <>
                        <button onClick={() => activePlaylist?.tracks?.[0] && handlePlayFullPlaylist(activePlaylist.tracks)} 
                          className="w-10 h-10 shrink-0 flex items-center justify-center rounded-full bg-[#1db954] text-black hover:scale-105 transition-transform shadow-md">
                          <Play className="w-4 h-4 ml-1" fill="currentColor" />
                        </button>
                        <button onClick={() => setViewMode("edit")} 
                          className="h-10 flex-1 rounded-full border border-white/20 hover:bg-white/5 font-bold text-xs transition-all flex items-center justify-center gap-1.5 whitespace-nowrap text-white">
                          <Edit2 className="w-3.5 h-3.5" /> Modifier
                        </button>
                        {isOwner && (
                          <>
                            <button onClick={openShareModal} 
                              className="h-10 flex-1 rounded-full border border-white/20 hover:border-[#1db954] hover:text-[#1db954] font-bold text-xs transition-all flex items-center justify-center gap-1.5 whitespace-nowrap text-white">
                              <UserPlus className="w-3.5 h-3.5" /> Partager
                            </button>
                            <button onClick={async () => { if(confirm("Supprimer la playlist ?")) { await deletePlaylist(activePlaylist?.id); setActivePlaylist(null); toggleNav(true); } }} 
                              className="w-10 h-10 shrink-0 flex items-center justify-center rounded-full bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-all">
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </>
                        )}
                      </>
                    )}
                    {viewMode === "edit" && (
                      <>
                        <button onClick={() => setViewMode("view")} 
                          className="h-10 flex-1 rounded-full bg-white text-black font-bold text-xs hover:scale-105 transition-transform whitespace-nowrap flex items-center justify-center gap-1.5">
                          <CheckCircle2 className="w-4 h-4" /> Terminer
                        </button>
                        <button onClick={() => setViewMode("refresh_pin")} 
                          className="h-10 flex-1 rounded-full bg-gradient-to-r from-purple-500 to-blue-500 text-white font-bold text-xs hover:scale-105 transition-transform shadow-md flex items-center justify-center gap-1.5 whitespace-nowrap">
                          <Wand2 className="w-4 h-4" /> Renouveau IA
                        </button>
                      </>
                    )}
                  </div>
                </div>
              </div>
            )}

            <div 
              ref={scrollRef}
              className="flex-1 w-full overflow-y-auto overflow-x-hidden overscroll-contain touch-pan-y pointer-events-auto custom-scrollbar px-4"
              style={{ paddingBottom: hasMiniPlayer ? '160px' : '100px' }}
            >
              <div className="max-w-5xl mx-auto pt-2">
                {viewMode === "refresh_pin" && (
                  <div className="bg-purple-500/20 border border-purple-500/50 p-4 rounded-xl w-full flex justify-between items-center mt-4 mb-6">
                    <div>
                      <h3 className="font-bold text-purple-300 text-sm">Étape 1 : Tes favoris</h3>
                      <p className="text-[10px] text-white/60">Épingle les sons à conserver.</p>
                    </div>
                    <button onClick={() => setViewMode("refresh_vibe")} className="px-4 py-2 rounded-full bg-purple-500 text-white font-bold text-xs hover:scale-105 transition-transform">Suivant →</button>
                  </div>
                )}

                {(viewMode === "view" || viewMode === "refresh_pin") && (
                  <div className="space-y-1 mb-10">
                    <div className="flex items-center gap-4 p-2 mb-2 border-b border-white/10 text-xs font-bold uppercase tracking-widest text-white/50">
                        <span className="w-6 text-right">#</span>
                        <span className="flex-1">Titre</span>
                        <span className="mr-4">Actions</span>
                    </div>
                    {activePlaylist?.tracks?.filter(Boolean).map((track: any, i: number) => {
                      const isPlayingThis = currentTrack?.id === track?.id && status === "playing";
                      const currentPreviewUrl = track.preview || dynamicPreviews[track.id];

                      return (
                        <div key={`tr-${track?.id}-${i}`} onClick={() => viewMode === "view" && handlePlayFullTrack(track, activePlaylist.tracks)} className={`flex items-center gap-3 p-2 rounded-xl transition-all group ${viewMode === "view" ? "hover:bg-white/10 cursor-pointer" : "bg-white/5"}`}>
                          {isPlayingThis ? (
                            <div className="w-5 flex items-end justify-center gap-[2px] h-3 shrink-0">
                              <motion.div animate={{ height: ["40%", "100%", "40%"] }} transition={{ repeat: Infinity, duration: 0.8, ease: "easeInOut" }} className="w-[3px] bg-[#1db954] rounded-t-sm" />
                              <motion.div animate={{ height: ["60%", "80%", "60%"] }} transition={{ repeat: Infinity, duration: 0.8, delay: 0.2, ease: "easeInOut" }} className="w-[3px] bg-[#1db954] rounded-t-sm" />
                              <motion.div animate={{ height: ["30%", "90%", "30%"] }} transition={{ repeat: Infinity, duration: 0.8, delay: 0.4, ease: "easeInOut" }} className="w-[3px] bg-[#1db954] rounded-t-sm" />
                            </div>
                          ) : (
                            <span className="w-5 text-white/30 text-xs text-center shrink-0">{i + 1}</span>
                          )}

                          <Image src={track?.image || "https://api.dicebear.com/7.x/shapes/svg?seed=music"} alt="" width={36} height={36} className="rounded shadow-sm object-cover shrink-0 pointer-events-none" />
                          <div className="flex-1 overflow-hidden">
                            <div className={`text-sm font-bold truncate transition-colors ${isPlayingThis || previewUrl === currentPreviewUrl ? "text-[#1db954]" : "text-white group-hover:text-[#1db954]"}`}>{track?.title}</div>
                            <div className="text-[10px] text-white/50 truncate">{track?.artist}</div>
                          </div>
                          
                          {viewMode === "view" && (
                            <div className="flex items-center gap-2 shrink-0">
                              <div className="text-[10px] text-white/40 hidden sm:block flex items-center gap-1"><Clock className="w-3 h-3" /> {track?.duration}</div>
                              <button disabled={isLoadingPreview === track.id} onClick={(e) => togglePreview(e, track)}
                                className={`w-7 h-7 flex items-center justify-center rounded-full border ${previewUrl && previewUrl === currentPreviewUrl ? 'border-[#1db954] text-[#1db954]' : 'border-white/20 text-white/70 hover:bg-white/10'} transition-all`}>
                                {isLoadingPreview === track.id ? <div className="w-3 h-3 border-2 border-white/50 border-t-[#1db954] rounded-full animate-spin" /> : previewUrl && previewUrl === currentPreviewUrl ? <PauseCircle className="w-3.5 h-3.5" /> : <PlayCircle className="w-3.5 h-3.5" />}
                              </button>
                              <button onClick={(e) => { e.stopPropagation(); setTrackToAdd(track); toggleNav(false); }}
                                className="w-7 h-7 flex items-center justify-center rounded-full text-white/50 hover:bg-white/10 hover:text-white transition-all">
                                <Plus className="w-4 h-4" />
                              </button>
                            </div>
                          )}
                          {viewMode === "refresh_pin" && (
                            <button onClick={() => togglePin(track?.id)} className={`w-8 h-8 flex items-center justify-center rounded-full transition-all mr-1 shrink-0 ${pinnedTracks.includes(track?.id) ? 'bg-purple-500 text-white shadow-[0_0_10px_rgba(168,85,247,0.5)]' : 'bg-white/10 text-white/30 hover:bg-white/20'}`}>
                              <Pin className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      );
                    })}
                    {(!activePlaylist?.tracks || activePlaylist.tracks.length === 0) && (
                      <div className="text-center text-white/40 py-10 flex flex-col items-center gap-3">
                        <ListMusic className="w-8 h-8 opacity-50" />
                        <p className="text-xs">Cette playlist est vide. Cherche un son en mode "Modifier" ou importe un lien !</p>
                      </div>
                    )}
                  </div>
                )}

                {viewMode === "edit" && (
                  <Reorder.Group axis="y" values={activePlaylist?.tracks?.filter(Boolean) || []} onReorder={handleReorder} className="space-y-2 mb-10 pt-2">
                    {activePlaylist?.tracks?.filter(Boolean).map((track: any) => (
                      <DraggableTrackItem key={`reorder-${track?.id}`} track={track} handleRemoveTrack={handleRemoveTrack} />
                    ))}
                  </Reorder.Group>
                )}

                {viewMode === "edit" && (
                  <div className="mt-8 pt-6 border-t border-white/10">
                    <h3 className="text-lg font-bold mb-3 flex items-center gap-2"><Search className="w-4 h-4" /> Ajouter des titres</h3>
                    <div className="relative mb-3">
                      <Search className="w-4 h-4 absolute left-4 top-1/2 -translate-y-1/2 text-white/40" />
                      <input placeholder="Chercher un titre ou un artiste..." value={editSearch} onChange={handleSearchAdd} className="w-full bg-white/5 border border-white/10 rounded-xl pl-11 pr-4 py-2.5 text-sm text-white outline-none focus:border-[#1db954]" />
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                      {editResults?.filter(Boolean).map((track: any, i: number) => (
                        <div key={`res-${track?.id}-${i}`} className="flex items-center justify-between p-2 bg-white/5 rounded-xl border border-white/5 hover:bg-white/10 transition-colors">
                          <div className="flex items-center gap-2 overflow-hidden flex-1">
                            <Image src={track?.image || "https://api.dicebear.com/7.x/shapes/svg?seed=music"} alt="" width={32} height={32} className="rounded object-cover flex-shrink-0" />
                            <div className="overflow-hidden">
                              <div className="text-xs font-bold text-white truncate">{track?.title}</div>
                              <div className="text-[10px] text-white/50 truncate">{track?.artist}</div>
                            </div>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <button disabled={isLoadingPreview === track.id} onClick={(e) => togglePreview(e, track)}
                              className={`w-7 h-7 flex items-center justify-center rounded-full border ${previewUrl === track.preview ? 'border-[#1db954] text-[#1db954] bg-[#1db954]/10' : 'border-white/20 text-white/70 hover:bg-white/10'} transition-all`}>
                              {isLoadingPreview === track.id ? <div className="w-3 h-3 border-2 border-white/50 border-t-[#1db954] rounded-full animate-spin" /> : previewUrl === track.preview ? <PauseCircle className="w-3.5 h-3.5" /> : <PlayCircle className="w-3.5 h-3.5" />}
                            </button>
                            <button onClick={() => handleAddTrack(track)} className="bg-white text-black px-3 py-1.5 rounded-full font-bold hover:scale-105 transition-transform flex-shrink-0 flex items-center gap-1 text-[10px]">
                              <Plus className="w-3 h-3" /> Ajouter
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {viewMode === "refresh_vibe" && (
                  <div className="animate-in fade-in slide-in-from-right-8 duration-500 space-y-6 max-w-xl mx-auto py-6">
                    <button onClick={() => setViewMode("refresh_pin")} className="text-purple-400 text-xs font-bold hover:underline flex items-center gap-1">
                      <ArrowLeft className="w-3 h-3" /> Revoir les épingles
                    </button>
                    <div><h3 className="text-2xl font-black mb-1 flex items-center gap-2"><Wand2 className="w-6 h-6 text-purple-400" /> L'Inspiration</h3><p className="text-[#b3b3b3] text-xs">L'IA va garder tes {pinnedTracks.length} sons épinglés, et générer le reste avec cette vibe.</p></div>
                    <div className="grid grid-cols-2 gap-2 sm:gap-3">
                      {VIBES.map((vibe) => (
                        <button key={vibe.id} onClick={() => setRefreshVibe(vibe)} className={`p-2.5 sm:p-4 rounded-xl border transition-all flex flex-col sm:flex-row items-center sm:items-start text-center sm:text-left gap-2 ${refreshVibe?.id === vibe.id ? 'bg-purple-500/20 border-purple-500 shadow-[0_0_15px_rgba(168,85,247,0.2)]' : 'bg-white/5 border-white/10 hover:bg-white/10'}`}>
                          <div className={cn("p-2 rounded-full shrink-0", refreshVibe?.id === vibe.id ? "bg-purple-500/20" : "bg-white/5")}>
                            <vibe.icon className={cn("w-4 h-4", refreshVibe?.id === vibe.id ? "text-purple-400" : "text-white/50")} />
                          </div>
                          <span className="font-bold text-xs sm:text-sm w-full break-words leading-tight">{vibe.label}</span>
                        </button>
                      ))}
                    </div>
                    <div className="bg-white/5 p-4 rounded-xl border border-white/10">
                       <div className="flex justify-between mb-3"><span className="font-bold text-xs flex items-center gap-1.5"><Clock className="w-3.5 h-3.5" /> Durée totale</span><span className="text-purple-400 font-black text-sm">{refreshDuration} min</span></div>
                       <input type="range" min="15" max="120" step="15" value={refreshDuration} onChange={(e) => setRefreshDuration(Number(e.target.value))} className="w-full accent-purple-500" />
                    </div>
                    <button onClick={executeRefresh} disabled={!refreshVibe} className="w-full bg-purple-500 text-white font-black text-sm py-3.5 rounded-full hover:scale-105 transition-transform disabled:opacity-50 disabled:scale-100 shadow-md flex items-center justify-center gap-2">
                      <Wand2 className="w-4 h-4" /> Générer le Mix
                    </button>
                  </div>
                )}

                {viewMode === "refresh_loading" && (
                  <div className="flex flex-col items-center justify-center py-20 space-y-4">
                    <div className="relative w-20 h-20 flex items-center justify-center">
                       <div className="absolute inset-0 border-4 border-transparent border-t-purple-500 rounded-full animate-spin"></div>
                       <div className="absolute inset-2 border-4 border-transparent border-b-blue-500 opacity-50 rounded-full animate-spin-reverse"></div>
                       <Wand2 className="w-6 h-6 text-white animate-pulse" />
                    </div>
                    <div className="text-center"><p className="font-bold text-lg mb-1">Renouveau en cours...</p><p className="text-purple-400 text-xs animate-pulse">L'IA préserve tes pépites et mixe le reste.</p></div>
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <PlaylistWizard isOpen={isWizardOpen} onClose={() => { setIsWizardOpen(false); toggleNav(true); }} onSave={handleSaveWizard} />

      <AnimatePresence>
        {importState.active && (
          <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4 w-full h-[100dvh]">
            <div className="absolute inset-0 bg-black/80 backdrop-blur-md touch-none" />
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }}
              className="relative bg-[#1c1c1e] w-full max-w-sm rounded-[32px] p-6 border border-white/10 shadow-2xl pointer-events-auto text-center flex flex-col items-center"
            >
              
              {importState.status === "loading" && (
                <>
                  <div className="relative w-20 h-20 mx-auto mb-6 flex items-center justify-center">
                    <div className="absolute inset-0 border-4 border-transparent border-t-[#1db954] rounded-full animate-spin opacity-20"></div>
                    <div className="absolute inset-2 border-4 border-transparent border-l-[#1db954] rounded-full animate-spin-reverse"></div>
                    <Download className="w-8 h-8 text-[#1db954] animate-pulse" />
                  </div>
                  <h2 className="text-xl font-black text-white mb-4">{importState.text}</h2>
                  
                  <div className="w-full h-2.5 bg-white/10 rounded-full overflow-hidden mb-3 relative">
                    <motion.div 
                      className="absolute left-0 top-0 bottom-0 bg-[#1db954]" 
                      initial={{ width: 0 }} 
                      animate={{ width: `${importState.progress}%` }} 
                      transition={{ ease: "linear", duration: 0.2 }}
                    />
                  </div>
                  <p className="text-[#1db954] font-bold text-sm tracking-widest">{importState.progress}%</p>
                  <p className="text-white/40 text-xs mt-6">Merci de ne pas fermer l'application pendant l'importation.</p>
                </>
              )}

              {importState.status === "success" && (
                <>
                  <div className="w-20 h-20 bg-[#1db954]/20 rounded-full flex items-center justify-center mx-auto mb-6">
                    <CheckCircle2 className="w-10 h-10 text-[#1db954]" />
                  </div>
                  <h2 className="text-2xl font-black text-white mb-2">Succès !</h2>
                  <p className="text-white/60 text-sm mb-8 leading-relaxed px-2">{importState.message}</p>
                  <button 
                    onClick={closeImportProgress} 
                    className="w-full bg-[#1db954] text-black font-black py-4 rounded-xl hover:scale-[1.02] active:scale-95 transition-transform shadow-[0_0_20px_rgba(29,185,84,0.3)]"
                  >
                    Super !
                  </button>
                </>
              )}

              {importState.status === "error" && (
                <>
                  <div className="w-20 h-20 bg-red-500/20 rounded-full flex items-center justify-center mx-auto mb-6">
                    <AlertCircle className="w-10 h-10 text-red-500" />
                  </div>
                  <h2 className="text-2xl font-black text-white mb-2">Oups...</h2>
                  <p className="text-white/60 text-sm mb-8 leading-relaxed px-2">{importState.message}</p>
                  <button 
                    onClick={closeImportProgress} 
                    className="w-full bg-white/10 text-white font-bold py-4 rounded-xl hover:bg-white/20 transition-colors"
                  >
                    Fermer
                  </button>
                </>
              )}

            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showSpotifyImportModal && (
          <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 w-full h-[100dvh]">
            <div className="absolute inset-0 bg-black/80 backdrop-blur-md touch-none" onClick={() => { setShowSpotifyImportModal(false); toggleNav(true); }} />
            <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }}
              className="relative bg-[#1c1c1e] w-full max-w-sm rounded-[32px] p-6 border border-white/10 shadow-2xl pointer-events-auto">
              <h2 className="text-2xl font-black text-white flex items-center gap-2 mb-4"><Download className="w-6 h-6 text-[#1db954]" /> Import Spotify</h2>
              <input value={spotifyUrlInput} onChange={(e) => setSpotifyUrlInput(e.target.value)}
                placeholder="Colle ton lien Spotify ici..."
                className="w-full bg-white/5 border border-white/10 rounded-2xl py-4 px-4 text-white outline-none focus:border-[#1db954] mb-6"
                onKeyDown={(e) => e.key === 'Enter' && executeSpotifyImport()} />
              <div className="flex gap-3">
                <button onClick={() => { setShowSpotifyImportModal(false); toggleNav(true); }} className="flex-1 py-3 text-white/50 hover:text-white font-bold transition-colors">Annuler</button>
                <button onClick={executeSpotifyImport} disabled={!spotifyUrlInput.includes("spotify")} className="flex-1 bg-[#1db954] text-black font-black py-3 rounded-xl disabled:opacity-50">Importer</button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showCreateModal && (
          <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 w-full h-[100dvh]">
            <div className="absolute inset-0 bg-black/80 backdrop-blur-md touch-none" onClick={() => { setShowCreateModal(false); toggleNav(true); }} />
            <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }}
              className="relative bg-[#1c1c1e] w-full max-w-sm rounded-[32px] p-6 border border-white/10 shadow-2xl pointer-events-auto">
              <h2 className="text-2xl font-black text-white flex items-center gap-2 mb-4"><ListMusic className="w-6 h-6 text-[#1db954]" /> Nouvelle Playlist</h2>
              <input value={newPlaylistName} onChange={(e) => setNewPlaylistName(e.target.value)}
                placeholder="Nom de la playlist..."
                className="w-full bg-white/5 border border-white/10 rounded-2xl py-4 px-4 text-white outline-none focus:border-[#1db954] mb-6"
                onKeyDown={(e) => e.key === 'Enter' && handleCreate()} />
              <div className="flex gap-3">
                <button onClick={() => { setShowCreateModal(false); toggleNav(true); }} className="flex-1 py-3 text-white/50 hover:text-white font-bold transition-colors">Annuler</button>
                <button onClick={handleCreate} disabled={!newPlaylistName.trim()} className="flex-1 bg-[#1db954] text-black font-black py-3 rounded-xl disabled:opacity-50">Créer</button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showShareModal && (
          <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 w-full h-[100dvh]">
            <div className="absolute inset-0 bg-black/80 backdrop-blur-md touch-none" onClick={() => { setShowShareModal(false); toggleNav(true); }} />
            <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }}
              className="relative w-full max-w-sm sm:max-w-md bg-[#1c1c1e] rounded-[32px] p-6 border border-white/10 shadow-2xl flex flex-col max-h-[80vh] pointer-events-auto">
              <div className="flex items-center justify-between mb-6 shrink-0">
                <h2 className="text-2xl font-black text-white flex items-center gap-2"><Users className="w-6 h-6 text-[#1db954]" /> Partager avec...</h2>
                <button onClick={() => { setShowShareModal(false); toggleNav(true); }} className="w-10 h-10 bg-white/10 hover:bg-white/20 rounded-full flex items-center justify-center transition-colors">
                  <X className="w-5 h-5 text-white" />
                </button>
              </div>
              <div className="flex-1 overflow-y-auto overscroll-contain custom-scrollbar pr-2 pb-2">
                {myFriends.length === 0 ? (
                  <div className="text-center py-6 flex flex-col items-center gap-4">
                    <AlertCircle className="w-10 h-10 text-white/20" />
                    <p className="text-white/50 mb-6">Tu n'as pas encore d'amis. Va sur ton Profil pour en ajouter !</p>
                    <button onClick={() => { setShowShareModal(false); toggleNav(true); }} className="bg-white/10 hover:bg-white/20 text-white font-bold py-3 px-8 rounded-full transition-colors">Fermer</button>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {myFriends?.filter(Boolean).map(friend => {
                      const isAlreadyCollab = activePlaylist?.playlist_collaborators?.some((c: any) => c?.user_id === friend?.id);
                      return (
                        <div key={`friend-${friend?.id}`} className="flex items-center gap-4 bg-white/5 p-3 rounded-2xl border border-white/5">
                          <Image src={friend?.avatar_url || "https://api.dicebear.com/7.x/shapes/svg?seed=user"} alt="" width={40} height={40} className="rounded-full object-cover" />
                          <span className="flex-1 font-bold text-white truncate">{friend?.username}</span>
                          {isAlreadyCollab ? (
                            <span className="text-xs text-[#1db954] font-bold bg-[#1db954]/10 px-3 py-1.5 rounded-full flex items-center gap-1">
                              <CheckCircle2 className="w-3 h-3" /> Ajouté
                            </span>
                          ) : (
                            <button onClick={() => handleShare(friend?.id)} className="bg-white/10 hover:bg-[#1db954] hover:text-black transition-all text-xs font-bold px-4 py-2 rounded-full flex items-center gap-1">
                              <UserPlus className="w-3 h-3" /> Inviter
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
}