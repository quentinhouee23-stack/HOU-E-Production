import { NextResponse } from "next/server";

function formatDuration(seconds: number) {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s < 10 ? '0' : ''}${s}`;
}

export async function GET(req: Request) {
  // 🟢 DÉMARRAGE DU CHRONOMÈTRE DE SÉCURITÉ VERCEL
  const startTime = Date.now();

  const { searchParams } = new URL(req.url);
  const vibe = searchParams.get("vibe") || "chill";
  const targetDuration = parseInt(searchParams.get("duration") || "1800"); 
  const isDiscovery = searchParams.get("discovery") === "true";

  try {
    let allTracks: any[] = [];
    let currentDurationSec = 0;
    
    let offset = isDiscovery ? Math.floor(Math.random() * 50) + 30 : 0;
    let loops = 0;

    while (currentDurationSec < targetDuration && loops < 5) {
      
      // 🟢 ARRÊT D'URGENCE SI ON ATTEINT 8 SECONDES
      if (Date.now() - startTime > 8000) {
        console.log("⏱️ Sécurité Vercel : Arrêt prématuré à 8 secondes");
        break;
      }

      const res = await fetch(`https://api.deezer.com/search?q=${encodeURIComponent(vibe)}&limit=50&index=${offset}`);
      const data = await res.json();

      if (!data.data || data.data.length === 0) {
        if (offset > 0) {
          offset = 0;
          loops++; 
          continue; 
        } else {
          break;
        }
      }

      const batch = data.data.sort(() => 0.5 - Math.random());

      for (const t of batch) {
        if (currentDurationSec >= targetDuration) break;
        
        if (t.duration > 300) continue;
        
        if (!allTracks.find(existing => existing.id === t.id.toString())) {
          allTracks.push({
            id: t.id.toString(),
            title: t.title,
            artist: t.artist.name,
            image: t.album.cover_xl || t.album.cover_medium,
            duration: formatDuration(t.duration),
            seconds: t.duration,
            preview: t.preview 
          });
          currentDurationSec += t.duration;
        }
      }
      
      offset += 50;
      loops++;
    }

    return NextResponse.json({ 
      tracks: allTracks, 
      totalSeconds: currentDurationSec 
    });

  } catch (error) {
    console.error("Erreur Smart Playlist:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}