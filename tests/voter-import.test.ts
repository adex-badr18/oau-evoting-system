import { describe, expect, it } from "vitest";
import { validateVoterCsv } from "../src/lib/csv/voter-import";

describe("voter CSV validation", () => {
  it("accepts valid rows and normalises email", () => {
    const result = validateVoterCsv("full_name,department,email_address\nAmina Bello,Computer Science,AMINA@EXAMPLE.EDU");
    expect(result.valid).toHaveLength(1);
    expect(result.valid[0].email_address).toBe("amina@example.edu");
  });
  it("rejects duplicate and malformed emails", () => {
    const result = validateVoterCsv("full_name,department,email_address\nAmina Bello,CS,amina@example.edu\nBayo Ade,CS,amina@example.edu\nBad User,CS,not-an-email");
    expect(result.errors).toHaveLength(2);
  });
});
