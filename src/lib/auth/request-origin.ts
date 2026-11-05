/** Reject cross-site browser requests that could misuse a signed-in session cookie. */
export function assertSameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  const host = request.headers.get("x-forwarded-host") || request.headers.get("host");
  if (!origin || !host) throw new Error("Invalid request origin.");
  const originUrl = new URL(origin);
  const forwardedProtocol = request.headers.get("x-forwarded-proto") || "http";
  const configured = process.env.APP_URL ? new URL(process.env.APP_URL).origin : null;
  const isConfiguredOrigin = configured === originUrl.origin;
  const isSameRequestHost = originUrl.host === host && (process.env.NODE_ENV !== "production" || originUrl.protocol === `${forwardedProtocol}:`);
  if (!isConfiguredOrigin && !isSameRequestHost) throw new Error("Invalid request origin.");
}