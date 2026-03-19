import { NextResponse } from "next/server";

function formatDuration(seconds: number) {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s < 10 ? '0' : ''}${s}`;
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");

  if (!id) return NextResponse.json({ tracks: [] });

  try {
    const res = await fetch(`https://api.deezer.com/album/${id}`);
    const data = await res.json();

    if (!data.tracks || !data.tracks.data) {
      return NextResponse.json({ tracks: [] });
    }

    const tracks = data.tracks.data.map((t: any) => ({
      id: t.id.toString(),
      title: t.title,
      artist: t.artist.name,
      image: data.cover_xl || data.cover_medium,
      duration: formatDuration(t.duration),
      preview: t.preview // 🟢 AJOUT DE LA PRÉVISUALISATION ICI
    }));

    return NextResponse.json({ tracks });
  } catch (error) {
    console.error("Erreur API Album:", error);
    return NextResponse.json({ error: "Erreur" }, { status: 500 });
  }
}