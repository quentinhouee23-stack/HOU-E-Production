import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { AuthProvider } from "@/context/AuthContext";
import { NotificationProvider } from "@/context/NotificationContext"; // 🟢 Import du système de notifications
import { MusicProvider } from "@/context/MusicContext";
import { PlaylistProvider } from "@/context/PlaylistContext";
import { LiquidGlassNav } from "@/components/ui/LiquidGlassNav";
import { FullScreenPlayer } from "@/components/player/FullScreenPlayer"; 
import { MiniPlayer } from "@/components/player/MiniPlayer";
import { Player } from "@/components/player/Player";
import { ImportModal } from "@/components/modals/ImportModal"; 
import { SplashScreen } from "@/components/ui/SplashScreen"; // 🟢 Import de ton écran de chargement
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

// 🟢 CONFIGURATION DE L'APP NATIVE (PWA) ET DE L'ICÔNE
export const metadata: Metadata = {
  title: "Avoir le Choix",
  description: "Ta musique, tes règles.",
  manifest: "/manifest.json",
  icons: {
    icon: "/logo.png",
    shortcut: "/logo.png",
    apple: "/logo.png", // Très important pour l'icône sur iPhone
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Avoir le Choix",
  },
};

// 🟢 CONFIGURATION DU VIEWPORT POUR EMPÊCHER LE ZOOM SUR MOBILE
export const viewport: Viewport = {
  themeColor: "#121212",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="fr">
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased bg-background text-foreground`}>
        <AuthProvider>  
          <NotificationProvider>
            <MusicProvider>
              <PlaylistProvider>
                
                {/* 🟢 TON ÉCRAN DE CHARGEMENT ENVELOPPE TOUTE L'APP */}
                <SplashScreen>
                  <main className="min-h-screen main-content-padding">
                    {children}
                  </main>
                  
                  {/* Logique Audio */}
                  <Player />
                  
                  {/* Interfaces de lecture */}
                  <MiniPlayer />
                  <FullScreenPlayer />
                  
                  {/* Le détecteur de liens TikTok/YouTube */}
                  <ImportModal />
                  
                  {/* Navigation */}
                  <LiquidGlassNav />
                </SplashScreen>

              </PlaylistProvider>
            </MusicProvider>
          </NotificationProvider>
        </AuthProvider>
      </body>
    </html>
  );
}