import { NextResponse } from "next/server";
import { getDatabase } from "../../../../lib/database";

export async function GET() {
  const result = await getDatabase().query<{ id: string; title: string; description: string | null; category: string; scope: string; starts_at: Date; ends_at: Date }>("SELECT id, title, description, category, scope, starts_at, ends_at FROM elections WHERE status = 'SCHEDULED' AND ends_at > now() ORDER BY starts_at ASC");
  return NextResponse.json({ elections: result.rows.map((e) => ({ id: e.id, title: e.title, description: e.description, category: e.category, scope: e.scope, startsAt: e.starts_at, endsAt: e.ends_at })) }, { headers: { "Cache-Control": "no-store" } });
}