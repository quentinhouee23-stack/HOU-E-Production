import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const videoId = searchParams.get("videoId");
  if (!videoId) return new Response("Missing videoId", { status: 400 });

  // Serveurs miroirs (Invidious) qui ne sont pas bloqués par YouTube
  const instances = [
    "https://inv.tux.pizza",
    "https://invidious.flokinet.to",
    "https://invidious.nerdvpn.de",
    "https://invidious.privacyredirect.com"
  ];

  for (const instance of instances) {
    try {
      // Test ultra-rapide (1.5s) pour vérifier que le serveur miroir est en ligne
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 1500);
      
      const check = await fetch(`${instance}/api/v1/videos/${videoId}?fields=title`, {
        signal: controller.signal
      });
      clearTimeout(timeoutId);

      if (check.ok) {
        // Le serveur est en ligne ! On REDIRIGE ton navigateur vers lui.
        // C'est ton PC qui télécharge la musique directement, Render est hors-jeu.
        // itag=140 = format audio pur
        const streamUrl = `${instance}/latest_version?id=${videoId}&itag=140`;
        
        return NextResponse.redirect(streamUrl, {
          status: 302,
          headers: { "Cache-Control": "no-store" }
        });
      }
    } catch (e) {
      // Le miroir est mort, on teste le suivant dans la liste
      continue;
    }
  }

  return new Response("Tous les serveurs miroirs sont inaccessibles", { status: 500 });
}