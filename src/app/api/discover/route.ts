import { NextResponse } from "next/server";
export const dynamic = "force-dynamic";

// ─────────────────────────────────────────────
//  UTILS
// ─────────────────────────────────────────────

function formatDuration(seconds: number) {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s < 10 ? "0" : ""}${s}`;
}

// ─────────────────────────────────────────────
//  BASE DE DONNÉES DE L'ADN (Ton Bon Goût)
// ─────────────────────────────────────────────

const VIBE_CONFIG = {
  rapfr: {
    keywords: ["rap francais", "rap fr banger"],
    artists: ["Gazo", "Tiakola", "Werenoi", "Ninho", "SDM", "PLK", "La Fève"]
  },
  rapus: {
    keywords: ["rap us", "trap us"],
    artists: ["Travis Scott", "Playboi Carti", "Future", "Metro Boomin", "Don Toliver", "Gunna"]
  },
  phonk: {
    keywords: ["brazilian phonk", "phonk montagem", "chill phonk", "phonk house"],
    artists: ["Montagem Orquestra", "DJ FKU", "WINK", "Slowboy", "RXDXVIL"]
  },
  pop: {
    keywords: ["pop hits", "indie pop"],
    artists: ["The Weeknd", "Dua Lipa", "Billie Eilish", "Tate McRae", "Sabrina Carpenter"]
  },
  chill: {
    keywords: ["lofi chill", "chillhop relax"],
    artists: ["Lofi Girl", "Chillhop", "Ouse", "Kina", "Kupla"]
  },
  afro: {
    keywords: ["afrobeat hits", "amapiano dance"],
    artists: ["Rema", "Burna Boy", "Asake", "Wizkid", "Tyla"]
  },
  tout: {
    keywords: ["hits 2026", "top hits"],
    artists: ["Gazo", "Travis Scott", "The Weeknd", "Tiakola", "Playboi Carti"]
  }
};

// ─────────────────────────────────────────────
//  LE BANHAMMER (Filtres Intransigeants)
// ─────────────────────────────────────────────

function isBlacklisted(t: any, vibe: string) {
  const title = (t.title || "").toLowerCase();
  const artist = (t.artist?.name || "").toLowerCase();

  // 1. Tes règles absolues :
  if (vibe === "rapfr" && artist.includes("jul")) return true; // Adieu Jul
  if (vibe === "phonk" && (title.includes("drift") || title.includes("aggressive") || title.includes("agressive") || title.includes("hard"))) return true;
  
  // 2. Règles générales anti-poubelle
  if (title.includes("type beat") || artist.includes("type beat")) return true;
  if (title.includes("karaoke") || title.includes("sped up") || title.includes("speed up") || title.includes("slowed")) return true;

  return false;
}

// ─────────────────────────────────────────────
//  LE PING DE SÉCURITÉ (Fini les sons muets)
// ─────────────────────────────────────────────

const withTimeout = (promise: Promise<any>, ms: number) => Promise.race([
  promise,
  new Promise((_, reject) => setTimeout(() => reject(new Error("Timeout")), ms))
]);

// On teste physiquement le lien audio. Si Deezer ment, on jette la piste.
async function isPreviewWorking(url: string) {
  try {
    const res = await withTimeout(fetch(url, { method: "HEAD" }), 1500);
    // On s'assure que la requête a réussi ET que c'est bien de l'audio
    return res.ok && res.headers.get("content-type")?.includes("audio");
  } catch {
    return false; 
  }
}

async function fetchSearch(query: string, limit = 20) {
  try {
    const res = await fetch(`https://api.deezer.com/search?q=${encodeURIComponent(query)}&limit=${limit}`);
    const data = await res.json();
    return data.data || [];
  } catch {
    return [];
  }
}

// ─────────────────────────────────────────────
//  HANDLER PRINCIPAL
// ─────────────────────────────────────────────

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const vibe = searchParams.get("vibe") || "tout";

  try {
    const config = VIBE_CONFIG[vibe] || VIBE_CONFIG["tout"];
    
    // On tire 2 artistes au hasard dans TON ADN
    const selectedArtists = [...config.artists].sort(() => 0.5 - Math.random()).slice(0, 2);
    // On tire 1 mot-clé au hasard dans ta vibe
    const selectedKeyword = config.keywords[Math.floor(Math.random() * config.keywords.length)];

    // 🟢 LA PRÉCISION CHIRURGICALE : On cherche EXPLICITEMENT dans le catalogue des artistes
    const [artist1Tracks, artist2Tracks, keywordTracks] = await Promise.all([
      fetchSearch(`artist:"${selectedArtists[0]}"`, 20),
      fetchSearch(`artist:"${selectedArtists[1]}"`, 20),
      fetchSearch(selectedKeyword, 20)
    ]);

    const rawTracks = [...artist1Tracks, ...artist2Tracks, ...keywordTracks];

    // Filtrage de base (Durée, Listes noires)
    let validTracks = rawTracks.filter(t => {
      if (!t.preview || !t.preview.startsWith("http")) return false;
      if (t.duration < 50 || t.duration > 400) return false;
      if (isBlacklisted(t, vibe)) return false;
      return true;
    });

    // Anti-doublons absolu
    validTracks = Array.from(new Map(validTracks.map(item => [item.id, item])).values());

    // Mélange façon Tinder
    validTracks.sort(() => 0.5 - Math.random());

    // On ne vérifie que les 20 premiers pour ne pas ralentir ton téléphone
    const tracksToCheck = validTracks.slice(0, 20);

    // 🟢 VÉRIFICATION ACTIVE DES MP3 EN PARALLÈLE (Adieu les pistes fantômes)
    const checkedPromises = await Promise.all(tracksToCheck.map(async (t) => {
      const isValid = await isPreviewWorking(t.preview);
      return isValid ? t : null;
    }));

    const finalTracks = checkedPromises
      .filter(t => t !== null)
      .map(t => ({
        id: t.id.toString(),
        title: t.title,
        artist: t.artist.name,
        image: t.album.cover_xl || t.album.cover_medium,
        duration: formatDuration(t.duration),
        preview: t.preview
      }));

    return NextResponse.json({ tracks: finalTracks });

  } catch (error) {
    console.error("Erreur API Discover:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}