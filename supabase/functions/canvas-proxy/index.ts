import { verifyUserJWT, corsHeaders } from "../_shared/auth.ts";

const MAX_BODY_BYTES = 5 * 1024 * 1024;
const FETCH_TIMEOUT_MS = 15_000;

type LegacyJsonBody = {
  url?: string;
  token?: string;
  method?: string;
  body?: string;
  contentType?: string;
};

type StructuredBody = {
  host?: string;
  path?: string;
  method?: string;
  canvasToken?: string;
};

function resolveOrigin(req: Request): string {
  return req.headers.get("origin") ?? "";
}

function isAllowedCanvasHost(host: string): boolean {
  const h = host.trim().toLowerCase();
  if (!h || h.includes("..") || h.includes("/")) return false;
  const extra = (Deno.env.get("CANVAS_ALLOWED_HOSTS") || "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  if (extra.includes(h)) return true;
  if (h.endsWith(".instructure.com") || h === "instructure.com") return true;
  if (h.endsWith(".canvaslms.com") || h === "canvaslms.com") return true;
  return false;
}

function normalizeHost(raw: string): string | null {
  const s = String(raw || "").trim();
  if (!s) return null;
  try {
    const u = s.includes("://") ? new URL(s) : new URL("https://" + s);
    return u.hostname.toLowerCase() || null;
  } catch {
    return null;
  }
}

function isApiV1Path(pathWithQuery: string): boolean {
  const p = pathWithQuery.split("?")[0] || "";
  return p.startsWith("/api/v1/");
}

function jsonErr(
  msg: string,
  status: number,
  origin: string,
): Response {
  return new Response(JSON.stringify({ error: msg }), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders(origin) },
  });
}

Deno.serve(async (req) => {
  const origin = resolveOrigin(req);
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders(origin) });
  }

  const auth = await verifyUserJWT(req);
  if ("error" in auth && auth.error) {
    return jsonErr(auth.error, auth.status, origin);
  }
  const userId = auth.userId;

  let targetUrl: string | null = null;
  let canvasToken: string | null = null;
  let method = "GET";
  let forwardBody: string | undefined;
  let forwardContentType: string | undefined;

  try {
    if (req.method === "POST") {
      const ct = req.headers.get("content-type") || "";
      if (!ct.includes("application/json")) {
        return jsonErr("POST requires application/json body", 400, origin);
      }
      const raw = (await req.json()) as LegacyJsonBody & StructuredBody;

      if (raw.host && raw.path && raw.canvasToken) {
        const host = normalizeHost(raw.host);
        if (!host || !isAllowedCanvasHost(host)) {
          return jsonErr("Host not allowed", 403, origin);
        }
        const fullPath = raw.path.startsWith("/") ? raw.path : "/" + raw.path;
        if (!isApiV1Path(fullPath)) {
          return jsonErr("Path must start with /api/v1/", 403, origin);
        }
        targetUrl = new URL(fullPath, "https://" + host).toString();
        canvasToken = String(raw.canvasToken);
        const m = (raw.method || "GET").toUpperCase();
        if (m !== "GET" && m !== "POST") {
          return jsonErr("Method must be GET or POST", 403, origin);
        }
        method = m;
      } else if (raw.url && raw.token) {
        let u: URL;
        try {
          u = new URL(String(raw.url));
        } catch {
          return jsonErr("Invalid url", 400, origin);
        }
        const host = u.hostname.toLowerCase();
        if (!isAllowedCanvasHost(host)) {
          return jsonErr("Host not allowed", 403, origin);
        }
        if (!isApiV1Path(u.pathname + u.search)) {
          return jsonErr("Path must start with /api/v1/", 403, origin);
        }
        targetUrl = String(raw.url);
        canvasToken = String(raw.token);
        const m = (raw.method || "GET").toUpperCase();
        if (m !== "GET" && m !== "POST") {
          return jsonErr("Method must be GET or POST", 403, origin);
        }
        method = m;
        forwardBody = raw.body;
        forwardContentType = raw.contentType;
      } else {
        return jsonErr("Missing host/path/canvasToken or legacy url/token", 400, origin);
      }
    } else if (req.method === "GET") {
      const url = new URL(req.url);
      const legacyUrl = url.searchParams.get("url");
      const legacyToken = url.searchParams.get("token");
      if (!legacyUrl || !legacyToken) {
        return jsonErr("Missing url or token", 400, origin);
      }
      let u: URL;
      try {
        u = new URL(legacyUrl);
      } catch {
        return jsonErr("Invalid url", 400, origin);
      }
      if (!isAllowedCanvasHost(u.hostname.toLowerCase())) {
        return jsonErr("Host not allowed", 403, origin);
      }
      if (!isApiV1Path(u.pathname + u.search)) {
        return jsonErr("Path must start with /api/v1/", 403, origin);
      }
      targetUrl = legacyUrl;
      canvasToken = legacyToken;
      method = (url.searchParams.get("method") || "GET").toUpperCase();
      if (method !== "GET" && method !== "POST") {
        return jsonErr("Method must be GET or POST", 403, origin);
      }
    } else {
      return jsonErr("Method not allowed", 405, origin);
    }

    if (!targetUrl || !canvasToken) {
      return jsonErr("Invalid request", 400, origin);
    }

    const headers: Record<string, string> = {
      Authorization: `Bearer ${canvasToken}`,
    };
    if (forwardBody != null && method !== "GET" && method !== "HEAD") {
      headers["Content-Type"] = forwardContentType || "application/x-www-form-urlencoded";
    }

    const controller = new AbortController();
    const tid = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

    const init: RequestInit = { method, headers, signal: controller.signal };
    if (forwardBody != null && method !== "GET" && method !== "HEAD") {
      init.body = forwardBody;
    }

    let res: Response;
    try {
      res = await fetch(targetUrl, init);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      if (msg.includes("abort")) {
        return jsonErr("Canvas request timed out", 504, origin);
      }
      return jsonErr("Network error reaching Canvas", 502, origin);
    } finally {
      clearTimeout(tid);
    }

    const buf = new Uint8Array(await res.arrayBuffer());
    if (buf.byteLength > MAX_BODY_BYTES) {
      return jsonErr("Canvas response too large", 413, origin);
    }

    const u = new URL(targetUrl);
    const logPath = u.pathname + u.search;
    console.log(
      JSON.stringify({
        t: new Date().toISOString(),
        userId,
        host: u.hostname,
        path: logPath.slice(0, 500),
        status: res.status,
      }),
    );

    const outCt = res.headers.get("content-type") || "application/json; charset=utf-8";
    return new Response(buf, {
      status: res.status,
      headers: { ...corsHeaders(origin), "Content-Type": outCt },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return jsonErr(msg, 500, origin);
  }
});
