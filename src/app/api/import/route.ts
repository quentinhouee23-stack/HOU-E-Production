// @ts-nocheck
import { NextResponse } from "next/server";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const url = searchParams.get("url");

  if (!url) return NextResponse.json({ error: "URL manquante" }, { status: 400 });

  try {
    let searchQuery = "";

    if (url.includes("tiktok")) {
      try {
        const tikRes = await fetch(`https://www.tikwm.com/api/?url=${encodeURIComponent(url)}`);
        const tikData = await tikRes.json();
        
        if (tikData?.data?.music_info) {
          const title = tikData.data.music_info.title;
          const author = tikData.data.music_info.author;
          
          // 🟢 LA RÈGLE D'OR : On ne devine plus les sons originaux !
          const isOriginal = title.toLowerCase().includes("original") || title.toLowerCase().includes("son original");
          
          if (isOriginal) {
             return NextResponse.json({ error: "original_sound" }, { status: 400 });
          } else {
             searchQuery = `${title} ${author}`;
          }
        }
      } catch (e) {
        console.log("Échec TikWM");
      }
    }

    if (!searchQuery && url.includes("tiktok")) {
      try {
        const oembedRes = await fetch(`https://www.tiktok.com/oembed?url=${encodeURIComponent(url)}`);
        const oembedData = await oembedRes.json();
        const match = oembedData?.title?.match(/♬(.*)/);
        
        if (match && match[1]) {
          searchQuery = match[1];
          if (searchQuery.toLowerCase().includes("original")) {
             return NextResponse.json({ error: "original_sound" }, { status: 400 });
          }
        }
      } catch (e) {
        console.log("Échec oEmbed");
      }
    }

    if (!searchQuery) {
       return NextResponse.json({ error: "protected_link" }, { status: 400 });
    }

    searchQuery = searchQuery
      .replace(/on TikTok/gi, "")
      .replace(/#\w+/g, " ")
      .replace(/@\w+/g, " ")
      .replace(/-/g, " ")
      .trim();

    let deezerRes = await fetch(`https://api.deezer.com/search?q=${encodeURIComponent(searchQuery)}&limit=1`);
    let deezerData = await deezerRes.json();

    if (!deezerData.data || deezerData.data.length === 0) {
      const shortQuery = searchQuery.split(" ").filter(w => w.length > 2).slice(0, 3).join(" ");
      deezerRes = await fetch(`https://api.deezer.com/search?q=${encodeURIComponent(shortQuery)}&limit=1`);
      deezerData = await deezerRes.json();
    }

    if (!deezerData.data || deezerData.data.length === 0) {
       return NextResponse.json({ error: "not_on_deezer" }, { status: 404 });
    }

    const item = deezerData.data[0];
    const minutes = Math.floor(item.duration / 60);
    const seconds = Math.floor(item.duration % 60);

    return NextResponse.json({
      track: {
        id: item.id.toString(),
        title: item.title,
        artist: item.artist.name,
        image: item.album.cover_xl || item.album.cover_medium,
        preview: item.preview,
        duration: `${minutes}:${seconds < 10 ? "0" : ""}${seconds}`
      }
    });

  } catch (error) {
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}