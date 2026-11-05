import { NextResponse } from "next/server";
import { getDashboard } from "../../../../lib/results/dashboard-service";

export async function GET(_: Request, { params }: { params: Promise<{ electionId: string }> }) {
  const { electionId } = await params;
  const result = await getDashboard(electionId);
  if (!result) return NextResponse.json({ error: "Election not found." }, { status: 404 });
  return NextResponse.json(result, { headers: { "Cache-Control": "no-store" } });
}
