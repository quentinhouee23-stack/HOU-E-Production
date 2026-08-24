import { NextResponse } from "next/server";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    let albums = [];

    // 1. On tente de récupérer les sorties de l'éditorial
    let res = await fetch('https://api.deezer.com/editorial/0/releases');
    let data = await res.json();

    // 2. Si l'éditorial est vide, on tape dans les charts ou une recherche générale pour garantir des données
    if (!data.data || data.data.length === 0) {
      res = await fetch('https://api.deezer.com/chart/0/albums');
      data = await res.json();
    }

    const items = data.data || data.albums?.data || [];

    if (items.length > 0) {
      const top15 = items.slice(0, 15);
      
      albums = top15.map((item: any) => {
        let formattedDate = "Nouveauté";
        if (item.release_date) {
          const d = new Date(item.release_date);
          if (!isNaN(d.getTime())) {
            formattedDate = d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
          }
        }

        return {
          id: item.id.toString(),
          title: item.title,
          artist: item.artist?.name || "Artiste",
          image: item.cover_xl || item.cover_medium || item.cover || "",
          date: formattedDate,
          genre: item.genre_id ? "Musique" : "Exclusivité",
          status: "new"
        };
      });
    }

    return NextResponse.json({ albums });

  } catch (error) {
    console.error("Erreur Releases API :", error);
    return NextResponse.json({ albums: [] }, { status: 200 });
  }
}