import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // no floating dev badge in demo recordings/screenshots
  devIndicators: false,
  turbopack: {
    root: process.cwd(),
  },
};

export default nextConfig;
