import { NextResponse } from "next/server";
import { readSession } from "../../../lib/auth/session";
import { assertSameOrigin } from "../../../lib/auth/request-origin";
import { castBallot } from "../../../lib/voting/vote-service";

export async function POST(request: Request) {
  const session = await readSession();
  if (!session || session.actorType !== "VOTER") return NextResponse.json({ error: "Voter authentication is required." }, { status: 401 });
  try {
    assertSameOrigin(request);
    const receipt = await castBallot(session.subject, await request.json());
    return NextResponse.json(receipt, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to submit ballot.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}