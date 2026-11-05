export type ElectionStatus = "DRAFT" | "SCHEDULED" | "OPEN" | "CLOSED" | "APPROVED" | "ARCHIVED";

export function currentElectionStatus(startAt: Date, endAt: Date, now = new Date()): ElectionStatus {
  if (now < startAt) return "SCHEDULED";
  if (now >= endAt) return "CLOSED";
  return "OPEN";
}

// An advertised election opens automatically at its configured start time.
export function isVotingOpen(status: ElectionStatus, startAt: Date, endAt: Date, now = new Date()) {
  return status === "SCHEDULED" && now >= startAt && now < endAt;
}

export function canCastBallot(input: { status: ElectionStatus; startAt: Date; endAt: Date; hasVoted: boolean; now?: Date }) {
  return isVotingOpen(input.status, input.startAt, input.endAt, input.now) && !input.hasVoted;
}

export function percentage(candidateVotes: number, positionVotes: number): number {
  if (candidateVotes < 0 || positionVotes < 0 || candidateVotes > positionVotes) throw new Error("Invalid vote totals");
  if (positionVotes === 0) return 0;
  return Math.round((candidateVotes / positionVotes) * 10000) / 100;
}

export function validateSingleChoice(selections: Array<{ positionId: string; candidateId: string }>) {
  const positions = new Set<string>();
  for (const selection of selections) {
    if (positions.has(selection.positionId)) throw new Error("Only one candidate may be selected for each position.");
    positions.add(selection.positionId);
  }
}