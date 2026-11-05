import { getDatabase } from "../database";

export type VerificationPack = {
  generatedAt: string;
  election: { id: string; title: string; status: string; startsAt: Date; endsAt: Date; approvedAt: Date | null };
  voterImports: Array<{ filename: string; checksum: string; totalRows: number; validRows: number; rejectedRows: number; uploadedAt: Date }>;
  credentialDelivery: Array<{ status: string; count: number }>;
  turnout: { eligibleVoters: number; votersMarkedAsVoted: number; anonymousBallots: number; ballotsMatchVoters: boolean };
  results: Array<{ position: string; candidate: string; votes: number }>;
  anonymousBallotRecords: Array<{ submittedAt: Date; auditHash: string }>;
  report: { contentHash: string | null; generatedAt: Date | null };
  auditTimeline: Array<{ occurredAt: Date; actorType: string; action: string; voterEmail: string | null; success: boolean }>;
};

export async function getElectionVerificationPack(electionId: string, administratorId: string, role: string): Promise<VerificationPack> {
  if (role === "ELECTION_ADMIN") {
    const assigned = await getDatabase().query("SELECT 1 FROM election_administrators WHERE election_id = $1 AND admin_user_id = $2", [electionId, administratorId]);
    if (!assigned.rowCount) throw new Error("You are not assigned to audit this election.");
  }
  const election = await getDatabase().query<{ id: string; title: string; status: string; starts_at: Date; ends_at: Date; approved_at: Date | null }>(
    "SELECT id, title, status, starts_at, ends_at, approved_at FROM elections WHERE id = $1", [electionId],
  );
  if (!election.rowCount) throw new Error("Election not found.");
  if (!["CLOSED", "APPROVED"].includes(election.rows[0].status)) throw new Error("The verification pack is available only after the election is closed.");

  const [imports, credentials, totals, results, ballotRecords, report, timeline] = await Promise.all([
    getDatabase().query<{ original_filename: string; file_checksum: string; total_rows: number; valid_rows: number; rejected_rows: number; created_at: Date }>(
      "SELECT original_filename, file_checksum, total_rows, valid_rows, rejected_rows, created_at FROM voter_import_batches WHERE election_id = $1 ORDER BY created_at", [electionId],
    ),
    getDatabase().query<{ delivery_status: string; count: string }>(
      `SELECT ce.delivery_status, count(*) FROM credential_events ce
       JOIN eligible_voters v ON v.id = ce.eligible_voter_id
       WHERE v.election_id = $1 GROUP BY ce.delivery_status ORDER BY ce.delivery_status`, [electionId],
    ),
    getDatabase().query<{ eligible: string; voted: string; ballots: string }>(
      `SELECT (SELECT count(*) FROM eligible_voters WHERE election_id = $1) AS eligible,
              (SELECT count(*) FROM eligible_voters WHERE election_id = $1 AND has_voted = true) AS voted,
              (SELECT count(*) FROM ballots WHERE election_id = $1) AS ballots`, [electionId],
    ),
    getDatabase().query<{ position: string; candidate: string; votes: string }>(
      `SELECT p.title AS position, c.full_name AS candidate, count(bs.candidate_id) AS votes
       FROM positions p JOIN candidates c ON c.position_id = p.id
       LEFT JOIN ballot_selections bs ON bs.candidate_id = c.id
       WHERE p.election_id = $1 GROUP BY p.id, p.title, c.id, c.full_name
       ORDER BY p.display_order, c.display_order`, [electionId],
    ),
    getDatabase().query<{ submitted_at: Date; audit_hash: string }>("SELECT submitted_at, audit_hash FROM ballots WHERE election_id = $1 ORDER BY submitted_at, audit_hash", [electionId]),
    getDatabase().query<{ content_hash: string; generated_at: Date }>("SELECT content_hash, generated_at FROM reports WHERE election_id = $1", [electionId]),
    getDatabase().query<{ occurred_at: Date; actor_type: string; action: string; voter_email: string | null; success: boolean }>(
      `SELECT occurred_at, actor_type, action, voter_email, success FROM audit_events
       WHERE election_id = $1 ORDER BY occurred_at`, [electionId],
    ),
  ]);
  const counts = totals.rows[0];
  const votersMarkedAsVoted = Number(counts.voted); const anonymousBallots = Number(counts.ballots);
  return {
    generatedAt: new Date().toISOString(),
    election: { id: election.rows[0].id, title: election.rows[0].title, status: election.rows[0].status, startsAt: election.rows[0].starts_at, endsAt: election.rows[0].ends_at, approvedAt: election.rows[0].approved_at },
    voterImports: imports.rows.map((row) => ({ filename: row.original_filename, checksum: row.file_checksum, totalRows: row.total_rows, validRows: row.valid_rows, rejectedRows: row.rejected_rows, uploadedAt: row.created_at })),
    credentialDelivery: credentials.rows.map((row) => ({ status: row.delivery_status, count: Number(row.count) })),
    turnout: { eligibleVoters: Number(counts.eligible), votersMarkedAsVoted, anonymousBallots, ballotsMatchVoters: votersMarkedAsVoted === anonymousBallots },
    results: results.rows.map((row) => ({ position: row.position, candidate: row.candidate, votes: Number(row.votes) })),
    anonymousBallotRecords: ballotRecords.rows.map((row) => ({ submittedAt: row.submitted_at, auditHash: row.audit_hash })),
    report: { contentHash: report.rows[0]?.content_hash ?? null, generatedAt: report.rows[0]?.generated_at ?? null },
    auditTimeline: timeline.rows.map((row) => ({ occurredAt: row.occurred_at, actorType: row.actor_type, action: row.action, voterEmail: row.voter_email, success: row.success })),
  };
}