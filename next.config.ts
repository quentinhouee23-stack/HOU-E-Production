import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["yt-search", "cheerio"],
  images: {
    dangerouslyAllowSVG: true,
    contentSecurityPolicy: "default-src 'self'; script-src 'none'; sandbox;",
    remotePatterns: [
      { protocol: "https", hostname: "**" },
    ],
  },
};

export default nextConfig;