import type { Track } from "@/types";

export interface iTunesSongResult {
  trackId: number;
  artistId: number;
  collectionId: number;
  trackName: string;
  artistName: string;
  collectionName: string;
  artworkUrl60?: string;
  artworkUrl100?: string;
  previewUrl?: string | null;
  trackTimeMillis?: number;
  primaryGenreName?: string;
  releaseDate?: string;
}

const ITUNES_SEARCH_URL = "https://itunes.apple.com/search";

export async function searchTracks(query: string, limit = 20): Promise<Track[]> {
  const trimmed = query.trim();
  if (!trimmed) return [];

  const params = new URLSearchParams({
    term: trimmed,
    entity: "song",
    limit: String(limit),
  });

  const res = await fetch(`${ITUNES_SEARCH_URL}?${params.toString()}`);
  if (!res.ok) throw new Error(`iTunes API error: ${res.status}`);

  const data = await res.json();
  return data.results.map((r: iTunesSongResult) => ({
    id: `itunes-${r.trackId}`,
    title: r.trackName,
    artist: r.artistName,
    artistId: String(r.artistId),
    album: r.collectionName,
    albumId: String(r.collectionId),
    duration: Math.round((r.trackTimeMillis ?? 0) / 1000),
    previewUrl: r.previewUrl ?? null,
    // On génère une URL de recherche YouTube qui sera utilisée par le Player
    fullStreamUrl: `https://www.youtube.com/results?search_query=${encodeURIComponent(r.artistName + " " + r.trackName)}`,
    coverUrl: r.artworkUrl100?.replace("100x100", "600x600") ?? "", // On force une meilleure qualité d'image
    genre: r.primaryGenreName ?? "Unknown",
    releaseYear: r.releaseDate ? new Date(r.releaseDate).getFullYear() : new Date().getFullYear(),
  }));
}