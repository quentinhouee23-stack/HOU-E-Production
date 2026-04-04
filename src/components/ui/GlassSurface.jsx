// @ts-nocheck
"use client";

import React from "react";

export default function GlassSurface({ 
  children,
  // On destructure TOUTES les props spéciales pour éviter qu'elles ne tombent dans "...props"
  width = "100%", 
  height = "100%", 
  borderRadius = 9999, 
  borderWidth,
  distortionScale,
  brightness,
  opacity,
  blur,
  displace,
  backgroundOpacity,
  saturation,
  redOffset,
  greenOffset,
  blueOffset,
  xChannel,
  yChannel,
  mixBlendMode,
  style = {}, 
  className = "", 
  ...props 
}) {
  return (
    <div
      className={`relative overflow-hidden ${className}`}
      style={{
        ...style,
        width: typeof width === "number" ? `${width}px` : width,
        height: typeof height === "number" ? `${height}px` : height,
        borderRadius: typeof borderRadius === "number" ? `${borderRadius}px` : borderRadius,
        // L'effet Glassmorphism pur en CSS (Béton armé)
        backgroundColor: "rgba(255, 255, 255, 0.03)",
        backdropFilter: "blur(20px) saturate(180%)",
        WebkitBackdropFilter: "blur(20px) saturate(180%)",
        border: "1px solid rgba(255, 255, 255, 0.08)",
        boxShadow: "inset 0 1px 1px rgba(255, 255, 255, 0.1), 0 8px 32px rgba(0, 0, 0, 0.4)",
      }}
      // Ici, props ne contient plus les erreurs car on les a sorties au-dessus
      {...props}
    >
      {/* Texture de grain pour le côté premium "verre" */}
      <div 
        className="absolute inset-0 pointer-events-none opacity-[0.03] mix-blend-overlay"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`,
        }}
      />
      
      {/* Contenu (icônes, texte) */}
      <div className="relative z-10 w-full h-full flex items-center justify-center">
        {children}
      </div>
    </div>
  );
}