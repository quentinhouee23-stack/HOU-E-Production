import { NextResponse } from "next/server";
// @ts-ignore
import yts from "yt-search";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const theme = searchParams.get("theme");
  const refTrack = searchParams.get("ref");

  try {
    // 🎯 On change le prompt : on demande explicitement des "Official Audio" 
    // et on retire les mots "mix" ou "playlist" qui ramènent des vidéos de 1h.
    const query = `${theme || ""} ${refTrack || ""} official audio`;
    const r = await yts(query);

    // 🛡️ FILTRE CRUCIAL : On ne prend que les vidéos de moins de 10 minutes
    // pour être certain d'avoir des chansons individuelles.
    const individualTracks = r.videos
      .filter((v: any) => v.seconds < 600 && v.seconds > 30) 
      .slice(0, 12)
      .map((video: any) => ({
        id: video.videoId,
        title: video.title.replace(/\(Official.*?\)|\[Official.*?\]/gi, ""), // Nettoyage titre
        artist: video.author?.name || "Artiste",
        image: video.thumbnail,
        duration: video.timestamp,
        url: video.url
      }));

    return NextResponse.json({ suggestions: individualTracks });
  } catch (error) {
    return NextResponse.json({ error: "Erreur suggestions" }, { status: 500 });
  }
}