import { NextResponse } from "next/server";
import { z } from "zod";
import { authenticateAdministrator } from "../../../../../lib/auth/admin-auth";
import { setSession } from "../../../../../lib/auth/session";
import { isLoginAllowed, loginAttemptKey, recordLoginFailure, recordLoginSuccess } from "../../../../../lib/auth/login-throttle";

const input = z.object({ email: z.string().email(), password: z.string().min(1).max(512), totpCode: z.string().regex(/^\d{6}$/).optional() });

export async function POST(request: Request) {
  try {
    const credentials = input.parse(await request.json());
    const attempt = loginAttemptKey(request, credentials.email);
    if (!isLoginAllowed(attempt)) return NextResponse.json({ error: "Too many sign-in attempts. Please wait 15 minutes and try again." }, { status: 429 });
    const administrator = await authenticateAdministrator(credentials);
    if (!administrator) {
      recordLoginFailure(attempt);
      return NextResponse.json({ error: "Invalid email, password, or verification code." }, { status: 401 });
    }
    if (administrator.mfaRequired) return NextResponse.json({ mfaRequired: true }, { status: 202 });
    recordLoginSuccess(attempt);
    await setSession({ subject: administrator.id, actorType: "ADMIN", role: administrator.role });
    return NextResponse.json({ success: true });
  } catch { return NextResponse.json({ error: "Unable to sign in." }, { status: 400 }); }
}