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
    const searchUrl = `https://www.youtube.com/results?search_query=${encodeURIComponent(q)}`;
    const res = await fetch(searchUrl, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
        "Accept-Language": "fr-FR,fr;q=0.9,en-US;q=0.8,en;q=0.7",
      },
    });

    const html = await res.text();
    const match = html.match(/"videoId":"([a-zA-Z0-9_-]{11})"/);

    if (!match || !match[1]) {
      return NextResponse.json({ error: "Aucun résultat trouvé" }, { status: 404 });
    }

    const videoId = match[1];
    searchCache.set(q, videoId);

    return NextResponse.json({ videoId });
  } catch (error: any) {
    console.error("[youtube-search-error]:", error);
    return NextResponse.json(
      { error: `Erreur recherche: ${error.message || "inconnue"}` },
      { status: 500 }
    );
  }
}