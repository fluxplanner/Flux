/**
 * Table-backed daily rate guard for the AI proxies (P0 A5).
 *
 * The proxies must never be an open relay: with payments off, a failed JWT
 * used to fall through and burn provider quota for anyone holding the public
 * anon key. Guests (the app signed out sends the anon key as Bearer) get a
 * narrow allowance metered here per IP+fingerprint; signed-in users get a
 * generous abuse stop even when payment metering is disabled.
 *
 * Storage: public.flux_ai_guard (bucket, day, count) — RLS enabled with no
 * policies, so only the service role touches it. The flux_bump_ai_guard RPC
 * increments atomically and self-cleans rows older than 2 days (TTL).
 */
import { serviceClient } from "./auth.ts";

/**
 * Increment the day counter for a bucket and return the new count,
 * or null when the guard itself failed (caller decides fail-open/closed).
 */
export async function bumpDailyGuard(bucket: string): Promise<number | null> {
  try {
    const sb = serviceClient();
    const { data, error } = await sb.rpc("flux_bump_ai_guard", {
      p_bucket: bucket,
    });
    if (error) {
      console.error("rate-limit: flux_bump_ai_guard failed:", error.message);
      return null;
    }
    const n = Number(data);
    return Number.isFinite(n) ? n : null;
  } catch (e) {
    console.error("rate-limit: guard unavailable:", e);
    return null;
  }
}

export async function sha256Hex(s: string): Promise<string> {
  const buf = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(s),
  );
  return [...new Uint8Array(buf)]
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/** First hop of x-forwarded-for — the client IP as seen by the edge. */
export function clientIp(req: Request): string {
  const xff = req.headers.get("x-forwarded-for") ?? "";
  const first = xff.split(",")[0].trim();
  return first || req.headers.get("cf-connecting-ip") || "unknown";
}

/**
 * True when the Bearer token is a Supabase anon-role JWT (the app's guest
 * mode). Payload-only decode — this is a FILTER, not authentication: the
 * anon key is public by design and the real gate is the daily guard.
 */
export function isAnonRoleJwt(token: string): boolean {
  try {
    const parts = String(token || "").split(".");
    if (parts.length !== 3) return false;
    const payload = JSON.parse(
      atob(parts[1].replace(/-/g, "+").replace(/_/g, "/")),
    );
    return payload && payload.role === "anon" && payload.iss === "supabase";
  } catch {
    return false;
  }
}
