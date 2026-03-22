"use client";

import { motion, AnimatePresence } from "framer-motion";
import { usePathname } from "next/navigation";
import React from "react";

// Variantes inspirées des transitions iOS/Android natives
const variants = {
  initial: {
    opacity: 0,
    y: 12,
    scale: 0.99,
  },
  animate: {
    opacity: 1,
    y: 0,
    scale: 1,
  },
  exit: {
    opacity: 0,
    y: -8,
    scale: 0.99,
  },
};

export default function Template({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <AnimatePresence mode="wait" initial={false}>
      <motion.div
        key={pathname}
        variants={variants}
        initial="initial"
        animate="animate"
        exit="exit"
        transition={{
          duration: 0.3,
          ease: [0.4, 0, 0.2, 1], // Material Design "standard" easing — naturel et fluide
        }}
        style={{ willChange: "transform, opacity" }} // Délègue au GPU, pas de jank
        className="h-full w-full"
      >
        {children}
      </motion.div>
    </AnimatePresence>
  );
}