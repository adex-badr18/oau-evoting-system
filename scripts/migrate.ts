import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { Client } from "pg";

async function loadLocalEnvironment() {
  try {
    const file = await readFile(join(process.cwd(), ".env.local"), "utf8");
    for (const line of file.split(/\r?\n/)) {
      const match = line.match(/^\s*([A-Z0-9_]+)=(.*)\s*$/);
      if (!match || process.env[match[1]]) continue;
      process.env[match[1]] = match[2].replace(/^['\"]|['\"]$/g, "");
    }
  } catch { /* Variables may have been supplied by the server. */ }
}

async function main() {
  await loadLocalEnvironment();
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required");
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  try {
    await client.query(`CREATE TABLE IF NOT EXISTS schema_migrations (version text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())`);
    const applied = await client.query<{ version: string }>("SELECT version FROM schema_migrations");
    const appliedVersions = new Set(applied.rows.map((row) => row.version));
    const migrationsDirectory = join(process.cwd(), "db", "migrations");
    const migrations = (await readdir(migrationsDirectory)).filter((name) => name.endsWith(".sql")).sort();
    const schemaExists = await client.query<{ exists: string | null }>("SELECT to_regclass('public.elections') AS exists");

    for (const migrationName of migrations) {
      if (appliedVersions.has(migrationName)) continue;
      if (migrationName.startsWith("001_") && schemaExists.rows[0].exists) {
        await client.query("INSERT INTO schema_migrations (version) VALUES ($1)", [migrationName]);
        console.log(`Recorded existing baseline: ${migrationName}`);
        continue;
      }
      const sql = await readFile(join(migrationsDirectory, migrationName), "utf8");
      await client.query("BEGIN");
      try {
        await client.query(sql);
        await client.query("INSERT INTO schema_migrations (version) VALUES ($1)", [migrationName]);
        await client.query("COMMIT");
        console.log(`Applied migration: ${migrationName}`);
      } catch (error) {
        await client.query("ROLLBACK");
        throw error;
      }
    }
  } finally { await client.end(); }
}
main().catch((error) => { console.error(error); process.exit(1); });