import { assertSameOrigin } from "../../../../../../lib/auth/request-origin";
import { NextResponse } from "next/server";
import { requireAdminSession } from "../../../../../../lib/auth/session";
import { prepareInitialCredentials, revertUndeliveredCredentials } from "../../../../../../lib/admin/credential-service";
import { isUniversityMailConfigured, sendInitialCredentials } from "../../../../../../lib/notifications/email";
import { getDatabase } from "../../../../../../lib/database";

export async function POST(request: Request, { params }: { params: Promise<{ electionId: string }> }) {
  try {
    assertSameOrigin(request);
    if (process.env.NODE_ENV === "production" && !isUniversityMailConfigured()) {
      return NextResponse.json({ error: "University email service is not configured. Configure SMTP before generating voter credentials." }, { status: 409 });
    }
    const { electionId } = await params;
    const admin = await requireAdminSession(["ICT_ADMIN", "ELECTION_ADMIN"]);
    const prepared = await prepareInitialCredentials(electionId, admin.subject);
    if (!isUniversityMailConfigured()) {
      await Promise.all(prepared.deliveries.map((delivery) => getDatabase().query("UPDATE credential_events SET delivery_status = 'TEST_ONLY', sent_at = now() WHERE id = $1", [delivery.credentialEventId])));
      return NextResponse.json({ recipientCount: prepared.deliveries.length, sent: 0, failed: 0, testCredentials: prepared.deliveries.map(({ email, fullName, temporaryPassword }) => ({ email, fullName, temporaryPassword })), testVoteUrl: `${process.env.APP_URL ?? "http://127.0.0.1:3000"}/vote?e=${electionId}` });
    }
    const delivery = await sendInitialCredentials(electionId, prepared.electionTitle, prepared.deliveries);
    await revertUndeliveredCredentials(delivery.failedCredentialEventIds);
    return NextResponse.json({ recipientCount: prepared.deliveries.length, sent: delivery.sent, failed: delivery.failed });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to prepare credentials." }, { status: 400 });
  }
}