import { assertSameOrigin } from "../../../../../lib/auth/request-origin";
import { NextResponse } from "next/server";
import { z } from "zod";
import { readSession } from "../../../../../lib/auth/session";
import { changeVoterPassword } from "../../../../../lib/auth/voter-auth";

const input = z.object({ currentPassword:z.string().min(1), newPassword:z.string().min(6).max(512) });
export async function POST(request: Request) {
  const session = await readSession();
  if (!session || session.actorType !== "VOTER") return NextResponse.json({ error:"Voter authentication is required." }, { status:401 });
  try { assertSameOrigin(request); const data=input.parse(await request.json()); await changeVoterPassword(session.subject,data.currentPassword,data.newPassword); return NextResponse.json({ success:true }); }
  catch (error) { return NextResponse.json({ error:error instanceof Error ? error.message : "Unable to change password." }, { status:400 }); }
}
