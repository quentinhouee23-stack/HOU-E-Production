// @ts-nocheck
"use client";

import React, { useState, useEffect } from "react";
import { Header } from "@/components/ui/Header";
import { useAuth } from "@/context/AuthContext";
import { useNotifications } from "@/context/NotificationContext";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { Edit2, Check, X, Clock, TrendingUp, LogOut, Users, UserPlus, Search as SearchIcon, UserCheck } from "lucide-react";

export default function ProfilePage() {
  const { user, signOut } = useAuth();
  const { sendNotification } = useNotifications();
  const router = useRouter();
  
  const [username, setUsername] = useState("Utilisateur");
  
  const [isEditingName, setIsEditingName] = useState(false);
  const [tempName, setTempName] = useState("");

  const [statsTimeframe, setStatsTimeframe] = useState("current"); 
  const [dailyStats, setDailyStats] = useState([]);
  const [topTracks, setTopTracks] = useState([]);
  const [lastWeekStats, setLastWeekStats] = useState([]);
  const [lastWeekTracks, setLastWeekTracks] = useState([]);

  const [showFriends, setShowFriends] = useState(false);
  const [activeTab, setActiveTab] = useState("friends"); 
  const [friendSearch, setFriendSearch] = useState("");
  
  const [searchResults, setSearchResults] = useState([]);
  const [myFriends, setMyFriends] = useState([]);
  const [pendingRequests, setPendingRequests] = useState([]);
  const [sentRequests, setSentRequests] = useState([]);

  const loadLocalStats = () => {
    const emptyDaily = [
      { day: "Lun", minutes: 0 }, { day: "Mar", minutes: 0 }, { day: "Mer", minutes: 0 },
      { day: "Jeu", minutes: 0 }, { day: "Ven", minutes: 0 }, { day: "Sam", minutes: 0 }, { day: "Dim", minutes: 0 },
    ];
    
    try {
      const currentStats = JSON.parse(localStorage.getItem("dailyStats"));
      setDailyStats(Array.isArray(currentStats) && currentStats.length === 7 ? currentStats : emptyDaily);
    } catch { setDailyStats(emptyDaily); }

    try {
      const pastStats = JSON.parse(localStorage.getItem("lastWeekStats"));
      setLastWeekStats(Array.isArray(pastStats) && pastStats.length === 7 ? pastStats : emptyDaily);
    } catch { setLastWeekStats(emptyDaily); }

    setTopTracks(JSON.parse(localStorage.getItem("weeklyTopTracks")) || []);
    setLastWeekTracks(JSON.parse(localStorage.getItem("lastWeekTopTracks")) || []);
  };

  useEffect(() => {
    if (!user) {
      router.push("/login");
      return;
    }

    const loadProfile = async () => {
      const currentName = user.user_metadata?.username || "Utilisateur";
      setUsername(currentName);

      // On s'assure que le profil existe bien
      await supabase.from('profiles').upsert({
        id: user.id,
        username: currentName
      });
      
      fetchFriends();
    };

    loadProfile();
    loadLocalStats();

    window.addEventListener("statsUpdated", loadLocalStats);
    return () => window.removeEventListener("statsUpdated", loadLocalStats);
  }, [user, router]);

  const fetchFriends = async () => {
    if (!user) return;
    
    const { data, error } = await supabase
      .from('friends')
      .select(`
        id,
        status,
        sender:user_id_1 ( id, username ),
        receiver:user_id_2 ( id, username )
      `)
      .or(`user_id_1.eq.${user.id},user_id_2.eq.${user.id}`);

    if (error) return;

    const accepted = [];
    const pending = [];
    const sent = [];

    data?.forEach(rel => {
      if (!rel.sender || !rel.receiver) return; 

      const isSender = rel.sender.id === user.id;
      const otherUser = isSender ? rel.receiver : rel.sender;

      if (rel.status === 'accepted') {
        accepted.push({ ...otherUser, relId: rel.id });
      } else if (rel.status === 'pending') {
        if (isSender) sent.push({ ...otherUser, relId: rel.id });
        else pending.push({ ...otherUser, relId: rel.id });
      }
    });

    setMyFriends(accepted);
    setPendingRequests(pending);
    setSentRequests(sent);
  };

  useEffect(() => {
    const searchUsers = async () => {
      if (friendSearch.length < 2) {
        setSearchResults([]);
        return;
      }

      const { data } = await supabase
        .from('profiles')
        .select('id, username')
        .ilike('username', `%${friendSearch}%`)
        .neq('id', user.id)
        .limit(10);
        
      setSearchResults(data || []);
    };

    const delay = setTimeout(searchUsers, 300);
    return () => clearTimeout(delay);
  }, [friendSearch, user]);

  const sendFriendRequest = async (targetId) => {
    await supabase.from('friends').insert({ user_id_1: user.id, user_id_2: targetId, status: 'pending' });
    sendNotification(targetId, 'friend_request', 'Nouvelle demande', `${user.user_metadata?.username || "Quelqu'un"} souhaite t'ajouter en ami !`);
    setFriendSearch(""); 
    fetchFriends();
  };

  const acceptFriendRequest = async (relId, senderId) => {
    await supabase.from('friends').update({ status: 'accepted' }).eq('id', relId);
    sendNotification(senderId, 'friend_request', 'Demande acceptée', `${user.user_metadata?.username || "Quelqu'un"} a accepté ta demande d'ami !`);
    fetchFriends();
  };

  const removeFriend = async (relId) => {
    await supabase.from('friends').delete().eq('id', relId);
    fetchFriends();
  };

  const startEditingName = () => {
    setTempName(username);
    setIsEditingName(true);
  };

  const saveName = async () => {
    if (tempName.trim().length > 0) {
      setUsername(tempName.trim());
      await supabase.auth.updateUser({ data: { username: tempName.trim() } });
      await supabase.from('profiles').upsert({ id: user.id, username: tempName.trim() });
      window.dispatchEvent(new Event("profileUpdated"));
    }
    setIsEditingName(false);
  };

  const handleSignOut = async () => {
    await signOut();
    router.push("/login");
  };

  if (!user) return null;

  const displayDaily = statsTimeframe === "current" ? dailyStats : lastWeekStats;
  const displayTopTracks = statsTimeframe === "current" ? topTracks : lastWeekTracks;
  const maxMinutes = Math.max(...displayDaily.map(d => Number(d.minutes) || 0), 1); 
  const todayArrayIndex = (new Date().getDay() + 6) % 7;

  return (
    <div className="pb-32 min-h-screen text-white flex flex-col relative overflow-hidden">
      <Header />

      <div className="px-4 py-8 max-w-5xl mx-auto space-y-12 w-full flex-1 relative">
        
        <section className="flex flex-col items-center text-center space-y-4 pt-4">
          
          <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} className="w-32 h-32 rounded-full border-4 border-[#1db954] shadow-[0_0_50px_rgba(29,185,84,0.2)] bg-[#1db954]/10 flex items-center justify-center">
             <span className="text-6xl font-black text-[#1db954] uppercase">{username.charAt(0)}</span>
          </motion.div>

          <div className="min-h-[60px] flex flex-col items-center justify-center">
            {isEditingName ? (
              <div className="flex items-center gap-2 bg-white/10 rounded-full pl-4 pr-1 py-1 border border-[#1db954]">
                <input 
                  type="text" value={tempName} onChange={(e) => setTempName(e.target.value)}
                  className="bg-transparent text-2xl font-black outline-none text-white w-40 text-center"
                  autoFocus onKeyDown={(e) => e.key === 'Enter' && saveName()}
                />
                <button onClick={saveName} className="w-8 h-8 rounded-full bg-[#1db954] text-black flex items-center justify-center hover:scale-105 transition-transform"><Check className="w-5 h-5" /></button>
                <button onClick={() => setIsEditingName(false)} className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center hover:bg-white/20 transition-colors"><X className="w-5 h-5 text-white/70" /></button>
              </div>
            ) : (
              <div className="flex items-center gap-3 group cursor-pointer" onClick={startEditingName}>
                <h1 className="text-4xl font-black">{username}</h1>
                <Edit2 className="w-5 h-5 text-white/30 group-hover:text-[#1db954] transition-colors" />
              </div>
            )}
            <p className="text-white/50 text-sm mt-1">{user.email}</p>
          </div>
          
          <div className="flex gap-3 pt-2">
            <button 
              onClick={() => { setShowFriends(true); fetchFriends(); }} 
              className="bg-white/10 hover:bg-white/20 transition-colors px-6 py-2 rounded-full font-bold flex items-center gap-2 relative"
            >
              <Users className="w-4 h-4" /> Amis
              {pendingRequests.length > 0 && (
                <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 rounded-full text-[10px] flex items-center justify-center font-black">
                  {pendingRequests.length}
                </span>
              )}
            </button>
            <button onClick={handleSignOut} className="bg-red-500/10 hover:bg-red-500/20 text-red-500 transition-colors px-6 py-2 rounded-full font-bold flex items-center gap-2">
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </section>

        <div className="space-y-6">
          <div className="flex items-center justify-center gap-2 mb-4 bg-white/5 p-1.5 rounded-full mx-auto max-w-[300px]">
             <button 
               onClick={() => setStatsTimeframe("current")} 
               className={`flex-1 py-2 px-4 rounded-full text-xs font-bold transition-all ${statsTimeframe === "current" ? "bg-[#1db954] text-black shadow-md" : "text-white/50 hover:text-white"}`}
             >
               Cette Semaine
             </button>
             <button 
               onClick={() => setStatsTimeframe("last")} 
               className={`flex-1 py-2 px-4 rounded-full text-xs font-bold transition-all ${statsTimeframe === "last" ? "bg-white text-black shadow-md" : "text-white/50 hover:text-white"}`}
             >
               Semaine Passée
             </button>
          </div>

          <section className="bg-white/5 border border-white/10 rounded-3xl p-6">
            <div className="flex items-center justify-between mb-8">
              <h2 className="text-xl font-bold flex items-center gap-3"><Clock className="w-6 h-6 text-[#1db954]" /> Temps d'écoute</h2>
            </div>
            
            <div className="flex items-end justify-between h-48 gap-2 mb-4 pt-4">
              {displayDaily.map((stat, i) => {
                const safeMinutes = Number(stat.minutes) || 0;
                const heightPercent = Math.max((safeMinutes / maxMinutes) * 100, 5);
                const isToday = statsTimeframe === "current" && i === todayArrayIndex; 

                return (
                  <div key={i} className="flex flex-col items-center justify-end flex-1 h-full relative">
                    <span className={`text-[10px] font-bold mb-2 ${safeMinutes > 0 ? 'text-white' : 'text-white/30'}`}>
                      {safeMinutes > 0 ? `${safeMinutes}m` : '-'}
                    </span>
                    <div className="w-full max-w-[40px] bg-white/10 rounded-t-xl relative overflow-hidden h-full flex-1">
                      <motion.div 
                        initial={{ height: "0%" }} 
                        animate={{ height: `${heightPercent}%` }} 
                        transition={{ duration: 1, delay: i * 0.1 }} 
                        className={`absolute bottom-0 w-full rounded-t-xl ${isToday ? "bg-[#1db954] shadow-[0_0_15px_rgba(29,185,84,0.3)]" : "bg-[#1db954]/60"}`} 
                      />
                    </div>
                    <span className={`text-xs mt-3 font-bold ${isToday ? "text-[#1db954]" : "text-white/50"}`}>{stat.day}</span>
                  </div>
                );
              })}
            </div>
          </section>

          <section>
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold flex items-center gap-3"><TrendingUp className="w-6 h-6 text-[#1db954]" /> Top 10</h2>
            </div>
            <div className="space-y-2">
              {displayTopTracks.length > 0 ? displayTopTracks.map((track, i) => (
                <div key={track.id} className="flex items-center p-3 bg-white/5 hover:bg-white/10 border border-white/5 rounded-2xl transition-all">
                  <div className="w-8 shrink-0 text-center font-black text-white/30">{i + 1}</div>
                  <img src={track.image} alt={track.title} className="w-14 h-14 rounded-xl object-cover shadow-md mx-3" />
                  <div className="flex-1 overflow-hidden">
                    <h3 className="font-bold text-white text-base truncate">{track.title}</h3>
                    <p className="text-sm text-white/50 truncate">{track.artist}</p>
                  </div>
                  <div className="shrink-0 px-4 text-right">
                    <p className="text-[#1db954] font-black text-lg">{track.plays}</p>
                    <p className="text-[10px] text-white/40 uppercase">écoutes</p>
                  </div>
                </div>
              )) : (
                <div className="text-center py-10 bg-white/5 rounded-3xl border border-white/5">
                  <span className="text-4xl" aria-hidden="true">
                    <svg viewBox="0 0 24 24" className="w-10 h-10 mx-auto" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M4 13a8 8 0 0 1 16 0v7" />
                      <path d="M4 14h3a2 2 0 0 1 2 2v3a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2z" />
                      <path d="M20 14h-3a2 2 0 0 0-2 2v3a2 2 0 0 0 2 2h1a2 2 0 0 0 2-2z" />
                    </svg>
                  </span>
                  <p className="text-white/50 mt-4">Aucune écoute enregistrée pour cette période.</p>
                </div>
              )}
            </div>
          </section>
        </div>

      </div>

      <AnimatePresence>
        {showFriends && (
          <div className="fixed inset-0 z-[200] flex items-end sm:items-center justify-center bg-black/80 backdrop-blur-md p-0 sm:p-6">
            <motion.div 
              initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }} transition={{ type: "spring", damping: 25, stiffness: 300 }}
              className="w-full sm:max-w-md bg-[#1c1c1e] rounded-t-[32px] sm:rounded-[32px] h-[85vh] sm:h-[600px] flex flex-col border-t sm:border border-white/10 overflow-hidden shadow-2xl"
            >
              <div className="flex items-center justify-between p-6 border-b border-white/5">
                <h2 className="text-2xl font-black text-white">Social</h2>
                <button onClick={() => setShowFriends(false)} className="w-10 h-10 bg-white/10 hover:bg-white/20 rounded-full flex items-center justify-center transition-colors">
                  <X className="w-5 h-5 text-white" />
                </button>
              </div>

              <div className="flex border-b border-white/5">
                <button 
                  onClick={() => setActiveTab("friends")} 
                  className={`flex-1 py-4 text-sm font-bold transition-colors ${activeTab === 'friends' ? 'text-[#1db954] border-b-2 border-[#1db954]' : 'text-white/50 hover:text-white'}`}
                >
                  Mes Amis ({myFriends.length})
                </button>
                <button 
                  onClick={() => setActiveTab("search")} 
                  className={`flex-1 py-4 text-sm font-bold transition-colors ${activeTab === 'search' ? 'text-[#1db954] border-b-2 border-[#1db954]' : 'text-white/50 hover:text-white'}`}
                >
                  Ajouter
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
                
                {activeTab === "search" && (
                  <div className="space-y-4">
                    <div className="relative">
                      <SearchIcon className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-white/40" />
                      <input 
                        type="text" placeholder="Chercher un pseudo..." value={friendSearch} onChange={(e) => setFriendSearch(e.target.value)}
                        className="w-full bg-white/5 border border-white/10 rounded-2xl py-3 pl-12 pr-4 text-white outline-none focus:border-[#1db954] transition-colors"
                      />
                    </div>

                    <div className="space-y-2 mt-4">
                      {searchResults.map(result => {
                        const isFriend = myFriends.some(f => f.id === result.id);
                        const hasSent = sentRequests.some(f => f.id === result.id);
                        const hasPending = pendingRequests.some(f => f.id === result.id);

                        return (
                          <div key={result.id} className="flex items-center gap-3 p-3 bg-white/5 rounded-2xl border border-white/5">
                            <div className="w-10 h-10 rounded-full bg-[#1db954]/20 flex items-center justify-center text-[#1db954] font-bold shrink-0 uppercase">
                               {result.username.charAt(0)}
                            </div>
                            <span className="flex-1 font-bold text-white truncate">{result.username}</span>
                            
                            {isFriend ? (
                              <span className="text-xs text-white/50 flex items-center gap-1"><UserCheck className="w-4 h-4"/> Amis</span>
                            ) : hasSent ? (
                              <span className="text-xs text-[#1db954] bg-[#1db954]/10 px-3 py-1.5 rounded-full font-bold">Envoyé</span>
                            ) : hasPending ? (
                              <button onClick={() => acceptFriendRequest(pendingRequests.find(p => p.id === result.id).relId, result.id)} className="bg-[#1db954] text-black text-xs font-bold px-4 py-2 rounded-full">Accepter</button>
                            ) : (
                              <button onClick={() => sendFriendRequest(result.id)} className="bg-white/10 hover:bg-white/20 transition-colors text-white text-xs font-bold px-4 py-2 rounded-full flex items-center gap-1">
                                <UserPlus className="w-4 h-4" /> Ajouter
                              </button>
                            )}
                          </div>
                        );
                      })}
                      {friendSearch.length >= 2 && searchResults.length === 0 && (
                        <p className="text-center text-white/50 text-sm py-4">Aucun utilisateur trouvé.</p>
                      )}
                    </div>
                  </div>
                )}

                {activeTab === "friends" && (
                  <div className="space-y-6">
                    {pendingRequests.length > 0 && (
                      <div>
                        <h3 className="text-xs font-bold uppercase tracking-widest text-white/40 mb-3">Demandes reçues ({pendingRequests.length})</h3>
                        <div className="space-y-2">
                          {pendingRequests.map(req => (
                            <div key={req.id} className="flex items-center gap-3 p-3 bg-[#1db954]/10 rounded-2xl border border-[#1db954]/20">
                              <div className="w-10 h-10 rounded-full bg-[#1db954]/30 flex items-center justify-center text-[#1db954] font-bold shrink-0 uppercase">
                                 {req.username.charAt(0)}
                              </div>
                              <span className="flex-1 font-bold text-white truncate">{req.username}</span>
                              <button onClick={() => acceptFriendRequest(req.relId, req.id)} className="bg-[#1db954] text-black w-8 h-8 flex items-center justify-center rounded-full hover:scale-105 transition-transform">
                                <Check className="w-4 h-4" />
                              </button>
                              <button onClick={() => removeFriend(req.relId)} className="bg-red-500/20 text-red-500 w-8 h-8 flex items-center justify-center rounded-full hover:bg-red-500/40 transition-colors">
                                <X className="w-4 h-4" />
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    <div>
                      {pendingRequests.length > 0 && <h3 className="text-xs font-bold uppercase tracking-widest text-white/40 mb-3">Ma liste</h3>}
                      
                      {myFriends.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-10 text-center opacity-50 space-y-4">
                          <Users className="w-12 h-12 text-[#1db954]" />
                          <div>
                            <p className="font-bold text-lg text-white">Aucun ami ajouté</p>
                            <p className="text-sm">Va dans l'onglet "Ajouter" pour trouver ta famille.</p>
                          </div>
                        </div>
                      ) : (
                        <div className="space-y-2">
                          {myFriends.map(friend => (
                            <div key={friend.id} className="flex items-center gap-3 p-3 bg-white/5 rounded-2xl border border-white/5 group">
                              <div className="w-12 h-12 rounded-full bg-[#1db954]/20 flex items-center justify-center text-[#1db954] font-bold text-xl shrink-0 uppercase">
                                  {friend.username.charAt(0)}
                              </div>
                              <span className="flex-1 font-bold text-white truncate">{friend.username}</span>
                              <button 
                                onClick={() => { if(window.confirm(`Supprimer ${friend.username} ?`)) removeFriend(friend.relId); }} 
                                className="opacity-0 group-hover:opacity-100 bg-red-500/20 text-red-500 w-8 h-8 flex items-center justify-center rounded-full hover:bg-red-500/40 transition-all"
                                title="Supprimer"
                              >
                                <X className="w-4 h-4" />
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

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