import fs from "node:fs";
import path from "node:path";
import type { NextConfig } from "next";

// Shared Supabase settings live in ../.env.supabase (never committed); the agent reads the
// same file, so both services use one database.
const shared = path.join(__dirname, "..", ".env.supabase");
if (fs.existsSync(shared)) {
  for (const line of fs.readFileSync(shared, "utf8").split("\n")) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
    if (m && !(m[1] in process.env)) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
}

const nextConfig: NextConfig = {
  // The shared contract lives in ../shared, outside the app.
  experimental: { externalDir: true },
  serverExternalPackages: ["postgres"],
};

export default nextConfig;
