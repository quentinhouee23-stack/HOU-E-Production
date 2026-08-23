import YTDlpWrap from "yt-dlp-wrap";
import { join } from "path";
import { existsSync, copyFileSync, chmodSync } from "fs";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const maxDuration = 30;

const searchCache = new Map<string, string>();

async function getYtDlp(): Promise<YTDlpWrap> {
  if (process.env.YTDLP_PATH) {
    return new YTDlpWrap(process.env.YTDLP_PATH);
  }

  // Sous Windows en local
  if (process.platform === "win32") {
    const localExe = join(process.cwd(), "bin", "yt-dlp.exe");
    if (!existsSync(localExe)) {
      throw new Error("yt-dlp binaire introuvable: " + localExe);
    }
    return new YTDlpWrap(localExe);
  }

  // Sous Linux / Vercel : copie vers /tmp et ajout des droits d'exécution
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
  const q = searchParams.get("q");

  if (!q) {
    return NextResponse.json({ error: "Paramètre q manquant" }, { status: 400 });
  }

  const cached = searchCache.get(q);
  if (cached) {
    return NextResponse.json({ videoId: cached });
  }

  const ytDlp = await getYtDlp();
  const cookiesArgs = getCookiesArgs();

  let lastError: any = null;

  for (const client of CLIENT_FALLBACKS) {
    try {
      const ytArgs = [
        `--no-warnings`,
        `--retries`, "2",
        `--socket-timeout`, "15",
        `--no-check-certificates`,
        `--extractor-args`, `youtube:player_client=${client}`,
        ...cookiesArgs,
        `--print`, "id",
        `--playlist-items`, "1",
        `ytsearch1:${q}`,
      ];

      const result = await ytDlp.execPromise(ytArgs);
      const videoId = result.trim().split("\n")[0];

      if (!videoId || videoId.length !== 11) {
        throw new Error("Aucun résultat");
      }

      searchCache.set(q, videoId);
      return NextResponse.json({ videoId });
    } catch (e: any) {
      console.error(`[youtube] client=${client} message:`, e.message);
      lastError = e;
      continue;
    }
  }

  const isBotError = lastError?.message?.toLowerCase().includes("not a bot") ||
    lastError?.stderr?.toLowerCase().includes("not a bot");

  return NextResponse.json(
    {
      error: isBotError
        ? "YouTube demande une vérification anti-bot. Vérifiez que cookies.txt est monté sur Render."
        : `Erreur recherche: ${lastError?.message || "inconnue"}`,
    },
    { status: 500 }
  );
}