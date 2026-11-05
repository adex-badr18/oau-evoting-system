import { assertSameOrigin } from "../../../../../../lib/auth/request-origin";
import { NextResponse } from "next/server";
import { requireAdminSession } from "../../../../../../lib/auth/session";
import { commitVoterImport } from "../../../../../../lib/admin/voter-import-service";
export async function POST(request: Request, { params }: { params: Promise<{ electionId: string }> }) {
  try { assertSameOrigin(request);
    const { electionId } = await params; const admin = await requireAdminSession(["ICT_ADMIN", "ELECTION_ADMIN"]); const form = await request.formData(); const file = form.get("file");
    if (!(file instanceof File) || !file.name.toLowerCase().endsWith(".csv")) return NextResponse.json({ error: "Upload a CSV file." }, { status: 400 });
    const result = await commitVoterImport({ electionId, administratorId: admin.subject, filename: file.name, csv: await file.text(), allowPartial: form.get("allowPartial") === "true" });
    return NextResponse.json(result, { status: result.committed ? 201 : 422 });
  } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to import voters." }, { status: 400 }); }
}
