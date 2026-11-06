"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";

export default function InitialAdminSetupPage() {
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    const form = new FormData(event.currentTarget);
    if (form.get("password") !== form.get("confirmPassword")) {
      setBusy(false);
      setError("The passwords do not match.");
      return;
    }
    const response = await fetch("/api/admin/setup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        fullName: form.get("fullName"),
        email: form.get("email"),
        password: form.get("password"),
      }),
    });
    const data = await response.json();
    setBusy(false);
    if (!response.ok) {
      setError(data.error ?? "Unable to create the administrator account.");
      return;
    }
    window.location.assign("/admin");
  }
  return (
    <>
      <header className="topbar">
        <div className="shell brand">
          <Link className="brand-title" href="/">
            OAU eVoting
          </Link>
        </div>
      </header>
      <main className="shell">
        <section className="page-head">
          <div className="eyebrow">One-time setup</div>
          <h1>Create the first ICT administrator</h1>
          <p>
            Use this only for a new local or deployed system. It locks
            automatically after the first administrator is created.
          </p>
        </section>
        <section className="panel" style={{ maxWidth: 560 }}>
          <form onSubmit={submit}>
            <label>
              Full name
              <input name="fullName" autoComplete="name" required />
            </label>
            <label>
              University email address
              <input name="email" type="email" autoComplete="email" required />
            </label>
            <label>
              Create password
              <input
                name="password"
                type="password"
                minLength={12}
                autoComplete="new-password"
                required
              />
            </label>
            <label>
              Confirm password
              <input
                name="confirmPassword"
                type="password"
                minLength={12}
                autoComplete="new-password"
                required
              />
            </label>
            {error && <p className="error">{error}</p>}
            <button className="action" disabled={busy} type="submit">
              {busy ? "Creating account..." : "Create ICT administrator"}
            </button>
          </form>
        </section>
      </main>
    </>
  );
}
