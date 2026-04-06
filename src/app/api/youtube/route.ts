// @ts-nocheck
import { NextResponse } from "next/server";
import { createClient } from '@supabase/supabase-js';

export const runtime = "nodejs";
export const maxDuration = 20;

const PIPED_APIS = [
  "https://pipedapi.kavin.rocks",
  "https://pipedapi.syncpundit.io",
  "https://api.piped.projectsegfau.lt",
  "https://pipedapi.smnz.de"
];

const INVIDIOUS_APIS = [
  "https://inv.tux.pizza",
  "https://invidious.nerdvpn.de",
  "https://inv.nadeko.net",
  "https://invidious.fdn.fr"
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

// 🟢 RECHERCHE BLINDÉE SUR 3 NIVEAUX
async function searchVideoId(q: string): Promise<string | null> {
  // Niveau 1 : Piped
  for (const api of PIPED_APIS) {
    try {
      const res = await fetchWithTimeout(`${api}/search?q=${encodeURIComponent(q)}&filter=videos`, 2500);
      if (res.ok) {
        const data = await res.json();
        if (data.items && data.items.length > 0) {
          const videoId = data.items[0].url.split("?v=")[1];
          if (videoId) return videoId;
        }
      }
    } catch (e) {}
  }

  // Niveau 2 : Invidious API
  for (const api of INVIDIOUS_APIS) {
    try {
      const res = await fetchWithTimeout(`${api}/api/v1/search?q=${encodeURIComponent(q)}&type=video`, 2500);
      if (res.ok) {
        const data = await res.json();
        if (data && data.length > 0 && data[0].videoId) {
          return data[0].videoId;
        }
      }
    } catch (e) {}
  }

  // Niveau 3 : Scrape direct
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

// 🟢 FABRICATION DU LIEN AUDIO SANS TEST VERCEL
async function getAudioUrl(videoId: string): Promise<string | null> {
  // On tente d'abord de récupérer l'URL Piped s'il accepte Vercel
  for (const api of PIPED_APIS) {
    try {
      const res = await fetchWithTimeout(`${api}/streams/${videoId}`, 2000);
      if (res.ok) {
        const data = await res.json();
        const streams = data.audioStreams || [];
        const best = streams.find((s: any) => s.mimeType.includes("m4a") || s.mimeType.includes("mp4"));
        if (best && best.url) return best.url;
      }
    } catch (e) {}
  }

  // Si Piped bloque Vercel, ON NE TESTE PLUS INVIDIOUS DEPUIS VERCEL.
  // On donne directement le lien M4A (itag 140) à ton téléphone. 
  // C'est ton iPhone qui contournera les sécurités en l'ouvrant !
  const randomApi = INVIDIOUS_APIS[Math.floor(Math.random() * INVIDIOUS_APIS.length)];
  return `${randomApi}/latest_version?id=${videoId}&itag=140&local=true`;
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
      // Secours ultime API Google
      const apiKey = process.env.YOUTUBE_API_KEY;
      if (apiKey) {
        try {
          const res = await fetch(`https://www.googleapis.com/youtube/v3/search?part=snippet&type=video&maxResults=1&q=${encodeURIComponent(q)}&key=${apiKey}`);
          const data = await res.json();
          if (data.items && data.items.length > 0) {
            const vId = data.items[0].id.videoId;
            const aUrl = await getAudioUrl(vId);
            if (aUrl) return NextResponse.json({ videoId: vId, audioUrl: aUrl });
          }
        } catch(e) {}
      }
      return NextResponse.json({ error: "Aucun résultat trouvé" }, { status: 404 });
    }

    const audioUrl = await getAudioUrl(videoId);
    if (audioUrl) {
      return NextResponse.json({ videoId, audioUrl });
    }

    return NextResponse.json({ error: "Flux audio introuvable au format M4A" }, { status: 404 });
  } catch (e) {
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}