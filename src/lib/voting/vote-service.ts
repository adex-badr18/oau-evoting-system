import { createHash, randomBytes } from "node:crypto";
import { inTransaction } from "../database";
import { validateSingleChoice } from "../election-rules";
import { ballotInput } from "./validators";

function receiptReference() { return `UEVS-${randomBytes(8).toString("hex").toUpperCase()}`; }
function ballotAuditHash(electionId: string, receipt: string) { return createHash("sha256").update(`${electionId}:${receipt}`).digest("hex"); }

export async function castBallot(voterId: string, input: unknown) {
  const ballot = ballotInput.parse(input);
  validateSingleChoice(ballot.selections);
  return inTransaction(async (client) => {
    const voter = await client.query<{ election_id: string; email: string; has_voted: boolean; must_change_password: boolean }>(
      `SELECT election_id, email, has_voted, must_change_password FROM eligible_voters WHERE id = $1 FOR UPDATE`, [voterId],
    );
    if (voter.rowCount !== 1 || voter.rows[0].election_id !== ballot.electionId) throw new Error("Voter is not eligible for this election.");
    if (voter.rows[0].must_change_password) throw new Error("Change your temporary password before submitting a ballot.");
    if (voter.rows[0].has_voted) throw new Error("A ballot has already been submitted for this election.");
    const election = await client.query(
      `SELECT id FROM elections WHERE id = $1 AND status = 'SCHEDULED' AND starts_at <= now() AND ends_at > now() FOR UPDATE`, [ballot.electionId],
    );
    if (election.rowCount !== 1) throw new Error("Voting is not currently open.");
    const positions = await client.query<{ id: string; is_mandatory: boolean }>(`SELECT id, is_mandatory FROM positions WHERE election_id = $1`, [ballot.electionId]);
    const selectedPositionIds = new Set(ballot.selections.map((selection) => selection.positionId));
    for (const position of positions.rows) if (position.is_mandatory && !selectedPositionIds.has(position.id)) throw new Error("Every required position must have one selection.");
    for (const selection of ballot.selections) {
      const validCandidate = await client.query(`SELECT 1 FROM candidates c JOIN positions p ON p.id = c.position_id WHERE c.id = $1 AND p.id = $2 AND p.election_id = $3 AND c.is_active = true`, [selection.candidateId, selection.positionId, ballot.electionId]);
      if (validCandidate.rowCount !== 1) throw new Error("One or more candidate selections are invalid.");
    }
    const receipt = receiptReference(); const auditHash = ballotAuditHash(ballot.electionId, receipt);
    const insertedBallot = await client.query<{ id: string; submitted_at: Date }>(`INSERT INTO ballots (election_id, receipt_reference, audit_hash) VALUES ($1, $2, $3) RETURNING id, submitted_at`, [ballot.electionId, receipt, auditHash]);
    for (const selection of ballot.selections) await client.query(`INSERT INTO ballot_selections (ballot_id, position_id, candidate_id) VALUES ($1, $2, $3)`, [insertedBallot.rows[0].id, selection.positionId, selection.candidateId]);
    await client.query(`UPDATE eligible_voters SET has_voted = true, voter_status = 'VOTED', updated_at = now() WHERE id = $1`, [voterId]);
    // This identity-linked audit event deliberately has no receipt or ballot fingerprint.
    // Those values remain only in the anonymous ballot record and the voter's private response.
    await client.query(`INSERT INTO audit_events (actor_type, action, election_id, voter_email, success) VALUES ('VOTER', 'BALLOT_SUBMITTED', $1, $2, true)`, [ballot.electionId, voter.rows[0].email]);
    return { receiptReference: receipt, auditHash, submittedAt: insertedBallot.rows[0].submitted_at.toISOString() };
  });
}