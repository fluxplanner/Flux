// Shared helpers for the Flux MCP connector (OAuth 2.1 AS + MCP resource server).
// Deno / Web Crypto only — no external deps beyond what _shared/auth.ts already uses.

const encoder = new TextEncoder();

/** base64url (no padding) from raw bytes. */
export function b64url(bytes: Uint8Array): string {
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/** SHA-256 → base64url. Used for PKCE challenge derivation. */
export async function sha256b64url(input: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", encoder.encode(input));
  return b64url(new Uint8Array(digest));
}

/** SHA-256 → lowercase hex. Used to hash tokens/codes before storage. */
export async function sha256hex(input: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", encoder.encode(input));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/** Cryptographically-random opaque token, base64url. */
export function randomToken(bytes = 32): string {
  const buf = new Uint8Array(bytes);
  crypto.getRandomValues(buf);
  return b64url(buf);
}

/** Verify a PKCE S256 challenge against the presented verifier. */
export async function verifyPkceS256(verifier: string, challenge: string): Promise<boolean> {
  if (!verifier || !challenge) return false;
  const derived = await sha256b64url(verifier);
  // constant-time-ish compare
  if (derived.length !== challenge.length) return false;
  let diff = 0;
  for (let i = 0; i < derived.length; i++) diff |= derived.charCodeAt(i) ^ challenge.charCodeAt(i);
  return diff === 0;
}

// ---- JSON-RPC 2.0 (MCP transport) ----------------------------------------

export type JsonRpcId = string | number | null;

export function rpcResult(id: JsonRpcId, result: unknown) {
  return { jsonrpc: "2.0", id, result };
}

export function rpcError(id: JsonRpcId, code: number, message: string, data?: unknown) {
  const err: Record<string, unknown> = { code, message };
  if (data !== undefined) err.data = data;
  return { jsonrpc: "2.0", id, error: err };
}

// MCP / JSON-RPC error codes
export const RPC = {
  PARSE: -32700,
  INVALID_REQUEST: -32600,
  METHOD_NOT_FOUND: -32601,
  INVALID_PARAMS: -32602,
  INTERNAL: -32603,
} as const;

export function json(body: unknown, status: number, headers: HeadersInit = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...headers },
  });
}

/** OAuth error response per RFC 6749 §5.2. */
export function oauthError(error: string, description: string, status = 400, headers: HeadersInit = {}) {
  return json({ error, error_description: description }, status, headers);
}
