import YTDlpWrap from "yt-dlp-wrap";
import { join } from "path";
import { existsSync, mkdirSync } from "fs";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const maxDuration = 15;

async function getYtDlp(): Promise<YTDlpWrap> {
  // On ignore la version périmée de Render et on télécharge la dernière mise à jour dans /tmp
  const isProd = process.env.NODE_ENV === "production" || !!process.env.RENDER;
  const binDir = isProd ? "/tmp/yt-bin" : join(process.cwd(), "bin");
  const exeName = process.platform === "win32" ? "yt-dlp.exe" : "yt-dlp";
  const localPath = join(binDir, exeName);

  if (!existsSync(localPath)) {
    if (!existsSync(binDir)) mkdirSync(binDir, { recursive: true });
    console.log("Téléchargement de la dernière mise à jour de yt-dlp...");
    await YTDlpWrap.downloadFromGithub(localPath);
  }

  return new YTDlpWrap(localPath);
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const q = searchParams.get("q");
    if (!q) return NextResponse.json({ error: "Recherche vide" }, { status: 400 });

    const ytDlp = await getYtDlp();
    const cookiesPath = join(process.cwd(), "cookies.txt");

    // L'armure complète : recherche + node JS + Android
    const ytArgs = [
      `ytsearch1:${q}`,
      "--get-id",
      "--no-playlist",
      "--default-search", "ytsearch",
      "--js-runtimes", "node",
      "--extractor-args", "youtube:player_client=android",
    ];

    // On ajoute tes cookies s'ils sont là
    if (existsSync(cookiesPath)) {
      ytArgs.push("--cookies", cookiesPath);
    }

    const result = await ytDlp.execPromise(ytArgs);

    const videoId = result.trim();
    if (!videoId || videoId.length !== 11) {
      return NextResponse.json({ error: "Aucun résultat" }, { status: 404 });
    }

    return NextResponse.json({ videoId });

  } catch (e: any) {
    console.error("[youtube] Erreur yt-dlp:", e.message);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}