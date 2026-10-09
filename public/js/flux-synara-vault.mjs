/* ============================================================================
   FLUX SYNARA VAULT  ·  flux-synara-vault.mjs
   The one piece of Flux that Synara's sync talks to (Synara: js/sync.js).
   Bundled by scripts/build-web-bundles.mjs into
   public/bundles/flux-synara-vault.<hash>.js and loaded only by synara.html.

   It uses the planner's own sign-in: the same Supabase project and the
   default session storage key the planner uses (app.js getSB), so a student
   signed in to Flux is signed in here, and supabase-js keeps token refreshes
   consistent across tabs. It never sees readable health data — Synara
   encrypts the record before calling put() and decrypts after get().

     window.FluxSynaraVault = {
       account() → { id, email } | null
       get()     → { ciphertext, iv, version, updated_at } | null
       put({ ciphertext, iv }) → { updated_at }
       remove()  → true
     }

   Errors carry .code: 'signed-out' | 'not-ready' (the synara_vaults table is
   not in this project yet) | 'offline' | 'failed'.
   ========================================================================== */
import { createClient } from '@supabase/supabase-js';

const SB_URL = 'https://lfigdijuqmbensebnevo.supabase.co';
const SB_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxmaWdkaWp1cW1iZW5zZWJuZXZvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMzNjEzMDgsImV4cCI6MjA4ODkzNzMwOH0.qG1d9DLKrs0qqLgAp-6UGdaU7xWvlg2sWq-oD-y2kVo';
const TABLE = 'synara_vaults';

/* Tests (and any future host) may provide their own vault first. */
if (!window.FluxSynaraVault) {
  let sb = null;
  const client = () => sb || (sb = createClient(SB_URL, SB_ANON, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false },
  }));

  const fail = (code, cause) => Object.assign(new Error(code), { code, cause });

  /* By code, not by message: "permission denied for table synara_vaults"
     names the table too, and is a sign-in problem, not a missing table. */
  function wrap(error) {
    const msg = String((error && (error.message || error.details)) || '');
    const code = error && error.code;
    if (code === 'PGRST205' || code === '42P01') return fail('not-ready', error);
    if (code === '42501' || /^PGRST30\d$/.test(code || '') || /JWT/i.test(msg)) return fail('signed-out', error);
    if (/fetch|network|Load failed/i.test(msg)) return fail('offline', error);
    return fail('failed', error);
  }

  async function account() {
    try {
      const { data } = await client().auth.getSession();
      const s = data && data.session;
      return s && s.user ? { id: s.user.id, email: s.user.email || '' } : null;
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
    const { data, error } = await client().from(TABLE).select('ciphertext, iv, version, updated_at').maybeSingle();
    if (error) throw wrap(error);
    return data || null;
  }

  async function put({ ciphertext, iv }) {
    const who = await need();
    const { data, error } = await client()
      .from(TABLE)
      .upsert({ user_id: who.id, ciphertext, iv, version: 1 })
      .select('updated_at')
      .single();
    if (error) throw wrap(error);
    return data;
  }

  async function remove() {
    const who = await need();
    const { error } = await client().from(TABLE).delete().eq('user_id', who.id);
    if (error) throw wrap(error);
    return true;
  }

  window.FluxSynaraVault = { account, get, put, remove };
}
