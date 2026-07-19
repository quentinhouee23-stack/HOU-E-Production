import YTDlpWrap from "yt-dlp-wrap";
import { join } from "path";
import { existsSync, mkdirSync } from "fs";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const maxDuration = 15;

async function getYtDlp(): Promise<YTDlpWrap> {
  if (process.env.YTDLP_PATH) {
    return new YTDlpWrap(process.env.YTDLP_PATH);
  }

  const binDir = join(process.cwd(), "bin");
  const exeName = process.platform === "win32" ? "yt-dlp.exe" : "yt-dlp";
  const localPath = join(binDir, exeName);

  if (!existsSync(localPath)) {
    if (!existsSync(binDir)) mkdirSync(binDir, { recursive: true });
    console.log("Téléchargement local de yt-dlp...");
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
    
    console.log("[youtube] Vérification cookies.txt au chemin :", cookiesPath);
    console.log("[youtube] Le fichier existe-t-il ? :", existsSync(cookiesPath));

    const ytArgs = [
      `ytsearch1:${q}`,
      "--get-id",
      "--no-playlist",
      "--default-search", "ytsearch",
      "--js-runtimes", "nodejs"
    ];

    if (existsSync(cookiesPath)) {
      ytArgs.push("--cookies", cookiesPath);
      console.log("[youtube] Cookies ajoutés à la requête !");
    } else {
      console.log("[youtube] ATTENTION : Fichier cookies.txt introuvable !");
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