import { NextResponse } from "next/server";
import { closeExpiredElections } from "../../../../lib/election-maintenance";

export async function POST(request: Request) {
  const secret = process.env.MAINTENANCE_SECRET;
  if (!secret) return NextResponse.json({ error: "Maintenance endpoint is not configured." }, { status: 503 });
  if (request.headers.get("authorization") !== `Bearer ${secret}`) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  const closed = await closeExpiredElections();
  return NextResponse.json({ closed });
}