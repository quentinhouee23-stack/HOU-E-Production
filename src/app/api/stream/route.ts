import { NextResponse } from "next/server";

export const runtime = "nodejs";

const PIPED_API = "https://pipedapi.kavin.rocks";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const videoId = searchParams.get("videoId");

  if (!videoId) {
    return NextResponse.json({ error: "videoId manquant" }, { status: 400 });
  }

  try {
    const res = await fetch(`${PIPED_API}/streams/${videoId}`, {
      headers: { "User-Agent": "Mozilla/5.0" },
      next: { revalidate: 3600 },
    });

    if (res.ok) {
      const data = await res.json();
      const audioStreams = data.audioStreams || [];
      const bestAudio = audioStreams.find((s: any) => s.format === "M4A" || s.mimeType?.includes("audio/mp4")) || audioStreams[0];

      if (bestAudio?.url) {
        return NextResponse.redirect(bestAudio.url, 302);
      }
    }
  } catch {}

  // Fallback direct format Invidious
  return NextResponse.redirect(`https://yt.artemislena.eu/latest_version?id=${videoId}&itag=140`, 302);
}