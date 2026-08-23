import ytSearch from "yt-search";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

const searchCache = new Map<string, string>();

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q");

  if (!q) {
    return NextResponse.json({ error: "Paramètre q manquant" }, { status: 400 });
  }

  const cached = searchCache.get(q);
  if (cached) {
    return NextResponse.json({ videoId: cached });
  }

  try {
    const searchResults = await ytSearch(q);
    const videos = searchResults.videos;

    if (!videos || videos.length === 0) {
      return NextResponse.json({ error: "Aucun résultat trouvé" }, { status: 404 });
    }

    const videoId = videos[0].videoId;
    searchCache.set(q, videoId);

    return NextResponse.json({ videoId });
  } catch (error: any) {
    console.error("[youtube-search-error]:", error);
    return NextResponse.json(
      { error: `Erreur lors de la recherche: ${error.message || "inconnue"}` },
      { status: 500 }
    );
  }
}