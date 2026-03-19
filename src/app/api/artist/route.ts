import { NextResponse } from "next/server";

function formatDuration(seconds: number) {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s < 10 ? '0' : ''}${s}`;
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");

  if (!id) return NextResponse.json({ topTracks: [], albums: [] });

  try {
    const [topRes, albumsRes] = await Promise.all([
      fetch(`https://api.deezer.com/artist/${id}/top?limit=15`),
      fetch(`https://api.deezer.com/artist/${id}/albums?limit=50`)
    ]);

    const topData = await topRes.json();
    const albumsData = await albumsRes.json();

    const topTracks = (topData.data || []).map((t: any) => ({
      id: t.id.toString(),
      title: t.title,
      artist: t.artist.name,
      image: t.album.cover_xl || t.album.cover_medium,
      duration: formatDuration(t.duration),
      preview: t.preview // 🟢 AJOUT DE LA PRÉVISUALISATION ICI
    }));

    const uniqueAlbumsMap = new Map();
    (albumsData.data || []).forEach((a: any) => {
      if (!uniqueAlbumsMap.has(a.title)) {
        uniqueAlbumsMap.set(a.title, {
          id: a.id.toString(),
          title: a.title,
          image: a.cover_xl || a.cover_medium,
          year: a.release_date ? a.release_date.split('-')[0] : ""
        });
      }
    });
    const albums = Array.from(uniqueAlbumsMap.values());

    return NextResponse.json({ topTracks, albums });
  } catch (error) {
    console.error("Erreur API Artist:", error);
    return NextResponse.json({ error: "Erreur" }, { status: 500 });
  }
}