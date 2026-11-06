"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type Election = {
  id: string;
  title: string;
  status: string;
  startsAt: string;
  endsAt: string;
};

/**
 * Currently, the load() function updates React state and is called directly from useEffect.
 * We will separate fetching data from updating state.
 * This handles the initial request asynchronously and prevents state updates after the
 * component is unmounted.
 */

export default function AdminPage() {
  const [elections, setElections] = useState<Election[]>([]);
  const [error, setError] = useState("");

  // 1. Add a reusable data-fetching function inside AdminPage, replacing the existing load() function
  async function fetchElections(): Promise<Election[]> {
    const response = await fetch("/api/admin/elections", {
      cache: "no-store",
    });

    const data = await response.json();

    if (response.status === 401) {
      window.location.assign("/admin/login");
      throw new Error("Authentication required.");
    }

    if (!response.ok) {
      throw new Error(data.error ?? "Unable to load your elections.");
    }

    return data.elections;
  }

  // 2. Add a separate load() function
  async function load() {
    try {
      setElections(await fetchElections());
      setError("");
    } catch {
      setError("Unable to load your elections.");
    }
  }

  // 3. Replace your existing useEffect
  useEffect(() => {
    let active = true;

    fetchElections()
      .then((items) => {
        if (active) setElections(items);
      })
      .catch(() => {
        if (active) setError("Unable to load your elections.");
      });

    return () => {
      active = false;
    };
  }, []);

  // async function load() {
  //   const response = await fetch("/api/admin/elections", { cache: "no-store" });
  //   const data = await response.json();
  //   if (response.status === 401) { window.location.assign("/admin/login"); return; }
  //   if (!response.ok) { setError(data.error ?? "Unable to load your elections."); return; }
  //   setElections(data.elections);
  // }
  // useEffect(() => { load().catch(() => setError("Unable to load your elections.")); }, []);

  async function signOut() {
    await fetch("/api/auth/logout", { method: "POST" });
    window.location.assign("/");
  }
  async function changeStatus(
    electionId: string,
    action: "ADVERTISE" | "CLOSE",
  ) {
    if (
      action === "CLOSE" &&
      !window.confirm(
        "Close voting for this election? Voters will no longer be able to vote.",
      )
    )
      return;
    setError("");
    const response = await fetch(`/api/admin/elections/${electionId}/status`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action }),
    });
    const data = await response.json();
    if (!response.ok) {
      setError(data.error ?? "Unable to change election status.");
      return;
    }
    await load();
  }
  return (
    <>
      <header className="topbar">
        <div className="shell brand">
          <Link className="brand-title" href="/">
            OAU eVoting Administration
          </Link>
          <nav className="nav">
            <Link href="/admin/profile">My profile</Link>
            <Link href="/vote">Voter sign in</Link>
            <button className="nav-signout" type="button" onClick={signOut}>
              Sign out
            </button>
          </nav>
        </div>
      </header>
      <main className="shell">
        <section className="page-head">
          <div className="eyebrow">Administrator workspace</div>
          <h1>Manage your elections.</h1>
          <p>
            Open, close, monitor, and access approved reports from this page
            whenever you sign in.
          </p>
        </section>
        {error && <p className="error">{error}</p>}
        <section className="panel">
          <span className="tag">New election</span>
          <h2>Create another election</h2>
          <p>
            Configure positions, candidates, eligible voters, and credentials
            before opening voting.
          </p>
          <Link className="action" href="/admin/elections/new">
            Create election
          </Link>
        </section>
        <section className="panel">
          <span className="tag">Election controls</span>
          <h2>Your elections</h2>
          {elections.length === 0 && <p>No election has been created yet.</p>}
          {elections.map((election) => (
            <article
              key={election.id}
              className="card"
              style={{ marginTop: 14 }}
            >
              <h2>{election.title}</h2>
              <p>
                Status: <strong>{election.status}</strong>
                <br />
                Opens: {new Date(election.startsAt).toLocaleString()}
                <br />
                Closes: {new Date(election.endsAt).toLocaleString()}
              </p>
              <Link className="action" href={`/admin/elections/${election.id}`}>
                Manage election
              </Link>
              {(election.status === "DRAFT" ||
                election.status === "SCHEDULED") && (
                <button
                  className="action"
                  style={{ marginLeft: 10 }}
                  onClick={() => changeStatus(election.id, "ADVERTISE")}
                >
                  Advertise
                </button>
              )}
              <Link
                className="action"
                style={{ marginLeft: 10, background: "#176b3a" }}
                href={`/dashboard?e=${election.id}`}
                target="_blank"
              >
                Live dashboard
              </Link>
              {election.status === "APPROVED" && (
                <Link
                  className="action"
                  style={{ marginLeft: 10, background: "#176b3a" }}
                  href={`/reports/${election.id}`}
                  target="_blank"
                >
                  Report repository
                </Link>
              )}
              {(election.status === "CLOSED" ||
                election.status === "APPROVED") && (
                <Link
                  className="action"
                  style={{ marginLeft: 10, background: "#4b356f" }}
                  href={`/admin/elections/${election.id}/verification`}
                >
                  Audit & verification
                </Link>
              )}
            </article>
          ))}
        </section>
      </main>
      <footer className="shell footer">
        Administrator access is restricted to authorised University personnel.
      </footer>
    </>
  );
}
