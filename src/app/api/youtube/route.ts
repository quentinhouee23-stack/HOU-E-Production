import { NextResponse } from "next/server";
import ytSearch from "yt-search";

export async function GET(req: Request) {
  // 🟢 LE VIGILE DE SÉCURITÉ : Vérifie d'où vient la requête
  const referer = req.headers.get("referer") || "";
  const host = req.headers.get("host") || "";
  
  if (process.env.NODE_ENV === "production" && !referer.includes(host)) {
    return NextResponse.json({ error: "Accès non autorisé. Réservé à l'application HOUÉE." }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const q = searchParams.get("q");

  if (!q) {
    return NextResponse.json({ error: "Recherche vide" }, { status: 400 });
  }

  try {
    // ==========================================
    // 🌍 PLAN A : Le scraper gratuit (yt-search)
    // ==========================================
    const results = await ytSearch(q);
    const videos = results.videos;

    if (videos && videos.length > 0) {
      const validVideo = videos.find((video) => {
        const duration = video.seconds;
        return duration >= 60 && duration <= 540;
      });

      if (validVideo) {
        return NextResponse.json({ videoId: validVideo.videoId });
      } 
      return NextResponse.json({ videoId: videos[0].videoId });
    }

    throw new Error("yt-search n'a retourné aucun résultat valide.");

  } catch (error) {
    console.warn("⚠️ Le Plan A (yt-search) a échoué. Activation du Plan B (API Officielle).");

    // ==========================================
    // 🚀 PLAN B : L'API Officielle YouTube (Ta nouvelle clé !)
    // ==========================================
    const apiKey = process.env.YOUTUBE_API_KEY;

    if (!apiKey) {
      console.error("❌ Clé YOUTUBE_API_KEY manquante dans les variables d'environnement !");
      return NextResponse.json({ error: "Erreur serveur : Recherche indisponible." }, { status: 500 });
    }

    try {
      const fallbackUrl = `https://www.googleapis.com/youtube/v3/search?part=snippet&type=video&videoCategoryId=10&maxResults=3&q=${encodeURIComponent(q)}&key=${apiKey}`;
      const fallbackRes = await fetch(fallbackUrl);
      const fallbackData = await fallbackRes.json();

      if (fallbackData.items && fallbackData.items.length > 0) {
        return NextResponse.json({ videoId: fallbackData.items[0].id.videoId });
      }

      return NextResponse.json({ error: "Aucun résultat trouvé même avec le mode de secours." }, { status: 404 });

    } catch (fallbackError) {
      console.error("❌ Le Plan B a crashé :", fallbackError);
      return NextResponse.json({ error: "Erreur serveur globale." }, { status: 500 });
    }
  }
}