/**
 * Simulation de la mise à jour IA des playlists (mock)
 * À remplacer par un vrai appel API plus tard.
 */

import type { Playlist, Track } from "@/types";
import { tracks } from "./data";

const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Simule le rafraîchissement intelligent d'une playlist :
 * - ajout de nouveautés basées sur le genre
 * - réorganisation des morceaux
 */
export async function updatePlaylistWithAI(playlist: Playlist): Promise<{
  addedTrackIds: string[];
  message: string;
}> {
  await delay(1500 + Math.random() * 1000);

  const existingIds = new Set(playlist.trackIds);
  const genreCount: Record<string, number> = {};
  tracks.forEach((t) => {
    if (existingIds.has(t.id)) genreCount[t.genre] = (genreCount[t.genre] ?? 0) + 1;
  });
  const topGenre = Object.entries(genreCount).sort((a, b) => b[1] - a[1])[0]?.[0] ?? "Pop";
  const candidates = tracks.filter(
    (t) => !existingIds.has(t.id) && t.genre === topGenre
  );
  const toAdd = candidates.slice(0, 2).map((t) => t.id);
  return {
    addedTrackIds: toAdd,
    message: toAdd.length
      ? `Ajout de ${toAdd.length} titre(s) recommandé(s) en ${topGenre}`
      : "Aucune nouveauté à ajouter pour l'instant",
  };
}
