/* ============================================================================
   FLUX AORTA VAULT  ·  flux-aorta-vault.mjs
   The Aorta Project's blood pressure tracker (aorta-tracker.html) saves to a
   Flux account through this. Bundled by scripts/build-web-bundles.mjs into
   public/bundles/flux-aorta_vault.<hash>.js and loaded only by that page.

   Same pattern as flux-synara-vault.mjs: the planner's Supabase project and
   default session storage key, so someone signed in to Flux is signed in
   here too. Signing in happens on the planner's own login (index.html),
   which sends them back (app.js, flux_return_to = "aorta-tracker.html").
   This file never starts a sign-in itself, and never OAuth (see getSB's
   Google block in app.js).

     window.FluxAortaVault = {
       account() → { id, name } | null
       get()     → { data, updated_at } | null
       put(data) → { updated_at }
       signOut() → true
     }

   One row per account in public.aorta_bp_records (data = the tracker's
   { v, people, gone } record, jsonb). Row-level security keeps each row to
   its owner. It is NOT end-to-end encrypted: anyone with database access
   could read it.

   Errors carry .code: 'signed-out' | 'not-ready' (table missing) |
   'offline' | 'failed'.
   ========================================================================== */
import { createClient } from '@supabase/supabase-js';

const SB_URL = 'https://lfigdijuqmbensebnevo.supabase.co';
const SB_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxmaWdkaWp1cW1iZW5zZWJuZXZvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMzNjEzMDgsImV4cCI6MjA4ODkzNzMwOH0.qG1d9DLKrs0qqLgAp-6UGdaU7xWvlg2sWq-oD-y2kVo';
const TABLE = 'aorta_bp_records';
const USER_DOMAIN = '@users.fluxplanner.app'; // app.js FLUX_USER_DOMAIN

/* Tests may provide their own vault first. */
if (!window.FluxAortaVault) {
  let sb = null;
  const client = () => sb || (sb = createClient(SB_URL, SB_ANON, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false },
  }));

  const fail = (code, cause) => Object.assign(new Error(code), { code, cause });

  function wrap(error) {
    const msg = String((error && (error.message || error.details)) || '');
    const code = error && error.code;
    if (code === 'PGRST205' || code === '42P01') return fail('not-ready', error);
    if (code === '42501' || /^PGRST30\d$/.test(code || '') || /JWT/i.test(msg)) return fail('signed-out', error);
    if (/fetch|network|Load failed/i.test(msg)) return fail('offline', error);
    return fail('failed', error);
  }

  /* Username accounts have a made-up address; show the username. */
  function nameOf(user) {
    const meta = user.user_metadata || {};
    const email = String(user.email || '');
    return meta.username || (email.endsWith(USER_DOMAIN) ? email.slice(0, -USER_DOMAIN.length) : email) || 'your account';
  }

  async function account() {
    try {
      const { data } = await client().auth.getSession();
      const s = data && data.session;
      return s && s.user ? { id: s.user.id, name: nameOf(s.user) } : null;
    } catch (e) {
      throw wrap(e);
    }
  }

  async function need() {
    const who = await account();
    if (!who) throw fail('signed-out');
    return who;
  }

  async function get() {
    await need();
    const { data, error } = await client().from(TABLE).select('data, updated_at').maybeSingle();
    if (error) throw wrap(error);
    return data || null;
  }

  async function put(data) {
    const who = await need();
    const { data: row, error } = await client()
      .from(TABLE)
      .upsert({ user_id: who.id, data })
      .select('updated_at')
      .single();
    if (error) throw wrap(error);
    return row;
  }

  async function signOut() {
    const { error } = await client().auth.signOut({ scope: 'local' });
    if (error) throw wrap(error);
    return true;
  }

  window.FluxAortaVault = { account, get, put, signOut };
  window.dispatchEvent(new Event('flux-aorta-vault'));
}
