export const runtime = "nodejs";
export const maxDuration = 60;

const PIPED_INSTANCES = [
  "https://pipedapi.kavin.rocks",
  "https://api.piped.privacydev.net",
  "https://piped-api.garudalinux.org",
  "https://api-piped.mha.fi",
];

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const videoId = searchParams.get("videoId");

  if (!videoId) {
    return new Response("Paramètre videoId manquant", { status: 400 });
  }

  for (const instance of PIPED_INSTANCES) {
    try {
      const res = await fetch(`${instance}/streams/${videoId}`, {
        headers: { "User-Agent": "Mozilla/5.0" },
        signal: AbortSignal.timeout(6000),
      });

      if (!res.ok) continue;

      const data = await res.json();
      const audioStreams = data.audioStreams;

      if (!audioStreams || audioStreams.length === 0) continue;

      // On récupère le meilleur flux audio
      const bestAudio = audioStreams[0].url;

      const upstream = await fetch(bestAudio, {
        headers: {
          "User-Agent": "Mozilla/5.0",
          Accept: "*/*",
        },
      });

      if (!upstream.ok) continue;

      const headers = new Headers();
      headers.set("Content-Type", upstream.headers.get("content-type") || "audio/webm");
      headers.set("Accept-Ranges", "bytes");
      headers.set("Cache-Control", "no-store");

      return new Response(upstream.body, {
        status: upstream.status,
        headers,
      });
    } catch {
      continue;
    }
  }

  return new Response("Impossible de récupérer le flux audio (instances indisponibles)", {
    status: 500,
  });
}