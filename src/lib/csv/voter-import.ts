import { parse } from "csv-parse/sync";
import { z } from "zod";

const voterRow = z.object({
  full_name: z.string().trim().min(1).max(150),
  department: z.string().trim().min(1).max(150),
  email_address: z.string().trim().email().max(254),
  matric_number: z.string().trim().max(100).optional(),
  faculty: z.string().trim().max(150).optional(),
});

export type ValidVoterRow = z.infer<typeof voterRow>;
export type ImportError = { row: number; reason: string; values: Record<string, string> };

export function validateVoterCsv(csv: string) {
  const records = parse(csv, { columns: true, skip_empty_lines: true, trim: true, bom: true }) as Record<string, string>[];
  const valid: ValidVoterRow[] = [];
  const errors: ImportError[] = [];
  const seenEmails = new Set<string>();
  records.forEach((record, index) => {
    const parsed = voterRow.safeParse(record);
    const email = record.email_address?.trim().toLowerCase();
    if (!parsed.success) {
      errors.push({ row: index + 2, reason: parsed.error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`).join("; "), values: record });
      return;
    }
    if (seenEmails.has(email)) {
      errors.push({ row: index + 2, reason: "Duplicate email address in uploaded file", values: record });
      return;
    }
    seenEmails.add(email);
    valid.push({ ...parsed.data, email_address: email });
  });
  return { totalRows: records.length, valid, errors };
}
