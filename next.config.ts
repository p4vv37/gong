import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // no floating dev badge in demo recordings/screenshots
  devIndicators: false,
  allowedDevOrigins: ["127.0.0.1"],
  turbopack: {
    root: process.cwd(),
  },
};

export default nextConfig;
