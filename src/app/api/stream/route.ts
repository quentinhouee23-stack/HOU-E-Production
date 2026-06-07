import YTDlpWrap from "yt-dlp-wrap";
import { join } from "path";
import { existsSync } from "fs";

export const runtime = "nodejs";
export const maxDuration = 60;

async function getYtDlp(): Promise<YTDlpWrap> {
  // 1. Si la variable Docker existe (donc on est sur Render / Linux)
  if (process.env.YTDLP_PATH) {
    return new YTDlpWrap(process.env.YTDLP_PATH);
  }

  // 2. Sinon, on est sur ton PC en développement (Windows)
  const binPathExe = join(process.cwd(), "bin", "yt-dlp.exe");
  return new YTDlpWrap(binPathExe);
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const videoId = searchParams.get("videoId");
  if (!videoId) return new Response("Missing videoId", { status: 400 });

  try {
    const ytDlp = await getYtDlp();
    const url = `https://www.youtube.com/watch?v=${videoId}`;

    // Étape 1 : récupère l'URL audio signée
    const rawOutput = await ytDlp.execPromise([
      url,
      "--get-url",
      "-f", "bestaudio[ext=m4a]/140/bestaudio",
      "--no-playlist",
    ]);

    const audioUrl = rawOutput.trim().split("\n")[0];
    if (!audioUrl?.startsWith("http")) {
      return new Response("URL audio introuvable", { status: 404 });
    }

    // Étape 2 : relay avec Range requests (vital pour iPhone/Safari)
    const rangeHeader = req.headers.get("range");

    const upstream = await fetch(audioUrl, {
      headers: {
        ...(rangeHeader ? { Range: rangeHeader } : {}),
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        "Referer": "https://www.youtube.com/",
        "Origin": "https://www.youtube.com",
      },
    });

    const responseHeaders = new Headers({
      "Content-Type": "audio/mp4",
      "Accept-Ranges": "bytes",
      "Access-Control-Allow-Origin": "*",
      "Cache-Control": "no-store",
    });

    // CRUCIAL pour la fluidité : Content-Length et Content-Range
    const contentLength = upstream.headers.get("Content-Length");
    const contentRange = upstream.headers.get("Content-Range");
    const contentType = upstream.headers.get("Content-Type");
    if (contentLength) responseHeaders.set("Content-Length", contentLength);
    if (contentRange) responseHeaders.set("Content-Range", contentRange);
    if (contentType) responseHeaders.set("Content-Type", contentType);

    return new Response(upstream.body, {
      status: upstream.status, // 200 ou 206
      headers: responseHeaders,
    });

  } catch (e: any) {
    console.error("[stream] Erreur:", e.message);
    return new Response(`Erreur: ${e.message}`, { status: 500 });
  }
}