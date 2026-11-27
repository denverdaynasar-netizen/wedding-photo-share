import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Standard Next.js production config
  experimental: {
    agentUpgrade: "security",
  },
};

export default nextConfig;
