// app/api/youtube/route.ts
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const maxDuration = 10;

const INVIDIOUS_INSTANCES = [
  "https://inv.nadeko.net",
  "https://invidious.nerdvpn.de",
  "https://invidious.privacyredirect.com",
];

const parseDuration = (iso: string) => {
  const match = iso.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!match) return 0;
  return (parseInt(match[1] || "0") * 3600)
       + (parseInt(match[2] || "0") * 60)
       + parseInt(match[3] || "0");
};

const isGoodDuration = (seconds: number) => seconds >= 60 && seconds <= 600;

// Fetch avec timeout manuel — compatible toutes versions Node
function fetchWithTimeout(url: string, ms: number) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  return fetch(url, { signal: controller.signal }).finally(() => clearTimeout(timer));
}

// ================================
// Plan A : Invidious (sans quota)
// ================================
async function searchInvidious(q: string): Promise<string | null> {
  for (const instance of INVIDIOUS_INSTANCES) {
    try {
      const url = `${instance}/api/v1/search?q=${encodeURIComponent(q)}&type=video&fields=videoId,lengthSeconds`;
      const res = await fetchWithTimeout(url, 2500);

      if (!res.ok) continue;
      const results = await res.json();
      if (!Array.isArray(results) || results.length === 0) continue;

      const best = results.find((v: any) => isGoodDuration(v.lengthSeconds)) ?? results[0];

      if (best?.videoId) {
        console.log(`✅ Invidious (${instance}): ${best.videoId}`);
        return best.videoId;
      }
    } catch (e) {
      console.warn(`⚠️ Instance Invidious ${instance} injoignable`);
    }
  }
  return null;
}

// ================================
// Plan B : API YouTube officielle
// ================================
async function searchYouTubeAPI(q: string, apiKey: string): Promise<string | null> {
  try {
    const searchUrl = new URL("https://www.googleapis.com/youtube/v3/search");
    searchUrl.searchParams.set("part", "snippet");
    searchUrl.searchParams.set("type", "video");
    searchUrl.searchParams.set("maxResults", "5");
    searchUrl.searchParams.set("q", q);
    searchUrl.searchParams.set("key", apiKey);

    const res = await fetchWithTimeout(searchUrl.toString(), 5000);
    const data = await res.json();

    if (!res.ok || !data.items?.length) {
      console.error("❌ YouTube API:", data.error?.message);
      return null;
    }

    const videoIds = data.items.map((i: any) => i.id.videoId).join(",");
    const detailUrl = new URL("https://www.googleapis.com/youtube/v3/videos");
    detailUrl.searchParams.set("part", "contentDetails");
    detailUrl.searchParams.set("id", videoIds);
    detailUrl.searchParams.set("key", apiKey);

    const detailRes = await fetchWithTimeout(detailUrl.toString(), 5000);
    const detailData = await detailRes.json();

    const withDurations = (detailData.items ?? []).map((item: any) => ({
      videoId: item.id,
      seconds: parseDuration(item.contentDetails.duration),
    }));

    const best = withDurations.find((v: any) => isGoodDuration(v.seconds)) ?? withDurations[0];
    return best?.videoId ?? null;
  } catch (e) {
    console.error("❌ YouTube API crash:", e);
    return null;
  }
}

// ================================
// Route principale
// ================================
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const q = searchParams.get("q");

    if (!q) return NextResponse.json({ error: "Recherche vide" }, { status: 400 });

    console.log(`🔍 Recherche: ${q}`);

    // Plan A : Invidious
    const invidiousId = await searchInvidious(q);
    if (invidiousId) {
      return NextResponse.json({ videoId: invidiousId });
    }

    console.warn("⚠️ Invidious indisponible, fallback YouTube API...");

    // Plan B : YouTube API officielle
    const apiKey = process.env.YOUTUBE_API_KEY;
    if (!apiKey) {
      console.error("❌ YOUTUBE_API_KEY manquante");
      return NextResponse.json({ error: "Aucune source disponible" }, { status: 503 });
    }

    const ytId = await searchYouTubeAPI(q, apiKey);
    if (ytId) {
      return NextResponse.json({ videoId: ytId });
    }

    return NextResponse.json({ error: "Aucun résultat trouvé" }, { status: 404 });

  } catch (e) {
    // Ce catch global garantit qu'on retourne TOUJOURS du JSON, jamais du HTML
    console.error("❌ Erreur globale /api/youtube:", e);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}