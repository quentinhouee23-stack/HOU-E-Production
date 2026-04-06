// @ts-nocheck
import { NextResponse } from "next/server";
import { createClient } from '@supabase/supabase-js';

export const runtime = "nodejs";
export const maxDuration = 20;

const PIPED_APIS = [
  "https://pipedapi.kavin.rocks",
  "https://pipedapi.syncpundit.io",
  "https://api.piped.projectsegfau.lt"
];

const INVIDIOUS_APIS = [
  "https://inv.tux.pizza",
  "https://invidious.nerdvpn.de",
  "https://inv.nadeko.net"
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
  } catch (err) {}
}

function fetchWithTimeout(url: string, ms: number, options: RequestInit = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  return fetch(url, { ...options, signal: controller.signal }).finally(() => clearTimeout(timer));
}

async function searchVideoId(q: string): Promise<string | null> {
  for (const api of PIPED_APIS) {
    try {
      const res = await fetchWithTimeout(`${api}/search?q=${encodeURIComponent(q)}&filter=videos`, 3000);
      if (res.ok) {
        const data = await res.json();
        if (data.items && data.items.length > 0) {
          const videoId = data.items[0].url.split("?v=")[1];
          if (videoId) return videoId;
        }
      }
    } catch (e) {}
  }

  try {
    const searchUrl = `https://www.youtube.com/results?search_query=${encodeURIComponent(q)}`;
    const res = await fetchWithTimeout(searchUrl, 3000, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
        'Cookie': 'CONSENT=YES+cb.20210328-17-p0.en+FX+478;'
      }
    });
    if (res.ok) {
      const html = await res.text();
      const match = html.match(/"videoId":"([a-zA-Z0-9_-]{11})"/);
      if (match && match[1]) return match[1];
    }
  } catch (e) {}

  return null;
}

async function checkUrlAlive(url: string): Promise<boolean> {
  try {
    const res = await fetchWithTimeout(url, 2000, { method: 'HEAD' });
    return res.ok || res.status === 302 || res.status === 206;
  } catch (e) {
    return false;
  }
}

async function getAudioUrl(videoId: string): Promise<string | null> {
  // 1. Piped : On exige du format MP4/M4A. Pas de WebM autorisé car iOS le rejette !
  for (const api of PIPED_APIS) {
    try {
      const res = await fetchWithTimeout(`${api}/streams/${videoId}`, 3000);
      if (res.ok) {
        const data = await res.json();
        const streams = data.audioStreams || [];
        const best = streams.find((s: any) => s.mimeType.includes("m4a") || s.mimeType.includes("mp4"));
        if (best && best.url) return best.url;
      }
    } catch (e) {}
  }

  // 2. Invidious : Itag 140 = M4A (100% compatible Apple)
  for (const api of INVIDIOUS_APIS) {
    const testUrl = `${api}/latest_version?id=${videoId}&itag=140&local=true`;
    const isAlive = await checkUrlAlive(testUrl);
    if (isAlive) return testUrl;
  }

  return null;
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const q = searchParams.get("q");
    const directVideoId = searchParams.get("videoId");

    if (directVideoId) {
      const audioUrl = await getAudioUrl(directVideoId);
      if (audioUrl) return NextResponse.json({ audioUrl });
      return NextResponse.json({ error: "Flux indisponible" }, { status: 404 });
    }

    if (!q) return NextResponse.json({ error: "Recherche vide" }, { status: 400 });

    const videoId = await searchVideoId(q);
    if (!videoId) {
      return NextResponse.json({ error: "Aucun résultat trouvé" }, { status: 404 });
    }

    const audioUrl = await getAudioUrl(videoId);
    if (audioUrl) {
      return NextResponse.json({ videoId, audioUrl });
    }

    return NextResponse.json({ error: "Flux audio introuvable en format M4A" }, { status: 404 });
  } catch (e) {
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}