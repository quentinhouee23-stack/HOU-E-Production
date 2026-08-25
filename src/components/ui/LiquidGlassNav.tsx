// @ts-nocheck
"use client";

import React, { useState, useRef, useEffect, useCallback, useTransition } from "react";
import { useRouter, usePathname } from "next/navigation";
import { Home, Search, ListMusic, Compass } from "lucide-react"; 
import { motion, AnimatePresence, LayoutGroup, useMotionValue, useSpring, useTransform } from "framer-motion";
import { cn } from "@/lib/utils";
import GlassSurface from "./GlassSurface";

// ─── Nav items ────────────────────────────────────────────────────────────────
const NAV_ITEMS = [
  { href: "/",      label: "Accueil",    Icon: Home,      isSearch: false },
  { href: "/discover",  label: "Découverte", Icon: Compass,   isSearch: false },
  { href: "/playlists", label: "Playlists",  Icon: ListMusic, isSearch: false },
  { href: "/search",    label: "Recherche",  Icon: Search,    isSearch: true  },
] as const;

// ─── Motion configs ───────────────────────────────────────────────────────────
const PILL_SPRING  = { type: "spring", stiffness: 450, damping: 35, mass: 0.6 } as const;
const SLIDE_SPRING = { type: "spring", stiffness: 450, damping: 35, mass: 0.6 } as const;
const FAST_TWEEN   = { type: "tween",  duration: 0.12, ease: "easeOut" } as const;

// ─── Props partagés pour GlassSurface ────────────────────────────────────────
const GLASS_PROPS = {
  width:            "100%",
  height:           "100%",
  borderRadius:     9999,
  borderWidth:      0.05,
  distortionScale:  -150, 
  brightness:       10,   
  opacity:          0.05, 
  blur:             8,    
  backgroundOpacity: 0.1, 
  saturation:       1.5,
  redOffset:        8,    
  greenOffset:      0,
  blueOffset:       -8,   
} as const;

// ─────────────────────────────────────────────────────────────────────────────
// COMPOSANT : NavSlot
// ─────────────────────────────────────────────────────────────────────────────
function NavSlot({
  item,
  isActive,
  isDragging,
}: {
  item: typeof NAV_ITEMS[number];
  isActive: boolean;
  isDragging: boolean;
}) {
  return (
    <div className="relative flex flex-col items-center justify-center h-12 flex-1 rounded-full cursor-pointer z-10">
      {isActive && !isDragging && (
        <motion.div
          layoutId="active-pill"
          transition={PILL_SPRING}
          className="absolute inset-0 rounded-full border border-white/10 bg-white/5 shadow-[inset_0_1px_0_rgba(255,255,255,0.1),0_0_15px_rgba(29,185,84,0.1)]"
          style={{ willChange: "transform" }}
        />
      )}
      <motion.span
        className="pointer-events-none relative z-10"
        animate={{ y: isActive ? -1 : 0 }}
        transition={FAST_TWEEN}
      >
        <item.Icon
          style={{
            width:       22,
            height:      22,
            color:       isActive ? "#1db954" : "rgba(255,255,255,0.4)",
            strokeWidth: isActive ? 2.5 : 2,
            filter:      isActive ? "drop-shadow(0 0 8px rgba(29,185,84,0.4))" : "none",
            transition:  "all 0.2s ease",
          }}
        />
      </motion.span>
      <motion.span
        initial={false}
        animate={{ opacity: isActive ? 1 : 0, y: isActive ? 0 : 5, scale: isActive ? 1 : 0.8 }}
        transition={FAST_TWEEN}
        aria-hidden={!isActive}
        className="absolute bottom-[3px] pointer-events-none font-bold tracking-wider text-[#1db954] text-[9px] drop-shadow-[0_0_8px_rgba(29,185,84,0.5)] z-10"
      >
        {item.label}
      </motion.span>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Export Principal
// ─────────────────────────────────────────────────────────────────────────────
export function LiquidGlassNav() {
  const pathname = usePathname();
  const router   = useRouter();

  const [isPending, startTransition] = useTransition();

  const [isSearchActive, setIsSearchActive] = useState(() => pathname === "/search");
  const [searchQuery,    setSearchQuery]    = useState("");
  const [dragIndex,      setDragIndex]      = useState<number | null>(null);
  const [isDragging,     setIsDragging]     = useState(false);
  const [optimisticIdx,  setOptimisticIdx]  = useState<number | null>(null);
  const [isVisible,      setIsVisible]      = useState(true);
  
  // 🟢 NOUVEAU : Détecteur de clavier
  const [isKeyboardOpen, setIsKeyboardOpen] = useState(false);

  const [containerW, setContainerW] = useState(400);
  const dragX       = useMotionValue(0);
  const smoothDragX = useSpring(dragX, { stiffness: 600, damping: 40, mass: 0.5 });

  const maxDragX = Math.max(containerW - 72, 100);
  const pillScale = useTransform(
    smoothDragX,
    [0, Math.max(0, maxDragX - 80), Math.max(0, maxDragX - 40), maxDragX],
    [1, 1, 0.85, 1]
  );

  const containerRef      = useRef<HTMLDivElement>(null);
  const inputRef          = useRef<HTMLInputElement>(null);
  const searchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pointerDownPos    = useRef<number | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;
    const observer = new ResizeObserver((entries) => {
      setContainerW(entries[0].contentRect.width);
    });
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  // 🟢 CORRECTION DU COMPORTEMENT DU CLAVIER
  useEffect(() => {
    const vv = window?.visualViewport;
    if (!vv) return;
    
    const handleResize = () => {
      const isKeyboardActive = window.innerHeight - vv.height > 150;
      setIsKeyboardOpen(isKeyboardActive);
    };

    vv.addEventListener("resize", handleResize);
    handleResize();
    
    return () => vv.removeEventListener("resize", handleResize);
  }, []);

  useEffect(() => {
    const show = () => setIsVisible(true);
    const hide = () => setIsVisible(false);
    window.addEventListener("showNav", show);
    window.addEventListener("hideNav", hide);
    return () => {
      window.removeEventListener("showNav", show);
      window.removeEventListener("hideNav", hide);
    };
  }, []);

  useEffect(() => { NAV_ITEMS.forEach((i) => router.prefetch(i.href)); }, [router]);

  useEffect(() => {
    setOptimisticIdx(null);
    setIsSearchActive((prev) => {
      const isSearch = pathname === "/search";
      return prev !== isSearch ? isSearch : prev;
    });
    if (pathname !== "/search") setSearchQuery("");
  }, [pathname]);

  useEffect(() => {
    const close = () => { if (!isPending) setIsSearchActive(false); };
    const open  = () => {
      if (!isPending) {
        setIsSearchActive(true);
        setTimeout(() => inputRef.current?.focus(), 400);
      }
    };
    window.addEventListener("closeSearchNav", close);
    window.addEventListener("openSearchNav",  open);
    return () => {
      window.removeEventListener("closeSearchNav", close);
      window.removeEventListener("openSearchNav",  open);
    };
  }, [isPending]);

  const computeIndex = useCallback((clientX: number): number => {
    if (!containerRef.current) return 0;
    const { left, width } = containerRef.current.getBoundingClientRect();
    const x = Math.max(0, Math.min(clientX - left, width));
    return Math.min(3, Math.floor((x / width) * 4));
  }, []);

  const getClampedTargetX = useCallback((clientX: number) => {
    if (!containerRef.current) return 0;
    const rect = containerRef.current.getBoundingClientRect();
    const maxAllowedX = rect.width - 86;
    let targetX = clientX - rect.left - 36;
    return Math.max(0, Math.min(targetX, maxAllowedX));
  }, []);

  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    if (isSearchActive || isPending) return;
    pointerDownPos.current = e.clientX;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  }, [isSearchActive, isPending]);

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    if (isSearchActive || isPending || pointerDownPos.current === null) return;
    
    const deltaX = Math.abs(e.clientX - pointerDownPos.current);
    if (!isDragging && deltaX > 5) {
      setIsDragging(true);
      dragX.set(getClampedTargetX(e.clientX));
    }

    if (isDragging) {
      dragX.set(getClampedTargetX(e.clientX));
      setDragIndex(computeIndex(e.clientX));
    }
  }, [isDragging, isSearchActive, isPending, computeIndex, dragX, getClampedTargetX]);

  const handlePointerUp = useCallback((e: React.PointerEvent) => {
    pointerDownPos.current = null; 
    (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
    
    if (isPending || isSearchActive) return;

    const idx  = computeIndex(e.clientX);
    const item = NAV_ITEMS[idx];

    if (isDragging) {
      setIsDragging(false);
    }
    
    setOptimisticIdx(idx);

    if (item.isSearch) {
      if (!isSearchActive) {
        setIsSearchActive(true);
        startTransition(() => { router.push("/search"); });
        setTimeout(() => inputRef.current?.focus(), 400);
      }
    } else {
      if (item.href === "/" && pathname === "/") {
        window.dispatchEvent(new Event("resetHomeView"));
      } else if (item.href === "/playlists" && pathname === "/playlists") {
        window.dispatchEvent(new Event("resetPlaylistsView"));
      } else {
        startTransition(() => { router.push(item.href); });
      }
    }
    setDragIndex(null);
  }, [isDragging, computeIndex, pathname, router, isSearchActive, isPending]);

  const currentIdx = Math.max(0, NAV_ITEMS.findIndex(
    (i) => pathname === i.href || (i.href !== "/" && pathname.startsWith(i.href))
  ));
  
  const activePillIdx = dragIndex !== null
    ? dragIndex
    : optimisticIdx !== null
      ? optimisticIdx
      : currentIdx;

  useEffect(() => {
    if (!containerRef.current || isDragging) return;
    const rect = containerRef.current.getBoundingClientRect();
    const segmentWidth = rect.width / 4;
    const maxAllowedX = rect.width - 86;
    let targetX = (segmentWidth * activePillIdx) + (segmentWidth / 2) - 36;
    
    dragX.set(Math.max(0, Math.min(targetX, maxAllowedX)));
  }, [activePillIdx, isDragging, containerW, dragX]);

  const openSearch = useCallback(() => {
    if (isPending || isSearchActive) return;
    setOptimisticIdx(3);
    setIsSearchActive(true);
    startTransition(() => { router.push("/search"); });
    setTimeout(() => inputRef.current?.focus(), 400);
  }, [isPending, isSearchActive, router]);

  const closeSearch = useCallback(() => {
    if (isPending || !isSearchActive) return;
    setOptimisticIdx(0);
    setIsSearchActive(false);
    setSearchQuery("");
    if (pathname === "/") {
      window.dispatchEvent(new Event("resetHomeView"));
    } else {
      startTransition(() => { router.push("/"); });
    }
  }, [isPending, isSearchActive, pathname, router]);

  return (
    <AnimatePresence>
      {isVisible && !isKeyboardOpen && (
        <motion.nav
          initial={{ y: 120, opacity: 0 }}
          animate={{ y: 0,   opacity: 1 }}
          exit={{    y: 120, opacity: 0 }}
          transition={{ type: "spring", stiffness: 370, damping: 32 }}
          className="fixed left-1/2 -translate-x-1/2 w-[92%] max-w-md z-[100] select-none pb-[env(safe-area-inset-bottom)]"
          style={{ 
            // 🟢 COLLÉ TOUT EN BAS COMME APPLE MUSIC (utilisation directe de safe-area sans marge superflue)
            bottom: "20px"
          }}
        >
          <div
            aria-hidden
            style={{
              position:    "absolute",
              inset:       0,
              borderRadius: "9999px",
              transform:    "scaleX(1.05) scaleY(1.4) translateY(10px)",
              filter:       "blur(20px)",
              background:   "rgba(0,0,0,0.6)",
              pointerEvents:"none",
              zIndex:       -1,
            }}
          />

          <LayoutGroup>
            <div
              ref={containerRef}
              onPointerDown={handlePointerDown}
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerUp}
              onPointerCancel={handlePointerUp}
              className={cn(
                "relative w-full h-16 flex gap-3 touch-none",
                isSearchActive ? "flex-row-reverse" : "flex-row"
              )}
              style={{ cursor: isSearchActive ? "default" : "pointer" }}
            >

              {isDragging && !isSearchActive && (
                <motion.div
                  layoutId="active-pill"
                  transition={PILL_SPRING}
                  className="absolute rounded-full border border-white/10 bg-white/5 shadow-[inset_0_1px_0_rgba(255,255,255,0.1),0_0_15px_rgba(29,185,84,0.1)] z-30 pointer-events-none"
                  style={{
                    x:    smoothDragX,
                    width: 72,
                    height:48,
                    top:   8,
                    scale: pillScale,
                    willChange: "transform",
                  }}
                />
              )}

              <motion.div
                layout
                transition={SLIDE_SPRING}
                className="flex-1 h-16 rounded-full relative overflow-hidden shadow-2xl z-10"
              >
                <GlassSurface
                  {...GLASS_PROPS}
                  style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }}
                />

                <AnimatePresence initial={false}>
                  {!isSearchActive ? (
                    <motion.div
                      key="nav"
                      initial={{ opacity: 0, x: -60 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{    opacity: 0, x: -60 }}
                      transition={SLIDE_SPRING}
                      className="absolute inset-0 flex items-center justify-around px-2 z-10"
                    >
                      {NAV_ITEMS.slice(0, 3).map((item, index) => (
                        <NavSlot
                          key={item.href}
                          item={item}
                          isActive={activePillIdx === index}
                          isDragging={isDragging}
                        />
                      ))}
                    </motion.div>
                  ) : (
                    <motion.div
                      key="search"
                      initial={{ opacity: 0, x: 60 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{    opacity: 0, x: 60 }}
                      transition={SLIDE_SPRING}
                      className="absolute inset-0 flex items-center px-5 gap-3 z-10"
                    >
                      <Search className="w-5 h-5 text-white/50 shrink-0" strokeWidth={2.5} />
                      <input
                        ref={inputRef}
                        value={searchQuery}
                        onChange={(e) => {
                          const val = e.target.value;
                          setSearchQuery(val);
                          if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
                          searchDebounceRef.current = setTimeout(() => {
                            startTransition(() => {
                              router.replace(val.trim() ? `/search?q=${encodeURIComponent(val)}` : "/search");
                            });
                          }, 300);
                        }}
                        placeholder="Artistes, titres, albums…"
                        className="flex-1 bg-transparent outline-none font-medium text-white placeholder:text-white/30"
                        style={{ fontSize: 16 }}
                        type="search"
                        inputMode="search"
                        enterKeyHint="search"
                        autoComplete="off"
                        autoCorrect="off"
                        spellCheck="false"
                      />
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>

              <motion.button
                layout
                onClick={isSearchActive ? closeSearch : openSearch}
                transition={SLIDE_SPRING}
                className="w-16 h-16 rounded-full shrink-0 relative overflow-hidden flex items-center justify-center z-20 cursor-pointer"
              >
                <GlassSurface
                  {...GLASS_PROPS}
                  style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }}
                />

                {!isSearchActive && activePillIdx === 3 && !isDragging && (
                  <motion.div
                    layoutId="active-pill"
                    transition={PILL_SPRING}
                    className="absolute inset-1.5 rounded-full border border-white/10 bg-white/5 shadow-[inset_0_1px_0_rgba(255,255,255,0.1),0_0_15px_rgba(29,185,84,0.1)]"
                    style={{ willChange: "transform" }}
                  />
                )}

                <AnimatePresence mode="wait">
                  {!isSearchActive ? (
                    <motion.div
                      key="icon-search"
                      initial={{ opacity: 0, rotate: -45 }}
                      animate={{ opacity: 1, rotate: 0 }}
                      exit={{    opacity: 0, rotate: 45 }}
                      transition={{ duration: 0.15 }}
                      className="absolute z-10 pointer-events-none"
                    >
                      <Search
                        className="w-6 h-6 transition-all duration-200"
                        style={{
                          color:  activePillIdx === 3 ? "#1db954" : "rgba(255,255,255,0.7)",
                          filter: activePillIdx === 3 ? "drop-shadow(0 0 8px rgba(29,185,84,0.4))" : "none",
                        }}
                        strokeWidth={activePillIdx === 3 ? 2.5 : 2}
                      />
                    </motion.div>
                  ) : (
                    <motion.div
                      key="icon-home"
                      initial={{ opacity: 0, rotate: 45 }}
                      animate={{ opacity: 1, rotate: 0 }}
                      exit={{    opacity: 0, rotate: -45 }}
                      transition={{ duration: 0.15 }}
                      className="absolute z-10 pointer-events-none"
                    >
                      <Home className="w-6 h-6 text-white/70" strokeWidth={2} />
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.button>

            </div>
          </LayoutGroup>
        </motion.nav>
      )}
    </AnimatePresence>
  );
}