import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  reactStrictMode: false, // Disable strict mode to prevent double chart init
  experimental: {
    optimizePackageImports: ["lucide-react"],
  },
  turbopack: {
    root: path.resolve(__dirname),
  },
};

export default nextConfig;
