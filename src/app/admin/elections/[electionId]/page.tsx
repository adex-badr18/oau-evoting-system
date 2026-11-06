"use client";

import Link from "next/link";
import { ChangeEvent, FormEvent, use, useState } from "react";

type Position = { id: string; title: string };
type TestCredential = {
  fullName: string;
  email: string;
  temporaryPassword: string;
};

export default function ElectionWorkspace({
  params,
}: {
  params: Promise<{ electionId: string }>;
}) {
  const { electionId } = use(params);
  const [positions, setPositions] = useState<Position[]>([]);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [testCredentials, setTestCredentials] = useState<TestCredential[]>([]);
  const [testVoteUrl, setTestVoteUrl] = useState("");
  async function request(
    path: string,
    body: BodyInit | Record<string, unknown>,
    isForm = false,
  ) {
    setError("");
    setMessage("");
    const response = await fetch(`/api/admin/elections/${electionId}/${path}`, {
      method: "POST",
      headers: isForm ? undefined : { "Content-Type": "application/json" },
      body: isForm ? (body as BodyInit) : JSON.stringify(body),
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error ?? "Action failed.");
    return data;
  }
  async function addPosition(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    try {
      const form = new FormData(formElement);
      const title = String(form.get("title"));
      const position = await request("positions", {
        title,
        displayOrder: positions.length,
        isMandatory: true,
      });
      setPositions([...positions, { id: position.id, title }]);
      formElement.reset();
      setMessage("Position added. You can now add candidates.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to add position.");
    }
  }
  async function addCandidate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    try {
      const form = new FormData(formElement);
      await request("candidates", {
        positionId: form.get("positionId"),
        fullName: form.get("fullName"),
        department: form.get("department") || undefined,
        displayOrder: 0,
      });
      formElement.reset();
      setMessage("Candidate added successfully.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to add candidate.");
    }
  }
  async function uploadVoters(event: ChangeEvent<HTMLInputElement>) {
    const input = event.currentTarget;
    const file = input.files?.[0];
    if (!file) return;
    try {
      const body = new FormData();
      body.append("file", file);
      body.append("allowPartial", "false");
      const result = await request("voters", body, true);
      setMessage(`${result.valid.length} eligible voter(s) imported.`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to import voters.");
    } finally {
      input.value = "";
    }
  }
  async function sendCredentials() {
    try {
      const result = await request("credentials", {});
      setTestCredentials(result.testCredentials ?? []);
      setTestVoteUrl(result.testVoteUrl ?? "");
      setMessage(
        result.testCredentials
          ? "Local test credentials generated. They are shown below and were not emailed."
          : `${result.sent} voter credential email(s) sent. ${result.failed} failed.`,
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to send credentials.");
    }
  }
  async function advertise() {
    try {
      await request("status", { action: "ADVERTISE" });
      setMessage(
        "Election advert is now visible on the welcome page. Voting will open automatically at the configured start time.",
      );
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Unable to advertise election.",
      );
    }
  }
  async function closeEarly() {
    if (
      !window.confirm(
        "Close this election now? Voters will no longer be able to vote.",
      )
    )
      return;
    try {
      await request("status", { action: "CLOSE" });
      setMessage("Voting is now closed.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to close election.");
    }
  }
  async function extend(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    try {
      const result = await request("status", {
        action: "EXTEND",
        endsAt: form.get("endsAt"),
      });
      setMessage(
        `Voting time extended to ${new Date(result.endsAt).toLocaleString()}.`,
      );
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Unable to extend voting time.",
      );
    }
  }
  async function approve() {
    try {
      await request("approve", {});
      setMessage(
        "Election approved. The official report is now stored in the repository.",
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to approve election.");
    }
  }
  async function cleanup() {
    const confirmation = window.prompt(
      "Only proceed after the election has been formally audited and the University appeal period is complete. This permanently removes voter personal details while keeping the approved report. Type ANONYMISE to continue.",
    );
    if (confirmation !== "ANONYMISE") {
      if (confirmation !== null)
        setError(
          "Anonymisation was cancelled because the confirmation word did not match.",
        );
      return;
    }
    try {
      const result = await request("cleanup", {});
      const completedAt = new Date(result.completedAt).toLocaleString();
      const notice = `Anonymisation completed at ${completedAt}. ${result.anonymised} voter record(s) were anonymised. The approved report and audit trail remain available.`;
      setMessage(notice);
      window.alert(notice);
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Unable to anonymise voter data.",
      );
    }
  }
  return (
    <>
      <header className="topbar">
        <div className="shell brand">
          <Link className="brand-title" href="/admin">
            OAU eVoting Administration
          </Link>
        </div>
      </header>
      <main className="shell">
        <section className="page-head">
          <div className="eyebrow">Election workspace</div>
          <h1>Configure your election</h1>
          <p>Complete these steps before opening voting.</p>
        </section>
        {message && <p className="notice">{message}</p>}
        {error && <p className="error">{error}</p>}
        <section className="grid">
          <section className="panel">
            <span className="tag">Step 1</span>
            <h2>Add position</h2>
            <form onSubmit={addPosition}>
              <label>
                Position title
                <input name="title" placeholder="e.g. President" required />
              </label>
              <button className="action">Add position</button>
            </form>
            {positions.length > 0 && (
              <p>
                Current positions:{" "}
                {positions.map((position) => position.title).join(", ")}
              </p>
            )}
          </section>
          <section className="panel">
            <span className="tag">Step 2</span>
            <h2>Add candidate</h2>
            <form onSubmit={addCandidate}>
              <label>
                Position
                <select name="positionId" required disabled={!positions.length}>
                  <option value="">Select a position</option>
                  {positions.map((position) => (
                    <option key={position.id} value={position.id}>
                      {position.title}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Candidate full name
                <input name="fullName" required />
              </label>
              <label>
                Department (optional)
                <input name="department" />
              </label>
              <button className="action" disabled={!positions.length}>
                Add candidate
              </button>
            </form>
          </section>
          <section className="panel">
            <span className="tag">Step 3</span>
            <h2>Import eligible voters</h2>
            <p>
              Upload a CSV containing full_name, department, email_address,
              official_id, and faculty.
            </p>
            <label>
              Voter CSV
              <input
                type="file"
                accept=".csv,text/csv"
                onChange={uploadVoters}
              />
            </label>
          </section>
        </section>
        <section className="panel">
          <span className="tag">Step 4</span>
          <h2>Generate and email voter passwords</h2>
          <p>
            This sends a unique temporary password to each imported voter using
            the University email service.
          </p>
          <button className="action" onClick={sendCredentials}>
            Send voter credentials
          </button>
        </section>
        <section className="panel">
          <span className="tag">Step 5</span>
          <h2>Advertise and voting controls</h2>
          <p>
            Click Advertise when setup is complete. The advert appears on the
            public welcome page, and voting opens automatically at the
            configured start time. You can close an active election early or
            extend its closing time while it is in progress.
          </p>
          <button className="action" onClick={advertise}>
            Advertise election
          </button>
          <Link
            className="action"
            style={{ marginLeft: 10, background: "#176b3a" }}
            href={`/dashboard?e=${electionId}`}
            target="_blank"
          >
            Open live dashboard
          </Link>
          <form onSubmit={extend} style={{ marginTop: 18 }}>
            <label>
              New voting closing time
              <input name="endsAt" type="datetime-local" required />
            </label>
            <button className="action">Extend voting time</button>
          </form>
        </section>
        <section className="panel election-danger">
          <span className="tag">Restricted action</span>
          <h2>Close election early</h2>
          <p>
            Use this only when an authorised officer has decided to stop a live
            election before its scheduled closing time. This action cannot be
            undone.
          </p>
          <button className="action danger-action" onClick={closeEarly}>
            Close election early
          </button>
        </section>
        <section className="panel">
          <span className="tag">Step 6</span>
          <h2>Approved report repository</h2>
          <p>
            After voting is closed, approve the result to create the immutable
            official report. You can then view or print it.
          </p>
          <button className="action" onClick={approve}>
            Approve and create report
          </button>
          <Link
            className="action"
            style={{ marginLeft: 10, background: "#176b3a" }}
            href={`/reports/${electionId}`}
            target="_blank"
          >
            View or print report
          </Link>
          <p className="error" style={{ marginTop: 14 }}>
            Do not anonymise voter records until the election audit,
            complaint/appeal review, and approved retention period have been
            completed.
          </p>
          <button
            className="action"
            style={{ marginLeft: 10, background: "#6b2a2a" }}
            onClick={cleanup}
          >
            Anonymise after audit
          </button>
        </section>
        {testCredentials.length > 0 && (
          <section className="panel">
            <span className="tag">Local test only</span>
            <h2>Voter sign-in credentials</h2>
            <p>
              Open{" "}
              <Link
                href={testVoteUrl}
                style={{ color: "#1e6ba8", textDecoration: "underline" }}
              >
                {testVoteUrl}
              </Link>{" "}
              and use one of these credentials. Do not use these passwords for a
              real election.
            </p>
            <ul>
              {testCredentials.map((credential) => (
                <li key={credential.email}>
                  <strong>{credential.fullName}</strong> - {credential.email}{" "}
                  password: <code>{credential.temporaryPassword}</code>
                </li>
              ))}
            </ul>
          </section>
        )}
      </main>
    </>
  );
}
