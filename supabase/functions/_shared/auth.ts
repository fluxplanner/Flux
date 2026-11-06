import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// Clean discriminated union: `"error" in auth` is a real discriminant, so the
// shared `if ("error" in auth && auth.error)` guard narrows `auth` to AuthResult
// (userId: string) in the success path across every function.
const OWNER_UID = (Deno.env.get("FLUX_OWNER_UID") ||
  "eabe2b1f-e428-4181-8530-8e5366eb3975").trim();

export interface AuthResult {
  userId: string;
  email: string;
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
  return { userId: user.id, email: user.email ?? "" };
}

export function serviceClient() {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );
}

const DEFAULT_ORIGIN = "https://fluxplanner.github.io";
const ALLOWED_ORIGINS = new Set([
  DEFAULT_ORIGIN,
  "https://azfermohammed.github.io",
  "https://claude.ai",
  "https://claude.com",
  ...(Deno.env.get("FLUX_ALLOWED_ORIGINS") || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean),
]);

/**
 * Echo the Origin only for Flux's own sites, local development and the browser
 * extension. Any other site gets the default, so a browser refuses to hand it the
 * response. Add a preview or custom domain with the FLUX_ALLOWED_ORIGINS secret.
 */
function resolveCorsOrigin(origin: string): string {
  const trimmed = (origin || "").trim();
  if (ALLOWED_ORIGINS.has(trimmed)) return trimmed;
  // Extension pages: do not rely on URL() — some runtimes mishandle chrome-extension://
  if (
    trimmed.startsWith("chrome-extension://") ||
    trimmed.startsWith("moz-extension://")
  ) {
    return trimmed;
  }
  try {
    const u = new URL(trimmed);
    const local = u.hostname === "localhost" || u.hostname === "127.0.0.1" ||
      u.hostname.endsWith(".localhost");
    if (local && (u.protocol === "http:" || u.protocol === "https:")) return trimmed;
  } catch {
    /* ignore */
  }
  return DEFAULT_ORIGIN;
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
