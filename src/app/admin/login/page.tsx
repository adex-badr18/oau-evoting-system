"use client";

import { FormEvent, useState } from "react";

export default function AdminLoginPage() {
  const [email, setEmail] = useState(""); const [password, setPassword] = useState(""); const [error, setError] = useState(""); const [mfaRequired, setMfaRequired] = useState(false); const [busy, setBusy] = useState(false);
  async function signIn(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError("");
    const response = await fetch("/api/auth/admin/login", { method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify({ email, password, totpCode:(new FormData(event.currentTarget).get("totpCode")) || undefined }) });
    const data = await response.json(); setBusy(false);
    if (data.mfaRequired) { setMfaRequired(true); setError("Enter the six-digit code from your authenticator app."); return; }
    if (!response.ok) { setError(data.error ?? "Unable to sign in."); return; }
    window.location.assign("/admin");
  }
  return <><header className="topbar"><div className="shell brand"><a className="brand-title" href="/">OAU eVoting</a></div></header><main className="shell"><section className="page-head"><div className="eyebrow">Restricted access</div><h1>Administrator sign in</h1><p>For authorised Obafemi Awolowo University Electoral Committee and ICT personnel only.</p></section><section className="panel" style={{maxWidth:560}}><form onSubmit={signIn} autoComplete="off"><label>University email address<input name="email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="off" required /></label><label>Password<input name="password" type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="new-password" required /></label>{mfaRequired && <label>Authenticator code<input name="totpCode" inputMode="numeric" pattern="[0-9]{6}" maxLength={6} autoComplete="one-time-code" required /></label>}{error && <p className="error">{error}</p>}<button className="action" disabled={busy} type="submit">{busy ? "Signing in..." : "Sign in"}</button></form></section></main></>;
}