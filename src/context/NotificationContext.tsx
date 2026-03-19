// @ts-nocheck
"use client";

import React, { createContext, useContext, useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "./AuthContext";

const NotificationContext = createContext<any>(null);

export function NotificationProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);

  const fetchNotifications = async () => {
    if (!user) return;
    const { data, error } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(30); // On garde les 30 dernières

    if (!error && data) {
      setNotifications(data);
      setUnreadCount(data.filter(n => !n.is_read).length);
    }
  };

  useEffect(() => {
    fetchNotifications();

    if (user) {
      // 1. Écoute en temps réel des nouvelles notifications pour MOI
      const subscription = supabase
        .channel('public:notifications')
        .on('postgres_changes', { 
          event: '*', 
          schema: 'public', 
          table: 'notifications',
          filter: `user_id=eq.${user.id}` 
        }, payload => {
          fetchNotifications();
        })
        .subscribe();

      // 2. 🟢 SYSTÈME DE NOTIFICATION QUOTIDIENNE (La surprise du jour)
      const triggerDailyNotification = async () => {
        const today = new Date().toISOString().split('T')[0]; // Format "YYYY-MM-DD"
        const storageKey = `houee_daily_notif_${user.id}`;
        const lastNotifDate = localStorage.getItem(storageKey);

        // Si on n'a pas encore envoyé de notif aujourd'hui
        if (lastNotifDate !== today) {
          
          // Le catalogue des notifications possibles
          const dailyMessages = [
            { type: 'new_release', title: '💿 Sorties de la semaine', message: 'De nouveaux albums sont sortis ! Viens découvrir les exclusivités du jour.' },
            { type: 'news', title: '🔥 L\'actu brûlante', message: 'Il y a du mouvement dans le monde de la musique. Ne rate rien sur le fil d\'actualité !' },
            { type: 'playlist_add', title: '🎧 Ton Mix Magique', message: 'L\'IA de HOUÉE est prête à te surprendre. Lance un nouveau mix basé sur tes goûts.' },
            { type: 'friend_activity', title: '👀 En direct chez tes amis', message: 'Curieux ? Va voir ce que tes amis écoutent en ce moment sur l\'accueil.' }
          ];

          // On tire une notification au hasard
          const randomNotif = dailyMessages[Math.floor(Math.random() * dailyMessages.length)];

          // On l'ajoute dans la base de données de l'utilisateur
          await supabase.from('notifications').insert({
            user_id: user.id,
            type: randomNotif.type,
            title: randomNotif.title,
            message: randomNotif.message,
            is_read: false
          });

          // On marque qu'il a eu sa notif pour aujourd'hui
          localStorage.setItem(storageKey, today);
        }
      };

      // On lance la vérification 3 secondes après l'ouverture de l'app pour ne pas bloquer le chargement
      const timeoutId = setTimeout(() => {
        triggerDailyNotification();
      }, 3000);

      return () => { 
        supabase.removeChannel(subscription); 
        clearTimeout(timeoutId);
      };
    }
  }, [user]);

  const markAsRead = async (notificationId: string) => {
    // Mise à jour optimiste (visuelle immédiate)
    setNotifications(prev => prev.map(n => n.id === notificationId ? { ...n, is_read: true } : n));
    setUnreadCount(prev => Math.max(0, prev - 1));
    
    // Envoi en BDD
    await supabase.from('notifications').update({ is_read: true }).eq('id', notificationId);
  };

  const markAllAsRead = async () => {
    setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
    setUnreadCount(0);
    await supabase.from('notifications').update({ is_read: true }).eq('user_id', user.id);
  };

  // Fonction utilitaire pour envoyer une notification à un ami (Demande d'ami, partage de playlist...)
  const sendNotification = async (targetUserId: string, type: string, title: string, message: string) => {
    if (!user || targetUserId === user.id) return; // On ne s'envoie pas de notif à soi-même manuellement
    await supabase.from('notifications').insert({
      user_id: targetUserId,
      type,
      title,
      message
    });
  };

  return (
    <NotificationContext.Provider value={{ notifications, unreadCount, markAsRead, markAllAsRead, sendNotification }}>
      {children}
    </NotificationContext.Provider>
  );
}

export const useNotifications = () => useContext(NotificationContext);