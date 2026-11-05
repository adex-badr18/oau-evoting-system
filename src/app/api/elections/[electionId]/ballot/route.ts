import { NextResponse } from "next/server";
import { readSession } from "../../../../../lib/auth/session";
import { getDatabase } from "../../../../../lib/database";

export async function GET(_: Request, { params }: { params: Promise<{ electionId: string }> }) {
  const { electionId } = await params; const session = await readSession();
  if (!session || session.actorType !== "VOTER" || session.electionId !== electionId) return NextResponse.json({ error: "Voter authentication is required." }, { status: 401 });
  const election = await getDatabase().query<{ title: string; status: string; starts_at: Date; ends_at: Date; has_voted: boolean; must_change_password: boolean }>(`SELECT e.title,e.status,e.starts_at,e.ends_at,v.has_voted,v.must_change_password FROM elections e JOIN eligible_voters v ON v.election_id=e.id WHERE e.id=$1 AND v.id=$2`, [electionId, session.subject]);
  if (election.rowCount !== 1) return NextResponse.json({ error: "Election not found." }, { status: 404 });
  if (election.rows[0].must_change_password) return NextResponse.json({ error: "Change your temporary password before voting." }, { status: 403 });
  const positions = await getDatabase().query<{ position_id: string; position_title: string; mandatory: boolean; candidate_id: string; candidate_name: string; department: string | null }>(`SELECT p.id position_id,p.title position_title,p.is_mandatory mandatory,c.id candidate_id,c.full_name candidate_name,c.department FROM positions p JOIN candidates c ON c.position_id=p.id WHERE p.election_id=$1 AND c.is_active=true ORDER BY p.display_order,c.display_order`, [electionId]);
  const grouped = new Map<string, { id: string; title: string; mandatory: boolean; candidates: Array<{ id: string; name: string; department: string | null }> }>();
  for (const row of positions.rows) { const position = grouped.get(row.position_id) ?? { id: row.position_id, title: row.position_title, mandatory: row.mandatory, candidates: [] }; position.candidates.push({ id: row.candidate_id, name: row.candidate_name, department: row.department }); grouped.set(row.position_id, position); }
  return NextResponse.json({ election: { title: election.rows[0].title, status: election.rows[0].status, startsAt: election.rows[0].starts_at, endsAt: election.rows[0].ends_at, hasVoted: election.rows[0].has_voted }, positions: [...grouped.values()] }, { headers: { "Cache-Control": "no-store" } });
}
