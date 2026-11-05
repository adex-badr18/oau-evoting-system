import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";

const SESSION_COOKIE = "uevs_session";
const SESSION_MAX_AGE_SECONDS = 60 * 60 * 8;

export type Session = { subject: string; actorType: "ADMIN" | "VOTER"; role?: string; electionId?: string };

function secretKey() {
  const secret = process.env.AUTH_SECRET;
  if (!secret || secret.length < 32) throw new Error("AUTH_SECRET must be at least 32 characters.");
  return new TextEncoder().encode(secret);
}

export async function issueSession(session: Session) {
  return new SignJWT({ actorType: session.actorType, role: session.role, electionId: session.electionId })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(session.subject)
    .setIssuedAt()
    .setExpirationTime(`${SESSION_MAX_AGE_SECONDS}s`)
    .sign(secretKey());
}

export async function readSession(): Promise<Session | null> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secretKey());
    if (!payload.sub || (payload.actorType !== "ADMIN" && payload.actorType !== "VOTER")) return null;
    return { subject: payload.sub, actorType: payload.actorType, role: typeof payload.role === "string" ? payload.role : undefined, electionId: typeof payload.electionId === "string" ? payload.electionId : undefined };
  } catch { return null; }
}

export async function setSession(session: Session) {
  const token = await issueSession(session);
  (await cookies()).set(SESSION_COOKIE, token, { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", maxAge: SESSION_MAX_AGE_SECONDS, path: "/" });
}

export async function clearSession() { (await cookies()).delete(SESSION_COOKIE); }

export async function requireAdminSession(roles?: string[]) {
  const session = await readSession();
  if (!session || session.actorType !== "ADMIN") throw new Error("Administrator authentication is required.");
  if (roles && (!session.role || !roles.includes(session.role))) throw new Error("You are not authorised for this action.");
  return session;
}
