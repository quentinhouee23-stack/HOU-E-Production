import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const videoId = searchParams.get("videoId");
  if (!videoId) return new Response("Missing videoId", { status: 400 });

  // Les meilleures instances Invidious mondiales (très stables)
  const instances = [
    "https://inv.tux.pizza",
    "https://invidious.nerdvpn.de",
    "https://invidious.flokinet.to",
    "https://vid.puffyan.us",
    "https://invidious.privacyredirect.com"
  ];

  for (const instance of instances) {
    try {
      console.log(`[stream] Test rapide de : ${instance}`);
      
      // Test ultra-rapide (1.5 secondes max) pour voir si l'instance est vivante
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 1500);
      
      // On demande juste le titre pour vérifier que le serveur n'est pas bloqué
      const res = await fetch(`${instance}/api/v1/videos/${videoId}?fields=title`, {
        signal: controller.signal
      });
      clearTimeout(timeoutId);

      if (res.ok) {
        console.log(`[stream] VICTOIRE ! Redirection de l'iPhone vers : ${instance}`);
        
        // itag=140 : Format audio natif d'Apple (m4a)
        // local=true : Force l'instance Invidious à masquer ton IP à YouTube
        const streamUrl = `${instance}/latest_version?id=${videoId}&itag=140&local=true`;
        
        // On redirige l'iPhone pour qu'il gère le streaming tout seul (magique pour iOS)
        return NextResponse.redirect(streamUrl, {
          status: 302,
          headers: {
            "Cache-Control": "no-store, max-age=0"
          }
        });
      }
    } catch (e) {
      console.log(`[stream] Échec ou serveur trop lent : ${instance}`);
    }
  }

  return new Response("Tous les serveurs relais sont inaccessibles, réessaie.", { status: 500 });
}