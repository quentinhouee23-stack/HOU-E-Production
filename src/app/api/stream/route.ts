import YTDlpWrap from "yt-dlp-wrap";
import { join } from "path";
import { existsSync, mkdirSync } from "fs";

export const runtime = "nodejs";
export const maxDuration = 60; // sans effet sur Render (spécifique Vercel), mais inoffensif

async function getYtDlp(): Promise<YTDlpWrap> {
  const isProd = process.env.NODE_ENV === "production" || !!process.env.RENDER;
  const binDir = isProd ? "/tmp/yt-bin" : join(process.cwd(), "bin");
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
    const cookiesPath = join(process.cwd(), "cookies.txt");

    const ytArgs = [
      url,
      "-f", "bestaudio[ext=m4a]/bestaudio",
      "--no-playlist",
      "-j", // dump-json : donne l'URL + les http_headers exacts liés au client
      "--js-runtimes", "node",
      "--extractor-args", "youtube:player_client=android",
    ];

    if (existsSync(cookiesPath)) {
      ytArgs.push("--cookies", cookiesPath);
    }

    const rawOutput = await ytDlp.execPromise(ytArgs);
    const info = JSON.parse(rawOutput.trim().split("\n").pop()!);

    const chosen = info?.requested_downloads?.[0] ?? info;
    const audioUrl: string | undefined = chosen?.url;
    const ytHeaders: Record<string, string> = chosen?.http_headers || info?.http_headers || {};

    if (!audioUrl?.startsWith("http")) {
      console.error("[stream] Pas d'URL dans la sortie yt-dlp:", rawOutput.slice(0, 500));
      return new Response("URL audio introuvable", { status: 404 });
    }

    const rangeHeader = req.headers.get("range");

    // On réutilise EXACTEMENT les headers que yt-dlp a validés pour ce client.
    // Ne PAS ajouter de Referer/Origin "browser-like" ici : c'est la cause
    // la plus fréquente des 403 en prod avec extractor-args client=android.
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