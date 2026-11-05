import { assertSameOrigin } from "../../../../../../lib/auth/request-origin";
import { NextResponse } from "next/server";
import { requireAdminSession } from "../../../../../../lib/auth/session";
import { anonymiseVoters } from "../../../../../../lib/reports/approval-service";
export async function POST(request: Request, { params }: { params: Promise<{ electionId: string }> }) {
  try {
    assertSameOrigin(request);
    const { electionId } = await params;
    const admin = await requireAdminSession(["ICT_ADMIN"]);
    return NextResponse.json(await anonymiseVoters(electionId, admin.subject));
  } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to clean up voter data." }, { status: 400 }); }
}