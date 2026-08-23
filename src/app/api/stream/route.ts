import YTDlpWrap from "yt-dlp-wrap";
import { join } from "path";
import { existsSync, copyFileSync, chmodSync } from "fs";

export const runtime = "nodejs";
export const maxDuration = 60;

async function getYtDlp(): Promise<YTDlpWrap> {
  if (process.env.YTDLP_PATH) {
    return new YTDlpWrap(process.env.YTDLP_PATH);
  }

  // En local sous Windows
  if (process.platform === "win32") {
    const localExe = join(process.cwd(), "bin", "yt-dlp.exe");
    if (!existsSync(localExe)) {
      throw new Error("yt-dlp binaire introuvable: " + localExe);
    }
    return new YTDlpWrap(localExe);
  }

  // Sur Vercel / Linux : copie vers /tmp et application des droits d'exécution
  const targetPath = "/tmp/yt-dlp";
  if (!existsSync(targetPath)) {
    const sourcePath = join(process.cwd(), "bin", "yt-dlp");
    if (!existsSync(sourcePath)) {
      throw new Error("yt-dlp binaire source introuvable: " + sourcePath);
    }
    copyFileSync(sourcePath, targetPath);
    chmodSync(targetPath, 0o755);
  }

  return new YTDlpWrap(targetPath);
}

function getCookiesArgs(): string[] {
  if (process.env.YTDLP_COOKIES_PATH && existsSync(process.env.YTDLP_COOKIES_PATH)) {
    return ["--cookies", process.env.YTDLP_COOKIES_PATH];
  }

  const rootCookies = join(process.cwd(), "cookies.txt");
  if (existsSync(rootCookies)) {
    if (process.platform !== "win32") {
      const tmpCookies = "/tmp/cookies.txt";
      if (!existsSync(tmpCookies)) {
        copyFileSync(rootCookies, tmpCookies);
      }
      return ["--cookies", tmpCookies];
    }
    return ["--cookies", rootCookies];
  }

  if (existsSync("/etc/secrets/cookies.txt")) {
    return ["--cookies", "/etc/secrets/cookies.txt"];
  }

  return [];
}

const CLIENT_FALLBACKS = [
  "android_vr",
  "tv_embedded",
  "web_safari",
  "web",
];

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const videoId = searchParams.get("videoId");

  if (!videoId) {
    return new Response("Paramètre videoId manquant", { status: 400 });
  }

  const ytDlp = await getYtDlp();
  const cookiesArgs = getCookiesArgs();

  let lastError: any = null;

  for (const client of CLIENT_FALLBACKS) {
    try {
      const ytArgs = [
        `--format-sort-force`,
        `--format-sort`, "res:360",
        `-f`, "bestaudio[ext=m4a]/bestaudio[ext=webm]/bestaudio/best[height<=360]",
        `--no-playlist`,
        `--no-warnings`,
        `--retries`, "2",
        `--socket-timeout`, "15",
        `--no-check-certificates`,
        `--extractor-args`, `youtube:player_client=${client}`,
        ...cookiesArgs,
        `--get-url`,
        `--`,
        videoId,
      ];

      const result = await ytDlp.execPromise(ytArgs);
      const streamUrl = result.trim().split("\n")[0];

      if (!streamUrl || !streamUrl.startsWith("http")) {
        throw new Error("URL de stream invalide");
      }

      const upstream = await fetch(streamUrl, {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
          Accept: "*/*",
          Referer: "https://www.youtube.com/",
        },
      });

      if (!upstream.ok) {
        throw new Error(`Upstream ${upstream.status}`);
      }

      const contentType = upstream.headers.get("content-type") || "audio/mpeg";
      const responseHeaders = new Headers();
      responseHeaders.set("Content-Type", contentType);
      responseHeaders.set("Accept-Ranges", "bytes");
      responseHeaders.set("Cache-Control", "no-store");

      return new Response(upstream.body, {
        status: upstream.status,
        headers: responseHeaders,
      });
    } catch (e: any) {
      console.error(`[stream] client=${client} error:`, e.stderr || e.message);
      lastError = e;
      continue;
    }
  }

  const isBotError =
    lastError?.message?.toLowerCase().includes("not a bot") ||
    lastError?.stderr?.toLowerCase().includes("not a bot");

  return new Response(
    isBotError
      ? "YouTube demande une vérification anti-bot. Vérifiez que cookies.txt est valide."
      : `Erreur stream: ${lastError?.message || "inconnue"}`,
    { status: 500 }
  );
}