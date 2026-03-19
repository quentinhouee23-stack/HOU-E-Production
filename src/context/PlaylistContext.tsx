// @ts-nocheck
"use client";

import React, { createContext, useContext, useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "./AuthContext";
import type { Track } from "@/types";

const PlaylistContext = createContext<any>(null);

export function PlaylistProvider({ children }: { children: React.ReactNode }) {
  const [playlists, setPlaylists] = useState([]);
  const { user } = useAuth();

  const fetchPlaylists = async () => {
    if (!user) {
      const saved = localStorage.getItem("my_glass_playlists");
      if (saved) setPlaylists(JSON.parse(saved));
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

    const { data, error } = await supabase
      .from("playlists")
      .select("*, playlist_collaborators(user_id)")
      .order('created_at', { ascending: false });

    if (!error && data) {
      setPlaylists(data);
    }
  };

  useEffect(() => {
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
  }, [user]);

  // 🟢 LA SOLUTION ULTIME : L'Interface Optimiste
  const createPlaylist = async (name: string, tracks: Track[] = []) => {
    const safeTracks = Array.isArray(tracks) ? tracks : [];
    
    // 1. CRÉATION IMMÉDIATE DANS L'INTERFACE
    // On n'attend plus le serveur. On crée une fausse playlist pour l'afficher tout de suite.
    const tempPlaylist = {
      id: `temp-${Date.now()}`, // Faux ID temporaire
      name,
      owner_id: user?.id || "local",
      tracks: safeTracks,
      is_shared: false,
      created_at: new Date().toISOString()
    };

    // BOUM 💥 Elle apparaît à l'écran instantanément !
    setPlaylists(prev => [tempPlaylist, ...prev]);

    // Mode hors-ligne / Visiteur
    if (!user) {
      const saved = JSON.parse(localStorage.getItem("my_glass_playlists") || "[]");
      localStorage.setItem("my_glass_playlists", JSON.stringify([tempPlaylist, ...saved]));
      return tempPlaylist;
    }

    // 2. ENVOI SILENCIEUX À SUPABASE (En arrière-plan)
    try {
      const { data, error } = await supabase.from("playlists").insert({
        name,
        owner_id: user.id,
        tracks: safeTracks,
        is_shared: false
      }).select().single();

      if (error) {
        console.error("❌ Supabase a refusé la sauvegarde :", error);
        return; // L'utilisateur garde la playlist localement sur son écran pour la session
      }

      // 3. REMPLACEMENT INVISIBLE
      // Quand Supabase répond enfin avec le "vrai" ID de la base de données, 
      // on remplace le faux ID temporaire en silence.
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
      shareWithFriend 
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