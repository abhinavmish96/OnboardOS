// Apply supabase/migrations/*.sql to SUPABASE_DB_URL (from ../.env.supabase or the env).
// Run from web/: node scripts/db-migrate.mjs
import fs from "node:fs";
import path from "node:path";
import postgres from "postgres";

const root = path.resolve(import.meta.dirname, "..", "..");
const envFile = path.join(root, ".env.supabase");
if (fs.existsSync(envFile)) {
  for (const line of fs.readFileSync(envFile, "utf8").split("\n")) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
    if (m && !(m[1] in process.env)) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
}
if (!process.env.SUPABASE_DB_URL) {
  console.error("SUPABASE_DB_URL is not set (put it in .env.supabase at the repo root).");
  process.exit(1);
}
const sql = postgres(process.env.SUPABASE_DB_URL, { prepare: false, max: 1, onnotice: () => {} });
const dir = path.join(root, "supabase", "migrations");
for (const file of fs.readdirSync(dir).filter((f) => f.endsWith(".sql")).sort()) {
  await sql.unsafe(fs.readFileSync(path.join(dir, file), "utf8"));
  console.log("applied", file);
}
const tables = await sql`select table_name from information_schema.tables where table_schema = 'onboardos' order by 1`;
console.log("onboardos tables:", tables.map((t) => t.table_name).join(", "));
await sql.end();
