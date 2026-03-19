// @ts-nocheck
"use client";

import Image from "next/image";
import { Play, Trash2 } from "lucide-react";
import { motion } from "framer-motion";
import { usePlaylists } from "@/context/PlaylistContext";
import { useMusic } from "@/context/MusicContext";
import { formatDuration } from "@/lib/utils";

interface UserPlaylistDetailProps {
  playlistId: string;
}

export function UserPlaylistDetail({ playlistId }: UserPlaylistDetailProps) {
  const { getPlaylistById, removeTrackFromPlaylist } = usePlaylists();
  const { playTrack } = useMusic();

  const playlist = getPlaylistById(playlistId);
  if (!playlist) return null;

  const onPlayAll = () => {
    if (!playlist.tracks.length) return;
    playTrack(playlist.tracks[0], { queue: playlist.tracks });
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="mt-6 rounded-2xl bg-white/5 border border-white/10 overflow-hidden"
    >
      <div className="p-4 flex flex-col sm:flex-row gap-4">
        <div className="relative w-full aspect-square sm:w-48 sm:aspect-auto sm:h-48 rounded-xl overflow-hidden flex-shrink-0">
          <Image
            src={`https://picsum.photos/seed/${encodeURIComponent(playlist.id)}/400/400`}
            alt={playlist.name}
            fill
            className="object-cover"
            sizes="(max-width: 640px) 100vw, 192px"
          />
        </div>
        <div className="flex-1 min-w-0">
          <h2 className="text-xl font-bold">{playlist.name}</h2>
          <p className="text-sm text-foreground/70 mt-1">{playlist.description}</p>
          <p className="text-xs text-foreground/60 mt-2">
            {playlist.tracks.length} titre{playlist.tracks.length > 1 ? "s" : ""} • {formatDuration(playlist.totalDuration)}
          </p>
          <button
            type="button"
            onClick={onPlayAll}
            className="mt-4 inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 text-sm font-semibold"
          >
            <Play className="w-4 h-4" />
            Lire tout
          </button>
        </div>
      </div>
      <ul className="divide-y divide-white/10">
        {playlist.tracks.map((track, index) => (
          <li
            key={track.id}
            className="flex items-center gap-3 px-4 py-3 hover:bg-white/5"
          >
            <span className="w-6 text-center text-xs text-foreground/50">{index + 1}</span>
            <div className="w-10 h-10 rounded-lg overflow-hidden flex-shrink-0 bg-white/10">
              {track.coverUrl && (
                <Image
                  src={track.coverUrl}
                  alt={track.title}
                  width={40}
                  height={40}
                  className="object-cover w-full h-full"
                />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{track.title}</p>
              <p className="text-xs text-foreground/60 truncate">{track.artist}</p>
            </div>
            <span className="text-xs text-foreground/50 w-14 text-right">{formatDuration(track.duration)}</span>
            <button
              type="button"
              onClick={() => removeTrackFromPlaylist(playlist.id, track.id)}
              className="ml-2 p-2 rounded-full hover:bg-white/10 text-foreground/70"
              aria-label="Supprimer le titre"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </li>
        ))}
        {playlist.tracks.length === 0 && (
          <li className="px-4 py-6 text-center text-sm text-foreground/60">
            Cette playlist est vide. Ajoutez des morceaux depuis la recherche avec le bouton &quot;+&quot;.
          </li>
        )}
      </ul>
    </motion.div>
  );
}

