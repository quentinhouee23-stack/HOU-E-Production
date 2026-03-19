import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const url = searchParams.get("url");

  if (!url || !url.includes("spotify.com/playlist/")) {
    return NextResponse.json({ error: "Lien Spotify invalide." }, { status: 400 });
  }

  try {
    const match = url.match(/playlist\/([a-zA-Z0-9]+)/);
    if (!match) {
      return NextResponse.json({ error: "ID de playlist introuvable." }, { status: 400 });
    }
    const playlistId = match[1];

    // 🟢 LE BOUCLIER : On met le résultat en cache pendant 24h (86400 secondes)
    const res = await fetch(`https://open.spotify.com/embed/playlist/$${playlistId}`, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
      },
      next: { revalidate: 86400 } 
    });
    
    if (!res.ok) {
      return NextResponse.json({ error: "Impossible de lire la playlist Spotify. Elle est peut-être privée." }, { status: 403 });
    }

    const html = await res.text();
    const jsonMatch = html.match(/<script id="__NEXT_DATA__" type="application\/json">(.*?)<\/script>/);
    
    if (!jsonMatch) {
      return NextResponse.json({ error: "Structure de la page Spotify non reconnue ou modifiée." }, { status: 500 });
    }

    const data = JSON.parse(jsonMatch[1]);
    const entity = data?.props?.pageProps?.state?.data?.entity;
    
    if (!entity || !entity.trackList) {
      return NextResponse.json({ error: "Aucun titre trouvé dans cette playlist." }, { status: 404 });
    }

    const playlistName = entity.name || "Playlist Spotify Importée";
    const trackList = entity.trackList;

    const tracks = trackList.map((t: any) => ({
      title: t.title,
      artist: t.subtitle,
      image: t.coverArt?.sources?.[0]?.url || ""
    }));

    return NextResponse.json({ name: playlistName, tracks: tracks });

  } catch (error) {
    console.error("Erreur lors du scraping Spotify :", error);
    return NextResponse.json({ error: "Erreur interne du serveur lors de l'importation." }, { status: 500 });
  }
}