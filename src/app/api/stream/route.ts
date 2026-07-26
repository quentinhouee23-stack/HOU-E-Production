import YTDlpWrap from "yt-dlp-wrap";
import { join } from "path";
import { existsSync, mkdirSync } from "fs";

export const runtime = "nodejs";
export const maxDuration = 60;

const COOKIES_PATH = "/etc/secrets/cookies.txt";

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
    const ytDlp = await getYtDlp();
    const url = `https://www.youtube.com/watch?v=${videoId}`;

    const ytArgs = [
      url,
      "--get-url",
      "-f", "140/bestaudio[ext=m4a]/bestaudio[acodec^=mp4a]",
      "--no-playlist",
      "--no-warnings",
      "--no-check-certificates",
    ];

    if (existsSync(COOKIES_PATH)) {
      ytArgs.push("--cookies", COOKIES_PATH);
    } else {
      console.warn("[stream] cookies.txt introuvable — YouTube va probablement bloquer");
    }

    const rawOutput = await ytDlp.execPromise(ytArgs);
    const audioUrl = rawOutput.trim().split("\n")[0];

    if (!audioUrl?.startsWith("http")) {
      return new Response("URL audio introuvable", { status: 404 });
    }

    const rangeHeader = req.headers.get("range");
    const upstream = await fetch(audioUrl, {
      headers: {
        ...(rangeHeader ? { Range: rangeHeader } : {}),
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
      },
    });

    const responseHeaders = new Headers({
      "Content-Type": "audio/mp4",
      "Accept-Ranges": "bytes",
      "Access-Control-Allow-Origin": "*",
      "Cache-Control": "no-store",
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
    console.error("[stream] message:", e.message, "stderr:", e.stderr);
    return new Response(`Erreur: ${e.message}`, { status: 500 });
  }
}