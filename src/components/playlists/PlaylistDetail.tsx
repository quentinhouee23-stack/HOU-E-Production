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
      className="rounded-2xl bg-white/5 border border-white/10 overflow-hidden"
    >
      <div className="p-4 flex flex-col sm:flex-row gap-4">
        <div className="relative w-full aspect-square sm:w-48 sm:aspect-auto sm:h-48 rounded-xl overflow-hidden flex-shrink-0">
          <Image
            src={playlist.coverUrl}
            alt={playlist.name}
            fill
            className="object-cover"
            sizes="(max-width: 640px) 100vw, 192px"
          />
        </div>
        <div className="flex-1 min-w-0">
          <h1 className="text-xl font-bold">{playlist.name}</h1>
          <p className="text-sm text-foreground/70 mt-1">{playlist.description}</p>
          {playlist.isShared && (
            <div className="flex items-center gap-2 mt-2 text-sm text-foreground/80">
              <Users className="w-4 h-4" />
              <span>Partagée avec la famille</span>
              <div className="flex -space-x-2">
                {contributors.slice(0, 4).map((u) =>
                  u ? (
                    <div
                      key={u.id}
                      className="w-6 h-6 rounded-full ring-2 ring-background overflow-hidden"
                      title={u.name}
                    >
                      <Image src={u.avatarUrl} alt={u.name} width={24} height={24} className="object-cover" />
                    </div>
                  ) : null
                )}
              </div>
            </div>
          )}
          <div className="flex flex-wrap gap-2 mt-4">
            <button
              type="button"
              onClick={handleUpdateWithAI}
              disabled={aiLoading}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 disabled:opacity-50"
            >
              <Sparkles className="w-4 h-4" />
              {aiLoading ? "Mise à jour…" : "Update with AI"}
            </button>
          </div>
          {aiMessage && (
            <p className="mt-2 text-sm text-foreground/70">{aiMessage}</p>
          )}
        </div>
      </div>
      <ul className="divide-y divide-white/10">
        {playlistTracks.map((track, i) => (
          <li
            key={track.id}
            className="flex items-center gap-3 px-4 py-3 hover:bg-white/5 group"
          >
            <span className="w-6 text-center text-sm text-foreground/50">{i + 1}</span>
            <div className="w-10 h-10 rounded-lg overflow-hidden flex-shrink-0">
              <Image src={track.coverUrl} alt="" width={40} height={40} className="object-cover w-full h-full" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-medium text-sm truncate">{track.title}</p>
              <p className="text-xs text-foreground/60 truncate">{track.artist}</p>
            </div>
            <ContributorAvatars track={track} />
            <span className="text-xs text-foreground/50 w-10 text-right">{formatDuration(track.duration)}</span>
            <button
              type="button"
              onClick={() => playTrack(track)}
              className="opacity-0 group-hover:opacity-100 p-2 rounded-full bg-primary text-primary-foreground hover:scale-110 transition-all"
              aria-label="Lire"
            >
              <Play className="w-4 h-4" fill="currentColor" />
            </button>
          </li>
        ))}
      </ul>
    </motion.div>
  );
}
