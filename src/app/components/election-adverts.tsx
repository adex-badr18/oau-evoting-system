"use client";

import { useEffect, useMemo, useState } from "react";

type Election = { id: string; title: string; description: string | null; category: string; scope: string; startsAt: string; endsAt: string };

export function ElectionAdverts() {
  const [elections, setElections] = useState<Election[]>([]);
  const [dismissed, setDismissed] = useState(false);
  const [index, setIndex] = useState(0);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    let active = true;
    async function load() {
      try {
        const response = await fetch("/api/public/elections", { cache: "no-store" });
        const data = await response.json();
        if (active) setElections(data.elections ?? []);
      } catch { if (active) setElections([]); }
    }
    void load();
    const timer = window.setInterval(() => { setNow(Date.now()); void load(); }, 15_000);
    return () => { active = false; window.clearInterval(timer); };
  }, []);

  useEffect(() => {
    function closeOnEscape(event: KeyboardEvent) { if (event.key === "Escape") setDismissed(true); }
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, []);

  const activeElections = useMemo(() => elections.filter((election) => new Date(election.endsAt).getTime() > now), [elections, now]);
  const election = activeElections[Math.min(index, Math.max(activeElections.length - 1, 0))];
  useEffect(() => { if (election) setDismissed(false); }, [election?.id]);
  if (dismissed || !election) return null;

  const startsAt = new Date(election.startsAt); const endsAt = new Date(election.endsAt); const live = startsAt.getTime() <= now;
  return <div className="election-modal-backdrop" role="presentation"><section className="election-modal" role="dialog" aria-modal="true" aria-labelledby="election-modal-title">
    <button className="election-modal-close" type="button" aria-label="Close election notice" onClick={() => setDismissed(true)}>x</button>
    <p className="election-modal-eyebrow">University election notice</p><span className={`election-modal-status ${live ? "is-live" : "is-upcoming"}`}>{live ? "Voting is live" : "Upcoming election"}</span>
    <p className="tag">{election.category}</p><h2 id="election-modal-title">{election.title}</h2>
    <p className="election-modal-copy">{election.description ?? `Eligible voters: ${election.scope}.`}</p>
    <div className="election-modal-times"><div><span>{live ? "Voting opened" : "Voting opens"}</span><strong>{startsAt.toLocaleString()}</strong></div><div><span>Voting closes</span><strong>{endsAt.toLocaleString()}</strong></div></div>
    <p className="election-modal-note">Use the personal voting link and temporary password sent to your registered email address.</p>
    <div className="election-modal-actions"><a className="welcome-primary" href={`/vote?e=${election.id}`}>{live ? "Sign in to vote" : "Open voter sign in"}</a><a className="welcome-secondary modal-secondary" href={`/dashboard?e=${election.id}`}>View election monitor</a></div>
    {activeElections.length > 1 && <div className="election-modal-pager"><button type="button" onClick={() => setIndex((current) => (current - 1 + activeElections.length) % activeElections.length)}>Previous</button><span>{Math.min(index, activeElections.length - 1) + 1} of {activeElections.length}</span><button type="button" onClick={() => setIndex((current) => (current + 1) % activeElections.length)}>Next</button></div>}
  </section></div>;
}