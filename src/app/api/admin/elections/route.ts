import { assertSameOrigin } from "../../../../lib/auth/request-origin";
import { NextResponse } from "next/server";
import { requireAdminSession } from "../../../../lib/auth/session";
import { createElection } from "../../../../lib/admin/election-service";
import { getDatabase } from "../../../../lib/database";
import { closeExpiredElections } from "../../../../lib/election-maintenance";

export async function GET() {
  let administrator;
  try {
    administrator = await requireAdminSession();
  } catch {
    return NextResponse.json({ error: "Your administrator session has expired. Please sign in again." }, { status: 401 });
  }

  try {
    await closeExpiredElections();
    const elections = await getDatabase().query<{ id: string; title: string; status: string; starts_at: Date; ends_at: Date }>(
      `SELECT e.id, e.title, e.status, e.starts_at, e.ends_at
       FROM elections e
       WHERE $1 = 'ICT_ADMIN' OR EXISTS (
         SELECT 1 FROM election_administrators ea
         WHERE ea.election_id = e.id AND ea.admin_user_id = $2
       )
       ORDER BY e.created_at DESC`,
      [administrator.role ?? "", administrator.subject],
    );
    return NextResponse.json({ elections: elections.rows.map((election) => ({ id: election.id, title: election.title, status: election.status, startsAt: election.starts_at, endsAt: election.ends_at })) });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to load elections." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const administrator = await requireAdminSession(["ICT_ADMIN", "ELECTION_ADMIN"]);
    const election = await createElection(await request.json(), administrator.subject);
    return NextResponse.json(election, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to create election." }, { status: 400 });
  }
}
