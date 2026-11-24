// Carries the Lichess connection across devices through the person's Flux
// account. The page is on the same origin as the planner, so it reuses the
// planner's saved Flux session (window.FluxSB.sessionKey) — no second sign-in.
// Table: public.flux_chess_lichess, one owner-only row per account.
//
// detectSessionInUrl is off: the Lichess OAuth redirect lands here with
// ?code=…, which Supabase would otherwise try to swap for a Flux session.

let client = null;
function sb() {
  if (client) return client;
  const cfg = window.FluxSB;
  if (!cfg || !window.supabase?.createClient) return null;
  client = window.supabase.createClient(cfg.url, cfg.anon, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false, storageKey: cfg.sessionKey },
  });
  return client;
}

// The signed-in Flux user, or null.
export async function user() {
  const c = sb();
  if (!c) return null;
  const { data } = await c.auth.getSession();
  return data?.session?.user || null;
}

// { lichess_token, lichess_username } or null when nothing is saved. Throws on
// network/database errors so callers can tell "none" from "couldn't check".
export async function pull() {
  const { data, error } = await sb().from('flux_chess_lichess').select('lichess_token, lichess_username').maybeSingle();
  if (error) throw error;
  return data;
}

export async function push(token, username) {
  const u = await user();
  if (!u) return;
  const { error } = await sb().from('flux_chess_lichess').upsert({
    user_id: u.id,
    lichess_token: token,
    lichess_username: /^[A-Za-z0-9_-]{2,30}$/.test(username || '') ? username : null,
  });
  if (error) throw error;
}

// Removes the saved connection. With a token, only if it is still that one,
// so a device holding a dead key can't wipe a fresh connection made elsewhere.
export async function drop(token) {
  const u = await user();
  if (!u) return;
  let q = sb().from('flux_chess_lichess').delete().eq('user_id', u.id);
  if (token) q = q.eq('lichess_token', token);
  const { error } = await q;
  if (error) throw error;
}
