import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The shared contract lives in ../shared, outside the app.
  experimental: { externalDir: true },
};

export default nextConfig;
