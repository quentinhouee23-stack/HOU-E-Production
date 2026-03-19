/**
 * Données mockées riches pour peupler l'application
 */

import type { Track, Playlist, User, NewsFeedItem, Artist, GenreStats, UserProfileStats } from "@/types";

export const currentUser: User = {
  id: "user-1",
  name: "Alex Rivera",
  avatarUrl: "https://api.dicebear.com/7.x/avataaars/svg?seed=Alex",
};

export const users: User[] = [
  currentUser,
  { id: "user-2", name: "Marie Dupont", avatarUrl: "https://api.dicebear.com/7.x/avataaars/svg?seed=Marie" },
  { id: "user-3", name: "Thomas Martin", avatarUrl: "https://api.dicebear.com/7.x/avataaars/svg?seed=Thomas" },
  { id: "user-4", name: "Léa Bernard", avatarUrl: "https://api.dicebear.com/7.x/avataaars/svg?seed=Lea" },
];

export const tracks: Track[] = [
  {
    id: "track-1",
    title: "Midnight Dreams",
    artist: "Luna Echo",
    artistId: "artist-1",
    album: "Neon Nights",
    albumId: "album-1",
    duration: 213,
    previewUrl: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3",
    coverUrl: "https://picsum.photos/seed/t1/300/300",
    genre: "Electronic",
    releaseYear: 2024,
    contributors: [
      { userId: "user-1", userName: "Alex Rivera", avatarUrl: currentUser.avatarUrl, addedAt: "2024-01-15T10:00:00Z" },
    ],
  },
  {
    id: "track-2",
    title: "Golden Hour",
    artist: "Solar Winds",
    artistId: "artist-2",
    album: "Horizons",
    albumId: "album-2",
    duration: 245,
    previewUrl: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-2.mp3",
    coverUrl: "https://picsum.photos/seed/t2/300/300",
    genre: "Indie",
    releaseYear: 2023,
    contributors: [
      { userId: "user-2", userName: "Marie Dupont", avatarUrl: users[1].avatarUrl, addedAt: "2024-02-01T14:30:00Z" },
    ],
  },
  {
    id: "track-3",
    title: "Ocean Drive",
    artist: "Coastal Soul",
    artistId: "artist-3",
    album: "Tides",
    albumId: "album-3",
    duration: 198,
    previewUrl: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-3.mp3",
    coverUrl: "https://picsum.photos/seed/t3/300/300",
    genre: "Pop",
    releaseYear: 2024,
  },
  {
    id: "track-4",
    title: "Neon Lights",
    artist: "Luna Echo",
    artistId: "artist-1",
    album: "Neon Nights",
    albumId: "album-1",
    duration: 221,
    previewUrl: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-4.mp3",
    coverUrl: "https://picsum.photos/seed/t4/300/300",
    genre: "Electronic",
    releaseYear: 2024,
  },
  {
    id: "track-5",
    title: "Starlight",
    artist: "Solar Winds",
    artistId: "artist-2",
    album: "Horizons",
    albumId: "album-2",
    duration: 267,
    previewUrl: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-5.mp3",
    coverUrl: "https://picsum.photos/seed/t5/300/300",
    genre: "Indie",
    releaseYear: 2023,
  },
  {
    id: "track-6",
    title: "Summer Breeze",
    artist: "Coastal Soul",
    artistId: "artist-3",
    album: "Tides",
    albumId: "album-3",
    duration: 189,
    previewUrl: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-6.mp3",
    coverUrl: "https://picsum.photos/seed/t6/300/300",
    genre: "Pop",
    releaseYear: 2024,
  },
  {
    id: "track-7",
    title: "Deep Dive",
    artist: "Luna Echo",
    artistId: "artist-1",
    album: "Neon Nights",
    albumId: "album-1",
    duration: 256,
    previewUrl: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-7.mp3",
    coverUrl: "https://picsum.photos/seed/t7/300/300",
    genre: "Electronic",
    releaseYear: 2024,
  },
  {
    id: "track-8",
    title: "Wildfire",
    artist: "Solar Winds",
    artistId: "artist-2",
    album: "Horizons",
    albumId: "album-2",
    duration: 234,
    previewUrl: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-8.mp3",
    coverUrl: "https://picsum.photos/seed/t8/300/300",
    genre: "Indie",
    releaseYear: 2023,
  },
];

export const playlists: Playlist[] = [
  {
    id: "playlist-1",
    name: "Focus & Code",
    description: "Concentration et productivité",
    coverUrl: "https://picsum.photos/seed/p1/400/400",
    trackIds: ["track-1", "track-4", "track-7"],
    createdAt: "2024-01-10T08:00:00Z",
    updatedAt: "2024-03-01T12:00:00Z",
    ownerId: "user-1",
    isShared: false,
  },
  {
    id: "playlist-2",
    name: "Road Trip 2024",
    description: "Vibes pour la route",
    coverUrl: "https://picsum.photos/seed/p2/400/400",
    trackIds: ["track-2", "track-3", "track-5", "track-6"],
    createdAt: "2024-02-15T09:00:00Z",
    updatedAt: "2024-03-05T18:30:00Z",
    ownerId: "user-1",
    isShared: true,
    sharedWith: ["user-2", "user-3", "user-4"],
    contributorIds: ["user-1", "user-2"],
  },
  {
    id: "playlist-3",
    name: "Soirée Chill",
    description: "Ambiance détente",
    coverUrl: "https://picsum.photos/seed/p3/400/400",
    trackIds: ["track-1", "track-2", "track-5", "track-8"],
    createdAt: "2024-02-20T14:00:00Z",
    updatedAt: "2024-03-07T10:00:00Z",
    ownerId: "user-1",
    isShared: false,
  },
  {
    id: "playlist-4",
    name: "Famille - Vacances",
    description: "Playlist partagée famille",
    coverUrl: "https://picsum.photos/seed/p4/400/400",
    trackIds: ["track-1", "track-2", "track-3", "track-6"],
    createdAt: "2024-01-05T07:00:00Z",
    updatedAt: "2024-03-08T09:00:00Z",
    ownerId: "user-1",
    isShared: true,
    sharedWith: ["user-2", "user-3", "user-4"],
    contributorIds: ["user-1", "user-2", "user-3"],
  },
];

export const artists: Artist[] = [
  { id: "artist-1", name: "Luna Echo", avatarUrl: "https://picsum.photos/seed/a1/200/200", genre: "Electronic", followerCount: 125000 },
  { id: "artist-2", name: "Solar Winds", avatarUrl: "https://picsum.photos/seed/a2/200/200", genre: "Indie", followerCount: 89000 },
  { id: "artist-3", name: "Coastal Soul", avatarUrl: "https://picsum.photos/seed/a3/200/200", genre: "Pop", followerCount: 210000 },
];

export const newsFeed: NewsFeedItem[] = [
  {
    id: "news-1",
    type: "new_release",
    title: "Nouvel album : Luna Echo - Neon Nights",
    description: "Le nouvel album tant attendu est disponible.",
    imageUrl: "https://picsum.photos/seed/n1/400/300",
    linkUrl: "/album/album-1",
    createdAt: "2024-03-07T00:00:00Z",
    metadata: { artistId: "artist-1", albumId: "album-1" },
  },
  {
    id: "news-2",
    type: "recommendation",
    title: "Basé sur votre amour pour l'Indie",
    description: "Découvrez Solar Winds et 5 artistes similaires.",
    imageUrl: "https://picsum.photos/seed/n2/400/300",
    linkUrl: "/artist/artist-2",
    createdAt: "2024-03-06T12:00:00Z",
    metadata: { artistId: "artist-2" },
  },
  {
    id: "news-3",
    type: "playlist_update",
    title: "Road Trip 2024 mise à jour",
    description: "Marie a ajouté 2 titres à la playlist partagée.",
    imageUrl: "https://picsum.photos/seed/p2/400/300",
    linkUrl: "/playlists/playlist-2",
    createdAt: "2024-03-05T18:30:00Z",
    metadata: { playlistId: "playlist-2" },
  },
  {
    id: "news-4",
    type: "artist_news",
    title: "Coastal Soul en tournée",
    description: "Dates de la tournée européenne 2024 annoncées.",
    imageUrl: "https://picsum.photos/seed/n4/400/300",
    linkUrl: "/artist/artist-3",
    createdAt: "2024-03-04T09:00:00Z",
    metadata: { artistId: "artist-3" },
  },
];

export const userProfileStats: UserProfileStats = {
  totalListenTimeMinutes: 2847,
  topGenres: [
    { genre: "Electronic", listenTimeMinutes: 920, trackCount: 45, percentage: 32 },
    { genre: "Indie", listenTimeMinutes: 750, trackCount: 38, percentage: 26 },
    { genre: "Pop", listenTimeMinutes: 520, trackCount: 28, percentage: 18 },
    { genre: "Rock", listenTimeMinutes: 400, trackCount: 22, percentage: 14 },
    { genre: "Jazz", listenTimeMinutes: 257, trackCount: 15, percentage: 10 },
  ],
  favoriteArtists: artists,
  playlistsCount: playlists.length,
  tracksCount: tracks.length,
};

export function getTrackById(id: string): Track | undefined {
  return tracks.find((t) => t.id === id);
}

export function getTracksByIds(ids: string[]): Track[] {
  return ids.map((id) => getTrackById(id)).filter((t): t is Track => t != null);
}

export function getPlaylistTracks(playlist: Playlist): Track[] {
  return getTracksByIds(playlist.trackIds);
}

export function getArtistById(id: string): Artist | undefined {
  return artists.find((a) => a.id === id);
}

export function getPlaylistById(id: string): Playlist | undefined {
  return playlists.find((p) => p.id === id);
}
