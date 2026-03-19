// @ts-nocheck
"use client";

import React, { useState, useRef, useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import { Home, Search, ListMusic, Compass, X } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";

const navItems = [
  { href: "/", label: "Accueil", icon: Home },
  { href: "/discover", label: "Découverte", icon: Compass },
  { href: "/playlists", label: "Playlists", icon: ListMusic },
  { href: "/search", label: "Recherche", icon: Search, isSearch: true },
];

const springConfig = { type: "spring", stiffness: 500, damping: 35, mass: 0.5 };
const morphTransition = { duration: 0.3, ease: [0.22, 1, 0.36, 1] };

export function LiquidGlassNav() {
  const pathname = usePathname();
  const router = useRouter();

  const [mounted, setMounted] = useState(false);
  const [isSearchActive, setIsSearchActive] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [optimisticIndex, setOptimisticIndex] = useState<number | null>(null);

  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    navItems.forEach(item => {
      router.prefetch(item.href);
    });
  }, [router]);

  useEffect(() => {
    setOptimisticIndex(null);
    if (pathname === "/search") {
      setIsSearchActive(true);
    } else {
      setIsSearchActive(false);
      setSearchQuery(""); 
    }
  }, [pathname]);

  useEffect(() => {
    const handleCloseSearch = () => setIsSearchActive(false);
    const handleOpenSearch = () => {
      setIsSearchActive(true);
      setTimeout(() => inputRef.current?.focus(), 100);
    };

    window.addEventListener("closeSearchNav", handleCloseSearch);
    window.addEventListener("openSearchNav", handleOpenSearch);

    return () => {
      window.removeEventListener("closeSearchNav", handleCloseSearch);
      window.removeEventListener("openSearchNav", handleOpenSearch);
    };
  }, []);

  if (!mounted) return null;

  const updateDragPosition = (clientX: number) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const x = clientX - rect.left;
    
    const totalWidth = rect.width;
    const searchWidth = 64; 
    const gap = 12; 
    const leftPillWidth = totalWidth - searchWidth - gap;

    let index = 0;
    if (x > leftPillWidth + gap / 2) {
       index = 3; 
    } else {
       const itemWidth = leftPillWidth / 3;
       index = Math.floor(x / itemWidth);
       index = Math.max(0, Math.min(index, 2));
    }
    
    setDragIndex((prev) => (prev !== index ? index : prev));
  };

  const handlePointerDown = (e: React.PointerEvent) => {
    if (isSearchActive) return;
    setIsDragging(true);
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    updateDragPosition(e.clientX);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isDragging || isSearchActive) return;
    updateDragPosition(e.clientX);
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    if (!isDragging) return;
    setIsDragging(false);
    (e.target as HTMLElement).releasePointerCapture(e.pointerId);

    if (dragIndex !== null) {
      const item = navItems[dragIndex];
      setOptimisticIndex(dragIndex); 

      if (item.isSearch) {
        setIsSearchActive(true);
        router.push("/search");
        setTimeout(() => inputRef.current?.focus(), 100);
      } else {
        if (item.href === "/") {
          if (pathname === "/") window.dispatchEvent(new Event("resetHomeView"));
          else router.push("/");
        } else if (item.href === "/playlists") {
          if (pathname === "/playlists") window.dispatchEvent(new Event("resetPlaylistsView"));
          else router.push(item.href);
        } else {
          router.push(item.href);
        }
      }
    }
    setDragIndex(null);
  };

  const currentIndex = navItems.findIndex(item => pathname === item.href || (item.href !== "/" && pathname.startsWith(item.href)));
  const activePillIndex = dragIndex !== null ? dragIndex : (optimisticIndex !== null ? optimisticIndex : currentIndex);

  const leftItems = navItems.slice(0, 3);

  return (
    <nav className="fixed bottom-6 left-1/2 -translate-x-1/2 w-[92%] max-w-md z-[100] select-none touch-none">
      <div
        ref={containerRef}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        className="relative w-full h-16"
      >
        <AnimatePresence mode="wait">
          
          {isSearchActive ? (
            <motion.div
              key="search-mode"
              initial={{ opacity: 0, scale: 0.95, filter: "blur(12px)" }}
              animate={{ opacity: 1, scale: 1, filter: "blur(0px)" }}
              exit={{ opacity: 0, scale: 0.95, filter: "blur(12px)" }}
              transition={morphTransition}
              className="flex w-full h-full gap-3 relative"
            >
              <motion.button
                whileTap={{ scale: 0.9 }}
                onClick={(e) => {
                  e.stopPropagation();
                  setIsSearchActive(false);
                  setSearchQuery(""); 
                  if (pathname === "/") window.dispatchEvent(new Event("resetHomeView"));
                  else router.push("/");
                }}
                className="w-16 h-16 flex items-center justify-center bg-[#252525]/70 backdrop-blur-[48px] saturate-[1.8] rounded-full border border-white/15 shadow-[0_12px_40px_rgba(0,0,0,0.6)] shrink-0 text-white/80 hover:text-[#1db954] transition-colors cursor-pointer relative overflow-hidden"
              >
                <div className="absolute inset-0 bg-gradient-to-br from-white/20 via-transparent to-black/40 pointer-events-none opacity-40" />
                <div className="absolute top-2 left-3 w-4 h-2 bg-white/40 rounded-full blur-[2px] -rotate-15 pointer-events-none" />
                <Home className="w-6 h-6 relative z-10" />
              </motion.button>

              <div className="flex-1 relative h-full flex items-center bg-[#252525]/70 backdrop-blur-[48px] saturate-[1.8] rounded-full border border-white/15 shadow-[0_12px_40px_rgba(0,0,0,0.6)] overflow-hidden">
                <div className="absolute inset-x-0 top-0 h-[1px] bg-gradient-to-r from-transparent via-white/30 to-transparent pointer-events-none" />
                <Search className="w-5 h-5 absolute left-4 text-white/60 pointer-events-none" />
                <input
                  ref={inputRef}
                  autoFocus
                  value={searchQuery}
                  onChange={(e) => {
                    const val = e.target.value;
                    setSearchQuery(val);
                    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
                    searchTimeoutRef.current = setTimeout(() => {
                      router.replace(val.trim() !== "" ? `/search?q=${encodeURIComponent(val)}` : `/search`);
                    }, 400); 
                  }}
                  placeholder="Artistes, titres..."
                  className="w-full h-full bg-transparent pl-12 pr-12 outline-none text-white font-bold placeholder:text-white/40 relative z-10"
                />
                <AnimatePresence>
                  {searchQuery.length > 0 && (
                    <motion.button
                      initial={{ opacity: 0, scale: 0.8 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.8 }}
                      onClick={(e) => {
                        e.stopPropagation();
                        setSearchQuery("");
                        router.replace(`/search`);
                        inputRef.current?.focus(); 
                      }}
                      className="absolute right-3 w-8 h-8 flex items-center justify-center rounded-full bg-white/20 hover:bg-white/30 text-white transition-colors z-10"
                    >
                      <X className="w-4 h-4" />
                    </motion.button>
                  )}
                </AnimatePresence>
              </div>
            </motion.div>

          ) : (
            <motion.div
              key="nav-mode"
              initial={{ opacity: 0, scale: 0.95, filter: "blur(12px)" }}
              animate={{ opacity: 1, scale: 1, filter: "blur(0px)" }}
              exit={{ opacity: 0, scale: 0.95, filter: "blur(12px)" }}
              transition={morphTransition}
              className="flex w-full h-full gap-3 relative"
            >
              <div className="flex-1 flex items-center justify-around bg-[#252525]/70 backdrop-blur-[48px] saturate-[1.8] rounded-full border border-white/15 shadow-[0_12px_40px_rgba(0,0,0,0.6)] px-2 relative overflow-hidden">
                <div className="absolute inset-x-0 top-0 h-[1px] bg-gradient-to-r from-transparent via-white/30 to-transparent pointer-events-none" />
                
                {leftItems.map((item, index) => {
                  const isActive = activePillIndex === index;
                  return (
                    <div key={item.href} className="relative flex flex-col items-center justify-center h-12 rounded-full flex-1 cursor-pointer">
                      {isActive && (
                        <motion.div
                          layoutId="liquid-pill"
                          transition={springConfig}
                          className="absolute inset-0 rounded-full bg-white/10 border border-white/20"
                          style={{
                            boxShadow: `
                              inset 0px 4px 8px rgba(255, 255, 255, 0.1), 
                              inset 0px -4px 8px rgba(0, 0, 0, 0.2),
                              0 4px 12px rgba(0,0,0,0.3)
                            `
                          }}
                        >

                        </motion.div>
                      )}
                      <motion.span 
                        className="relative z-10 pointer-events-none"
                        animate={{ y: isActive ? -2 : 0 }}
                        transition={springConfig}
                      >
                        <item.icon
                          className={cn("w-6 h-6 transition-colors duration-500", isActive ? "text-[#1db954]" : "text-white/60")}
                          strokeWidth={isActive ? 2.5 : 2}
                        />
                      </motion.span>
                      <motion.span 
                        initial={false}
                        animate={{ opacity: isActive ? 1 : 0, y: isActive ? 0 : 5, scale: isActive ? 1 : 0.8 }}
                        transition={springConfig}
                        className="relative z-10 text-[9px] font-bold pointer-events-none text-[#1db954] absolute bottom-0.5"
                      >
                        {item.label}
                      </motion.span>
                    </div>
                  );
                })}
              </div>

              <div className="w-16 h-16 flex items-center justify-center bg-[#252525]/70 backdrop-blur-[48px] saturate-[1.8] rounded-full border border-white/15 shadow-[0_12px_40px_rgba(0,0,0,0.6)] shrink-0 relative cursor-pointer overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-br from-white/20 via-transparent to-black/40 pointer-events-none opacity-40" />
                <div className="absolute top-2 left-3 w-4 h-2 bg-white/40 rounded-full blur-[2px] -rotate-15 pointer-events-none" />
                
                {activePillIndex === 3 && (
                  <motion.div
                    layoutId="liquid-pill"
                    className="absolute inset-0 rounded-full bg-white/10 border border-white/30 shadow-[inset_0_0_20px_rgba(255,255,255,0.1)]"
                    transition={springConfig}
                  />
                )}
                <motion.span className="relative z-10 pointer-events-none" animate={{ scale: activePillIndex === 3 ? 1.1 : 1 }}>
                  <Search className={cn("w-6 h-6", activePillIndex === 3 ? "text-[#1db954]" : "text-white/60")} strokeWidth={activePillIndex === 3 ? 2.5 : 2} />
                </motion.span>
              </div>

            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </nav>
  );
}