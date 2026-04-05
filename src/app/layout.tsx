// @ts-nocheck
import type { Metadata, Viewport } from "next";
import { Plus_Jakarta_Sans, JetBrains_Mono } from "next/font/google"; 
import { AuthProvider } from "@/context/AuthContext";
import { MusicProvider } from "@/context/MusicContext";
import { PlaylistProvider } from "@/context/PlaylistContext";
import { LiquidGlassNav } from "@/components/ui/LiquidGlassNav";
import { FullScreenPlayer } from "@/components/player/FullScreenPlayer"; 
import { MiniPlayer } from "@/components/player/MiniPlayer";
import { Player } from "@/components/player/Player";
import { ImportModal } from "@/components/modals/ImportModal"; 
import { SplashScreen } from "@/components/ui/SplashScreen";
import { OrientationLock } from "@/components/ui/OrientationLock";
import { NetworkStatus } from "@/components/ui/NetworkStatus"; 
import { AnimationProvider } from "@/components/ui/AnimationProvider"; 
import "./globals.css";

const plusJakarta = Plus_Jakarta_Sans({
  variable: "--font-sans", 
  subsets: ["latin"],
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-geist-mono", 
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "HOUÉE",
  description: "Ta musique, tes règles.",
  manifest: "/manifest.json",
  icons: {
    icon: "/logo.png",
    shortcut: "/logo.png",
    // 🟢 CORRECTION ICI : On force iOS à utiliser une image dédiée, carrée et sans transparence
    apple: [
      { url: "/apple-icon.png", sizes: "180x180", type: "image/png" },
    ],
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "HOUÉE",
  },
};

export const viewport: Viewport = {
  themeColor: "#121212",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="fr">
      <body className={`${plusJakarta.variable} ${jetbrainsMono.variable} font-sans antialiased bg-background text-foreground overflow-x-hidden`}>
        <AuthProvider>  
          <MusicProvider>
            <PlaylistProvider>
              
              <OrientationLock />
              <NetworkStatus />

              <SplashScreen>
                <AnimationProvider>
                  <main className="min-h-screen main-content-padding">
                    {children}
                  </main>
                  
                  <Player />
                  <MiniPlayer />
                  <FullScreenPlayer />
                  <ImportModal />
                  <LiquidGlassNav />
                </AnimationProvider>
              </SplashScreen>

            </PlaylistProvider>
          </MusicProvider>
        </AuthProvider>
      </body>
    </html>
  );
}