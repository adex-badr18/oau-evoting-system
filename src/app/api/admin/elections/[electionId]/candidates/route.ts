import { assertSameOrigin } from "../../../../../../lib/auth/request-origin";
import { NextResponse } from "next/server";
import { requireAdminSession } from "../../../../../../lib/auth/session";
import { addCandidate } from "../../../../../../lib/admin/election-service";
export async function POST(request: Request, { params }: { params: Promise<{ electionId: string }> }) {
  try { assertSameOrigin(request); const { electionId } = await params; const admin = await requireAdminSession(["ICT_ADMIN", "ELECTION_ADMIN"]); return NextResponse.json(await addCandidate(electionId, await request.json(), admin.subject), { status: 201 }); }
  catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to add candidate." }, { status: 400 }); }
}
