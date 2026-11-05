import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdminSession } from "../../../../../../lib/auth/session";
import { assertSameOrigin } from "../../../../../../lib/auth/request-origin";
import { advertiseElection, closeElection, extendElection } from "../../../../../../lib/admin/election-service";

const input = z.discriminatedUnion("action", [z.object({ action: z.literal("ADVERTISE") }), z.object({ action: z.literal("CLOSE") }), z.object({ action: z.literal("EXTEND"), endsAt: z.coerce.date() })]);

export async function POST(request: Request, { params }: { params: Promise<{ electionId: string }> }) {
  try {
    assertSameOrigin(request);
    const { electionId } = await params; const admin = await requireAdminSession(["ICT_ADMIN", "ELECTION_ADMIN"]); const body = input.parse(await request.json());
    if (body.action === "ADVERTISE") return NextResponse.json(await advertiseElection(electionId, admin.subject));
    if (body.action === "CLOSE") return NextResponse.json(await closeElection(electionId, admin.subject));
    return NextResponse.json(await extendElection(electionId, body.endsAt, admin.subject));
  } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to update election." }, { status: 400 }); }
}