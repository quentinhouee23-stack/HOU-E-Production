/** @type {import('next').NextConfig} */
const nextConfig = {
  reactCompiler: true,
  images: {
    // 🟢 OPTIMISATION : Next.js garde les images en mémoire pendant 1 an !
    minimumCacheTTL: 31536000, 
    remotePatterns: [
      { 
        protocol: "https", 
        hostname: "**" 
      },
    ],
  },
};

export default nextConfig;