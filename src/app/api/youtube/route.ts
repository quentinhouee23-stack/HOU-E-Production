// @ts-nocheck
import { NextResponse } from "next/server";

export const runtime = "nodejs";

function fetchWithTimeout(url: string, ms: number, options: RequestInit = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  return fetch(url, { ...options, signal: controller.signal }).finally(() => clearTimeout(timer));
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const q = searchParams.get("q");

    if (!q) return NextResponse.json({ error: "Recherche vide" }, { status: 400 });

    // 1. Scraping direct (Ultra-rapide)
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
        if (match && match[1]) return NextResponse.json({ videoId: match[1] });
      }
    } catch (e) {}

    // 2. API Piped en secours
    const PIPED_APIS = ["https://api.piped.projectsegfau.lt", "https://pipedapi.smnz.de", "https://pipedapi.kavin.rocks"];
    for (const api of PIPED_APIS) {
      try {
        const res = await fetchWithTimeout(`${api}/search?q=${encodeURIComponent(q)}&filter=videos`, 2500);
        if (res.ok) {
          const data = await res.json();
          if (data.items && data.items.length > 0) {
            const videoId = data.items[0].url.split("?v=")[1];
            if (videoId) return NextResponse.json({ videoId });
          }
        }
      } catch (e) {}
    }

    return NextResponse.json({ error: "Aucun résultat trouvé" }, { status: 404 });
  } catch (e) {
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}