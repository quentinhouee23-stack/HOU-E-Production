// @ts-nocheck
"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useAuth } from "@/context/AuthContext";
import { useNotifications } from "@/context/NotificationContext";
import { motion, AnimatePresence } from "framer-motion";
import { User, Bell, Check, UserPlus, ListMusic, Sparkles } from "lucide-react";

export function Header() {
  const { user } = useAuth();
  
  // On récupère le système de notifications
  const notificationsContext = useNotifications(); 
  const notifications = notificationsContext?.notifications || [];
  const unreadCount = notificationsContext?.unreadCount || 0;
  const markAsRead = notificationsContext?.markAsRead;
  const markAllAsRead = notificationsContext?.markAllAsRead;

  const [showNotifs, setShowNotifs] = useState(false);

  const username = user?.user_metadata?.username || "Utilisateur";

  // Fonction pour associer une icône au type de notif
  const getIconForType = (type) => {
    switch(type) {
      case 'friend_request': return <UserPlus className="w-4 h-4 text-blue-400" />;
      case 'playlist_add': return <ListMusic className="w-4 h-4 text-[#1db954]" />;
      case 'new_release': return <Sparkles className="w-4 h-4 text-purple-400" />;
      default: return <Bell className="w-4 h-4 text-white/50" />;
    }
  };

  return (
    <header className="sticky top-0 z-[500] flex items-center justify-between px-4 sm:px-8 py-4 bg-black/80 backdrop-blur-2xl border-b border-white/5">
      
      {/* 🟢 1. LOGO SIGNATURE "HOUÉE" */}
      <Link href="/" className="hover:opacity-80 transition-opacity">
        <h1 
          className="text-3xl text-white tracking-widest" 
          style={{ fontFamily: "'Dancing Script', 'Brush Script MT', cursive", fontWeight: 600 }}
        >
          HOUÉE
        </h1>
      </Link>
      
      <div className="flex items-center gap-4">
        {user ? (
          <>
            <div className="relative">
              {/* LA CLOCHE DE NOTIFICATIONS */}
              <button 
                onClick={() => setShowNotifs(!showNotifs)}
                className="relative w-10 h-10 rounded-full bg-[#1c1c1e] border border-white/5 hover:bg-white/10 flex items-center justify-center transition-colors shadow-sm"
              >
                <Bell className="w-5 h-5 text-white" />
                {unreadCount > 0 && (
                  <span className="absolute -top-1 -right-1 w-4 h-4 bg-[#1db954] rounded-full text-[10px] flex items-center justify-center font-black text-black shadow-lg">
                    {unreadCount}
                  </span>
                )}
              </button>

              {/* 🟢 2. LE POP-UP DE NOTIFICATIONS CENTRÉ */}
              <AnimatePresence>
                {showNotifs && (
                  <>
                    {/* Overlay d'arrière plan qui ferme le pop-up si on clique à côté */}
                    <motion.div 
                      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                      className="fixed inset-0 z-[501] bg-black/40 backdrop-blur-sm" 
                      onClick={() => setShowNotifs(false)}
                    />
                    
                    {/* La modale centrée */}
                    <motion.div 
                      initial={{ opacity: 0, y: -20, scale: 0.95, x: "-50%" }} 
                      animate={{ opacity: 1, y: 0, scale: 1, x: "-50%" }} 
                      exit={{ opacity: 0, y: -20, scale: 0.95, x: "-50%" }}
                      transition={{ type: "spring", stiffness: 400, damping: 25 }}
                      className="fixed top-24 left-1/2 w-[92%] max-w-sm bg-[#1c1c1e] border border-white/10 rounded-3xl shadow-[0_20px_50px_rgba(0,0,0,0.5)] z-[502] overflow-hidden"
                    >
                      <div className="p-5 border-b border-white/5 flex items-center justify-between bg-white/5">
                        <h3 className="font-black text-white text-lg">Notifications</h3>
                        {unreadCount > 0 && (
                          <button onClick={markAllAsRead} className="text-xs text-[#1db954] hover:text-white font-bold flex items-center gap-1 transition-colors bg-[#1db954]/10 px-3 py-1.5 rounded-full">
                            <Check className="w-3 h-3" /> Tout lu
                          </button>
                        )}
                      </div>

                      <div className="max-h-[60vh] overflow-y-auto custom-scrollbar pb-2">
                        {notifications.length === 0 ? (
                          <div className="p-10 flex flex-col items-center text-center text-white/40">
                            <Bell className="w-10 h-10 mb-3 opacity-20" />
                            <p className="text-sm font-medium">Aucune notification pour le moment.</p>
                          </div>
                        ) : (
                          notifications.map((notif) => (
                            <div 
                              key={notif.id} 
                              onClick={() => { if(!notif.is_read) markAsRead(notif.id); }}
                              className={`p-4 mx-2 mt-2 rounded-2xl flex gap-4 cursor-pointer transition-colors ${notif.is_read ? 'opacity-50 hover:bg-white/5' : 'bg-white/5 border border-white/5 hover:bg-white/10'}`}
                            >
                              <div className="mt-1 bg-black/50 p-2.5 rounded-full h-fit border border-white/5">
                                {getIconForType(notif.type)}
                              </div>
                              <div className="flex-1">
                                <h4 className={`text-sm mb-1 ${notif.is_read ? 'font-medium text-white/70' : 'font-bold text-white'}`}>{notif.title}</h4>
                                <p className="text-xs text-white/50 leading-relaxed">{notif.message}</p>
                              </div>
                              {!notif.is_read && <div className="w-2 h-2 rounded-full bg-[#1db954] mt-2 shrink-0 shadow-[0_0_8px_#1db954]" />}
                            </div>
                          ))
                        )}
                      </div>
                    </motion.div>
                  </>
                )}
              </AnimatePresence>
            </div>

            {/* 🟢 3. ICÔNE RAPPEL DE LA MARQUE (Profil) */}
            <Link href="/profile" className="flex items-center gap-3 rounded-full focus:outline-none group">
              <motion.span
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                className="relative w-10 h-10 rounded-full overflow-hidden ring-1 ring-white/20 group-hover:ring-[#1db954] transition-all flex items-center justify-center bg-gradient-to-br from-[#1c1c1e] to-black shadow-lg"
              >
                {/* Lettre "H" stylisée en police signature */}
                <span 
                  className="text-white text-xl translate-y-[1px] translate-x-[1px]" 
                  style={{ fontFamily: "'Dancing Script', 'Brush Script MT', cursive", fontWeight: 600 }}
                >
                  H
                </span>
              </motion.span>
            </Link>
          </>
        ) : (
          <Link href="/login" className="flex items-center gap-2 bg-white text-black hover:bg-gray-200 transition-colors px-5 py-2 rounded-full text-sm font-bold shadow-lg">
            <User className="w-4 h-4" />
            Connexion
          </Link>
        )}
      </div>
    </header>
  );
} 