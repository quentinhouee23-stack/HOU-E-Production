import { NextResponse } from "next/server";
import { createClient } from '@supabase/supabase-js';

export const runtime = "nodejs";
export const maxDuration = 20;

const INVIDIOUS_INSTANCES = [
  "https://inv.nadeko.net",
  "https://invidious.nerdvpn.de",
  "https://invidious.privacyredirect.com",
];

const PIPED_INSTANCES = [
  "https://pipedapi.kavin.rocks",
  "https://pipedapi.syncpundit.io",
  "https://api.piped.projectsegfau.lt"
];

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

async function incrementTokenUsage() {
  try {
    const today = new Date().toISOString().split('T')[0];
    const { data } = await supabase.from('api_usage').select('tokens').eq('date', today).single();
    const currentTokens = data ? data.tokens : 0;
    await supabase.from('api_usage').upsert({ date: today, tokens: currentTokens + 101 });
  } catch (err) {
    console.error("Erreur compteur tokens", err);
  }
}

const parseDuration = (iso: string) => {
  const match = iso.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!match) return 0;
  return (parseInt(match[1] || "0") * 3600) + (parseInt(match[2] || "0") * 60) + parseInt(match[3] || "0");
};

const isGoodDuration = (seconds: number) => seconds >= 60 && seconds <= 600;

function fetchWithTimeout(url: string, ms: number, options: RequestInit = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  return fetch(url, { ...options, signal: controller.signal }).finally(() => clearTimeout(timer));
}

async function scrapeYouTubeDirect(q: string, timeoutMs: number): Promise<string | null> {
  try {
    const searchUrl = `https://www.youtube.com/results?search_query=${encodeURIComponent(q)}`;
    const res = await fetchWithTimeout(searchUrl, timeoutMs, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
        'Accept-Language': 'en-US,en;q=0.9',
      }
    });
    if (!res.ok) return null;
    const html = await res.text();
    const match = html.match(/"videoId":"([a-zA-Z0-9_-]{11})"/);
    if (match && match[1]) return match[1];
  } catch (e) {}
  return null;
}

async function searchYouTubeAPI(q: string, apiKey: string, timeoutMs: number): Promise<string | null> {
  try {
    const searchUrl = new URL("https://www.googleapis.com/youtube/v3/search");
    searchUrl.searchParams.set("part", "snippet");
    searchUrl.searchParams.set("type", "video");
    searchUrl.searchParams.set("maxResults", "5");
    searchUrl.searchParams.set("q", q);
    searchUrl.searchParams.set("key", apiKey);

    const res = await fetchWithTimeout(searchUrl.toString(), timeoutMs);
    const data = await res.json();
    if (!res.ok || !data.items?.length) return null;

    const videoIds = data.items.map((i: any) => i.id.videoId).join(",");
    const detailUrl = new URL("https://www.googleapis.com/youtube/v3/videos");
    detailUrl.searchParams.set("part", "contentDetails");
    detailUrl.searchParams.set("id", videoIds);
    detailUrl.searchParams.set("key", apiKey);

    const detailRes = await fetchWithTimeout(detailUrl.toString(), timeoutMs);
    const detailData = await detailRes.json();

    const withDurations = (detailData.items ?? []).map((item: any) => ({
      videoId: item.id,
      seconds: parseDuration(item.contentDetails.duration),
    }));

    await incrementTokenUsage();
    const best = withDurations.find((v: any) => isGoodDuration(v.seconds)) ?? withDurations[0];
    return best?.videoId ?? null;
  } catch (e) {
    return null;
  }
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const q = searchParams.get("q");

    if (!q) return NextResponse.json({ error: "Recherche vide" }, { status: 400 });

    let videoId = await scrapeYouTubeDirect(q, 2500);

    if (!videoId) {
      const apiKey = process.env.YOUTUBE_API_KEY;
      if (apiKey) videoId = await searchYouTubeAPI(q, apiKey, 4000);
    }

    if (videoId) return NextResponse.json({ videoId });

    return NextResponse.json({ error: "Aucun résultat trouvé" }, { status: 404 });
  } catch (e) {
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}