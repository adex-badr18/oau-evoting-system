import { getDatabase } from "../database";
import { closeExpiredElection } from "../election-maintenance";
import { isVotingOpen, type ElectionStatus } from "../election-rules";

export type DashboardResult = { election: { title: string; status: string; startsAt: Date; endsAt: Date }; eligibleVoters: number; ballotsSubmitted: number; positions: Array<{ id: string; title: string; candidates: Array<{ id: string; name: string; votes: number; percentage: number }> }> };

export async function getDashboard(electionId: string): Promise<DashboardResult | null> {
  await closeExpiredElection(electionId);
  const election = await getDatabase().query<{ title: string; status: ElectionStatus; starts_at: Date; ends_at: Date }>(`SELECT title, status, starts_at, ends_at FROM elections WHERE id = $1`, [electionId]);
  if (election.rowCount !== 1) return null;
  const totals = await getDatabase().query<{ eligible: string; ballots: string }>(`SELECT (SELECT count(*) FROM eligible_voters WHERE election_id = $1) AS eligible, (SELECT count(*) FROM ballots WHERE election_id = $1) AS ballots`, [electionId]);
  const rows = await getDatabase().query<{ position_id: string; position_title: string; candidate_id: string; candidate_name: string; votes: string; position_votes: string }>(`SELECT p.id position_id, p.title position_title, c.id candidate_id, c.full_name candidate_name, count(bs.candidate_id) votes, sum(count(bs.candidate_id)) OVER (PARTITION BY p.id) position_votes FROM positions p JOIN candidates c ON c.position_id = p.id AND c.is_active = true LEFT JOIN ballot_selections bs ON bs.candidate_id = c.id WHERE p.election_id = $1 GROUP BY p.id, p.title, c.id, c.full_name ORDER BY p.display_order, c.display_order`, [electionId]);
  const positions = new Map<string, DashboardResult["positions"][number]>();
  for (const row of rows.rows) { const position = positions.get(row.position_id) ?? { id: row.position_id, title: row.position_title, candidates: [] }; const votes = Number(row.votes); const total = Number(row.position_votes); position.candidates.push({ id: row.candidate_id, name: row.candidate_name, votes, percentage: total ? Math.round((votes / total) * 10000) / 100 : 0 }); positions.set(row.position_id, position); }
  const raw = election.rows[0];
  const status = isVotingOpen(raw.status, raw.starts_at, raw.ends_at) ? "OPEN" : raw.status === "SCHEDULED" && new Date() >= raw.ends_at ? "CLOSED" : raw.status;
  return { election: { title: raw.title, status, startsAt: raw.starts_at, endsAt: raw.ends_at }, eligibleVoters: Number(totals.rows[0].eligible), ballotsSubmitted: Number(totals.rows[0].ballots), positions: [...positions.values()] };
}