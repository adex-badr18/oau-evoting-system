import type { PoolClient } from "pg";
import { inTransaction } from "../database";
import { candidateInput, createElectionInput, positionInput } from "./validators";

export async function createElection(input: unknown, administratorId: string) {
  const election = createElectionInput.parse(input);
  return inTransaction(async (client) => {
    const result = await client.query<{ id: string }>(
      `INSERT INTO elections (title, description, category, scope, starts_at, ends_at, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id`,
      [election.title, election.description ?? null, election.category, election.scope, election.startsAt, election.endsAt, administratorId],
    );
    const electionId = result.rows[0].id;
    await client.query(`INSERT INTO election_administrators (election_id, admin_user_id) VALUES ($1, $2)`, [electionId, administratorId]);
    await writeAuditEvent(client, administratorId, "ELECTION_CREATED", electionId, true, { title: election.title });
    return { id: electionId, ...election };
  });
}

export async function addPosition(electionId: string, input: unknown, administratorId: string) {
  const position = positionInput.parse(input);
  return inTransaction(async (client) => {
    await assertAdminAssigned(client, electionId, administratorId);
    await assertDraftElection(client, electionId);
    const result = await client.query<{ id: string }>(
      `INSERT INTO positions (election_id, title, display_order, is_mandatory)
       VALUES ($1, $2, $3, $4) RETURNING id`,
      [electionId, position.title, position.displayOrder, position.isMandatory],
    );
    await writeAuditEvent(client, administratorId, "POSITION_ADDED", electionId, true, { positionId: result.rows[0].id });
    return result.rows[0];
  });
}

export async function addCandidate(electionId: string, input: unknown, administratorId: string) {
  const candidate = candidateInput.parse(input);
  return inTransaction(async (client) => {
    await assertAdminAssigned(client, electionId, administratorId);
    await assertDraftElection(client, electionId);
    const position = await client.query(`SELECT 1 FROM positions WHERE id = $1 AND election_id = $2`, [candidate.positionId, electionId]);
    if (position.rowCount !== 1) throw new Error("Candidate position does not belong to this election.");
    const nextOrder = await client.query<{ display_order: number }>("SELECT COALESCE(MAX(display_order) + 1, 0) AS display_order FROM candidates WHERE position_id = $1", [candidate.positionId]);
    const result = await client.query<{ id: string }>(
      `INSERT INTO candidates (position_id, full_name, department, manifesto_url, photo_url, display_order)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
      [candidate.positionId, candidate.fullName, candidate.department ?? null, candidate.manifestoUrl ?? null, candidate.photoUrl ?? null, nextOrder.rows[0].display_order],
    );
    await writeAuditEvent(client, administratorId, "CANDIDATE_ADDED", electionId, true, { candidateId: result.rows[0].id });
    return result.rows[0];
  });
}

async function assertReadyToAdvertise(client: PoolClient, electionId: string) {
  const readiness = await client.query<{ positions: string; candidates: string; voters: string }>(
    `SELECT (SELECT count(*) FROM positions WHERE election_id = $1)::text AS positions,
            (SELECT count(*) FROM candidates c JOIN positions p ON p.id = c.position_id WHERE p.election_id = $1 AND c.is_active)::text AS candidates,
            (SELECT count(*) FROM eligible_voters WHERE election_id = $1 AND voter_status IN ('INVITED', 'ACTIVE'))::text AS voters`, [electionId],
  );
  const checks = readiness.rows[0];
  if (Number(checks.positions) < 1 || Number(checks.candidates) < 1 || Number(checks.voters) < 1) throw new Error("Add at least one position, one active candidate, and one invited voter before advertising the election.");
  const incomplete = await client.query<{ title: string }>(
    `SELECT p.title FROM positions p
     WHERE p.election_id = $1 AND p.is_mandatory = true
       AND NOT EXISTS (SELECT 1 FROM candidates c WHERE c.position_id = p.id AND c.is_active = true)
     ORDER BY p.display_order`,
    [electionId],
  );
  if (incomplete.rowCount) throw new Error(`Add at least one active candidate for each required position: ${incomplete.rows.map((position) => position.title).join(", ")}.`);
}

export async function advertiseElection(electionId: string, administratorId: string) {
  return inTransaction(async (client) => {
    await assertAdminAssigned(client, electionId, administratorId);
    const election = await client.query<{ status: string; starts_at: Date; ends_at: Date }>("SELECT status, starts_at, ends_at FROM elections WHERE id = $1 FOR UPDATE", [electionId]);
    if (election.rowCount !== 1) throw new Error("Election not found.");
    if (!['DRAFT', 'SCHEDULED'].includes(election.rows[0].status)) throw new Error("Only a draft election can be advertised.");
    if (election.rows[0].ends_at <= new Date()) throw new Error("The configured voting end time has already passed.");
    await assertReadyToAdvertise(client, electionId);
    await client.query("UPDATE elections SET status = 'SCHEDULED', updated_at = now() WHERE id = $1", [electionId]);
    await writeAuditEvent(client, administratorId, "ELECTION_ADVERTISED", electionId, true, {});
    return { status: "SCHEDULED" };
  });
}

export async function closeElection(electionId: string, administratorId: string) {
  return inTransaction(async (client) => {
    await assertAdminAssigned(client, electionId, administratorId);
    const election = await client.query<{ status: string; starts_at: Date }>("SELECT status, starts_at FROM elections WHERE id = $1 FOR UPDATE", [electionId]);
    if (election.rowCount !== 1) throw new Error("Election not found.");
    if (election.rows[0].status !== 'SCHEDULED' || election.rows[0].starts_at > new Date()) throw new Error("Only an election currently in progress can be closed early.");
    await client.query("UPDATE elections SET status = 'CLOSED', updated_at = now() WHERE id = $1", [electionId]);
    await writeAuditEvent(client, administratorId, "ELECTION_CLOSED_EARLY", electionId, true, {});
    return { status: "CLOSED" };
  });
}

export async function extendElection(electionId: string, endsAt: Date, administratorId: string) {
  return inTransaction(async (client) => {
    await assertAdminAssigned(client, electionId, administratorId);
    const election = await client.query<{ status: string; starts_at: Date; ends_at: Date }>("SELECT status, starts_at, ends_at FROM elections WHERE id = $1 FOR UPDATE", [electionId]);
    if (election.rowCount !== 1) throw new Error("Election not found.");
    const current = election.rows[0];
    if (current.status !== 'SCHEDULED' || current.starts_at > new Date() || current.ends_at <= new Date()) throw new Error("Only an election currently in progress can have its time extended.");
    if (endsAt <= current.ends_at || endsAt <= new Date()) throw new Error("The new closing time must be later than the current closing time.");
    await client.query("UPDATE elections SET ends_at = $1, updated_at = now() WHERE id = $2", [endsAt, electionId]);
    await writeAuditEvent(client, administratorId, "ELECTION_TIME_EXTENDED", electionId, true, { previousEndsAt: current.ends_at.toISOString(), endsAt: endsAt.toISOString() });
    return { status: "SCHEDULED", endsAt };
  });
}
async function assertDraftElection(client: PoolClient, electionId: string) {
  const result = await client.query<{ status: string }>(`SELECT status FROM elections WHERE id = $1 FOR UPDATE`, [electionId]);
  if (result.rowCount !== 1) throw new Error("Election not found.");
  if (!['DRAFT', 'SCHEDULED'].includes(result.rows[0].status)) throw new Error("Election configuration is locked after voting opens.");
}

export async function assertAdminAssigned(client: PoolClient, electionId: string, administratorId: string) {
  const result = await client.query(
    `SELECT 1 FROM election_administrators WHERE election_id = $1 AND admin_user_id = $2
     UNION ALL SELECT 1 FROM admin_users WHERE id = $2 AND role = 'ICT_ADMIN'`,
    [electionId, administratorId],
  );
  if ((result.rowCount ?? 0) < 1) throw new Error("You are not assigned to manage this election.");
}

export async function writeAuditEvent(client: PoolClient, actorAdminId: string | null, action: string, electionId: string | null, success: boolean, metadata: Record<string, unknown>) {
  await client.query(
    `INSERT INTO audit_events (actor_admin_id, actor_type, action, election_id, success, metadata)
     VALUES ($1, 'ADMIN', $2, $3, $4, $5::jsonb)`,
    [actorAdminId, action, electionId, success, JSON.stringify(metadata)],
  );
}
