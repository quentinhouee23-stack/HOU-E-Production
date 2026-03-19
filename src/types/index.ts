/**
 * Types stricts pour l'application de streaming musical
 */

export interface Track {
  id: string;
  title: string;
  artist: string;
  artistId: string;
  album: string;
  albumId: string;
  duration: number; // en secondes
  previewUrl: string | null; // URL pour extrait 30s
  coverUrl: string;
  genre: string;
  releaseYear: number;
  contributors?: TrackContributor[]; // pour playlists partagées
}

export interface TrackContributor {
  userId: string;
  userName: string;
  avatarUrl: string;
  addedAt: string; // ISO date
}

export interface Album {
  id: string;
  title: string;
  artist: string;
  artistId: string;
  coverUrl: string;
  releaseYear: number;
  trackCount: number;
  genre: string;
}

export interface Artist {
  id: string;
  name: string;
  avatarUrl: string;
  genre: string;
  followerCount: number;
}

export interface Playlist {
  id: string;
  name: string;
  description: string;
  coverUrl: string;
  trackIds: string[];
  createdAt: string;
  updatedAt: string;
  ownerId: string;
  isShared: boolean;
  sharedWith?: string[]; // userIds
  contributorIds?: string[];
}

export interface User {
  id: string;
  name: string;
  avatarUrl: string;
  email?: string;
}

export interface GenreStats {
  genre: string;
  listenTimeMinutes: number;
  trackCount: number;
  percentage: number;
}

export interface UserProfileStats {
  totalListenTimeMinutes: number;
  topGenres: GenreStats[];
  favoriteArtists: Artist[];
  playlistsCount: number;
  tracksCount: number;
}

export interface NewsFeedItem {
  id: string;
  type: "new_release" | "recommendation" | "playlist_update" | "artist_news";
  title: string;
  description: string;
  imageUrl: string;
  linkUrl: string;
  createdAt: string;
  metadata?: {
    artistId?: string;
    albumId?: string;
    playlistId?: string;
  };
}

export type PlayerStatus = "idle" | "playing" | "paused" | "loading";

export interface PlayerState {
  currentTrack: Track | null;
  queue: Track[];
  currentTime: number;
  duration: number;
  status: PlayerStatus;
  volume: number;
}

/** Playlist utilisateur pilotée par l'app (différente des playlists mockées de data.ts) */
export interface UserPlaylist {
  id: string;
  name: string;
  description: string;
  tracks: Track[];
  createdAt: string;
  updatedAt: string;
  /** Durée totale de la playlist (somme des durées des pistes) en secondes */
  totalDuration: number;
}

export interface Track {
  id: string;
  title: string;
  artist: string;
  // Ajoute cette ligne exacte :
  image?: string; 
}