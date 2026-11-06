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

export function looksLikeCalendar(text: string): boolean {
  return /^﻿?\s*BEGIN:VCALENDAR/i.test(text);
}
