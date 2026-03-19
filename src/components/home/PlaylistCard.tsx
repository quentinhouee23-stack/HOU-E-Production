"use client";

import Link from "next/link";
import Image from "next/image";
import { motion } from "framer-motion";
import type { Playlist } from "@/types";
import { getPlaylistTracks } from "@/lib/data";

interface PlaylistCardProps {
  playlist: Playlist;
  index?: number;
}

export function PlaylistCard({ playlist, index = 0 }: PlaylistCardProps) {
  const tracks = getPlaylistTracks(playlist);

  return (
    <Link href={`/playlists?id=${playlist.id}`}>
      <motion.article
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: index * 0.05 }}
        className="group rounded-2xl overflow-hidden bg-white/5 border border-white/10 hover:bg-white/8 hover:border-white/15 transition-all duration-300"
      >
        <div className="aspect-square relative overflow-hidden">
          <Image
            src={playlist.coverUrl}
            alt={playlist.name}
            fill
            className="object-cover group-hover:scale-105 transition-transform duration-500"
            sizes="(max-width: 768px) 50vw, 25vw"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
        </div>
        <div className="p-3">
          <h3 className="font-semibold text-sm truncate">{playlist.name}</h3>
          <p className="text-xs text-foreground/60">
            {tracks.length} titre{tracks.length > 1 ? "s" : ""}
            {playlist.isShared && " • Partagée"}
          </p>
        </div>
      </motion.article>
    </Link>
  );
}
