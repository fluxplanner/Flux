# P33.1 — Connect Flux to Claude (MCP)

**Step ID:** `P33-CLAUDE-MCP`
**Flag:** `enable_claude_mcp` (default **off**)
**Migration:** `20260535000000_claude_mcp.sql`
**Edge function:** `supabase/functions/mcp/`

Lets any Flux user connect their account to **Claude** (claude.ai, Claude Desktop, Claude Code)
so Claude can **read their planner and create/edit/complete tasks** — the Notion-connector
experience. One-click OAuth; no token pasting.

## Architecture
One Deno Edge Function (`mcp`) is **both** an OAuth 2.1 Authorization Server **and** an MCP
resource server (Streamable HTTP). It mints its own opaque, hashed, revocable tokens but reuses
**Supabase Auth** for the actual login via a same-origin consent page.

```
Claude ──(add server URL)──▶ /.well-known/oauth-protected-resource + /oauth-authorization-server
       ──/register (DCR)──▶ client_id
       ──/authorize──▶ 302 → connect-claude.html (Flux login + consent)
                                   └─ POST /authorize/grant (Supabase JWT) → single-use code
       ──/token (PKCE S256)──▶ access + refresh tokens
       ──MCP JSON-RPC (Bearer)──▶ initialize / tools/list / tools/call
```

Public base is pinned by the `MCP_PUBLIC_URL` secret
(`https://lfigdijuqmbensebnevo.supabase.co/functions/v1/mcp`); consent page via `MCP_CONSENT_URL`.
Deployed with **`--no-verify-jwt`** (auth is enforced in-code; Claude's calls carry our tokens,
not a Supabase JWT).

## Scopes
| Scope | Grants |
|-------|--------|
| `planner.read` | Read tasks, events, goals, habits, notes (allowlisted) |
| `tasks.write`  | Create / update / complete / delete tasks |

## Tools
- **Read:** `get_planner_overview`, `list_tasks` (status: upcoming/overdue/today/done/all + subject/date filters), `get_task`, `list_events`, `list_goals`, `list_habits`, `list_notes`
- **Write (tasks):** `create_task`, `update_task`, `complete_task`, `delete_task`

## Data + privacy
Tasks live in `public.user_data.data.tasks` (the per-user JSON blob), not the legacy `tasks`
table. Reads are **default-deny against an allowlist** (`READABLE_KEYS` in `index.ts`):
`tasks, events, goals, habits, notes, classes, colleges, grades, smartLists, recurringSeries,
weeklyEvents, examPrepPlan`. Everything else — **`integrations` (Canvas/Google tokens),
`devAccounts`, `platformConfig`, `ownerAuditLog`, `feedbackInbox`, settings, profile** — is
structurally unreachable.

Task writes use optimistic-concurrency read-modify-write (`updated_at` guard + retry) and bump
`data.mcpMeta.rev`. The browser's `syncToCloud()` (app.js) folds in remote-only tasks when
`mcpMeta.rev` advances, so Claude-created tasks aren't clobbered by last-write-wins sync.

## Tables (all RLS-enabled)
- `flux_mcp_tokens` — access/refresh **SHA-256 hashes only**; user can SELECT/UPDATE/DELETE own rows (Settings → disconnect).
- `flux_mcp_oauth_clients`, `flux_mcp_auth_codes` — **service-role only** (RLS on, no policies = default-deny; shows as INFO `rls_enabled_no_policy`, which is intended).

> **Consent page must be statically hosted.** Supabase forces `text/plain` + a sandbox CSP on
> HTML returned from `*.supabase.co/functions`, so the OAuth approval UI (which runs JS) cannot be
> served by the function — it lives on GitHub Pages as `connect-claude.html`, and `/authorize`
> 302-redirects to it (`MCP_CONSENT_URL`, default `https://fluxplanner.github.io/Flux/connect-claude.html`).

## Enable / connect
1. **One-time hosting:** merge branch `feat/claude-mcp-consent`, enable GitHub Pages
   (Settings → Pages → Deploy from a branch → `main` → `/root`), and in Supabase → Auth → URL
   Configuration → **Redirect URLs** add `https://fluxplanner.github.io/Flux/**` (so consent-page sign-in can return).
2. Turn on the flag (per-user or globally) — see Dev enable.
3. In **claude.ai**: Settings → Connectors → *Add custom connector* → paste
   `https://lfigdijuqmbensebnevo.supabase.co/functions/v1/mcp` → **Connect** → approve on the Flux page.
   In **Claude Code**: `claude mcp add --transport http flux https://lfigdijuqmbensebnevo.supabase.co/functions/v1/mcp` then `/mcp` to auth.

## Dev enable
```javascript
window.FLUX_EXPERIMENTS = { enable_claude_mcp: true };
await FluxFeatureFlags.load({ force: true });
location.reload(); // Settings → Data → "Connect to Claude" card appears
```

## Rollback
Disable the flag — the Settings card hides and the browser stops the extra sync read. The function
can stay deployed (inert without connections). To hard-revoke everything:
`update public.flux_mcp_tokens set revoked_at = now();`

## Files
- `supabase/migrations/20260535000000_claude_mcp.sql`
- `supabase/functions/mcp/index.ts`, `supabase/functions/_shared/mcp.ts`
- `connect-claude.html`, `public/js/connect-claude.js`
- `public/js/flux-claude-connect.js`, `public/css/flux-claude-connect.css`
- `public/js/app.js` (API.mcp, settings-render hook, mcpMeta sync merge)
