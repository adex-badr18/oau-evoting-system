import { getDatabase, inTransaction } from "./database";

/** Closes elections that have reached their scheduled end time. Safe to run repeatedly. */
export async function closeExpiredElections() {
  return inTransaction(async (client) => {
    const closed = await client.query<{ id: string }>(
      `UPDATE elections SET status = 'CLOSED', updated_at = now()
       WHERE status = 'SCHEDULED' AND ends_at <= now() RETURNING id`,
    );
    for (const election of closed.rows) {
      await client.query(
        `INSERT INTO audit_events (actor_type, action, election_id, success, metadata)
         VALUES ('SYSTEM', 'ELECTION_CLOSED_AUTOMATIC', $1, true, '{}'::jsonb)`,
        [election.id],
      );
    }
    return closed.rows.length;
  });
}

export async function closeExpiredElection(electionId: string) {
  await getDatabase().query(`UPDATE elections SET status = 'CLOSED', updated_at = now() WHERE id = $1 AND status = 'SCHEDULED' AND ends_at <= now()`, [electionId]);
}