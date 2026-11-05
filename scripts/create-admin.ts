import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { Client } from "pg";
import { hashPassword } from "../src/lib/auth/password";

async function loadLocalEnvironment() {
  try {
    const file = await readFile(resolve(process.cwd(), ".env.local"), "utf8");
    for (const line of file.split(/\r?\n/)) {
      const match = line.match(/^\s*([A-Z0-9_]+)=(.*)\s*$/);
      if (!match || process.env[match[1]]) continue;
      process.env[match[1]] = match[2].replace(/^['\"]|['\"]$/g, "");
    }
  } catch {
    // Environment variables may instead have been supplied by the host.
  }
}

async function main() {
  await loadLocalEnvironment();
  const email = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  const password = process.env.ADMIN_PASSWORD;
  const fullName = process.env.ADMIN_NAME?.trim() || "OAU ICT Test Administrator";
  const resetExisting = process.env.ADMIN_RESET === "true";
  if (resetExisting && process.env.NODE_ENV === "production") throw new Error("ADMIN_RESET is disabled in production. Retain the existing administrator account or use the approved recovery process.");
  if (!email || !password) throw new Error("Set ADMIN_EMAIL and ADMIN_PASSWORD before running this command.");
  if (password.length < 12) throw new Error("ADMIN_PASSWORD must contain at least 12 characters.");
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required. Create .env.local first.");

  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  try {
    const existing = await client.query<{ id: string }>("SELECT id FROM admin_users WHERE email = $1", [email]);
    if (existing.rowCount) {
      if (!resetExisting) throw new Error(`An administrator already exists for ${email}. Set ADMIN_RESET=true to reset this local test account.`);
      await client.query("UPDATE admin_users SET full_name = $1, password_hash = $2, is_active = true, updated_at = now() WHERE id = $3", [fullName, await hashPassword(password), existing.rows[0].id]);
      console.log(`Password reset for ICT administrator ${email}.`);
      return;
    }
    await client.query(
      "INSERT INTO admin_users (email, full_name, role, password_hash) VALUES ($1, $2, 'ICT_ADMIN', $3)",
      [email, fullName, await hashPassword(password)],
    );
    console.log(`ICT administrator created for ${email}.`);
  } finally {
    await client.end();
  }
}

main().catch((error) => { console.error(error); process.exit(1); });
