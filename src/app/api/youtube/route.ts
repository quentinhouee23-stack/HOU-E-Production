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

// 🟢 INITIALISATION SUPABASE POUR LE COMPTEUR
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

async function incrementTokenUsage() {
  try {
    const today = new Date().toISOString().split('T')[0]; 
    const { data } = await supabase.from('api_usage').select('tokens').eq('date', today).single();
    const currentTokens = data ? data.tokens : 0;
    
    await supabase.from('api_usage').upsert({ date: today, tokens: currentTokens + 101 });
    console.log(`📊 Tokens mis à jour : ${currentTokens + 101} / 10000`);
  } catch (err) {
    console.error("Erreur mise à jour compteur tokens", err);
  }
}

const parseDuration = (iso: string) => {
  const match = iso.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!match) return 0;
  return (parseInt(match[1] || "0") * 3600)
       + (parseInt(match[2] || "0") * 60)
       + parseInt(match[3] || "0");
};

const isGoodDuration = (seconds: number) => seconds >= 60 && seconds <= 600;

function fetchWithTimeout(url: string, ms: number, options: RequestInit = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  return fetch(url, { ...options, signal: controller.signal }).finally(() => clearTimeout(timer));
}

async function searchInvidious(q: string, timeoutMs: number): Promise<string | null> {
  for (const instance of INVIDIOUS_INSTANCES) {
    try {
      const url = `${instance}/api/v1/search?q=${encodeURIComponent(q)}&type=video&fields=videoId,lengthSeconds`;
      const res = await fetchWithTimeout(url, timeoutMs);

      if (!res.ok) continue;
      const results = await res.json();
      if (!Array.isArray(results) || results.length === 0) continue;

      const best = results.find((v: any) => isGoodDuration(v.lengthSeconds)) ?? results[0];

      if (best?.videoId) {
        console.log(`✅ Invidious (${instance}): ${best.videoId}`);
        return best.videoId;
      }
    } catch (e) {}
  }
  return null;
}

async function searchPiped(q: string, timeoutMs: number): Promise<string | null> {
  for (const instance of PIPED_INSTANCES) {
    try {
      const url = `${instance}/search?q=${encodeURIComponent(q)}&filter=videos`;
      const res = await fetchWithTimeout(url, timeoutMs);

      if (!res.ok) continue;
      const data = await res.json();
      const results = data.items;
      
      if (!Array.isArray(results) || results.length === 0) continue;

      const best = results.find((v: any) => isGoodDuration(v.duration)) ?? results[0];

      if (best?.url) {
        const videoId = best.url.split("?v=")[1];
        if (videoId) {
          console.log(`✅ Piped (${instance}): ${videoId}`);
          return videoId;
        }
      }
    } catch (e) {}
  }
  return null;
}

async function scrapeYouTubeDirect(q: string, timeoutMs: number): Promise<string | null> {
  try {
    const searchUrl = `https://www.youtube.com/results?search_query=${encodeURIComponent(q)}`;
    const res = await fetchWithTimeout(searchUrl, timeoutMs, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept-Language': 'en-US,en;q=0.9',
      }
    });

    if (!res.ok) return null;
    const html = await res.text();

    const match = html.match(/"videoId":"([a-zA-Z0-9_-]{11})"/);
    if (match && match[1]) {
      console.log(`✅ Scraping YouTube Direct : ${match[1]}`);
      return match[1];
    }
  } catch (e) {
    console.error("❌ Erreur Scraping Direct", e);
  }
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

    if (!res.ok || !data.items?.length) {
      console.error("❌ YouTube API:", data.error?.message);
      return null;
    }

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
    console.error("❌ YouTube API crash:", e);
    return null;
  }
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const q = searchParams.get("q");
    const isBg = searchParams.get("bg") === "true";

    if (!q) return NextResponse.json({ error: "Recherche vide" }, { status: 400 });

    console.log(`🔍 Recherche globale: ${q} | Mode arrière-plan: ${isBg}`);

    const invTimeout = isBg ? 3500 : 2000;
    const pipedTimeout = isBg ? 3500 : 2000;
    const scrapeTimeout = isBg ? 2000 : 2000;

    const invidiousId = await searchInvidious(q, invTimeout);
    if (invidiousId) return NextResponse.json({ videoId: invidiousId });

    const pipedId = await searchPiped(q, pipedTimeout);
    if (pipedId) return NextResponse.json({ videoId: pipedId });

    const scrapedId = await scrapeYouTubeDirect(q, scrapeTimeout);
    if (scrapedId) return NextResponse.json({ videoId: scrapedId });

    if (isBg) {
      console.warn("⚠️ Toutes les méthodes gratuites ont échoué en arrière-plan. Utilisation Google API bloquée pour sauver les tokens.");
      return NextResponse.json({ error: "Aucun résultat gratuit (Tokens protégés)" }, { status: 404 });
    }

    console.warn("⚠️ Toutes les méthodes gratuites ont échoué, fallback sur l'API Google...");

    const apiKey = process.env.YOUTUBE_API_KEY;
    if (!apiKey) {
      console.error("❌ YOUTUBE_API_KEY manquante");
      return NextResponse.json({ error: "Aucune source disponible" }, { status: 503 });
    }

    const ytId = await searchYouTubeAPI(q, apiKey, 4000);
    if (ytId) {
      console.log(`✅ YouTube API Google : ${ytId}`);
      return NextResponse.json({ videoId: ytId });
    }

    return NextResponse.json({ error: "Aucun résultat trouvé" }, { status: 404 });

  } catch (e) {
    console.error("❌ Erreur globale /api/youtube:", e);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}