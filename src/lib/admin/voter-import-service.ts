import { createHash } from "node:crypto";
import { inTransaction } from "../database";
import { validateVoterCsv } from "../csv/voter-import";
import { writeAuditEvent } from "./election-service";
import { assertAdminAssigned } from "./election-service";

export async function commitVoterImport(input: { electionId: string; administratorId: string; filename: string; csv: string; allowPartial: boolean }) {
  const validation = validateVoterCsv(input.csv);
  if (validation.errors.length > 0 && !input.allowPartial) {
    return { committed: false as const, ...validation };
  }
  return inTransaction(async (client) => {
    await assertAdminAssigned(client, input.electionId, input.administratorId);
    const election = await client.query(`SELECT status FROM elections WHERE id = $1 FOR UPDATE`, [input.electionId]);
    if (election.rowCount !== 1) throw new Error("Election not found.");
    if (!['DRAFT', 'SCHEDULED'].includes(election.rows[0].status)) throw new Error("Voter import is locked after voting opens.");
    const checksum = createHash("sha256").update(input.csv).digest("hex");
    const batch = await client.query<{ id: string }>(
      `INSERT INTO voter_import_batches (election_id, uploaded_by, original_filename, file_checksum, total_rows, valid_rows, rejected_rows)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id`,
      [input.electionId, input.administratorId, input.filename, checksum, validation.totalRows, validation.valid.length, validation.errors.length],
    );
    for (const voter of validation.valid) {
      await client.query(
        `INSERT INTO eligible_voters (election_id, import_batch_id, full_name, department, email, matric_number, faculty)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [input.electionId, batch.rows[0].id, voter.full_name, voter.department, voter.email_address, voter.matric_number ?? null, voter.faculty ?? null],
      );
    }
    await writeAuditEvent(client, input.administratorId, "VOTERS_IMPORTED", input.electionId, true, { batchId: batch.rows[0].id, validRows: validation.valid.length, rejectedRows: validation.errors.length });
    return { committed: true as const, batchId: batch.rows[0].id, ...validation };
  });
}
