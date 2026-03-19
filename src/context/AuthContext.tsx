// @ts-nocheck
"use client";

import React, { createContext, useContext, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

const AuthContext = createContext<any>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<any>(null);
  const [session, setSession] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const syncProfile = async (currentUser) => {
    if (currentUser) {
      await supabase.from('profiles').upsert({
        id: currentUser.id,
        username: currentUser.user_metadata?.username || "Utilisateur",
        avatar_url: currentUser.user_metadata?.avatar_url || ""
      });
    }
  };

  useEffect(() => {
    const checkActiveSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      setSession(session);
      setUser(session?.user || null);
      
      await syncProfile(session?.user);
      setLoading(false);
    };
    
    checkActiveSession();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      setSession(session);
      setUser(session?.user || null);
      
      await syncProfile(session?.user);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const signUp = async (email: string, password: string, username: string) => {
    const avatar_url = `https://api.dicebear.com/7.x/avataaars/svg?seed=${username}&backgroundColor=1db954`;
    
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { username, avatar_url }
      }
    });
    
    if (error) throw error;
    
    if (data?.user) {
      await supabase.from('profiles').upsert({
        id: data.user.id,
        username: username,
        avatar_url: avatar_url
      });
    }
    
    return data;
  };

  const signIn = async (email: string, password: string) => {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    if (error) throw error;
    return data;
  };

  const signOut = async () => {
    // 🟢 LE COUP DE BALAI : On nettoie le navigateur pour ne pas mélanger les comptes sur un même appareil
    localStorage.removeItem("dailyStats");
    localStorage.removeItem("weeklyTopTracks");
    localStorage.removeItem("playlists");
    localStorage.removeItem("my_glass_playlists");

    const { error } = await supabase.auth.signOut();
    if (error) throw error;
  };

  return (
    <AuthContext.Provider value={{ user, session, loading, signUp, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth doit être utilisé à l'intérieur d'un AuthProvider");
  }
  return context;
};