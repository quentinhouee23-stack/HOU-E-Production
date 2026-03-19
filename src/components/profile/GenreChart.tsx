"use client";

import { motion } from "framer-motion";
import type { GenreStats } from "@/types";

interface GenreChartProps {
  genres: GenreStats[];
}

export function GenreChart({ genres }: GenreChartProps) {
  const maxMinutes = Math.max(...genres.map((g) => g.listenTimeMinutes), 1);

  return (
    <div className="space-y-3">
      {genres.map((g, i) => (
        <motion.div
          key={g.genre}
          initial={{ opacity: 0, x: -10 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: i * 0.08 }}
          className="flex items-center gap-3"
        >
          <span className="w-20 text-sm font-medium truncate">{g.genre}</span>
          <div className="flex-1 h-8 rounded-lg bg-white/10 overflow-hidden">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${g.percentage}%` }}
              transition={{ delay: 0.2 + i * 0.05, duration: 0.5 }}
              className="h-full rounded-lg bg-primary/80 flex items-center justify-end pr-2"
            >
              <span className="text-xs font-medium text-primary-foreground">
                {g.percentage}%
              </span>
            </motion.div>
          </div>
          <span className="text-xs text-foreground/60 w-14 text-right">
            {Math.round(g.listenTimeMinutes)} min
          </span>
        </motion.div>
      ))}
    </div>
  );
}
