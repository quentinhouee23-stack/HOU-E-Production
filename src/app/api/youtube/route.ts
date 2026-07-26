import YTDlpWrap from "yt-dlp-wrap";
import { join } from "path";
import { existsSync, mkdirSync } from "fs";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const maxDuration = 15;

async function getYtDlp(): Promise<YTDlpWrap> {
  if (process.env.RENDER || process.env.NODE_ENV === "production") {
    return new YTDlpWrap(process.env.YTDLP_PATH || "/usr/local/bin/yt-dlp");
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
  try {
    const { searchParams } = new URL(req.url);
    const q = searchParams.get("q");
    if (!q) return NextResponse.json({ error: "Recherche vide" }, { status: 400 });

    const ytDlp = await getYtDlp();

    const ytArgs = [
      `ytsearch1:${q}`,
      "--print", "id",
      "--flat-playlist",
      "--no-playlist"
    ];

    const result = await ytDlp.execPromise(ytArgs);
    const videoId = result.trim().split("\n")[0]; 

    if (!videoId || videoId.length !== 11) {
      return NextResponse.json({ error: "Aucun résultat" }, { status: 404 });
    }

    return NextResponse.json({ videoId });
  } catch (e: any) {
    console.error("[youtube] Erreur:", e?.message);
    return NextResponse.json({ error: e?.message }, { status: 500 });
  }
}