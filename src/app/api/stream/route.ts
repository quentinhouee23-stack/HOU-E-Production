import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const maxDuration = 30;

const STREAM_APIS = [
  // Instances Invidious
  {
    url: (id: string) => `https://invidious.privacydev.net/api/v1/videos/${id}`,
    extract: (data: any) => {
      const formats = data.adaptiveFormats?.filter((f: any) => f.type?.includes("audio")) || [];
      return formats[0]?.url;
    },
  },
  {
    url: (id: string) => `https://inv.tux.pizza/api/v1/videos/${id}`,
    extract: (data: any) => {
      const formats = data.adaptiveFormats?.filter((f: any) => f.type?.includes("audio")) || [];
      return formats[0]?.url;
    },
  },
  {
    url: (id: string) => `https://yt.artemislena.eu/api/v1/videos/${id}`,
    extract: (data: any) => {
      const formats = data.adaptiveFormats?.filter((f: any) => f.type?.includes("audio")) || [];
      return formats[0]?.url;
    },
  },
  // Instances Piped
  {
    url: (id: string) => `https://pipedapi.kavin.rocks/streams/${id}`,
    extract: (data: any) => data.audioStreams?.[0]?.url,
  },
  {
    url: (id: string) => `https://api.piped.privacydev.net/streams/${id}`,
    extract: (data: any) => data.audioStreams?.[0]?.url,
  },
];

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const videoId = searchParams.get("videoId");

  if (!videoId) {
    return NextResponse.json({ error: "Paramètre videoId manquant" }, { status: 400 });
  }

  for (const api of STREAM_APIS) {
    try {
      const endpoint = api.url(videoId);
      const res = await fetch(endpoint, {
        headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)" },
        signal: AbortSignal.timeout(4000),
      });

      if (!res.ok) continue;

      const data = await res.json();
      const directAudioUrl = api.extract(data);

      if (directAudioUrl && directAudioUrl.startsWith("http")) {
        // Redirection 302 directe vers le CDN audio pour une lecture instantanée sans saturer Vercel
        return NextResponse.redirect(directAudioUrl, 302);
      }
    } catch (e: any) {
      console.warn(`[stream fallback] ${api.url(videoId)} failed:`, e.message);
      continue;
    }
  }

  return NextResponse.json(
    { error: "Impossible de récupérer le flux audio parmi les instances disponibles." },
    { status: 502 }
  );
}