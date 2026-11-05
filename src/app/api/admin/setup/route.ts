import { assertSameOrigin } from "../../../../lib/auth/request-origin";
import { NextResponse } from "next/server";
import { z } from "zod";
import { inTransaction } from "../../../../lib/database";
import { hashPassword } from "../../../../lib/auth/password";
import { setSession } from "../../../../lib/auth/session";

const input = z.object({
  fullName: z.string().trim().min(3).max(160),
  email: z.string().trim().email().max(320),
  password: z.string().min(12).max(512),
});

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const administrator = input.parse(await request.json());
    const id = await inTransaction(async (client) => {
      // Serialise setup attempts so two simultaneous visitors cannot both create an initial admin.
      await client.query("SELECT pg_advisory_xact_lock(82402917)");
      const count = await client.query<{ count: string }>("SELECT count(*) FROM admin_users");
      if (Number(count.rows[0].count) > 0) throw new Error("Initial setup has already been completed. Contact an ICT administrator.");
      const result = await client.query<{ id: string }>(
        "INSERT INTO admin_users (email, full_name, role, password_hash) VALUES ($1, $2, 'ICT_ADMIN', $3) RETURNING id",
        [administrator.email.toLowerCase(), administrator.fullName, await hashPassword(administrator.password)],
      );
      await client.query("INSERT INTO audit_events (actor_admin_id, actor_type, action, success, metadata) VALUES ($1, 'ADMIN', 'INITIAL_ADMIN_CREATED', true, '{}'::jsonb)", [result.rows[0].id]);
      return result.rows[0].id;
    });
    await setSession({ subject: id, actorType: "ADMIN", role: "ICT_ADMIN" });
    return NextResponse.json({ success: true }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to complete initial setup.";
    return NextResponse.json({ error: message }, { status: message.includes("already been completed") ? 403 : 400 });
  }
}
