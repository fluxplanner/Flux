-- P33.1 Claude MCP connector — OAuth 2.1 Authorization Server + MCP resource server.
-- Flux mints its own opaque, hashed, revocable MCP tokens but reuses Supabase Auth
-- for the actual login (consent page). Tasks are writable; planner data is readable
-- (curated allowlist enforced in the Edge Function, never here).

INSERT INTO public.flux_feature_flags (key, description, default_enabled, category) VALUES
  (
    'enable_claude_mcp',
    'Connect Flux to Claude (MCP) — Claude can read planner data and create/edit tasks',
    false,
    'student'
  )
ON CONFLICT (key) DO UPDATE SET
  description = EXCLUDED.description,
  category = EXCLUDED.category;

-- ---------------------------------------------------------------------------
-- Dynamically-registered OAuth clients (Claude registers itself, RFC 7591).
-- Public clients (PKCE, no secret). Touched only by the Edge Function service role.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.flux_mcp_oauth_clients (
  client_id text PRIMARY KEY,
  client_name text,
  redirect_uris text[] NOT NULL DEFAULT '{}',
  token_endpoint_auth_method text NOT NULL DEFAULT 'none',
  grant_types text[] NOT NULL DEFAULT '{authorization_code,refresh_token}',
  created_at timestamptz NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------------
-- Short-lived, single-use authorization codes (PKCE-bound). Service role only.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.flux_mcp_auth_codes (
  code_sha256 text PRIMARY KEY,
  client_id text NOT NULL,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  redirect_uri text NOT NULL,
  code_challenge text NOT NULL,
  code_challenge_method text NOT NULL DEFAULT 'S256',
  scope text NOT NULL DEFAULT '',
  expires_at timestamptz NOT NULL,
  used boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS flux_mcp_auth_codes_expiry_idx ON public.flux_mcp_auth_codes (expires_at);

-- ---------------------------------------------------------------------------
-- Access + refresh tokens. Opaque tokens are NEVER stored — only SHA-256 hashes.
-- A user can see/revoke their own connections from app settings (RLS below).
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.flux_mcp_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  client_id text NOT NULL,
  client_name text,
  scope text NOT NULL DEFAULT '',
  access_sha256 text UNIQUE,
  refresh_sha256 text UNIQUE,
  access_expires_at timestamptz,
  refresh_expires_at timestamptz,
  last_used_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS flux_mcp_tokens_access_idx  ON public.flux_mcp_tokens (access_sha256);
CREATE INDEX IF NOT EXISTS flux_mcp_tokens_refresh_idx ON public.flux_mcp_tokens (refresh_sha256);
CREATE INDEX IF NOT EXISTS flux_mcp_tokens_user_idx    ON public.flux_mcp_tokens (user_id);

ALTER TABLE public.flux_mcp_oauth_clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.flux_mcp_auth_codes    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.flux_mcp_tokens        ENABLE ROW LEVEL SECURITY;

-- clients + codes: no policies at all → only the service-role Edge Function can read/write.

-- tokens: owner may list and revoke their own Claude connections from Settings.
DROP POLICY IF EXISTS flux_mcp_tokens_own_select ON public.flux_mcp_tokens;
CREATE POLICY flux_mcp_tokens_own_select ON public.flux_mcp_tokens
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS flux_mcp_tokens_own_update ON public.flux_mcp_tokens;
CREATE POLICY flux_mcp_tokens_own_update ON public.flux_mcp_tokens
  FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS flux_mcp_tokens_own_delete ON public.flux_mcp_tokens;
CREATE POLICY flux_mcp_tokens_own_delete ON public.flux_mcp_tokens
  FOR DELETE USING (auth.uid() = user_id);

COMMENT ON TABLE public.flux_mcp_tokens IS
  'Claude MCP OAuth access/refresh tokens (SHA-256 hashes only). Minted + validated by the mcp Edge Function service role; users may revoke their own rows.';
COMMENT ON TABLE public.flux_mcp_oauth_clients IS
  'Dynamically-registered MCP OAuth clients (RFC 7591). Service-role only.';
COMMENT ON TABLE public.flux_mcp_auth_codes IS
  'Single-use PKCE authorization codes for the MCP OAuth flow. Service-role only.';
