import { describe, expect, it } from "vitest";
import { canCastBallot, currentElectionStatus, percentage, validateSingleChoice } from "../src/lib/election-rules";

describe("election rules", () => {
  const start = new Date("2026-08-02T09:00:00+01:00");
  const end = new Date("2026-08-02T17:00:00+01:00");
  it("uses server time to determine election state", () => {
    expect(currentElectionStatus(start, end, new Date("2026-08-02T08:59:59+01:00"))).toBe("SCHEDULED");
    expect(currentElectionStatus(start, end, new Date("2026-08-02T09:00:00+01:00"))).toBe("OPEN");
    expect(currentElectionStatus(start, end, new Date("2026-08-02T17:00:00+01:00"))).toBe("CLOSED");
  });
  it("does not allow voting outside the window or after a ballot", () => {
    expect(canCastBallot({ status:"SCHEDULED", startAt:start, endAt:end, hasVoted:false, now:new Date("2026-08-02T11:00:00+01:00") })).toBe(true);
    expect(canCastBallot({ status:"SCHEDULED", startAt:start, endAt:end, hasVoted:true, now:new Date("2026-08-02T11:00:00+01:00") })).toBe(false);
  });
  it("calculates display percentages consistently", () => expect(percentage(1, 3)).toBe(33.33));
  it("allows only one candidate selection per position", () => {
    expect(() => validateSingleChoice([{ positionId:"president", candidateId:"a" }, { positionId:"president", candidateId:"b" }])).toThrow();
  });
});
