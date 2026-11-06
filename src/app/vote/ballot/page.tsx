"use client";

import Link from "next/link";
import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";

type Ballot = {
  election: {
    title: string;
    status: string;
    endsAt: string;
    hasVoted: boolean;
  };
  positions: Array<{
    id: string;
    title: string;
    mandatory: boolean;
    candidates: Array<{ id: string; name: string; department: string | null }>;
  }>;
};
function BallotContent() {
  const electionId = useSearchParams().get("e");
  const [ballot, setBallot] = useState<Ballot | null>(null);
  const [selections, setSelections] = useState<Record<string, string>>({});
  const [loadError, setLoadError] = useState("");
  const [submitError, setSubmitError] = useState("");
  const [receipt, setReceipt] = useState<{
    reference: string;
    auditHash: string;
    submittedAt: string;
  } | null>(null);
  useEffect(() => {
    if (!electionId) return;
    fetch(`/api/elections/${electionId}/ballot`)
      .then(async (r) => {
        const data = await r.json();
        if (!r.ok) throw Error(data.error);
        setBallot(data);
      })
      .catch((e) => setLoadError(e.message));
  }, [electionId]);
  async function submit() {
    if (!ballot || !electionId) return;
    setSubmitError("");
    if (!ballot.positions.length) {
      setSubmitError(
        "This election has no available positions or candidates. Contact the election administrator.",
      );
      return;
    }
    if (
      Object.keys(selections).length === 0 ||
      ballot.positions.some((p) => p.mandatory && !selections[p.id])
    ) {
      setSubmitError(
        "Select one candidate for every required position before submitting your vote.",
      );
      return;
    }
    const response = await fetch("/api/vote", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        electionId,
        selections: Object.entries(selections).map(
          ([positionId, candidateId]) => ({ positionId, candidateId }),
        ),
      }),
    });
    const data = await response.json();
    if (!response.ok) {
      setSubmitError(data.error ?? "Unable to submit vote.");
      return;
    }
    setReceipt({
      reference: data.receiptReference,
      auditHash: data.auditHash,
      submittedAt: data.submittedAt,
    });
  }
  if (receipt)
    return (
      <main className="shell">
        <section className="page-head">
          <div className="eyebrow">Vote recorded</div>
          <h1>Thank you. Your ballot has been submitted.</h1>
          <p>
            Submission time:{" "}
            <strong>{new Date(receipt.submittedAt).toLocaleString()}</strong>
          </p>
          <p>
            Receipt reference: <strong>{receipt.reference}</strong>. It does not
            reveal your selections.
          </p>
          <p>
            Anonymous ballot fingerprint:{" "}
            <strong style={{ wordBreak: "break-all" }}>
              {receipt.auditHash}
            </strong>
          </p>
          <p>
            Keep your receipt privately. The fingerprint proves the ballot
            record exists but cannot identify you or reveal your selections.
          </p>
          <Link className="action" href="/dashboard">
            View live results
          </Link>
        </section>
      </main>
    );
  if (loadError)
    return (
      <main className="shell">
        <section className="page-head">
          <h1>Unable to open ballot</h1>
          <p className="error">{loadError}</p>
          <Link className="action" href={`/vote?e=${electionId ?? ""}`}>
            Return to sign in
          </Link>
        </section>
      </main>
    );
  if (!ballot)
    return (
      <main className="shell">
        <p>Loading your secure ballot...</p>
      </main>
    );
  return (
    <>
      <header className="topbar">
        <div className="shell brand">
          <Link className="brand-title" href="/">
            OAU eVoting
          </Link>
          <Link href="/dashboard">Live dashboard</Link>
        </div>
      </header>
      <main className="shell">
        <section className="page-head">
          <div className="eyebrow">Secure ballot</div>
          <h1>{ballot.election.title}</h1>
          <p>
            Voting closes {new Date(ballot.election.endsAt).toLocaleString()}.
            Review selections carefully: submitted ballots cannot be changed.
          </p>
        </section>
        <section className="panel ballot-panel">
          <p className="ballot-intro">
            Select one candidate for each position, then submit your ballot
            once.
          </p>
          {ballot.positions.map((position) => (
            <section className="panel" key={position.id}>
              <h2>{position.title}</h2>
              {position.candidates.map((candidate) => (
                <label key={candidate.id} style={{ fontWeight: 400 }}>
                  <input
                    type="radio"
                    name={position.id}
                    checked={selections[position.id] === candidate.id}
                    onChange={() =>
                      setSelections({
                        ...selections,
                        [position.id]: candidate.id,
                      })
                    }
                  />
                  {candidate.name}
                  {candidate.department ? ` - ${candidate.department}` : ""}
                </label>
              ))}
            </section>
          ))}
          {submitError && <p className="error">{submitError}</p>}
          <button className="action" onClick={submit}>
            Submit vote
          </button>
        </section>
      </main>
    </>
  );
}

export default function BallotPage() {
  return (
    <Suspense
      fallback={
        <main className="shell">
          <p>Loading ballot...</p>
        </main>
      }
    >
      <BallotContent />
    </Suspense>
  );
}
