"use client";

import Image from "next/image";
import { motion } from "framer-motion";
import { ListMusic } from "lucide-react";
import type { UserPlaylist } from "@/types";

interface UserPlaylistCardProps {
  playlist: UserPlaylist;
  index?: number;
  onSelect?: (playlistId: string) => void;
  selected?: boolean;
}

export function UserPlaylistCard({
  playlist,
  index = 0,
  onSelect,
  selected = false,
}: UserPlaylistCardProps) {
  return (
    <button
      type="button"
      onClick={() => onSelect?.(playlist.id)}
      className={[
        "text-left rounded-2xl overflow-hidden w-full",
        "bg-white/5 border transition-all duration-300",
        selected ? "border-primary/60 bg-white/8" : "border-white/10 hover:bg-white/8 hover:border-white/15",
      ].join(" ")}
    >
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: index * 0.05 }}
      >
        <div className="aspect-square relative overflow-hidden">
          <Image
            src={`https://picsum.photos/seed/${encodeURIComponent(playlist.id)}/400/400`}
            alt={playlist.name}
            fill
            className="object-cover"
            sizes="(max-width: 768px) 50vw, 25vw"
          />
          <div className="absolute bottom-2 left-2 inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-black/50 text-white text-[10px]">
            <ListMusic className="w-3 h-3" />
            <span>{playlist.tracks.length} titre{playlist.tracks.length > 1 ? "s" : ""}</span>
          </div>
        </div>
        <div className="p-3">
          <h3 className="font-semibold text-sm truncate">{playlist.name}</h3>
          <p className="text-xs text-foreground/60 truncate">{playlist.description}</p>
        </div>
      </motion.div>
    </button>
  );
}

