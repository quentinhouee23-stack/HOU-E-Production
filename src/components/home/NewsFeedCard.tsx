"use client";

import Link from "next/link";
import Image from "next/image";
import { motion } from "framer-motion";
import { Music2, Sparkles, ListMusic, Radio } from "lucide-react";
import type { NewsFeedItem } from "@/types";

const typeIcons = {
  new_release: Music2,
  recommendation: Sparkles,
  playlist_update: ListMusic,
  artist_news: Radio,
};

interface NewsFeedCardProps {
  item: NewsFeedItem;
  index?: number;
}

export function NewsFeedCard({ item, index = 0 }: NewsFeedCardProps) {
  const Icon = typeIcons[item.type];

  return (
    <Link href={item.linkUrl}>
      <motion.article
        initial={{ opacity: 0, x: -8 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ delay: index * 0.06 }}
        className="group flex gap-4 p-4 rounded-2xl bg-white/5 border border-white/10 hover:bg-white/8 hover:border-white/15 transition-all duration-300"
      >
        <div className="relative w-24 h-24 rounded-xl overflow-hidden flex-shrink-0">
          <Image
            src={item.imageUrl}
            alt=""
            fill
            className="object-cover group-hover:scale-105 transition-transform duration-500"
            sizes="96px"
          />
          <div className="absolute bottom-1 right-1 w-6 h-6 rounded-md bg-black/60 flex items-center justify-center">
            <Icon className="w-3.5 h-3.5 text-white" />
          </div>
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-sm line-clamp-1 group-hover:text-primary transition-colors">
            {item.title}
          </h3>
          <p className="text-xs text-foreground/60 line-clamp-2 mt-0.5">{item.description}</p>
          <time className="text-[10px] text-foreground/50 mt-1 block">
            {new Date(item.createdAt).toLocaleDateString("fr-FR", { day: "numeric", month: "short" })}
          </time>
        </div>
      </motion.article>
    </Link>
  );
}
