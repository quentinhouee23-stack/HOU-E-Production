import YTDlpWrap from "yt-dlp-wrap";
import { join } from "path";
import { existsSync, mkdirSync } from "fs";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const maxDuration = 15;

async function getYtDlp(): Promise<YTDlpWrap> {
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

    // La vraie magie est ici : --flat-playlist (et non --extract-flat)
    const ytArgs = [
      `ytsearch1:${q}`,
      "--print", "id", // Récupère uniquement l'ID proprement
      "--flat-playlist", // LE VRAI PARAMÈTRE ANTI-BLOCAGE
      "--no-playlist"
    ];

    const result = await ytDlp.execPromise(ytArgs);
    
    // On s'assure de ne garder que la première ligne (l'ID) sans espaces
    const videoId = result.trim().split("\n")[0]; 

    if (!videoId || videoId.length !== 11) {
      return NextResponse.json({ error: "Aucun résultat" }, { status: 404 });
    }

    return NextResponse.json({ videoId });

  } catch (e: any) {
    console.error("[youtube] Erreur yt-dlp:", e.message);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}