import { NextResponse } from "next/server";
import { requireAdminSession } from "../../../../../../lib/auth/session";
import { getElectionVerificationPack } from "../../../../../../lib/reports/verification-service";

export async function GET(_: Request, { params }: { params: Promise<{ electionId: string }> }) {
  try {
    const session = await requireAdminSession(["ICT_ADMIN", "ELECTION_ADMIN", "APPROVING_OFFICER", "AUDITOR"]);
    const { electionId } = await params;
    return NextResponse.json({ pack: await getElectionVerificationPack(electionId, session.subject, session.role!) }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to prepare the verification pack.";
    const status = message.includes("authentication") || message.includes("authorised") || message.includes("assigned") ? 403 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}