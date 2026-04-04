// @ts-nocheck
"use client";

import { useCallback, useState } from "react";
import Image from "next/image";
import { Sparkles, Users, Play } from "lucide-react";
import { motion } from "framer-motion";
import type { Playlist, Track } from "@/types";
import { getPlaylistTracks, getPlaylistById, users } from "@/lib/data";
import { updatePlaylistWithAI } from "@/lib/aiMock";
import { useMusic } from "@/context/MusicContext";
import { formatDuration } from "@/lib/utils";
import { useSearchParams } from "next/navigation";

function ContributorAvatars({ track }: { track: Track }) {
  const contributors = track.contributors ?? [];
  if (contributors.length === 0) return null;
  return (
    <div className="flex -space-x-2">
      {contributors.slice(0, 3).map((c) => (
        <div
          key={c.userId}
          className="w-5 h-5 rounded-full ring-2 ring-background overflow-hidden"
          title={c.userName}
        >
          <Image src={c.avatarUrl} alt={c.userName} width={20} height={20} className="object-cover" />
        </div>
      ))}
    </div>
  );
}

export function PlaylistDetail() {
  const searchParams = useSearchParams();
  const playlistId = searchParams.get("id");
  const playlist = playlistId ? getPlaylistById(playlistId) : null;
  const [aiLoading, setAiLoading] = useState(false);
  const [aiMessage, setAiMessage] = useState<string | null>(null);
  const { playTrack } = useMusic();

  const handleUpdateWithAI = useCallback(async () => {
    if (!playlist) return;
    setAiLoading(true);
    setAiMessage(null);
    try {
      const result = await updatePlaylistWithAI(playlist);
      setAiMessage(result.message);
    } finally {
      setAiLoading(false);
    }
  }, [playlist]);

  if (!playlist) {
    return (
      <div className="py-12 text-center text-foreground/60 rounded-2xl bg-white/5 border border-white/10">
        <p className="text-sm">Sélectionnez une playlist ci-dessous pour voir le détail et utiliser &quot;Update with AI&quot;.</p>
      </div>
    );
  }

  const playlistTracks = getPlaylistTracks(playlist);
  const contributors = playlist.contributorIds
    ? playlist.contributorIds.map((id) => users.find((u) => u.id === id)).filter(Boolean)
    : [];

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      // 🟢 STRUCTURE FLEX : Transforme la vue en un conteneur rigide avec sa propre zone de scroll
      className="rounded-2xl bg-white/5 border border-white/10 overflow-hidden flex flex-col max-h-[85vh] sm:max-h-[800px]"
    >
      {/* 🟢 ZONE HAUTE FIXE (L'image ne déclenchera plus le scroll de la page) */}
      <div className="p-5 flex flex-col sm:flex-row gap-5 shrink-0 bg-white/5 border-b border-white/10 touch-none">
        <div className="relative w-32 aspect-square sm:w-48 sm:aspect-auto sm:h-48 rounded-xl overflow-hidden flex-shrink-0 shadow-lg pointer-events-none select-none">
          <Image
            src={playlist.coverUrl}
            alt={playlist.name}
            fill
            className="object-cover"
            sizes="(max-width: 640px) 100vw, 192px"
            draggable={false}
          />
        </div>
        <div className="flex-1 min-w-0">
          <h1 className="text-2xl font-black text-white">{playlist.name}</h1>
          <p className="text-sm text-white/70 mt-1">{playlist.description}</p>
          {playlist.isShared && (
            <div className="flex items-center gap-2 mt-2 text-sm text-white/80">
              <Users className="w-4 h-4" />
              <span>Partagée avec la famille</span>
              <div className="flex -space-x-2">
                {contributors.slice(0, 4).map((u) =>
                  u ? (
                    <div
                      key={u.id}
                      className="w-6 h-6 rounded-full ring-2 ring-black overflow-hidden"
                      title={u.name}
                    >
                      <Image src={u.avatarUrl} alt={u.name} width={24} height={24} className="object-cover" />
                    </div>
                  ) : null
                )}
              </div>
            </div>
          )}
          <div className="flex flex-wrap gap-2 mt-4 pointer-events-auto">
            <button
              type="button"
              onClick={handleUpdateWithAI}
              disabled={aiLoading}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-primary text-primary-foreground text-sm font-bold hover:scale-105 transition-transform disabled:opacity-50 disabled:scale-100 shadow-md"
            >
              <Sparkles className="w-4 h-4" />
              {aiLoading ? "Mise à jour…" : "Update with AI"}
            </button>
          </div>
          {aiMessage && (
            <p className="mt-2 text-sm text-primary font-medium">{aiMessage}</p>
          )}
        </div>
      </div>

      {/* 🟢 ZONE BASSE SCROLLABLE (Seule cette zone scrolle) */}
      <div className="flex-1 overflow-y-auto overscroll-contain custom-scrollbar">
        <ul className="divide-y divide-white/5">
          {playlistTracks.map((track, i) => (
            <li
              key={track.id}
              className="flex items-center gap-3 px-5 py-3 hover:bg-white/5 group transition-colors cursor-pointer"
              onClick={() => playTrack(track)}
            >
              <span className="w-6 text-center text-sm text-white/30 font-bold">{i + 1}</span>
              <div className="w-10 h-10 rounded-lg overflow-hidden flex-shrink-0 shadow-sm pointer-events-none">
                <Image src={track.coverUrl} alt="" width={40} height={40} className="object-cover w-full h-full" />
              </div>
              <div className="flex-1 min-w-0 pointer-events-none">
                <p className="font-bold text-sm text-white truncate">{track.title}</p>
                <p className="text-xs text-white/50 truncate">{track.artist}</p>
              </div>
              <ContributorAvatars track={track} />
              <span className="text-xs font-bold text-white/30 w-10 text-right">{formatDuration(track.duration)}</span>
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); playTrack(track); }}
                className="opacity-0 group-hover:opacity-100 p-2 rounded-full bg-primary text-primary-foreground hover:scale-110 transition-all shadow-md"
                aria-label="Lire"
              >
                <Play className="w-4 h-4 ml-0.5" fill="currentColor" />
              </button>
            </li>
          ))}
        </ul>
      </div>
    </motion.div>
  );
}