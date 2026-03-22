// @ts-nocheck
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const HEADERS = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
  "Accept-Language": "fr-FR,fr;q=0.9",
};

async function fetchFromEmbed(type: "playlist" | "album", id: string) {
  // 🟢 CORRECTION : Les liens sont concaténés pour éviter que le tchat ne les masque !
  const embedUrl = "https://" + "open.spotify.com/embed/" + type + "/" + id;
  
  const res: Response = await fetch(embedUrl, { headers: HEADERS });
  if (!res.ok) throw new Error(`Embed inaccessible : ${res.status}`);

  const html: string = await res.text();
  const nextDataMatch = html.match(/<script id="__NEXT_DATA__" type="application\/json">([^<]+)<\/script>/);
  if (!nextDataMatch) throw new Error("__NEXT_DATA__ introuvable.");

  const nextData: any = JSON.parse(nextDataMatch[1]);
  const pageState = nextData?.props?.pageProps?.state;
  const entity = pageState?.data?.entity;
  const session = pageState?.settings?.session;

  if (!entity) throw new Error("Données de l'entité introuvables.");

  const name: string = entity.name ?? entity.title ?? "Importé";
  const accessToken: string | null = session?.accessToken ?? null;
  const expiresAt: number | null = session?.accessTokenExpirationTimestampMs ?? null;

  const coverImage: string =
    entity.coverArt?.sources?.find((s: any) => s.height >= 300)?.url ??
    entity.coverArt?.sources?.[0]?.url ??
    "";

  const trackList: { title: string; artist: string; image: string }[] =
    (entity.trackList ?? []).map((t: any) => ({
      title: t.title ?? t.name ?? "Inconnu",
      artist: t.subtitle ?? "Inconnu",
      image: coverImage,
    }));

  return { name, trackList, accessToken, expiresAt, coverImage };
}

async function fetchAllTracksFromAPI(
  type: "playlist" | "album",
  id: string,
  token: string,
  coverImage: string
) {
  const tracks: { title: string; artist: string; image: string }[] = [];

  if (type === "album") {
    let nextUrl: string | null = "https://" + "api.spotify.com/v1/albums/" + id + "/tracks?limit=50";
    while (nextUrl) {
      const res: Response = await fetch(nextUrl, { headers: { Authorization: `Bearer ${token}` } });
      if (!res.ok) throw new Error(`Erreur API album : ${res.status}`);
      const data: any = await res.json();
      nextUrl = data.next ?? null;
      for (const track of data.items ?? []) {
        if (!track) continue;
        tracks.push({
          title: track.name,
          artist: track.artists?.map((a: { name: string }) => a.name).join(", ") ?? "Inconnu",
          image: coverImage,
        });
      }
    }
  } else {
    let nextUrl: string | null = "https://" + "api.spotify.com/v1/playlists/" + id + "/tracks?limit=100&fields=next,items(track(name,artists(name),album(images)))";
    while (nextUrl) {
      const res: Response = await fetch(nextUrl, { headers: { Authorization: `Bearer ${token}` } });
      if (!res.ok) throw new Error(`Erreur API playlist : ${res.status}`);
      const data: any = await res.json();
      nextUrl = data.next ?? null;
      for (const item of data.items ?? []) {
        const track = item?.track;
        if (!track || track.type === "episode") continue;
        tracks.push({
          title: track.name,
          artist: track.artists?.map((a: { name: string }) => a.name).join(", ") ?? "Inconnu",
          image: track.album?.images?.[0]?.url ?? coverImage,
        });
      }
    }
  }

  return tracks;
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const url = searchParams.get("url");

  if (!url) return NextResponse.json({ error: "Lien manquant." }, { status: 400 });

  const match = url.match(/(?:intl-[a-z-]+\/)?(playlist|album)\/([a-zA-Z0-9]+)/);
  if (!match) {
    return NextResponse.json(
      { error: "Lien invalide. Colle un lien Spotify de playlist ou d'album." },
      { status: 400 }
    );
  }

  const type = match[1] as "playlist" | "album";
  const id = match[2];

  try {
    const { name, trackList, accessToken, expiresAt, coverImage } = await fetchFromEmbed(type, id);

    if (trackList.length === 0) {
      return NextResponse.json({ error: "Aucun titre trouvé dans l'embed." }, { status: 404 });
    }

    let finalTracks = trackList;

    if (accessToken) {
      try {
        const apiTracks = await fetchAllTracksFromAPI(type, id, accessToken, coverImage);
        if (apiTracks.length >= trackList.length) {
          finalTracks = apiTracks;
        }
      } catch (apiErr) {
        console.warn("API fallback échoué, utilisation des tracks embed :", apiErr);
      }
    }

    return NextResponse.json({ name, tracks: finalTracks });

  } catch (error) {
    console.error("Erreur lors de l'import Spotify :", error);
    return NextResponse.json({ error: `Erreur : ${(error as Error).message}` }, { status: 500 });
  }
}