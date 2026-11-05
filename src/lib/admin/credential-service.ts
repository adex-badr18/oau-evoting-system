import { inTransaction } from "../database";
import { generateTemporaryPassword, hashPassword } from "../auth/password";
import { assertAdminAssigned, writeAuditEvent } from "./election-service";

export type CredentialDelivery = { email: string; fullName: string; temporaryPassword: string; credentialEventId: string };

export async function prepareInitialCredentials(electionId: string, administratorId: string) {
  return inTransaction(async (client) => {
    await assertAdminAssigned(client, electionId, administratorId);
    const election = await client.query<{ title: string; status: string }>(`SELECT title, status FROM elections WHERE id = $1 FOR UPDATE`, [electionId]);
    if (election.rowCount !== 1) throw new Error("Election not found.");
    if (!['DRAFT', 'SCHEDULED'].includes(election.rows[0].status)) throw new Error("Credentials cannot be generated after voting opens.");
    const voters = await client.query<{ id: string; email: string; full_name: string }>(
      `SELECT id, email, full_name FROM eligible_voters WHERE election_id = $1 AND password_hash IS NULL AND voter_status = 'PENDING' FOR UPDATE`, [electionId],
    );
    const deliveries: CredentialDelivery[] = [];
    for (const voter of voters.rows) {
      const temporaryPassword = generateTemporaryPassword();
      const passwordHash = await hashPassword(temporaryPassword);
      await client.query(`UPDATE eligible_voters SET password_hash = $1, voter_status = 'INVITED', must_change_password = true, credential_expires_at = (SELECT ends_at FROM elections WHERE id = $2), updated_at = now() WHERE id = $3`, [passwordHash, electionId, voter.id]);
      const event = await client.query<{ id: string }>(`INSERT INTO credential_events (eligible_voter_id, event_type, expires_at, delivery_status) VALUES ($1, 'INVITATION', (SELECT ends_at FROM elections WHERE id = $2), 'QUEUED') RETURNING id`, [voter.id, electionId]);
      deliveries.push({ email: voter.email, fullName: voter.full_name, temporaryPassword, credentialEventId: event.rows[0].id });
    }
    await writeAuditEvent(client, administratorId, "INITIAL_CREDENTIALS_PREPARED", electionId, true, { recipientCount: deliveries.length });
    return { electionTitle: election.rows[0].title, deliveries };
  });
}

/** Undo only invitations that the mail service could not deliver. */
export async function revertUndeliveredCredentials(credentialEventIds: string[]) {
  if (credentialEventIds.length === 0) return;
  return inTransaction(async (client) => {
    await client.query(
      `UPDATE eligible_voters v
       SET password_hash = NULL, voter_status = 'PENDING', must_change_password = true,
           credential_expires_at = NULL, updated_at = now()
       FROM credential_events ce
       WHERE ce.id = ANY($1::uuid[]) AND ce.eligible_voter_id = v.id
         AND ce.delivery_status = 'FAILED' AND v.has_voted = false`,
      [credentialEventIds],
    );
  });
}