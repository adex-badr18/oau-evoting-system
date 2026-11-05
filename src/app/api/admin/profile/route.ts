import { assertSameOrigin } from "../../../../lib/auth/request-origin";
import { NextResponse } from "next/server";
import { z } from "zod";
import { inTransaction } from "../../../../lib/database";
import { hashPassword, verifyPassword } from "../../../../lib/auth/password";
import { requireAdminSession } from "../../../../lib/auth/session";

const updateInput = z.object({
  fullName: z.string().trim().min(3).max(160),
  email: z.string().trim().email().max(320),
  currentPassword: z.string().min(1).max(512),
  newPassword: z.string().min(12).max(512).optional().or(z.literal("")),
});

export async function GET() {
  let session;
  try {
    session = await requireAdminSession();
  } catch {
    return NextResponse.json({ error: "Your administrator session has expired. Please sign in again." }, { status: 401 });
  }
  try {
    const profile = await inTransaction(async (client) => {
      const result = await client.query<{ full_name: string; email: string; role: string; mfa_enabled: boolean }>("SELECT full_name, email, role, mfa_enabled FROM admin_users WHERE id = $1 AND is_active = true", [session.subject]);
      if (!result.rowCount) throw new Error("Administrator account was not found.");
      return result.rows[0];
    });
    return NextResponse.json(profile);
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to load profile." }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    assertSameOrigin(request);
    const session = await requireAdminSession();
    const input = updateInput.parse(await request.json());
    const profile = await inTransaction(async (client) => {
      const result = await client.query<{ password_hash: string }>("SELECT password_hash FROM admin_users WHERE id = $1 AND is_active = true FOR UPDATE", [session.subject]);
      if (!result.rowCount || !(await verifyPassword(input.currentPassword, result.rows[0].password_hash))) throw new Error("Your current password is incorrect.");
      const passwordHash = input.newPassword ? await hashPassword(input.newPassword) : result.rows[0].password_hash;
      const updated = await client.query<{ full_name: string; email: string; role: string; mfa_enabled: boolean }>(
        "UPDATE admin_users SET full_name = $1, email = $2, password_hash = $3, updated_at = now() WHERE id = $4 RETURNING full_name, email, role, mfa_enabled",
        [input.fullName, input.email.toLowerCase(), passwordHash, session.subject],
      );
      await client.query("INSERT INTO audit_events (actor_admin_id, actor_type, action, success, metadata) VALUES ($1, 'ADMIN', 'ADMIN_PROFILE_UPDATED', true, $2::jsonb)", [session.subject, JSON.stringify({ emailChanged: true, passwordChanged: Boolean(input.newPassword) })]);
      return updated.rows[0];
    });
    return NextResponse.json(profile);
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to update profile." }, { status: 400 });
  }
}
