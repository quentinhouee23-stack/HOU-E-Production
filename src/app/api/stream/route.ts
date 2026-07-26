import YTDlpWrap from "yt-dlp-wrap";
import { join } from "path";
import { existsSync, mkdirSync } from "fs";

export const runtime = "nodejs";
export const maxDuration = 60;

// CACHE RAM : Mémorise l'URL audio pendant 4 heures
const urlCache = new Map<string, { url: string; expires: number }>();

async function getYtDlp(): Promise<YTDlpWrap> {
  if (process.env.YTDLP_PATH) {
    return new YTDlpWrap(process.env.YTDLP_PATH);
  }

  const binDir = join(process.cwd(), "bin");
  const exeName = process.platform === "win32" ? "yt-dlp.exe" : "yt-dlp";
  const localPath = join(binDir, exeName);

  if (!existsSync(localPath)) {
    if (!existsSync(binDir)) mkdirSync(binDir, { recursive: true });
    await YTDlpWrap.downloadFromGithub(localPath);
  }

  return new YTDlpWrap(localPath);
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const videoId = searchParams.get("videoId");
  if (!videoId) return new Response("Missing videoId", { status: 400 });

  try {
    const now = Date.now();
    let audioUrl = "";

    // On vérifie si on a déjà extrait cette musique récemment
    const cached = urlCache.get(videoId);
    if (cached && cached.expires > now) {
      audioUrl = cached.url; // Extraction instantanée en 0 seconde !
    } else {
      const ytDlp = await getYtDlp();
      const url = `https://www.youtube.com/watch?v=${videoId}`;

      const ytArgs = [
        url,
        "--get-url",
        "-f", "140/bestaudio",
        "--no-playlist",
        "--no-warnings",
        "--no-check-certificates"
      ];

      const rawOutput = await ytDlp.execPromise(ytArgs);
      audioUrl = rawOutput.trim().split("\n")[0];

      if (!audioUrl?.startsWith("http")) {
        return new Response("URL audio introuvable", { status: 404 });
      }

      // On mémorise l'URL pour les 4 prochaines heures (durée de validité chez Google)
      urlCache.set(videoId, { url: audioUrl, expires: now + 4 * 60 * 60 * 1000 });
    }

    const rangeHeader = req.headers.get("range");

    const upstream = await fetch(audioUrl, {
      headers: {
        ...(rangeHeader ? { Range: rangeHeader } : {}),
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      },
    });

    const responseHeaders = new Headers({
      "Content-Type": "audio/mp4",
      "Accept-Ranges": "bytes",
      "Access-Control-Allow-Origin": "*",
    });

    const contentLength = upstream.headers.get("Content-Length");
    const contentRange = upstream.headers.get("Content-Range");
    
    if (contentLength) responseHeaders.set("Content-Length", contentLength);
    if (contentRange) responseHeaders.set("Content-Range", contentRange);

    return new Response(upstream.body, {
      status: upstream.status,
      headers: responseHeaders,
    });

  } catch (e: any) {
    return new Response(`Erreur: ${e.message}`, { status: 500 });
  }
}