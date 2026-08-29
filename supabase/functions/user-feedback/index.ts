import { verifyUserJWT, json, corsHeaders, serviceClient } from "../_shared/auth.ts";

const OWNER_EMAIL = (Deno.env.get("FLUX_OWNER_EMAIL") || "azfermohammed21@gmail.com")
  .trim()
  .toLowerCase();
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

/** Owner's Auth user id (best-effort memo; resets on isolate restart, like _hits). */
let _ownerUserId: string | null = null;

/** Resolve the owner's Auth user id by email (paginated; cap pages for safety). */
async function findOwnerUserId(
  admin: ReturnType<typeof serviceClient>,
): Promise<string | null> {
  if (_ownerUserId) return _ownerUserId;
  const perPage = 200;
  const maxPages = 50;
  for (let page = 1; page <= maxPages; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage });
    if (error) throw error;
    const users = data?.users ?? [];
    const hit = users.find((u) =>
      String(u.email || "").trim().toLowerCase() === OWNER_EMAIL
    );
    // Only a positive result is memoized, so an owner account created later is
    // still picked up by a later request.
    if (hit?.id) return (_ownerUserId = hit.id);
    if (users.length < perPage) return null;
  }
  return null;
}

/**
 * Fetch just the owner's user_data row.
 *
 * Preferred path is the owner's Auth user id: the owner's own client reads its
 * inbox back from the row keyed by its auth id (app.js syncToCloud), so that is
 * the only row where an appended entry is guaranteed to be seen.
 *
 * Fallback matches the ownerEmail marker the client writes into that same row,
 * for when the Auth lookup is unavailable. Either way Postgres does the
 * filtering and returns one row, so no other user's data blob is ever read
 * into this isolate.
 */
async function findOwnerRow(
  admin: ReturnType<typeof serviceClient>,
): Promise<OwnerRow | null> {
  let ownerId: string | null = null;
  try {
    ownerId = await findOwnerUserId(admin);
  } catch (e) {
    // Degrade to the marker lookup rather than dropping the feedback.
    console.error("user-feedback: owner auth lookup failed", e);
  }

  if (ownerId) {
    const { data, error } = await admin
      .from("user_data")
      .select("id,data")
      .eq("id", ownerId)
      .maybeSingle();
    if (error) throw error;
    if (data) return data as OwnerRow;
  }

  // limit(1) keeps this from erroring if a stale duplicate marker ever exists,
  // preserving the old "first match wins" behaviour.
  const { data, error } = await admin
    .from("user_data")
    .select("id,data")
    .eq("data->>ownerEmail", OWNER_EMAIL)
    .limit(1)
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
    console.error("user-feedback: no owner row for", OWNER_EMAIL);
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
