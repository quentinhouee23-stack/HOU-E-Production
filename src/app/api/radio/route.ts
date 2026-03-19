// @ts-nocheck
import { NextResponse } from "next/server";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const trackId = searchParams.get("id");
  const artistName = searchParams.get("artist");

  if (!trackId) return NextResponse.json({ error: "ID manquant" }, { status: 400 });

  try {
    let res = await fetch(`https://api.deezer.com/track/${trackId}/radio`);
    let data = await res.json();

    if (!data.data || data.data.length === 0) {
      res = await fetch(`https://api.deezer.com/search?q=artist:"${encodeURIComponent(artistName || '')}"`);
      data = await res.json();
    }

    if (!data.data || data.data.length === 0) {
      return NextResponse.json({ tracks: [] }, { status: 404 });
    }

    // 🟢 LE FILTRE STRICT : On applique la même règle d'or pour la radio
    const validTracks = data.data.filter((item: any) => item.duration <= 300);

    if (validTracks.length === 0) {
      return NextResponse.json({ tracks: [] }, { status: 404 });
    }

    const tracks = validTracks.map((item: any) => {
      const minutes = Math.floor(item.duration / 60);
      const seconds = Math.floor(item.duration % 60);
      return {
        id: item.id.toString(),
        title: item.title,
        artist: item.artist?.name || artistName,
        image: item.album?.cover_xl || item.album?.cover_medium,
        duration: `${minutes}:${seconds < 10 ? "0" : ""}${seconds}`,
        preview: item.preview
      };
    });

    return NextResponse.json({ tracks });

  } catch (error) {
    console.error("Erreur Radio API :", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}