// Flux Planner — Claude MCP connector.
//
// One Edge Function that is BOTH:
//   1. an OAuth 2.1 Authorization Server (Dynamic Client Registration, PKCE,
//      authorization_code + refresh_token grants) that reuses Supabase Auth for
//      the actual user login via a same-origin consent page, and
//   2. an MCP resource server (Streamable HTTP) exposing planner tools.
//
// Scopes: `planner.read` (curated, allowlisted reads) and `tasks.write` (task CRUD).
// All user data lives in public.user_data.data (single JSONB blob per user); tasks
// are data.tasks[]. Secrets in the blob (integrations tokens, owner-only keys) are
// NEVER exposed — reads are default-deny against an explicit allowlist.
//
// Deploy NOTE: must be deployed with verify_jwt = false (discovery, /register and
// /token are called by Claude without a Supabase JWT). Auth is enforced in-code.

import { serviceClient, verifyUserJWT, corsHeaders } from "../_shared/auth.ts";
import {
  json,
  oauthError,
  rpcResult,
  rpcError,
  RPC,
  randomToken,
  sha256hex,
  verifyPkceS256,
  type JsonRpcId,
} from "../_shared/mcp.ts";

const SUPPORTED_SCOPES = ["planner.read", "tasks.write"];
const ACCESS_TTL_SEC = 60 * 60; // 1h
const REFRESH_TTL_SEC = 60 * 60 * 24 * 30; // 30d
const CODE_TTL_SEC = 5 * 60; // 5m
const SERVER_INFO = { name: "Flux Planner", version: "1.0.0" };

// Planner blob keys that read tools may surface. DEFAULT-DENY: anything not here
// (integrations, devAccounts, platformConfig, ownerAuditLog, feedbackInbox,
// ownerEmail, settings, profile, …) is structurally unreachable.
const READABLE_KEYS = new Set([
  "tasks", "events", "goals", "habits", "notes",
  "classes", "colleges", "grades", "smartLists",
  "recurringSeries", "weeklyEvents", "examPrepPlan",
]);

function cors(origin: string) {
  return {
    ...corsHeaders(origin),
    "Access-Control-Allow-Headers":
      "authorization, x-client-info, apikey, content-type, mcp-protocol-version, mcp-session-id",
    "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
  };
}

/** Resolve the public base URL (issuer/resource) + the route within the function. */
function resolve(req: Request): { base: string; route: string } {
  const url = new URL(req.url);
  let route = url.pathname;
  let mount = "";
  // Supabase invokes the function with the path as `/<fn>/<subpath>` (e.g. `/mcp/authorize`).
  // Direct/custom-domain calls may use the full `/functions/v1/mcp/...` or be root-mounted.
  const m = route.match(/^\/functions\/v1\/mcp(?=\/|$)/) || route.match(/^\/mcp(?=\/|$)/);
  if (m) {
    mount = m[0];
    route = route.slice(m[0].length);
  }
  if (!route) route = "/";
  // Advertised URLs must be the PUBLIC https origin + `/functions/v1/mcp`, which the function
  // can't always infer from the internal request — pin it via MCP_PUBLIC_URL in production.
  const envBase = Deno.env.get("MCP_PUBLIC_URL");
  const base = (envBase || `${url.origin}${mount}`).replace(/^http:\/\//, "https://").replace(/\/+$/, "");
  return { base, route };
}

function consentUrl(): string {
  return (
    Deno.env.get("MCP_CONSENT_URL") ||
    "https://fluxplanner.github.io/Flux/connect-claude.html"
  );
}

// ===========================================================================
// Entry
// ===========================================================================
Deno.serve(async (req) => {
  const origin = req.headers.get("origin") ?? "";
  const ch = cors(origin);
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: ch });

  const { base, route } = resolve(req);

  try {
    // ---- OAuth discovery (RFC 9728 / RFC 8414) ----------------------------
    if (route.startsWith("/.well-known/oauth-protected-resource")) {
      return json(
        {
          resource: base,
          authorization_servers: [base],
          scopes_supported: SUPPORTED_SCOPES,
          bearer_methods_supported: ["header"],
          resource_documentation: "https://azfermohammed.github.io/Fluxplanner/",
        },
        200,
        ch,
      );
    }
    if (
      route.startsWith("/.well-known/oauth-authorization-server") ||
      route.startsWith("/.well-known/openid-configuration")
    ) {
      return json(
        {
          issuer: base,
          authorization_endpoint: `${base}/authorize`,
          token_endpoint: `${base}/token`,
          registration_endpoint: `${base}/register`,
          revocation_endpoint: `${base}/revoke`,
          scopes_supported: SUPPORTED_SCOPES,
          response_types_supported: ["code"],
          grant_types_supported: ["authorization_code", "refresh_token"],
          code_challenge_methods_supported: ["S256"],
          token_endpoint_auth_methods_supported: ["none"],
        },
        200,
        ch,
      );
    }

    // ---- Dynamic Client Registration (RFC 7591) ---------------------------
    if (route === "/register" && req.method === "POST") return register(req, ch);

    // ---- Authorization endpoint -------------------------------------------
    if (route === "/authorize" && req.method === "GET") return authorize(req, base, ch);
    if (route === "/authorize/grant" && req.method === "POST") return grant(req, ch);

    // ---- Token endpoint ---------------------------------------------------
    if (route === "/token" && req.method === "POST") return token(req, ch);

    // ---- Token revocation (RFC 7009) --------------------------------------
    if (route === "/revoke" && req.method === "POST") return revoke(req, ch);

    // ---- MCP endpoint (Streamable HTTP) -----------------------------------
    if (route === "/" || route === "/mcp") {
      if (req.method === "GET") {
        // No server-initiated SSE stream in this stateless server.
        return new Response("Method Not Allowed", { status: 405, headers: { ...ch, Allow: "POST" } });
      }
      if (req.method === "POST") return mcp(req, base, ch);
    }

    return json({ error: "not_found" }, 404, ch);
  } catch (e) {
    console.error("[mcp] unhandled", e);
    return json({ error: "server_error" }, 500, ch);
  }
});

// ===========================================================================
// OAuth: Dynamic Client Registration
// ===========================================================================
async function register(req: Request, ch: Record<string, string>) {
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return oauthError("invalid_client_metadata", "Body must be JSON", 400, ch);
  }
  const redirectUris = Array.isArray(body.redirect_uris) ? body.redirect_uris.map(String) : [];
  if (redirectUris.length === 0) {
    return oauthError("invalid_redirect_uri", "redirect_uris is required", 400, ch);
  }
  for (const u of redirectUris) {
    try {
      const parsed = new URL(u);
      // Allow https + Claude's localhost/loopback desktop redirects.
      const ok =
        parsed.protocol === "https:" ||
        parsed.hostname === "localhost" ||
        parsed.hostname === "127.0.0.1" ||
        parsed.hostname === "[::1]";
      if (!ok) return oauthError("invalid_redirect_uri", `Unsupported redirect_uri: ${u}`, 400, ch);
    } catch {
      return oauthError("invalid_redirect_uri", `Malformed redirect_uri: ${u}`, 400, ch);
    }
  }

  const sb = serviceClient();
  const clientId = "flux_client_" + randomToken(18);
  const clientName = typeof body.client_name === "string" ? body.client_name.slice(0, 200) : "MCP Client";
  const { error } = await sb.from("flux_mcp_oauth_clients").insert({
    client_id: clientId,
    client_name: clientName,
    redirect_uris: redirectUris,
    token_endpoint_auth_method: "none",
  });
  if (error) {
    console.error("[mcp] register insert", error);
    return oauthError("server_error", "Could not register client", 500, ch);
  }

  return json(
    {
      client_id: clientId,
      client_id_issued_at: Math.floor(Date.now() / 1000),
      client_secret_expires_at: 0, // public client, never expires
      client_name: clientName,
      redirect_uris: redirectUris,
      grant_types: ["authorization_code", "refresh_token"],
      response_types: ["code"],
      token_endpoint_auth_method: "none",
      scope: SUPPORTED_SCOPES.join(" "),
    },
    201,
    ch,
  );
}

// ===========================================================================
// OAuth: Authorization endpoint → redirect to the Flux consent page
// ===========================================================================
async function authorize(req: Request, base: string, ch: Record<string, string>) {
  const q = new URL(req.url).searchParams;
  const clientId = q.get("client_id") || "";
  const redirectUri = q.get("redirect_uri") || "";
  const responseType = q.get("response_type") || "";
  const codeChallenge = q.get("code_challenge") || "";
  const codeChallengeMethod = q.get("code_challenge_method") || "";
  const state = q.get("state") || "";
  const scope = normalizeScope(q.get("scope"));

  const sb = serviceClient();
  const { data: client } = await sb
    .from("flux_mcp_oauth_clients")
    .select("client_id, client_name, redirect_uris")
    .eq("client_id", clientId)
    .maybeSingle();

  // Invalid client / redirect_uri → must NOT redirect (RFC 6749 §4.1.2.1).
  if (!client || !clientId) return htmlError("Unknown client_id.", ch);
  if (!redirectUri || !(client.redirect_uris as string[]).includes(redirectUri)) {
    return htmlError("redirect_uri does not match the registered client.", ch);
  }

  // Validation errors that CAN be reported to the client via redirect.
  const fail = (error: string, desc: string) => {
    const u = new URL(redirectUri);
    u.searchParams.set("error", error);
    u.searchParams.set("error_description", desc);
    if (state) u.searchParams.set("state", state);
    return Response.redirect(u.toString(), 302);
  };
  if (responseType !== "code") return fail("unsupported_response_type", "Only response_type=code is supported");
  if (!codeChallenge || codeChallengeMethod !== "S256") {
    return fail("invalid_request", "PKCE S256 (code_challenge) is required");
  }

  // Hand off to the statically-hosted Flux consent page. (Supabase forces text/plain +
  // a sandbox CSP on HTML served from *.supabase.co/functions, so the consent UI — which
  // must run JS to authenticate — has to live on static hosting, not in the function.)
  const c = new URL(consentUrl());
  c.searchParams.set("client_id", clientId);
  c.searchParams.set("redirect_uri", redirectUri);
  c.searchParams.set("code_challenge", codeChallenge);
  c.searchParams.set("code_challenge_method", "S256");
  c.searchParams.set("scope", scope);
  c.searchParams.set("state", state);
  c.searchParams.set("resource", base);
  return Response.redirect(c.toString(), 302);
}

// ===========================================================================
// OAuth: consent approval → mint single-use authorization code
// Called by the consent page with the user's Supabase JWT as Bearer.
// ===========================================================================
async function grant(req: Request, ch: Record<string, string>) {
  const auth = await verifyUserJWT(req);
  if ("status" in auth) return json({ error: "unauthorized", error_description: auth.error }, auth.status, ch);

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return json({ error: "invalid_request" }, 400, ch);
  }
  const clientId = String(body.client_id || "");
  const redirectUri = String(body.redirect_uri || "");
  const codeChallenge = String(body.code_challenge || "");
  const state = String(body.state || "");
  const scope = normalizeScope(typeof body.scope === "string" ? body.scope : null);

  const sb = serviceClient();
  const { data: client } = await sb
    .from("flux_mcp_oauth_clients")
    .select("client_id, redirect_uris")
    .eq("client_id", clientId)
    .maybeSingle();
  if (!client || !(client.redirect_uris as string[]).includes(redirectUri) || !codeChallenge) {
    return json({ error: "invalid_request" }, 400, ch);
  }

  const code = randomToken(32);
  const codeHash = await sha256hex(code);
  const { error } = await sb.from("flux_mcp_auth_codes").insert({
    code_sha256: codeHash,
    client_id: clientId,
    user_id: auth.userId,
    redirect_uri: redirectUri,
    code_challenge: codeChallenge,
    code_challenge_method: "S256",
    scope,
    expires_at: new Date(Date.now() + CODE_TTL_SEC * 1000).toISOString(),
  });
  if (error) {
    console.error("[mcp] grant insert", error);
    return json({ error: "server_error" }, 500, ch);
  }

  const redirect = new URL(redirectUri);
  redirect.searchParams.set("code", code);
  if (state) redirect.searchParams.set("state", state);
  return json({ redirect: redirect.toString() }, 200, ch);
}

// ===========================================================================
// OAuth: Token endpoint (authorization_code + refresh_token)
// ===========================================================================
async function token(req: Request, ch: Record<string, string>) {
  const form = await readForm(req);
  const grantType = form.get("grant_type") || "";
  const sb = serviceClient();

  if (grantType === "authorization_code") {
    const code = form.get("code") || "";
    const verifier = form.get("code_verifier") || "";
    const clientId = form.get("client_id") || "";
    const redirectUri = form.get("redirect_uri") || "";
    if (!code || !verifier) return oauthError("invalid_request", "code and code_verifier required", 400, ch);

    const codeHash = await sha256hex(code);
    const { data: row } = await sb
      .from("flux_mcp_auth_codes")
      .select("*")
      .eq("code_sha256", codeHash)
      .maybeSingle();
    if (!row || row.used) return oauthError("invalid_grant", "Authorization code invalid or used", 400, ch);
    if (new Date(row.expires_at).getTime() < Date.now()) {
      return oauthError("invalid_grant", "Authorization code expired", 400, ch);
    }
    if (clientId && clientId !== row.client_id) return oauthError("invalid_grant", "client_id mismatch", 400, ch);
    if (redirectUri && redirectUri !== row.redirect_uri) {
      return oauthError("invalid_grant", "redirect_uri mismatch", 400, ch);
    }
    if (!(await verifyPkceS256(verifier, row.code_challenge))) {
      return oauthError("invalid_grant", "PKCE verification failed", 400, ch);
    }

    // Single-use: burn the code immediately.
    await sb.from("flux_mcp_auth_codes").update({ used: true }).eq("code_sha256", codeHash);

    const { data: client } = await sb
      .from("flux_mcp_oauth_clients")
      .select("client_name")
      .eq("client_id", row.client_id)
      .maybeSingle();

    return issueTokens(sb, row.user_id, row.client_id, client?.client_name ?? null, row.scope, ch);
  }

  if (grantType === "refresh_token") {
    const refresh = form.get("refresh_token") || "";
    if (!refresh) return oauthError("invalid_request", "refresh_token required", 400, ch);
    const refreshHash = await sha256hex(refresh);
    const { data: row } = await sb
      .from("flux_mcp_tokens")
      .select("*")
      .eq("refresh_sha256", refreshHash)
      .is("revoked_at", null)
      .maybeSingle();
    if (!row || (row.refresh_expires_at && new Date(row.refresh_expires_at).getTime() < Date.now())) {
      return oauthError("invalid_grant", "refresh_token invalid or expired", 400, ch);
    }
    // Rotate: reissue on the same row.
    return issueTokens(sb, row.user_id, row.client_id, row.client_name, row.scope, ch, row.id);
  }

  return oauthError("unsupported_grant_type", `Unsupported grant_type: ${grantType}`, 400, ch);
}

async function issueTokens(
  sb: ReturnType<typeof serviceClient>,
  userId: string,
  clientId: string,
  clientName: string | null,
  scope: string,
  ch: Record<string, string>,
  existingRowId?: string,
) {
  const access = randomToken(32);
  const refresh = randomToken(32);
  const now = Date.now();
  const patch = {
    user_id: userId,
    client_id: clientId,
    client_name: clientName,
    scope,
    access_sha256: await sha256hex(access),
    refresh_sha256: await sha256hex(refresh),
    access_expires_at: new Date(now + ACCESS_TTL_SEC * 1000).toISOString(),
    refresh_expires_at: new Date(now + REFRESH_TTL_SEC * 1000).toISOString(),
    revoked_at: null,
  };
  let err;
  if (existingRowId) {
    ({ error: err } = await sb.from("flux_mcp_tokens").update(patch).eq("id", existingRowId));
  } else {
    ({ error: err } = await sb.from("flux_mcp_tokens").insert(patch));
  }
  if (err) {
    console.error("[mcp] issueTokens", err);
    return oauthError("server_error", "Could not issue token", 500, ch);
  }
  return json(
    {
      access_token: access,
      token_type: "Bearer",
      expires_in: ACCESS_TTL_SEC,
      refresh_token: refresh,
      scope,
    },
    200,
    { ...ch, "Cache-Control": "no-store" },
  );
}

async function revoke(req: Request, ch: Record<string, string>) {
  const form = await readForm(req);
  const t = form.get("token") || "";
  if (!t) return json({}, 200, ch);
  const h = await sha256hex(t);
  const sb = serviceClient();
  await sb
    .from("flux_mcp_tokens")
    .update({ revoked_at: new Date().toISOString() })
    .or(`access_sha256.eq.${h},refresh_sha256.eq.${h}`);
  return json({}, 200, ch);
}

// ===========================================================================
// MCP resource server (Streamable HTTP / JSON-RPC 2.0)
// ===========================================================================
async function mcp(req: Request, base: string, ch: Record<string, string>) {
  const session = await authBearer(req);
  if (!session) {
    return new Response(JSON.stringify({ error: "invalid_token" }), {
      status: 401,
      headers: {
        ...ch,
        "Content-Type": "application/json",
        "WWW-Authenticate": `Bearer resource_metadata="${base}/.well-known/oauth-protected-resource"`,
      },
    });
  }

  let payload: unknown;
  try {
    payload = await req.json();
  } catch {
    return json(rpcError(null, RPC.PARSE, "Parse error"), 200, ch);
  }

  const batch = Array.isArray(payload) ? payload : [payload];
  const responses: unknown[] = [];
  for (const msg of batch) {
    const res = await handleRpc(msg, session, base);
    if (res !== null) responses.push(res);
  }

  if (responses.length === 0) return new Response(null, { status: 202, headers: ch });
  const out = Array.isArray(payload) ? responses : responses[0];
  return json(out, 200, ch);
}

interface Session {
  userId: string;
  scope: string;
  rowId: string;
}

async function authBearer(req: Request): Promise<Session | null> {
  const h = req.headers.get("Authorization") || "";
  if (!h.startsWith("Bearer ")) return null;
  const tok = h.slice(7).trim();
  if (!tok) return null;
  const sb = serviceClient();
  const { data: row } = await sb
    .from("flux_mcp_tokens")
    .select("id, user_id, scope, access_expires_at, revoked_at")
    .eq("access_sha256", await sha256hex(tok))
    .maybeSingle();
  if (!row || row.revoked_at) return null;
  if (row.access_expires_at && new Date(row.access_expires_at).getTime() < Date.now()) return null;
  // best-effort last_used_at (don't block the response)
  sb.from("flux_mcp_tokens").update({ last_used_at: new Date().toISOString() }).eq("id", row.id).then(
    () => {},
    () => {},
  );
  return { userId: row.user_id, scope: row.scope || "", rowId: row.id };
}

async function handleRpc(msg: any, session: Session, base: string): Promise<unknown | null> {
  const id: JsonRpcId = msg && typeof msg === "object" && "id" in msg ? msg.id : null;
  const method: string = msg?.method ?? "";
  const isNotification = !(msg && typeof msg === "object" && "id" in msg);

  switch (method) {
    case "initialize": {
      const requested = msg?.params?.protocolVersion;
      return rpcResult(id, {
        protocolVersion: typeof requested === "string" ? requested : "2025-06-18",
        capabilities: { tools: { listChanged: false } },
        serverInfo: SERVER_INFO,
        instructions:
          "Flux Planner: read the student's tasks, calendar, goals, habits and notes, and create/edit/complete tasks. Use list_tasks for what's due; create_task to add work.",
      });
    }
    case "notifications/initialized":
    case "notifications/cancelled":
      return null; // notifications: no response
    case "ping":
      return rpcResult(id, {});
    case "tools/list":
      return rpcResult(id, { tools: toolsFor(session.scope) });
    case "tools/call":
      return await callTool(id, msg?.params, session);
    default:
      if (isNotification) return null;
      return rpcError(id, RPC.METHOD_NOT_FOUND, `Method not found: ${method}`);
  }
}

// ---- Tool catalog ---------------------------------------------------------
function hasScope(scope: string, want: string): boolean {
  return scope.split(/\s+/).filter(Boolean).includes(want);
}

function toolsFor(scope: string) {
  const tools: unknown[] = [];
  if (hasScope(scope, "planner.read")) {
    tools.push(
      {
        name: "get_planner_overview",
        description:
          "High-level snapshot of the student's planner: task counts (total/done/upcoming/overdue), the next few due items, and counts of events, goals, habits and notes.",
        inputSchema: { type: "object", properties: {} },
      },
      {
        name: "list_tasks",
        description:
          "List the student's tasks. Use status to focus: 'upcoming' (not done, due today or later), 'overdue', 'today', 'done', or 'all'.",
        inputSchema: {
          type: "object",
          properties: {
            status: { type: "string", enum: ["upcoming", "overdue", "today", "done", "all"], default: "upcoming" },
            subject: { type: "string", description: "Filter to a subject (case-insensitive)." },
            from: { type: "string", description: "Only tasks due on/after this YYYY-MM-DD." },
            to: { type: "string", description: "Only tasks due on/before this YYYY-MM-DD." },
            limit: { type: "number", default: 50 },
          },
        },
      },
      {
        name: "get_task",
        description: "Get a single task by its id.",
        inputSchema: { type: "object", properties: { id: { type: ["string", "number"] } }, required: ["id"] },
      },
      {
        name: "list_events",
        description: "List the student's calendar events.",
        inputSchema: { type: "object", properties: { limit: { type: "number", default: 50 } } },
      },
      {
        name: "list_goals",
        description: "List the student's goals.",
        inputSchema: { type: "object", properties: {} },
      },
      {
        name: "list_habits",
        description: "List the student's habits.",
        inputSchema: { type: "object", properties: {} },
      },
      {
        name: "list_notes",
        description: "List the student's notes (titles and short snippets; full body trimmed).",
        inputSchema: { type: "object", properties: { limit: { type: "number", default: 30 } } },
      },
    );
  }
  if (hasScope(scope, "tasks.write")) {
    tools.push(
      {
        name: "create_task",
        description: "Create a new task / assignment / to-do for the student.",
        inputSchema: {
          type: "object",
          properties: {
            name: { type: "string", description: "What needs to be done." },
            date: { type: "string", description: "Due date, YYYY-MM-DD." },
            subject: { type: "string" },
            priority: { type: "string", enum: ["low", "med", "high"] },
            type: { type: "string", description: "e.g. homework, exam, project, reading." },
            notes: { type: "string" },
            estTime: { type: "number", description: "Estimated minutes." },
          },
          required: ["name"],
        },
      },
      {
        name: "update_task",
        description: "Update fields on an existing task (only provided fields change).",
        inputSchema: {
          type: "object",
          properties: {
            id: { type: ["string", "number"] },
            name: { type: "string" },
            date: { type: "string" },
            subject: { type: "string" },
            priority: { type: "string", enum: ["low", "med", "high"] },
            type: { type: "string" },
            notes: { type: "string" },
            estTime: { type: "number" },
            done: { type: "boolean" },
          },
          required: ["id"],
        },
      },
      {
        name: "complete_task",
        description: "Mark a task as done.",
        inputSchema: { type: "object", properties: { id: { type: ["string", "number"] } }, required: ["id"] },
      },
      {
        name: "delete_task",
        description: "Delete a task permanently.",
        inputSchema: { type: "object", properties: { id: { type: ["string", "number"] } }, required: ["id"] },
      },
    );
  }
  return tools;
}

// ---- Tool dispatch --------------------------------------------------------
const READ_TOOLS = new Set([
  "get_planner_overview", "list_tasks", "get_task", "list_events", "list_goals", "list_habits", "list_notes",
]);
const WRITE_TOOLS = new Set(["create_task", "update_task", "complete_task", "delete_task"]);

async function callTool(id: JsonRpcId, params: any, session: Session): Promise<unknown> {
  const name: string = params?.name ?? "";
  const args = params?.arguments ?? {};

  if (READ_TOOLS.has(name) && !hasScope(session.scope, "planner.read")) {
    return toolError(id, "This connection lacks the planner.read scope.");
  }
  if (WRITE_TOOLS.has(name) && !hasScope(session.scope, "tasks.write")) {
    return toolError(id, "This connection lacks the tasks.write scope.");
  }

  const sb = serviceClient();
  try {
    switch (name) {
      case "get_planner_overview":
        return toolOk(id, await overview(sb, session.userId));
      case "list_tasks":
        return toolOk(id, await listTasks(sb, session.userId, args));
      case "get_task":
        return toolOk(id, await getTask(sb, session.userId, args));
      case "list_events":
        return toolOk(id, await listKey(sb, session.userId, "events", num(args.limit, 50)));
      case "list_goals":
        return toolOk(id, await listKey(sb, session.userId, "goals", 200));
      case "list_habits":
        return toolOk(id, await listKey(sb, session.userId, "habits", 200));
      case "list_notes":
        return toolOk(id, await listNotes(sb, session.userId, num(args.limit, 30)));
      case "create_task":
        return toolOk(id, await createTask(sb, session.userId, args));
      case "update_task":
        return toolOk(id, await updateTask(sb, session.userId, args));
      case "complete_task":
        return toolOk(id, await updateTask(sb, session.userId, { id: args.id, done: true }));
      case "delete_task":
        return toolOk(id, await deleteTask(sb, session.userId, args));
      default:
        return rpcError(id, RPC.METHOD_NOT_FOUND, `Unknown tool: ${name}`);
    }
  } catch (e) {
    console.error("[mcp] tool", name, e);
    return toolError(id, e instanceof Error && e.message === "write_conflict"
      ? "The planner was being edited at the same time. Please try again."
      : "Tool failed: " + (e instanceof Error ? e.message : String(e)));
  }
}

function toolOk(id: JsonRpcId, data: unknown) {
  return rpcResult(id, {
    content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
    structuredContent: data && typeof data === "object" ? (data as Record<string, unknown>) : { value: data },
  });
}
function toolError(id: JsonRpcId, message: string) {
  return rpcResult(id, { content: [{ type: "text", text: message }], isError: true });
}

// ---- Data layer (blob read/write) ----------------------------------------
async function loadData(sb: ReturnType<typeof serviceClient>, userId: string) {
  const { data, error } = await sb.from("user_data").select("data, updated_at").eq("id", userId).maybeSingle();
  if (error) throw new Error("load_failed");
  return { data: (data?.data ?? {}) as Record<string, any>, updatedAt: data?.updated_at ?? null };
}

function readArray(data: Record<string, any>, key: string): any[] {
  if (!READABLE_KEYS.has(key)) return [];
  const v = data[key];
  return Array.isArray(v) ? v : [];
}

function todayStr(): string {
  return new Date().toISOString().slice(0, 10);
}
function dueStr(t: any): string {
  return t && t.date ? String(t.date).slice(0, 10) : "";
}

async function overview(sb: ReturnType<typeof serviceClient>, userId: string) {
  const { data } = await loadData(sb, userId);
  const tasks = readArray(data, "tasks");
  const today = todayStr();
  const open = tasks.filter((t) => !t.done);
  const overdue = open.filter((t) => dueStr(t) && dueStr(t) < today);
  const upcoming = open
    .filter((t) => dueStr(t) && dueStr(t) >= today)
    .sort((a, b) => dueStr(a).localeCompare(dueStr(b)));
  return {
    tasks: { total: tasks.length, done: tasks.filter((t) => t.done).length, open: open.length, overdue: overdue.length },
    next_due: upcoming.slice(0, 5).map(slimTask),
    overdue: overdue.slice(0, 5).map(slimTask),
    counts: {
      events: readArray(data, "events").length,
      goals: readArray(data, "goals").length,
      habits: readArray(data, "habits").length,
      notes: readArray(data, "notes").length,
    },
    today,
  };
}

function slimTask(t: any) {
  return {
    id: t.id,
    name: t.name ?? t.text ?? "",
    date: t.date ?? null,
    subject: t.subject ?? null,
    priority: t.priority ?? null,
    type: t.type ?? null,
    done: !!t.done,
    notes: t.notes ?? null,
    estTime: t.estTime ?? null,
  };
}

async function listTasks(sb: ReturnType<typeof serviceClient>, userId: string, args: any) {
  const { data } = await loadData(sb, userId);
  let tasks = readArray(data, "tasks");
  const status = String(args.status || "upcoming");
  const today = todayStr();

  if (status === "done") tasks = tasks.filter((t) => t.done);
  else if (status === "upcoming") tasks = tasks.filter((t) => !t.done && dueStr(t) && dueStr(t) >= today);
  else if (status === "overdue") tasks = tasks.filter((t) => !t.done && dueStr(t) && dueStr(t) < today);
  else if (status === "today") tasks = tasks.filter((t) => dueStr(t) === today);
  // 'all' → no status filter

  if (args.subject) {
    const s = String(args.subject).toLowerCase();
    tasks = tasks.filter((t) => String(t.subject ?? "").toLowerCase() === s);
  }
  if (args.from) tasks = tasks.filter((t) => dueStr(t) && dueStr(t) >= String(args.from).slice(0, 10));
  if (args.to) tasks = tasks.filter((t) => dueStr(t) && dueStr(t) <= String(args.to).slice(0, 10));

  tasks.sort((a, b) => {
    const da = dueStr(a), db = dueStr(b);
    if (da && db) return da.localeCompare(db);
    if (da) return -1;
    if (db) return 1;
    return 0;
  });
  const limit = num(args.limit, 50);
  return { count: tasks.length, tasks: tasks.slice(0, limit).map(slimTask) };
}

async function getTask(sb: ReturnType<typeof serviceClient>, userId: string, args: any) {
  const { data } = await loadData(sb, userId);
  const t = readArray(data, "tasks").find((x) => String(x.id) === String(args.id));
  if (!t) throw new Error("Task not found: " + args.id);
  return slimTask(t);
}

async function listKey(sb: ReturnType<typeof serviceClient>, userId: string, key: string, limit: number) {
  const { data } = await loadData(sb, userId);
  const arr = readArray(data, key);
  return { count: arr.length, [key]: arr.slice(0, limit) };
}

async function listNotes(sb: ReturnType<typeof serviceClient>, userId: string, limit: number) {
  const { data } = await loadData(sb, userId);
  const notes = readArray(data, "notes");
  const slim = notes.slice(0, limit).map((n: any) => ({
    id: n.id,
    title: n.title ?? n.name ?? "(untitled)",
    subject: n.subject ?? null,
    updated: n.updated ?? n.updatedAt ?? null,
    snippet: String(n.body ?? n.content ?? n.text ?? "")
      .replace(/<[^>]*>/g, " ")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 280),
  }));
  return { count: notes.length, notes: slim };
}

// ---- Writes (optimistic-concurrency read-modify-write on data.tasks) ------
async function mutateTasks<T>(
  sb: ReturnType<typeof serviceClient>,
  userId: string,
  mutator: (tasks: any[]) => T,
): Promise<T> {
  for (let attempt = 0; attempt < 4; attempt++) {
    const { data, updatedAt } = await loadData(sb, userId);
    const tasks = Array.isArray(data.tasks) ? data.tasks.slice() : [];
    const result = mutator(tasks);
    const nextData = {
      ...data,
      tasks,
      mcpMeta: { rev: ((data.mcpMeta?.rev as number) || 0) + 1, lastWriteAt: new Date().toISOString(), lastWriteBy: "claude" },
    };
    const nowIso = new Date().toISOString();

    if (updatedAt === null) {
      // No row yet → create it. onConflict guards against a racing insert.
      const { error } = await sb
        .from("user_data")
        .upsert({ id: userId, data: nextData, updated_at: nowIso }, { onConflict: "id" });
      if (!error) return result;
    } else {
      const { data: upd, error } = await sb
        .from("user_data")
        .update({ data: nextData, updated_at: nowIso })
        .eq("id", userId)
        .eq("updated_at", updatedAt)
        .select("id");
      if (!error && upd && upd.length) return result;
    }
    // Contended (someone else wrote between read and write) → retry.
  }
  throw new Error("write_conflict");
}

async function createTask(sb: ReturnType<typeof serviceClient>, userId: string, args: any) {
  if (!args || !args.name || !String(args.name).trim()) throw new Error("name is required");
  const task: Record<string, any> = {
    id: Date.now(),
    name: String(args.name).trim(),
    done: false,
    createdAt: new Date().toISOString(),
  };
  for (const k of ["date", "subject", "priority", "type", "notes"]) {
    if (args[k] != null && args[k] !== "") task[k] = String(args[k]);
  }
  if (args.date) task.date = String(args.date).slice(0, 10);
  if (args.estTime != null) task.estTime = Number(args.estTime);

  await mutateTasks(sb, userId, (tasks) => {
    tasks.push(task);
  });
  return { created: true, task: slimTask(task) };
}

async function updateTask(sb: ReturnType<typeof serviceClient>, userId: string, args: any) {
  if (args?.id == null) throw new Error("id is required");
  let updated: any = null;
  await mutateTasks(sb, userId, (tasks) => {
    const i = tasks.findIndex((t) => String(t.id) === String(args.id));
    if (i < 0) throw new Error("Task not found: " + args.id);
    const t = { ...tasks[i] };
    for (const k of ["name", "date", "subject", "priority", "type", "notes"]) {
      if (args[k] != null) t[k] = String(args[k]);
    }
    if (args.date != null) t.date = String(args.date).slice(0, 10);
    if (args.estTime != null) t.estTime = Number(args.estTime);
    if (typeof args.done === "boolean") {
      t.done = args.done;
      if (args.done && !t.completedAt) t.completedAt = new Date().toISOString();
      if (!args.done) delete t.completedAt;
    }
    tasks[i] = t;
    updated = t;
  });
  return { updated: true, task: slimTask(updated) };
}

async function deleteTask(sb: ReturnType<typeof serviceClient>, userId: string, args: any) {
  if (args?.id == null) throw new Error("id is required");
  let removed = false;
  await mutateTasks(sb, userId, (tasks) => {
    const i = tasks.findIndex((t) => String(t.id) === String(args.id));
    if (i < 0) throw new Error("Task not found: " + args.id);
    tasks.splice(i, 1);
    removed = true;
  });
  return { deleted: removed, id: args.id };
}

// ---- helpers --------------------------------------------------------------
function num(v: unknown, dflt: number): number {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : dflt;
}

function normalizeScope(raw: string | null): string {
  const requested = (raw || "").split(/\s+/).filter(Boolean);
  const allowed = requested.filter((s) => SUPPORTED_SCOPES.includes(s));
  return (allowed.length ? allowed : SUPPORTED_SCOPES).join(" ");
}

async function readForm(req: Request): Promise<URLSearchParams> {
  const ct = req.headers.get("content-type") || "";
  if (ct.includes("application/json")) {
    try {
      const o = await req.json();
      const p = new URLSearchParams();
      for (const [k, v] of Object.entries(o || {})) p.set(k, String(v));
      return p;
    } catch {
      return new URLSearchParams();
    }
  }
  const text = await req.text();
  return new URLSearchParams(text);
}

function htmlError(message: string, ch: Record<string, string>) {
  return new Response(
    `<!doctype html><meta charset=utf-8><title>Flux · Connection error</title>
<body style="font:16px system-ui;max-width:34rem;margin:12vh auto;padding:0 1.5rem;color:#0f172a">
<h1 style="font-size:1.25rem">Couldn't start the Claude connection</h1>
<p>${message}</p>
<p style="color:#64748b">Close this tab and try adding the Flux connector again from Claude.</p>`,
    { status: 400, headers: { ...ch, "Content-Type": "text/html; charset=utf-8" } },
  );
}
