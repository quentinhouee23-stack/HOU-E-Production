"use client";

import { useEffect, useState } from "react";

export function ServerWakeUp() {
  const [isAwake, setIsAwake] = useState(false);

  useEffect(() => {
    const wake = async () => {
      try {
        const res = await fetch("/api/health");
        if (res.ok) setIsAwake(true);
        else setTimeout(wake, 3000);
      } catch {
        setTimeout(wake, 3000);
      }
    };
    wake();
  }, []);

  // Petit indicateur discret en bas de l'écran
  if (isAwake) return null;

  return (
    <div style={{
      position: "fixed",
      bottom: "80px", // au-dessus du player
      left: "50%",
      transform: "translateX(-50%)",
      background: "#1a1a1a",
      border: "1px solid #333",
      borderRadius: "20px",
      padding: "8px 16px",
      display: "flex",
      alignItems: "center",
      gap: "8px",
      zIndex: 9999,
      fontSize: "12px",
      color: "#888",
    }}>
      <div style={{
        width: "8px", height: "8px",
        borderRadius: "50%",
        background: "#f59e0b",
        animation: "pulse 1.5s ease-in-out infinite",
      }} />
      Serveur en démarrage…
      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.3; }
        }
      `}</style>
    </div>
  );
}