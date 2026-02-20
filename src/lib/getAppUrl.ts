/**
 * Returns the public HTTPS base URL of this app.
 *
 * Priority:
 * 1. NEXT_PUBLIC_APP_URL  (if set and not localhost)
 * 2. VERCEL_URL           (auto-set by Vercel on every deployment)
 * 3. NEXT_PUBLIC_APP_URL  (localhost fallback for local dev)
 */
export function getAppUrl(): string {
  const explicit = process.env.NEXT_PUBLIC_APP_URL ?? "";

  if (explicit && !explicit.includes("localhost")) {
    return explicit.replace(/\/$/, ""); // strip trailing slash
  }

  // Vercel injects VERCEL_URL automatically (no https:// prefix)
  const vercelUrl = process.env.VERCEL_URL;
  if (vercelUrl) {
    return `https://${vercelUrl}`;
  }

  // Local development fallback
  return explicit || "http://localhost:3000";
}
