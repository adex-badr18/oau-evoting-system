import { assertSameOrigin } from "../../../../../../lib/auth/request-origin";
import { NextResponse } from "next/server";
import { requireAdminSession } from "../../../../../../lib/auth/session";
import { approveElection } from "../../../../../../lib/reports/approval-service";
export async function POST(request: Request, { params }: { params: Promise<{ electionId: string }> }) {
  try {
    assertSameOrigin(request);
    const { electionId } = await params;
    const officer = await requireAdminSession(["APPROVING_OFFICER", "ICT_ADMIN"]);
    return NextResponse.json(await approveElection(electionId, officer.subject));
  } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to approve election." }, { status: 400 }); }
}