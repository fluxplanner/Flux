import { verifyUserJWT, json, corsHeaders, serviceClient } from "../_shared/auth.ts";
import { overDailyLimit } from "../_shared/rate-limit.ts";

/** Matches OWNER_UID in release-admin and public/js/app.js. */
const OWNER_UID = (Deno.env.get("FLUX_OWNER_UID") ||
  "eabe2b1f-e428-4181-8530-8e5366eb3975").trim();
const MAX_MSG = 4000;
const MAX_INBOX = 250;

/** Simple in-memory rate limit (best-effort; resets on isolate restart). */
const _hits = new Map<string, number[]>();
function rateOk(userId: string): boolean {
  const now = Date.now();
  const windowMs = 60_000;
  const max = 8;
  const arr = (_hits.get(userId) || []).filter((t) => now - t < windowMs);
  if (arr.length >= max) return false;
  arr.push(now);
  _hits.set(userId, arr);
  return true;
}

function sanitizeMessage(s: unknown): string {
  const t = String(s ?? "").trim().slice(0, MAX_MSG);
  return t.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "");
}

type OwnerRow = { id: string; data: Record<string, unknown> | null };

/**
 * Fetch just the owner's user_data row, by the owner's fixed Auth user id.
 *
 * Neither the owner's email nor the ownerEmail marker inside the row can be
 * trusted here: anyone can register an unclaimed address, and every user can
 * write their own row, so either lookup could divert the feedback inbox.
 */
async function findOwnerRow(
  admin: ReturnType<typeof serviceClient>,
): Promise<OwnerRow | null> {
  const { data, error } = await admin
    .from("user_data")
    .select("id,data")
    .eq("id", OWNER_UID)
    .maybeSingle();
  if (error) throw error;
  return (data as OwnerRow) ?? null;
}

Deno.serve(async (req) => {
  const origin = req.headers.get("origin") ?? "";

  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders(origin) });
  }
  if (req.method !== "POST") {
    return json({ error: "Method not allowed" }, 405, origin);
  }

  const auth = await verifyUserJWT(req);
  if ("error" in auth) {
    return json({ error: auth.error }, auth.status, origin);
  }

  // rateOk lives in memory and resets on every cold start.
  if (await overDailyLimit("user-feedback", auth.userId, 40)) {
    return json({ error: "rate_limited" }, 429, origin);
  }
  if (!rateOk(auth.userId)) {
    return json({ error: "Too many feedback submissions. Try again in a minute." }, 429, origin);
  }

  let body: { message?: string; category?: string; path?: string };
  try {
    body = await req.json();
  } catch {
    return json({ error: "Invalid JSON body" }, 400, origin);
  }

  const message = sanitizeMessage(body.message);
  if (!message) {
    return json({ error: "Message is required" }, 400, origin);
  }

  const category = String(body.category || "general").slice(0, 64).replace(
    /[^a-zA-Z0-9 _-]/g,
    "",
  ) || "general";
  const path = String(body.path || "").slice(0, 500);

  const admin = serviceClient();

  let hit: OwnerRow | null = null;
  try {
    hit = await findOwnerRow(admin);
  } catch (qErr) {
    console.error("user-feedback query", qErr);
    return json({ error: "Could not load owner row" }, 500, origin);
  }

  if (!hit?.id) {
    console.error("user-feedback: no owner row for", OWNER_UID);
    return json({ error: "Feedback inbox not configured" }, 503, origin);
  }

  const rowData = (hit.data && typeof hit.data === "object")
    ? hit.data as Record<string, unknown>
    : {};

  const inbox = Array.isArray(rowData.feedbackInbox)
    ? [...rowData.feedbackInbox as object[]]
    : [];

  const entry = {
    id: crypto.randomUUID(),
    t: Date.now(),
    fromUserId: auth.userId,
    fromEmail: (auth.email || "").slice(0, 320),
    message,
    category,
    path,
    ua: (req.headers.get("user-agent") || "").slice(0, 240),
  };

  inbox.push(entry);
  while (inbox.length > MAX_INBOX) inbox.shift();

  const nextData = { ...rowData, feedbackInbox: inbox };

  const { error: upErr } = await admin
    .from("user_data")
    .update({
      data: nextData,
      updated_at: new Date().toISOString(),
    })
    .eq("id", hit.id);

  if (upErr) {
    console.error("user-feedback update", upErr);
    return json({ error: "Could not save feedback" }, 500, origin);
  }

  return json({ ok: true, id: entry.id }, 200, origin);
});
