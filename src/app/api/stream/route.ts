import YTDlpWrap from "yt-dlp-wrap";
import { join } from "path";
import { existsSync, mkdirSync } from "fs";

export const runtime = "nodejs";
export const maxDuration = 60;

async function getYtDlp(): Promise<YTDlpWrap> {
  if (process.env.RENDER || process.env.NODE_ENV === "production") {
    return new YTDlpWrap(process.env.YTDLP_PATH || "/usr/local/bin/yt-dlp");
  }

  const binDir = join(process.cwd(), "bin");
  const exeName = process.platform === "win32" ? "yt-dlp.exe" : "yt-dlp";
  const localPath = join(binDir, exeName);

  if (!existsSync(localPath)) {
    if (!existsSync(binDir)) mkdirSync(binDir, { recursive: true });
    console.log("Téléchargement de yt-dlp...");
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
    
    // On sécurise la recherche des cookies (Next.js a tendance à les perdre en route)
    let cookiesPath = join(process.cwd(), "cookies.txt");
    if (!existsSync(cookiesPath)) cookiesPath = "/app/cookies.txt";

    // ASTUCE ANTI-429 : On passe sur iOS au lieu d'Android
    const ytArgs = [
      url,
      "-f", "bestaudio[ext=m4a]/bestaudio",
      "--no-playlist",
      "-j", 
      "--js-runtimes", "node",
      "--extractor-args", "youtube:player_client=ios", 
    ];

    if (existsSync(cookiesPath)) {
      ytArgs.push("--cookies", cookiesPath);
      console.log("[stream] Cookies trouvés et activés !");
    } else {
      console.log("[stream] ATTENTION : Cookies introuvables au chemin", cookiesPath);
    }

    const rawOutput = await ytDlp.execPromise(ytArgs);
    const info = JSON.parse(rawOutput.trim().split("\n").pop()!);

    const chosen = info?.requested_downloads?.[0] ?? info;
    const audioUrl: string | undefined = chosen?.url;
    const ytHeaders: Record<string, string> = chosen?.http_headers || info?.http_headers || {};

    if (!audioUrl?.startsWith("http")) {
      console.error("[stream] Pas d'URL dans la sortie yt-dlp");
      return new Response("URL audio introuvable", { status: 404 });
    }

    const rangeHeader = req.headers.get("range");

    const upstream = await fetch(audioUrl, {
      headers: {
        ...ytHeaders,
        ...(rangeHeader ? { Range: rangeHeader } : {}),
      },
    });

    if (!upstream.ok && upstream.status !== 206) {
      const bodyText = await upstream.text().catch(() => "");
      console.error("[stream] Upstream a refusé:", upstream.status, bodyText.slice(0, 300));
      return new Response(`Upstream ${upstream.status}`, { status: upstream.status });
    }

    const responseHeaders = new Headers({
      "Content-Type": "audio/mp4",
      "Accept-Ranges": "bytes",
      "Access-Control-Allow-Origin": "*",
      "Cache-Control": "no-store",
    });

    const contentLength = upstream.headers.get("Content-Length");
    const contentRange = upstream.headers.get("Content-Range");
    const contentType = upstream.headers.get("Content-Type");
    
    if (contentLength) responseHeaders.set("Content-Length", contentLength);
    if (contentRange) responseHeaders.set("Content-Range", contentRange);
    if (contentType) responseHeaders.set("Content-Type", contentType);

    return new Response(upstream.body, {
      status: upstream.status,
      headers: responseHeaders,
    });

  } catch (e: any) {
    console.error("[stream] Erreur brute:", e?.message || e);
    return new Response(`Erreur: ${e?.message || "inconnue"}`, { status: 500 });
  }
}