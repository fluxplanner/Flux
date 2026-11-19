// lms-feed — fetch a student's private Schoology or Moodle calendar feed
// (.ics) on their behalf. Browsers can't read these feeds directly (no CORS),
// so the client posts the link here and gets the iCalendar text back.
//
// Only two URL shapes are accepted, so this can't be used as an open proxy:
//   Schoology  https://<any>.schoology.com/calendar/feed/ical/…
//   Moodle     https://<school host>/…/calendar/export_execute.php?…
import { verifyUserJWT, corsHeaders } from "../_shared/auth.ts";

const MAX_BYTES = 3 * 1024 * 1024;
const FETCH_TIMEOUT_MS = 15_000;
const MAX_REDIRECTS = 3;

type Provider = "schoology" | "moodle";

function jsonErr(msg: string, status: number, origin: string): Response {
  return new Response(JSON.stringify({ error: msg }), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders(origin) },
  });
}

function isPrivateHost(host: string): boolean {
  const h = host.toLowerCase();
  if (h === "localhost" || h.endsWith(".localhost") || h.endsWith(".local") || h.endsWith(".internal")) return true;
  // Reject every IP literal: real school sites use names.
  if (/^\d+\.\d+\.\d+\.\d+$/.test(h) || h.includes(":") || h.startsWith("[")) return true;
  return !h.includes(".");
}

/** Returns the normalised URL when it matches the provider's feed shape. */
function validateFeedUrl(raw: string, provider: Provider): URL | null {
  let s = String(raw || "").trim();
  if (s.toLowerCase().startsWith("webcal://")) s = "https://" + s.slice(9);
  let u: URL;
  try {
    u = new URL(s);
  } catch {
    return null;
  }
  if (u.protocol !== "https:" || u.username || u.password) return null;
  if (u.port && u.port !== "443") return null;
  const host = u.hostname.toLowerCase();
  if (isPrivateHost(host)) return null;
  const path = u.pathname;
  if (provider === "schoology") {
    if (!(host === "schoology.com" || host.endsWith(".schoology.com"))) return null;
    if (!path.startsWith("/calendar/feed/ical/")) return null;
  } else {
    if (!path.endsWith("/calendar/export_execute.php")) return null;
  }
  return u;
}

async function fetchFeed(start: URL, provider: Provider): Promise<string> {
  let url = start;
  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS);
    let res: Response;
    try {
      res = await fetch(url.toString(), {
        redirect: "manual",
        signal: ctrl.signal,
        headers: { Accept: "text/calendar, text/plain;q=0.8, */*;q=0.1", "User-Agent": "FluxPlanner-LMSFeed/1.0" },
      });
    } finally {
      clearTimeout(timer);
    }
    if (res.status >= 300 && res.status < 400) {
      const loc = res.headers.get("location");
      if (!loc) throw new Error("Feed redirected without a location");
      // Re-check every hop so a redirect can't point somewhere else.
      const next = validateFeedUrl(new URL(loc, url).toString(), provider);
      if (!next) throw new Error("Feed redirected to a link Flux can't use");
      url = next;
      continue;
    }
    if (!res.ok) throw new Error(`The school site answered ${res.status}. Check the link is still valid.`);
    const len = Number(res.headers.get("content-length") || 0);
    if (len > MAX_BYTES) throw new Error("Calendar feed is too large");
    const buf = await res.arrayBuffer();
    if (buf.byteLength > MAX_BYTES) throw new Error("Calendar feed is too large");
    const text = new TextDecoder().decode(buf);
    if (!text.trimStart().startsWith("BEGIN:VCALENDAR")) {
      throw new Error("That link didn't return a calendar. Copy the export link again.");
    }
    return text;
  }
  throw new Error("Too many redirects");
}

Deno.serve(async (req) => {
  const origin = req.headers.get("origin") ?? "";
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders(origin) });
  if (req.method !== "POST") return jsonErr("POST only", 405, origin);

  const auth = await verifyUserJWT(req);
  if ("error" in auth) return jsonErr(auth.error, auth.status, origin);

  let body: { provider?: string; url?: string };
  try {
    body = await req.json();
  } catch {
    return jsonErr("Body must be JSON", 400, origin);
  }
  const provider = body.provider === "moodle" ? "moodle" : body.provider === "schoology" ? "schoology" : null;
  if (!provider) return jsonErr("provider must be schoology or moodle", 400, origin);
  const url = validateFeedUrl(String(body.url || ""), provider);
  if (!url) return jsonErr(`That isn't a ${provider === "moodle" ? "Moodle" : "Schoology"} calendar link`, 400, origin);

  try {
    const ics = await fetchFeed(url, provider);
    return new Response(JSON.stringify({ ics }), {
      headers: { "Content-Type": "application/json", "Cache-Control": "no-store", ...corsHeaders(origin) },
    });
  } catch (e) {
    const msg = e instanceof Error && e.name !== "AbortError" ? e.message : "The school site took too long to answer";
    return jsonErr(msg, 502, origin);
  }
});
