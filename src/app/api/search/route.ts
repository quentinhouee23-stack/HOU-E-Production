// @ts-nocheck
import { NextResponse } from "next/server";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const q = searchParams.get("q");

  if (!q) {
    return NextResponse.json({ error: "Recherche vide" }, { status: 400 });
  }

  try {
    // 🟢 LE BOUCLIER : On met en cache les résultats de recherche pendant 7 jours (604800 secondes)
    const res = await fetch(`https://api.deezer.com/search?q=${encodeURIComponent(q)}`, {
      next: { revalidate: 604800 }
    });
    const data = await res.json();

    if (!data.data || data.data.length === 0) {
      return NextResponse.json({ tracks: [], artists: [] }, { status: 404 });
    }

    const validTracks = data.data.filter((item: any) => item.duration <= 300);
    const artistsMap = new Map();
    
    const tracks = validTracks.map((item: any) => {
      if (!artistsMap.has(item.artist.id)) {
        artistsMap.set(item.artist.id, {
          id: item.artist.id.toString(),
          name: item.artist.name,
          image: item.artist.picture_xl || item.artist.picture_medium,
        });
      }

      const minutes = Math.floor(item.duration / 60);
      const seconds = Math.floor(item.duration % 60);
      const formattedDuration = `${minutes}:${seconds < 10 ? "0" : ""}${seconds}`;

      return {
        id: item.id.toString(),
        title: item.title,
        artist: item.artist.name,
        image: item.album.cover_xl || item.album.cover_medium,
        duration: formattedDuration,
        preview: item.preview, 
      };
    });

    const artists = Array.from(artistsMap.values());
    return NextResponse.json({ tracks, artists });

  } catch (error) {
    console.error("Erreur Search API :", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}