import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const videoId = searchParams.get("videoId");
  if (!videoId) return new Response("Missing videoId", { status: 400 });

  try {
    // Liste de serveurs miroirs "Piped" (ils bypassent YouTube à notre place)
    const instances = [
      "https://pipedapi.kavin.rocks",
      "https://pipedapi.drgns.space",
      "https://pipedapi.r4fo.com",
      "https://piped-api.lunar.icu"
    ];

    let audioUrl = "";

    // On interroge les miroirs un par un jusqu'à ce qu'un serveur nous donne la musique
    for (const instance of instances) {
      try {
        console.log(`[stream] Demande au miroir : ${instance}...`);
        
        const res = await fetch(`${instance}/streams/${videoId}`, {
          headers: { "Accept": "application/json" }
        });
        
        if (!res.ok) continue;
        const data = await res.json();
        
        // On cherche un format MP4 (crucial pour que ça marche sur ton iPhone !)
        const stream = data.audioStreams?.find((s: any) => 
          s.mimeType.includes("mp4") || s.mimeType.includes("m4a")
        ) || data.audioStreams?.[0]; 
        
        if (stream && stream.url) {
          audioUrl = stream.url;
          console.log(`[stream] Succès ! Musique trouvée sur ${instance}`);
          break;
        }
      } catch (e) {
        console.warn(`[stream] Échec sur ${instance}`);
      }
    }

    if (!audioUrl) {
      return new Response("Impossible de trouver le flux audio sur les serveurs miroirs.", { status: 404 });
    }

    // On récupère la musique depuis le miroir et on l'envoie à ton iPhone
    const rangeHeader = req.headers.get("range");

    const upstream = await fetch(audioUrl, {
      headers: {
        ...(rangeHeader ? { Range: rangeHeader } : {}),
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
      },
    });

    const responseHeaders = new Headers({
      "Content-Type": "audio/mp4",
      "Accept-Ranges": "bytes",
      "Access-Control-Allow-Origin": "*",
      "Cache-Control": "no-store",
    });

    const contentLength = upstream.headers.get("Content-Length");
    const contentRange = upstream.headers.get("Content-Range");
    const contentType = upstream.headers.get("Content-Type");
    
    if (contentLength) responseHeaders.set("Content-Length", contentLength);
    if (contentRange) responseHeaders.set("Content-Range", contentRange);
    if (contentType) responseHeaders.set("Content-Type", contentType);

    return new Response(upstream.body, {
      status: upstream.status,
      headers: responseHeaders,
    });

  } catch (e: any) {
    console.error("[stream] Erreur brute:", e?.message || e);
    return new Response(`Erreur: ${e?.message || "inconnue"}`, { status: 500 });
  }
}