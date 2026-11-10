import { corsHeaders, verifyUserJWT } from "../_shared/auth.ts";
import { looksLikeCalendar, normalizeFeedUrl, resolvesToPublicHost } from "../_shared/schoology-feed.ts";

/*
 * Fetches a student's Schoology calendar link. Browsers cannot read it directly
 * because Schoology does not allow cross-site requests.
 *
 * The link is a secret: anyone holding it can read that calendar. It is never
 * logged, and neither is the response.
 */

const MAX_BYTES = 5 * 1024 * 1024;
const TIMEOUT_MS = 15_000;
const MAX_REDIRECTS = 3;

async function readCapped(res: Response): Promise<string | null> {
  if (!res.body) return "";
  const reader = res.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > MAX_BYTES) {
      await reader.cancel();
      return null;
    }
    chunks.push(value);
  }
  const all = new Uint8Array(total);
  let at = 0;
  for (const c of chunks) {
    all.set(c, at);
    at += c.byteLength;
  }
  return new TextDecoder().decode(all);
}

/** Follows redirects by hand so that every hop passes the same address check. */
async function fetchFeed(start: string, signal: AbortSignal): Promise<Response | null> {
  let url = start;
  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    if (!(await resolvesToPublicHost(new URL(url).hostname))) return null;
    const res = await fetch(url, {
      redirect: "manual",
      signal,
      headers: { Accept: "text/calendar, text/plain", "User-Agent": "FluxPlanner-CalendarSync" },
    });
    if (res.status < 300 || res.status >= 400) return res;
    await res.body?.cancel();
    const next = normalizeFeedUrl(new URL(res.headers.get("location") ?? "", url).toString());
    if (!next) return null;
    url = next;
  }
  return null;
}

Deno.serve(async (req) => {
  const origin = req.headers.get("origin") ?? "";
  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { "Content-Type": "application/json", ...corsHeaders(origin) },
    });

  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders(origin) });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const auth = await verifyUserJWT(req);
  if ("error" in auth) return json({ error: auth.error }, auth.status);

  let url: string | null = null;
  try {
    url = normalizeFeedUrl((await req.json())?.url);
  } catch {
    url = null;
  }
  if (!url) return json({ error: "That doesn't look like a calendar link." }, 400);

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetchFeed(url, controller.signal);
    if (!res) return json({ error: "That link redirects somewhere Flux can't open." }, 400);

    const text = await readCapped(res);
    console.log(JSON.stringify({ userId: auth.userId, host: new URL(url).hostname, status: res.status }));
    if (text === null) return json({ error: "That calendar is too large." }, 413);
    if (!res.ok || !looksLikeCalendar(text)) {
      return json({ error: "That link didn't return a calendar. Copy it from Schoology again." }, 422);
    }
    return json({ ics: text });
  } catch (e) {
    const aborted = e instanceof Error && e.name === "AbortError";
    return json({ error: aborted ? "Schoology took too long to answer." : "Couldn't reach Schoology." }, 502);
  } finally {
    clearTimeout(timer);
  }
});
