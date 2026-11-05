"use client";

import { FormEvent, useState } from "react";

export default function NewElectionPage() {
  const [error, setError] = useState(""); const [busy, setBusy] = useState(false);
  async function create(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError(""); const form = new FormData(event.currentTarget);
    const response = await fetch("/api/admin/elections", { method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify({ title:form.get("title"), category:form.get("category"), scope:form.get("scope"), description:form.get("description") || undefined, startsAt:form.get("startsAt"), endsAt:form.get("endsAt") }) });
    const data = await response.json(); setBusy(false);
    if (!response.ok) { setError(data.error ?? "Unable to create election."); return; }
    window.location.assign(`/admin/elections/${data.id}`);
  }
  return <><header className="topbar"><div className="shell brand"><a className="brand-title" href="/admin">OAU eVoting Administration</a></div></header><main className="shell"><section className="page-head"><div className="eyebrow">Election setup</div><h1>Create an election</h1><p>Create the election record first. You will then add positions, candidates, eligible voters, and voter credentials.</p></section><section className="panel" style={{maxWidth:760}}><form onSubmit={create}><label>Election title<input name="title" placeholder="e.g. OAU Senate Election 2026" required /></label><div className="two"><label>Election category<input name="category" placeholder="e.g. Senate Rep. to Council" required /></label><label>Eligible voter scope<input name="scope" placeholder="e.g. All registered Members" required /></label></div><label>Description (optional)<textarea name="description" placeholder="Brief purpose or instructions" /></label><div className="two"><label>Voting opens<input name="startsAt" type="datetime-local" required /></label><label>Voting closes<input name="endsAt" type="datetime-local" required /></label></div>{error && <p className="error">{error}</p>}<button className="action" disabled={busy} type="submit">{busy ? "Creating..." : "Create election"}</button></form></section></main></>;
}
