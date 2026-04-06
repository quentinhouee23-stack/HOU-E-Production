// @ts-nocheck
import { NextResponse } from "next/server";
import { createClient } from '@supabase/supabase-js';

export const runtime = "nodejs";
export const maxDuration = 20;

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

// 🟢 La liste de nos 5 serveurs de secours ultra-rapides
const INVIDIOUS_INSTANCES = [
  "https://inv.nadeko.net",
  "https://invidious.nerdvpn.de",
  "https://inv.tux.pizza",
  "https://invidious.projectsegfau.lt",
  "https://inv.bp.projectsegfau.lt"
];

async function incrementTokenUsage() {
  try {
    const today = new Date().toISOString().split('T')[0];
    const { data } = await supabase.from('api_usage').select('tokens').eq('date', today).single();
    const currentTokens = data ? data.tokens : 0;
    await supabase.from('api_usage').upsert({ date: today, tokens: currentTokens + 101 });
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
    console.error("❌ YouTube API crash:", e);
    return null;
  }
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const q = searchParams.get("q");
    const directVideoId = searchParams.get("videoId"); 

    // 🟢 On génère INSTANTANÉMENT une liste de 5 URLs audios sans appeler d'API externe (0 risque de crash serveur)
    if (directVideoId) {
      const audioUrls = INVIDIOUS_INSTANCES.map(inst => `${inst}/latest_version?id=${directVideoId}&itag=140&local=true`).join(',');
      return NextResponse.json({ audioUrl: audioUrls });
    }

    if (!q) return NextResponse.json({ error: "Recherche vide" }, { status: 400 });

    // 1. Recherche de l'ID vidéo
    let videoId = await scrapeYouTubeDirect(q, 2500);
    if (!videoId) {
      const apiKey = process.env.YOUTUBE_API_KEY;
      if (apiKey) videoId = await searchYouTubeAPI(q, apiKey, 4000);
    }

    if (!videoId) return NextResponse.json({ error: "Aucun résultat trouvé" }, { status: 404 });

    // 2. Génération du tableau de secours
    const audioUrls = INVIDIOUS_INSTANCES.map(inst => `${inst}/latest_version?id=${videoId}&itag=140&local=true`).join(',');

    return NextResponse.json({ videoId, audioUrl: audioUrls });

  } catch (e) {
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}