// @ts-nocheck
"use client";

import React, { createContext, useContext, useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "./AuthContext";
import type { Track } from "@/types";

const PlaylistContext = createContext<any>(null);

export function PlaylistProvider({ children }: { children: React.ReactNode }) {
  const [playlists, setPlaylists] = useState([]);
  
  const [isLoaded, setIsLoaded] = useState(false);
  const { user, loading } = useAuth(); 

  const preloadImages = (playlistsData) => {
    if (!playlistsData || playlistsData.length === 0) return;
    
    playlistsData.forEach(p => {
      if (p.tracks && p.tracks.length > 0 && p.tracks[0].image) {
        const img = new Image();
        img.src = p.tracks[0].image;
      }
    });
  };

  const fetchPlaylists = async () => {
    if (!user) {
      const saved = localStorage.getItem("my_glass_playlists");
      if (saved) {
        const parsed = JSON.parse(saved);
        setPlaylists(parsed);
        preloadImages(parsed);
      }
      setIsLoaded(true); 
      return;
    }

    const saved = localStorage.getItem("my_glass_playlists");
    if (saved) {
      const localPlaylists = JSON.parse(saved);
      if (localPlaylists.length > 0) {
        for (const p of localPlaylists) {
          await supabase.from("playlists").insert({
            name: p.name,
            owner_id: user.id,
            tracks: p.tracks || [],
            is_shared: false
          });
        }
        localStorage.removeItem("my_glass_playlists");
      }
    }

    // 🟢 DÉTECTEUR DE BLOCAGE POUR TES ANCIENNES PLAYLISTS
    const { data, error } = await supabase
      .from("playlists")
      .select("*, playlist_collaborators(user_id)")
      .order('created_at', { ascending: false });

    if (error) {
      console.error("🚨 SUPABASE REFUSE DE LIRE TES PLAYLISTS :", error.message, error.details, error.hint);
      alert(`Erreur de lecture de tes playlists : ${error.message}`);
    } else if (data) {
      setPlaylists(data);
      preloadImages(data); 
    }
    
    setIsLoaded(true);
  };

  useEffect(() => {
    if (loading) return;

    setIsLoaded(false);
    fetchPlaylists();

    if (user) {
      const subscription = supabase
        .channel('public:playlists')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'playlists' }, payload => {
          fetchPlaylists();
        })
        .subscribe();

      return () => { supabase.removeChannel(subscription); };
    }
  }, [user, loading]);

  const createPlaylist = async (name: string, tracks: Track[] = []) => {
    const safeTracks = Array.isArray(tracks) ? tracks : [];
    
    const tempPlaylist = {
      id: `temp-${Date.now()}`, 
      name,
      owner_id: user?.id || "local",
      tracks: safeTracks,
      is_shared: false,
      created_at: new Date().toISOString()
    };

    // Interface optimiste : on l'affiche tout de suite
    setPlaylists(prev => [tempPlaylist, ...prev]);

    if (!user) {
      const saved = JSON.parse(localStorage.getItem("my_glass_playlists") || "[]");
      localStorage.setItem("my_glass_playlists", JSON.stringify([tempPlaylist, ...saved]));
      return tempPlaylist;
    }

    try {
      const { data, error } = await supabase.from("playlists").insert({
        name,
        owner_id: user.id,
        tracks: safeTracks,
        is_shared: false
      }).select().single();

      // 🟢 DÉTECTEUR DE BLOCAGE POUR LA CRÉATION
      if (error) {
        console.error("🚨 SUPABASE REFUSE DE SAUVEGARDER :", error.message, error.details);
        alert(`Supabase a bloqué ta playlist !\nRaison : ${error.message}\nDétails : ${error.details}`);
        
        // On annule l'interface optimiste : la playlist disparaît direct sous tes yeux
        setPlaylists(prev => prev.filter(p => p.id !== tempPlaylist.id));
        return; 
      }

      if (data) {
        setPlaylists(prev => prev.map(p => p.id === tempPlaylist.id ? data : p));
      }
    } catch (err) {
      console.error("❌ Crash réseau lors de la sauvegarde :", err);
    }
  };

  const updatePlaylist = async (id: string, updates: any) => {
    setPlaylists(prev => {
      const newPlaylists = prev.map(p => p.id === id ? { ...p, ...updates } : p);
      if (!user) localStorage.setItem("my_glass_playlists", JSON.stringify(newPlaylists));
      return newPlaylists;
    });

    if (user && !id.startsWith("temp-")) {
      await supabase.from("playlists").update(updates).eq("id", id);
    }
  };

  const deletePlaylist = async (id: string) => {
    setPlaylists(prev => {
      const newPlaylists = prev.filter(p => p.id !== id);
      if (!user) localStorage.setItem("my_glass_playlists", JSON.stringify(newPlaylists));
      return newPlaylists;
    });

    if (user && !id.startsWith("temp-")) {
      await supabase.from("playlists").delete().eq("id", id);
    }
  };

  const addTrackToPlaylist = (playlistId: string, track: Track) => {
    const playlist = playlists.find(p => p.id === playlistId);
    if (!playlist) return;
    
    if (playlist.tracks?.find((t: any) => t.id === track.id)) return;
    
    const newTracks = [...(playlist.tracks || []), track];
    updatePlaylist(playlistId, { tracks: newTracks });
  };

  const removeTrackFromPlaylist = (playlistId: string, trackId: string) => {
    const playlist = playlists.find(p => p.id === playlistId);
    if (!playlist) return;
    
    const newTracks = playlist.tracks?.filter((t: any) => t.id !== trackId) || [];
    updatePlaylist(playlistId, { tracks: newTracks });
  };

  const shareWithFriend = async (playlistId: string, friendId: string) => {
    if (!user || playlistId.startsWith("temp-")) return;
    await supabase.from("playlist_collaborators").insert({ playlist_id: playlistId, user_id: friendId });
    await supabase.from("playlists").update({ is_shared: true }).eq("id", playlistId);
    fetchPlaylists();
  };

  return (
    <PlaylistContext.Provider value={{ 
      playlists, 
      createPlaylist, 
      updatePlaylist, 
      deletePlaylist, 
      addTrackToPlaylist, 
      removeTrackFromPlaylist,
      shareWithFriend,
      isLoaded 
    }}>
      {children}
    </PlaylistContext.Provider>
  );
}

export const usePlaylists = () => {
  const ctx = useContext(PlaylistContext);
  if (!ctx) throw new Error("usePlaylists must be used within PlaylistProvider");
  return ctx;
};