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

// 🟢 NOUVEAU : Récupère l'URL audio directe depuis Invidious pour un videoId connu.
// Utilise local=true pour que l'URL soit proxiée par Invidious → pas de CORS.
// C'est ce qui permet à un <audio> natif de jouer le son en arrière-plan sur iOS.
async function getAudioUrl(videoId: string, timeoutMs: number): Promise<string | null> {
  for (const instance of INVIDIOUS_INSTANCES) {
    try {
      const url = `${instance}/api/v1/videos/${videoId}?local=true&fields=adaptiveFormats`;
      const res = await fetchWithTimeout(url, timeoutMs);
      if (!res.ok) continue;

      const data = await res.json();
      const formats: any[] = data.adaptiveFormats || [];

      // On filtre les formats audio uniquement, on prend le meilleur bitrate
      const audioFormats = formats
        .filter((f) => f.type?.startsWith("audio/"))
        .sort((a, b) => parseInt(b.bitrate || "0") - parseInt(a.bitrate || "0"));

      if (audioFormats.length > 0 && audioFormats[0].url) {
        console.log(`✅ Audio URL depuis ${instance} : itag ${audioFormats[0].itag}`);
        return audioFormats[0].url;
      }
    } catch (e) {
      // Instance down ou timeout, on essaie la suivante
    }
  }
  return null;
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
    const directVideoId = searchParams.get("videoId"); // 🟢 NOUVEAU : pour récupérer l'audioUrl d'un videoId connu
    const isBg = searchParams.get("bg") === "true";

    // 🟢 MODE DIRECT : On connaît déjà le videoId, on veut juste l'URL audio fraîche
    if (directVideoId) {
      console.log(`🎵 Récupération audio pour videoId connu : ${directVideoId}`);
      const audioUrl = await getAudioUrl(directVideoId, 5000);
      if (audioUrl) {
        return NextResponse.json({ audioUrl });
      }
      return NextResponse.json({ error: "Audio URL non disponible" }, { status: 404 });
    }

    if (!q) return NextResponse.json({ error: "Recherche vide" }, { status: 400 });

    console.log(`🔍 Recherche globale: ${q} | Mode arrière-plan: ${isBg}`);

    // ÉTAPE 1 : Trouver le videoId (logique existante inchangée)
    let videoId: string | null = null;

    videoId = await searchInvidious(q, isBg ? 3500 : 2000);
    if (!videoId) videoId = await searchPiped(q, isBg ? 3500 : 2000);
    if (!videoId) videoId = await scrapeYouTubeDirect(q, 2000);

    if (!videoId && !isBg) {
      const apiKey = process.env.YOUTUBE_API_KEY;
      if (apiKey) {
        videoId = await searchYouTubeAPI(q, apiKey, 4000);
      }
    }

    if (!videoId) {
      return NextResponse.json({ error: "Aucun résultat trouvé" }, { status: 404 });
    }

    // ÉTAPE 2 : 🟢 NOUVEAU — Récupérer l'URL audio directe pour ce videoId
    // C'est cette URL qui sera jouée par le <audio> natif → background iOS natif
    const audioUrl = await getAudioUrl(videoId, 4000);

    if (audioUrl) {
      console.log(`✅ Réponse complète : videoId=${videoId} + audioUrl OK`);
      return NextResponse.json({ videoId, audioUrl });
    }

    // Fallback : on retourne au moins le videoId (le Player utilisera l'iframe YouTube)
    console.warn(`⚠️ audioUrl non disponible, fallback iframe pour videoId=${videoId}`);
    return NextResponse.json({ videoId });

  } catch (e) {
    console.error("❌ Erreur globale /api/youtube:", e);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}