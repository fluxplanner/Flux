import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// Clean discriminated union: `"error" in auth` is a real discriminant, so the
// shared `if ("error" in auth && auth.error)` guard narrows `auth` to AuthResult
// (userId: string) in the success path across every function.
const OWNER_UID = (Deno.env.get("FLUX_OWNER_UID") ||
  "eabe2b1f-e428-4181-8530-8e5366eb3975").trim();

export interface AuthResult {
  userId: string;
  email: string;
  /** "aal2" once this session has entered an authenticator code. */
  aal: string;
  /** Seconds since the session last entered a code; null if it never did. */
  mfaAgeSeconds: number | null;
  /** The account has a verified authenticator. */
  hasMfa: boolean;
}

/** Reads aal and amr from a token getUser has already accepted as genuine. */
function sessionAssurance(token: string) {
  try {
    const part = token.split(".")[1] ?? "";
    const b64 = part.replace(/-/g, "+").replace(/_/g, "/");
    const claims = JSON.parse(atob(b64.padEnd(b64.length + (4 - b64.length % 4) % 4, "=")));
    const amr = Array.isArray(claims.amr) ? claims.amr : [];
    const totp = amr
      .filter((a: { method?: string; timestamp?: number }) => a?.method === "totp" && Number.isFinite(a.timestamp))
      .map((a: { timestamp: number }) => a.timestamp);
    const latest = totp.length ? Math.max(...totp) : null;
    return {
      aal: String(claims.aal || "aal1"),
      mfaAgeSeconds: latest === null ? null : Math.floor(Date.now() / 1000) - latest,
    };
  } catch {
    return { aal: "aal1", mfaAgeSeconds: null };
  }
}

/**
 * Owner powers need a code entered within maxAgeSeconds once the owner has an
 * authenticator. Same rule as flux_is_platform_admin() in the database.
 */
export function hasRecentMfa(auth: AuthResult, maxAgeSeconds: number) {
  return auth.aal === "aal2" && auth.mfaAgeSeconds !== null &&
    auth.mfaAgeSeconds <= maxAgeSeconds;
}
export interface AuthError {
  error: string;
  status: number;
}

export async function verifyUserJWT(
  req: Request,
): Promise<AuthResult | AuthError> {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return { error: "Missing Authorization header", status: 401 };
  }
  const token = authHeader.replace("Bearer ", "");

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
  );

  const { data: { user }, error } = await supabase.auth.getUser(token);
  if (error || !user) {
    const msg = error?.message?.trim();
    return {
      error: msg || "Invalid or expired token",
      status: 401,
    };
  }

  // Only PostgREST runs flux_check_request, so functions check bans themselves.
  // cf-connecting-ip is set by Cloudflare; a client sending its own is refused.
  const ip = (req.headers.get("cf-connecting-ip") ?? "").trim();
  const values = ip ? `(${user.id},"${ip}")` : `(${user.id})`;
  const { data: bans } = await serviceClient()
    .from("flux_bans")
    .select("id")
    .eq("active", true)
    .in("kind", ["user", "ip"])
    .filter("value", "in", values)
    .limit(1);
  if (bans?.length && user.id !== OWNER_UID) {
    return { error: "flux_banned", status: 403 };
  }
  const hasMfa = (user.factors ?? []).some((f) => f.status === "verified");
  return { userId: user.id, email: user.email ?? "", hasMfa, ...sessionAssurance(token) };
}

export function serviceClient(headers?: Record<string, string>) {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    {
      auth: { autoRefreshToken: false, persistSession: false },
      ...(headers ? { global: { headers } } : {}),
    },
  );
}

/**
 * A service client whose writes flux_admin_action_log credits to the signed-in
 * caller. The database believes these headers only from the service role.
 */
export function serviceClientActingFor(req: Request, userId: string) {
  return serviceClient({
    "x-flux-actor": userId,
    "x-flux-ip": (req.headers.get("cf-connecting-ip") ?? "").trim().slice(0, 100),
    "x-flux-ua": (req.headers.get("user-agent") ?? "").slice(0, 400),
  });
}

/**
 * Echo a safe Origin for Access-Control-Allow-Origin.
 * Browsers require an exact match with the page origin; a fixed fallback breaks
 * GitHub Pages project URLs, custom domains, previews, etc.
 * The anon key is already public in static bundles — broad http(s) echo is acceptable here.
 */
function resolveCorsOrigin(origin: string): string {
  const trimmed = (origin || "").trim();
  if (!trimmed) return "https://azfermohammed.github.io";
  // Opaque / file origins — some browsers send the literal string "null"
  if (trimmed === "null") return "null";
  // Extension pages: do not rely on URL() — some runtimes mishandle chrome-extension://
  if (
    trimmed.startsWith("chrome-extension://") ||
    trimmed.startsWith("moz-extension://")
  ) {
    return trimmed;
  }
  try {
    const u = new URL(trimmed);
    if (u.protocol !== "http:" && u.protocol !== "https:") {
      return "https://azfermohammed.github.io";
    }
    const host = u.hostname;
    if (
      host === "localhost" ||
      host === "127.0.0.1" ||
      host.endsWith(".localhost") ||
      host.includes(".")
    ) {
      return trimmed;
    }
  } catch {
    /* ignore */
  }
  return "https://azfermohammed.github.io";
}

export function corsHeaders(origin: string) {
  const o = resolveCorsOrigin(origin);
  const h: Record<string, string> = {
    "Access-Control-Allow-Origin": o,
    "Access-Control-Allow-Headers":
      "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
    "Vary": "Origin",
  };
  return h;
}

export function json(data: unknown, status = 200, origin = "") {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json",
      ...corsHeaders(origin),
    },
  });
}
