import { NextResponse } from "next/server";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    // On récupère uniquement la vraie liste des sorties dynamiques
    const res = await fetch('https://api.deezer.com/editorial/0/releases');
    const data = await res.json();

    let albums = [];

    if (data.data && data.data.length > 0) {
      const top15 = data.data.slice(0, 15);
      
      // L'API scanne chaque album pour trouver son genre musical
      albums = await Promise.all(top15.map(async (item: any) => {
        let genre = "Musique"; // Genre par défaut
        
        try {
          const detailRes = await fetch(`https://api.deezer.com/album/${item.id}`);
          const detailData = await detailRes.json();
          
          if (detailData.genres && detailData.genres.data && detailData.genres.data.length > 0) {
            genre = detailData.genres.data[0].name; 
          }
        } catch (err) {
          console.error("Erreur récupération genre", err);
        }

        let formattedDate = "Nouveauté";
        if (item.release_date) {
          const d = new Date(item.release_date);
          formattedDate = d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
        }

        return {
          id: item.id.toString(),
          title: item.title,
          artist: item.artist?.name || "Artiste",
          image: item.cover_xl || item.cover_medium || "",
          date: formattedDate,
          genre: genre,
          status: "new"
        };
      }));
    }

    // On renvoie uniquement les vrais albums dynamiques
    return NextResponse.json({ albums: albums });

  } catch (error) {
    console.error("Erreur Releases API :", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}