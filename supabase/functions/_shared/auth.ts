import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

export interface AuthResult {
  userId: string;
  email: string;
  error?: never;
}
export interface AuthError {
  userId?: never;
  email?: never;
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
    return { error: "Invalid or expired token", status: 401 };
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
