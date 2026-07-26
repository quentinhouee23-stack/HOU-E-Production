import YTDlpWrap from "yt-dlp-wrap";

import { join } from "path";

import { existsSync } from "fs";

import { NextResponse } from "next/server";



export const runtime = "nodejs";

export const maxDuration = 15;



async function getYtDlp(): Promise<YTDlpWrap> {

  const binPath = join(process.cwd(), "bin", "yt-dlp");

  const binPathExe = join(process.cwd(), "bin", "yt-dlp.exe");

  const path = existsSync(binPathExe) ? binPathExe : existsSync(binPath) ? binPath : null;

  if (path) return new YTDlpWrap(path);

  const downloadPath = process.platform === "win32" ? binPathExe : binPath;

  await YTDlpWrap.downloadFromGithub(downloadPath);

  return new YTDlpWrap(downloadPath);

}



export async function GET(req: Request) {

  try {

    const { searchParams } = new URL(req.url);

    const q = searchParams.get("q");

    if (!q) return NextResponse.json({ error: "Recherche vide" }, { status: 400 });



    const ytDlp = await getYtDlp();



    // Recherche YouTube via yt-dlp

    const result = await ytDlp.execPromise([

      `ytsearch1:${q}`,              // Cherche le 1er résultat

      "--get-id",                     // Retourne juste l'ID

      "--no-playlist",

      "--default-search", "ytsearch",

    ]);



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