import { NextResponse } from "next/server";
import ytSearch from "yt-search";

export async function GET(req: Request) {
  // 🟢 LE VIGILE DE SÉCURITÉ : Vérifie d'où vient la requête
  const referer = req.headers.get("referer") || "";
  const host = req.headers.get("host") || "";
  
  // En production, si la requête ne vient pas de ton propre site, on bloque !
  if (process.env.NODE_ENV === "production" && !referer.includes(host)) {
    return NextResponse.json({ error: "Accès non autorisé. Réservé à l'application HOUÉE." }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const q = searchParams.get("q");

  if (!q) {
    return NextResponse.json({ error: "Recherche vide" }, { status: 400 });
  }

  try {
    const results = await ytSearch(q);
    const videos = results.videos;

    if (!videos || videos.length === 0) {
      return NextResponse.json({ error: "Aucun résultat" }, { status: 404 });
    }

    // On filtre : on veut une vidéo entre 1 minute et 9 minutes maximum !
    const validVideo = videos.find((video) => {
      const duration = video.seconds;
      return duration >= 60 && duration <= 540;
    });

    if (validVideo) {
      return NextResponse.json({ videoId: validVideo.videoId });
    } 
    
    // S'il n'y a que des vidéos hors durée (très rare), on prend la première
    return NextResponse.json({ videoId: videos[0].videoId });

  } catch (error) {
    console.error("Erreur YouTube API :", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}