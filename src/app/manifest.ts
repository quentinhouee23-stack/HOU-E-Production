import { MetadataRoute } from 'next'
 
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Stream Music',
    short_name: 'Stream',
    description: 'Ton application de streaming musicale',
    start_url: '/',
    display: 'standalone', // 🟢 Force l'affichage plein écran (cache le navigateur)
    orientation: 'portrait-primary', // 🟢 BLOQUE L'APPLICATION EN MODE PORTRAIT
    background_color: '#121212',
    theme_color: '#121212',
    icons: [
      {
        src: 'https://api.dicebear.com/7.x/shapes/png?seed=music', // L'icône de ton app
        sizes: '512x512',
        type: 'image/png',
      },
    ],
  }
}