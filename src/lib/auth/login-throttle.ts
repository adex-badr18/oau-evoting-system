type Attempt = { failures: number; resetAt: number; blockedUntil: number };
const attempts = new Map<string, Attempt>();
const windowMs = 15 * 60 * 1000;
const maxFailures = 8;

function clientAddress(request: Request) {
  return request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || request.headers.get("x-real-ip") || "unknown";
}

export function loginAttemptKey(request: Request, identity: string) {
  return `${clientAddress(request)}:${identity.trim().toLowerCase()}`;
}

export function isLoginAllowed(key: string) {
  const item = attempts.get(key);
  if (!item) return true;
  const now = Date.now();
  if (item.blockedUntil > now) return false;
  if (item.resetAt <= now) { attempts.delete(key); return true; }
  return true;
}

export function recordLoginFailure(key: string) {
  const now = Date.now();
  const existing = attempts.get(key);
  const item = !existing || existing.resetAt <= now ? { failures: 0, resetAt: now + windowMs, blockedUntil: 0 } : existing;
  item.failures += 1;
  if (item.failures >= maxFailures) item.blockedUntil = now + windowMs;
  attempts.set(key, item);
}

export function recordLoginSuccess(key: string) { attempts.delete(key); }