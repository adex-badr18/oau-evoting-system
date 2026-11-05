import { NextResponse } from "next/server";
import { z } from "zod";
import { authenticateVoter } from "../../../../../lib/auth/voter-auth";
import { setSession } from "../../../../../lib/auth/session";
import { isLoginAllowed, loginAttemptKey, recordLoginFailure, recordLoginSuccess } from "../../../../../lib/auth/login-throttle";

const input = z.object({ electionId: z.string().uuid(), email: z.string().email(), password: z.string().min(1).max(512) });
export async function POST(request: Request) {
  try {
    const data = input.parse(await request.json());
    const attempt = loginAttemptKey(request, `${data.electionId}:${data.email}`);
    if (!isLoginAllowed(attempt)) return NextResponse.json({ error: "Too many sign-in attempts. Please wait 15 minutes and try again." }, { status: 429 });
    const voter = await authenticateVoter(data);
    if (!voter) {
      recordLoginFailure(attempt);
      return NextResponse.json({ error: "Invalid email or password." }, { status: 401 });
    }
    recordLoginSuccess(attempt);
    await setSession({ subject:voter.id, actorType:"VOTER", electionId:data.electionId });
    return NextResponse.json({ mustChangePassword:voter.mustChangePassword, hasVoted:voter.hasVoted });
  } catch { return NextResponse.json({ error:"Unable to sign in." }, { status:400 }); }
}