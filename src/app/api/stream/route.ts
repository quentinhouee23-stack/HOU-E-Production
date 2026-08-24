import { NextRequest, NextResponse } from "next/server";
import ytdl from "@distube/ytdl-core";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const videoId = request.nextUrl.searchParams.get("videoId");

  if (!videoId) {
    return new NextResponse("Video ID manquant", { status: 400 });
  }

  try {
    const url = `https://www.youtube.com/watch?v=${videoId}`;
    
    // Récupérer les informations de la vidéo pour trouver le meilleur format audio
    const info = await ytdl.getInfo(url);
    const format = ytdl.chooseFormat(info.formats, { quality: "highestaudio" });

    if (!format || !format.url) {
      return new NextResponse("Flux audio introuvable", { status: 404 });
    }

    // On redirige silencieusement le lecteur audio vers l'URL brute du serveur de Google
    // Cette URL est valide pour l'IP qui la demande pendant quelques heures
    return NextResponse.redirect(format.url, 302);
    
  } catch (error) {
    console.error("[Stream API Error]", error);
    return new NextResponse("Erreur d'extraction", { status: 500 });
  }
}