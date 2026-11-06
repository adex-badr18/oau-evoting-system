"use client";

import Link from "next/link";
import { FormEvent, Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import { site } from "../../lib/site";

function VoterContent() {
  const electionId = useSearchParams().get("e");
  const [step, setStep] = useState<"login" | "password">("login");
  const [oldPassword, setOldPassword] = useState("");
  const [error, setError] = useState("");
  async function login(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    if (!electionId) {
      setError("Use the personal voting link in your invitation email.");
      return;
    }
    const form = new FormData(event.currentTarget);
    const response = await fetch("/api/auth/voter/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        electionId,
        email: form.get("email"),
        password: form.get("password"),
      }),
    });
    const data = await response.json();
    if (!response.ok) {
      setError(data.error ?? "Unable to sign in.");
      return;
    }
    if (data.mustChangePassword) {
      setOldPassword(String(form.get("password")));
      setStep("password");
      return;
    }
    window.location.assign(`/vote/ballot?e=${electionId}`);
  }
  async function changePassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    const form = new FormData(event.currentTarget);
    const next = String(form.get("password"));
    if (next !== String(form.get("confirm"))) {
      setError("The two new passwords do not match.");
      return;
    }
    const response = await fetch("/api/auth/voter/change-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ currentPassword: oldPassword, newPassword: next }),
    });
    const data = await response.json();
    if (!response.ok) {
      setError(data.error ?? "Unable to change password.");
      return;
    }
    window.location.assign(`/vote/ballot?e=${electionId}`);
  }
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
          <div className="eyebrow">Voter access</div>
          <h1>
            {step === "login" ? "Sign in to vote" : "Create your password"}
          </h1>
          <p>
            Use the personal voting link and temporary password sent to your
            registered email address.
          </p>
        </section>
        <section className="panel voter-login-panel" style={{ maxWidth: 560 }}>
          <p className="voter-login-note">
            Your email address and password are not saved or displayed by this
            browser form.
          </p>
          {step === "login" ? (
            <form onSubmit={login}>
              <label>
                Email address
                <input type="email" name="email" autoComplete="off" required />
              </label>
              <label>
                Temporary password
                <input
                  type="password"
                  name="password"
                  autoComplete="new-password"
                  required
                />
              </label>
              {error && <p className="error">{error}</p>}
              <button className="action">Sign in securely</button>
            </form>
          ) : (
            <form onSubmit={changePassword}>
              <label>
                New password
                <input type="password" name="password" minLength={6} required />
              </label>
              <label>
                Confirm new password
                <input type="password" name="confirm" minLength={6} required />
              </label>
              {error && <p className="error">{error}</p>}
              <button className="action">Save password and continue</button>
            </form>
          )}
        </section>
        <section className="panel">
          <span className="tag">Support</span>
          <p>
            Need help before voting closes? Contact{" "}
            <a href={`mailto:${site.supportEmail}`}>{site.supportEmail}</a>.
          </p>
        </section>
      </main>
    </>
  );
}

export default function VoterPage() {
  return (
    <Suspense
      fallback={
        <main className="shell">
          <p>Loading voter sign in...</p>
        </main>
      }
    >
      <VoterContent />
    </Suspense>
  );
}
