import { NextResponse } from "next/server";
import { clearSession } from "../../../../lib/auth/session";
import { assertSameOrigin } from "../../../../lib/auth/request-origin";

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    await clearSession();
    return NextResponse.json({ success: true });
  } catch { return NextResponse.json({ error: "Invalid request origin." }, { status: 400 }); }
}