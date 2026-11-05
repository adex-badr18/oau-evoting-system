import { getDatabase } from "../database";
import { hashPassword, verifyPassword } from "./password";

export async function authenticateVoter(input: { electionId: string; email: string; password: string }) {
  const result = await getDatabase().query<{ id: string; email: string; password_hash: string; must_change_password: boolean; has_voted: boolean }>(
    `SELECT id, email, password_hash, must_change_password, has_voted FROM eligible_voters WHERE election_id = $1 AND email = $2 AND voter_status NOT IN ('LOCKED', 'ANONYMISED')`,
    [input.electionId, input.email.trim().toLowerCase()],
  );
  const voter = result.rows[0];
  if (!voter?.password_hash || !(await verifyPassword(input.password, voter.password_hash))) return null;
  await getDatabase().query(`UPDATE eligible_voters SET last_login_at = now() WHERE id = $1`, [voter.id]);
  await getDatabase().query(
    `INSERT INTO audit_events (actor_type, action, election_id, voter_email, success)
     VALUES ('VOTER', 'VOTER_LOGIN', $1, $2, true)`,
    [input.electionId, voter.email],
  );
  return { id: voter.id, mustChangePassword: voter.must_change_password, hasVoted: voter.has_voted };
}

export async function changeVoterPassword(voterId: string, currentPassword: string, newPassword: string) {
  if (newPassword.length < 6) throw new Error("Choose a password with at least 6 characters.");
  const result = await getDatabase().query<{ election_id: string; email: string; password_hash: string }>(`SELECT election_id, email, password_hash FROM eligible_voters WHERE id = $1 FOR UPDATE`, [voterId]);
  if (result.rowCount !== 1 || !(await verifyPassword(currentPassword, result.rows[0].password_hash))) throw new Error("Current password is incorrect.");
  await getDatabase().query(`UPDATE eligible_voters SET password_hash = $1, must_change_password = false, voter_status = 'ACTIVE', updated_at = now() WHERE id = $2`, [await hashPassword(newPassword), voterId]);
  await getDatabase().query(
    `INSERT INTO audit_events (actor_type, action, election_id, voter_email, success)
     VALUES ('VOTER', 'VOTER_PASSWORD_CHANGED', $1, $2, true)`,
    [result.rows[0].election_id, result.rows[0].email],
  );
}