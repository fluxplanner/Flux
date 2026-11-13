/**
 * Rules for the calendar link a student pastes into Flux. The server fetches
 * this address on the student's behalf, so it must never reach anything private.
 *
 * Districts can run Schoology on their own domain, so the host cannot be limited
 * to schoology.com. Instead the link must be a public https name, and
 * looksLikeCalendar decides whether the response is ever handed back.
 */
export function normalizeFeedUrl(raw: unknown): string | null {
  const input = String(raw ?? "").trim();
  if (!input || input.length > 2048) return null;

  let u: URL;
  try {
    u = new URL(input.replace(/^(webcals?|http):\/\//i, "https://"));
  } catch {
    return null;
  }
  if (u.protocol !== "https:" || u.username || u.password) return null;
  if (u.port && u.port !== "443") return null;

  const host = u.hostname.toLowerCase();
  if (!host.includes(".")) return null;
  if (host.startsWith("[") || /^[\d.]+$/.test(host)) return null;
  if (/(^|\.)(localhost|local|internal|intranet|lan|home|corp)$/.test(host)) return null;
  if (/(^|\.)supabase\.(co|in|net)$/.test(host)) return null;
  return u.toString();
}

/** Loopback, private, link-local, carrier-NAT, multicast and reserved addresses. */
export function isPrivateAddress(ip: string): boolean {
  const s = String(ip ?? "").trim().toLowerCase();
  const v4 = /^(?:::ffff:)?(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(s);
  if (v4) {
    const a = Number(v4[1]);
    const b = Number(v4[2]);
    return a === 0 || a === 10 || a === 127 || a >= 224 ||
      (a === 100 && b >= 64 && b <= 127) ||
      (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && (b === 168 || b === 0)) ||
      (a === 198 && (b === 18 || b === 19));
  }
  if (!s.includes(":")) return true; // not an address at all
  return s === "::" || s === "::1" || s.startsWith("::ffff:") ||
    /^f[cd]/.test(s) || /^fe[89ab]/.test(s) || s.startsWith("ff") ||
    s.startsWith("64:ff9b:");
}

/**
 * normalizeFeedUrl only reads the name, and a public-looking name can point
 * at a private address (127.0.0.1.nip.io does). Look the name up and refuse
 * when any answer is private.
 *
 * If the lookup itself is unavailable the address is allowed: the name check
 * has already passed, and a resolver fault must not break calendar sync.
 */
export async function resolvesToPublicHost(host: string): Promise<boolean> {
  const answers: string[] = [];
  for (const type of ["A", "AAAA"] as const) {
    try {
      answers.push(...await Deno.resolveDns(host, type));
    } catch (e) {
      if (!(e instanceof Deno.errors.NotFound)) {
        console.error("resolvesToPublicHost: lookup unavailable:", e instanceof Error ? e.name : "error");
      }
    }
  }
  return !answers.some(isPrivateAddress);
}

export function looksLikeCalendar(text: string): boolean {
  return /^﻿?\s*BEGIN:VCALENDAR/i.test(text);
}
