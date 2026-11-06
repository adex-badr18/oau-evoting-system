"use client";

import Link from "next/link";
import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";

type Dashboard = {
  election: { title: string; status: string; startsAt: string; endsAt: string };
  eligibleVoters: number;
  ballotsSubmitted: number;
  positions: Array<{
    id: string;
    title: string;
    candidates: Array<{
      id: string;
      name: string;
      votes: number;
      percentage: number;
    }>;
  }>;
};

/**
 * The issue here is that Date.now() is called while React is rendering.
 *
 */

// function remaining(end: string) {
//   const seconds = Math.max(0, Math.floor((new Date(end).getTime() - Date.now()) / 1000));
//   return `${Math.floor(seconds / 3600)}h ${Math.floor((seconds % 3600) / 60)}m ${seconds % 60}s`;
// }

function remaining(end: string, now: number) {
  const seconds = Math.max(
    0,
    Math.floor((new Date(end).getTime() - now) / 1000),
  );

  return `${Math.floor(seconds / 3600)}h ${Math.floor((seconds % 3600) / 60)}m ${seconds % 60}s`;
}

function DashboardContent() {
  const electionId = useSearchParams().get("e");
  const [dashboard, setDashboard] = useState<Dashboard | null>(null);
  const [error, setError] = useState("");

  // const [clock, setClock] = useState(Date.now());
  const [clock, setClock] = useState<number | null>(null);

  useEffect(() => {
    const timer = window.setInterval(() => setClock(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);
  useEffect(() => {
    if (!electionId) return;
    async function refresh() {
      try {
        const response = await fetch(`/api/results/${electionId}`, {
          cache: "no-store",
        });
        const data = await response.json();
        if (!response.ok)
          throw new Error(data.error ?? "Unable to load dashboard.");
        setDashboard(data);
        setError("");
      } catch (reason) {
        setError(
          reason instanceof Error
            ? reason.message
            : "Unable to load dashboard.",
        );
      }
    }
    refresh();
    const timer = window.setInterval(refresh, 3000);
    return () => window.clearInterval(timer);
  }, [electionId]);
  const turnout =
    dashboard && dashboard.eligibleVoters
      ? Math.round(
          (dashboard.ballotsSubmitted / dashboard.eligibleVoters) * 10000,
        ) / 100
      : 0;
  const monitorStatus = !dashboard
    ? ""
    : dashboard.election.status === "OPEN"
      ? "LIVE"
      : dashboard.election.status === "SCHEDULED"
        ? "PENDING"
        : "CLOSED";
  const monitorMessage =
    monitorStatus === "LIVE"
      ? "Voting is currently live"
      : monitorStatus === "PENDING"
        ? "Voting has not started yet"
        : "Voting is closed";
  return (
    <>
      <header className="topbar">
        <div className="shell brand">
          <Link className="brand-title" href="/">
            OAU eVoting
          </Link>
          <nav className="nav">
            <Link href="/vote">Voter sign in</Link>
            <Link href="/admin">Administrator sign in</Link>
          </nav>
        </div>
      </header>
      <main className="shell">
        <section className="page-head">
          <div className="eyebrow">Election dashboard</div>
          <h1>{dashboard?.election.title ?? "Live election results"}</h1>
          <p>
            Official aggregate results only. This dashboard refreshes
            automatically every three seconds and never displays voter identity.
          </p>
        </section>
        {!electionId && (
          <section className="panel">
            <h2>No election selected</h2>
            <p>
              Use the dashboard link from the election workspace to view its
              live results.
            </p>
          </section>
        )}
        {error && <p className="error">{error}</p>}
        {dashboard && (
          <>
            <section className="dashboard-banner">
              <span>LIVE ELECTION MONITOR</span>
              <strong>{monitorMessage}</strong>
            </section>
            <section className="summary">
              <div className="metric">
                <span>Election status</span>
                <strong>{monitorStatus}</strong>
              </div>
              <div className="metric">
                <span>Eligible voters</span>
                <strong>{dashboard.eligibleVoters}</strong>
              </div>
              <div className="metric">
                <span>Ballots submitted</span>
                <strong>{dashboard.ballotsSubmitted}</strong>
              </div>
              <div className="metric">
                <span>Turnout</span>
                <strong>{turnout}%</strong>
              </div>
            </section>
            <section className="panel">
              <span className="tag">Voting schedule</span>
              <h2>
                {dashboard.election.status === "OPEN"
                  ? `Time remaining: ${
                      clock === null
                        ? "Updating..."
                        : remaining(dashboard.election.endsAt, clock)
                    }`
                  : // ? `Time remaining: ${remaining(dashboard.election.endsAt)}`
                    "Voting is not currently open"}

                {/* {dashboard.election.status === "OPEN"
                    ? `Time remaining: ${remaining(dashboard.election.endsAt)}` :
                    "Voting is not currently open"} */}
              </h2>
              <p>
                Opens: {new Date(dashboard.election.startsAt).toLocaleString()}
                <br />
                Closes: {new Date(dashboard.election.endsAt).toLocaleString()}
              </p>
            </section>
            {dashboard.positions.map((position) => (
              <section className="panel" key={position.id}>
                <h2>{position.title}</h2>
                {position.candidates.map((candidate) => (
                  <div
                    key={candidate.id}
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      padding: "10px 0",
                      borderTop: "1px solid #dce5ee",
                    }}
                  >
                    <span>{candidate.name}</span>
                    <strong>
                      {candidate.votes} vote(s) - {candidate.percentage}%
                    </strong>
                  </div>
                ))}
              </section>
            ))}
          </>
        )}
      </main>
      <footer className="shell footer">
        {/* Last refreshed: {new Date(clock).toLocaleTimeString()} */}
        Last refreshed:{" "}
        {clock === null ? "Updating..." : new Date(clock).toLocaleTimeString()}
      </footer>
    </>
  );
}

export default function DashboardPage() {
  return (
    <Suspense
      fallback={
        <main className="shell">
          <p>Loading dashboard...</p>
        </main>
      }
    >
      <DashboardContent />
    </Suspense>
  );
}
