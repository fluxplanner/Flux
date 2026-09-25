/* ============================================================================
   FLUX GRAPHER · CLOUD  ·  flux-grapher-cloud.js
   Optional sign-in, and saving graphs to a Flux account.

   The grapher never needs an account. This file only wakes up when someone
   presses Save or opens their saved graphs, and even then it asks for
   nothing it does not need: a Flux name and password.

   WHICH SESSION
   -------------
     In the planner   the planner's own supabase client (window.getSB) — you
                      are already signed in, so saving is one click.
     On grapher.html  no supabase library at all (the page loads no bundles).
                      Sign-in is a plain POST to the auth endpoint, and the
                      session is kept under the grapher's own key. A planner
                      session in the same browser is borrowed read-only while
                      its token is still fresh, but never refreshed from here:
                      refreshing rotates the token, and the planner would be
                      left holding a dead one.

   Rows live in public.flux_graphs, owner-only by RLS (verified with negative
   tests — another account can neither read nor write them).
   ========================================================================== */
(function () {
  'use strict';

  const SB_URL = 'https://lfigdijuqmbensebnevo.supabase.co';
  const SB_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxmaWdkaWp1cW1iZW5zZWJuZXZvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMzNjEzMDgsImV4cCI6MjA4ODkzNzMwOH0.qG1d9DLKrs0qqLgAp-6UGdaU7xWvlg2sWq-oD-y2kVo';
  const OWN_KEY = 'flux_grapher_session';
  const PLANNER_KEY = 'sb-lfigdijuqmbensebnevo-auth-token';
  const OPTED_OUT_KEY = 'flux_grapher_signed_out';
  const USER_DOMAIN = 'users.fluxplanner.app';
  const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

  function G() { return window.FluxGrapher || {}; }
  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }
  function toast(m, k) { if (G().toast) G().toast(m, k); }

  function read(key) {
    try { const r = localStorage.getItem(key); return r ? JSON.parse(r) : null; } catch (e) { return null; }
  }
  function write(key, v) {
    try { if (v == null) localStorage.removeItem(key); else localStorage.setItem(key, JSON.stringify(v)); } catch (e) {}
  }

  /** The same folding the planner does, so "Azfer Mohammed" signs in as azfer.mohammed. */
  function normalizeUsername(raw) {
    return String(raw || '').trim().toLowerCase()
      .normalize('NFD').replace(/[̀-ͯ]/g, '')
      .replace(/\s+/g, '.')
      .replace(/[^a-z0-9._-]/g, '')
      .replace(/\.{2,}/g, '.')
      .replace(/^[.\-_]+|[.\-_]+$/g, '');
  }
  function displayName(user) {
    const meta = (user && user.user_metadata) || {};
    if (meta.full_name) return String(meta.full_name);
    const email = String((user && user.email) || '');
    return email.endsWith('@' + USER_DOMAIN) ? email.slice(0, -USER_DOMAIN.length - 1) : email;
  }

  function inPlanner() { return typeof window.getSB === 'function' && !!document.getElementById('app'); }

  /* ── Sessions ───────────────────────────────────────────────────────── */

  function pack(j) {
    const now = Math.floor(Date.now() / 1000);
    return {
      access_token: j.access_token,
      refresh_token: j.refresh_token,
      expires_at: j.expires_at || (now + (j.expires_in || 3600)),
      user: j.user ? { id: j.user.id, email: j.user.email, user_metadata: j.user.user_metadata || {} } : null,
    };
  }

  async function refreshOwn(s) {
    try {
      const res = await fetch(SB_URL + '/auth/v1/token?grant_type=refresh_token', {
        method: 'POST',
        headers: { apikey: SB_ANON, 'Content-Type': 'application/json' },
        body: JSON.stringify({ refresh_token: s.refresh_token }),
      });
      if (!res.ok) { write(OWN_KEY, null); return null; }
      const next = pack(await res.json());
      write(OWN_KEY, next);
      return next;
    } catch (e) {
      return null;       // offline: keep the stored session for later
    }
  }

  /** { token, user, source } or null. Never prompts. */
  async function session() {
    if (inPlanner()) {
      try {
        const sb = window.getSB();
        const r = sb && await sb.auth.getSession();
        const s = r && r.data && r.data.session;
        if (s && s.access_token) return { token: s.access_token, user: s.user, source: 'planner' };
      } catch (e) {}
      return null;
    }
    const now = Math.floor(Date.now() / 1000);
    let own = read(OWN_KEY);
    if (own && own.access_token) {
      if (!own.expires_at || own.expires_at - 60 < now) own = await refreshOwn(own);
      if (own && own.access_token) return { token: own.access_token, user: own.user, source: 'grapher' };
    }
    if (read(OPTED_OUT_KEY)) return null;
    const p = read(PLANNER_KEY);
    const ps = p && (p.currentSession || p);
    if (ps && ps.access_token && ps.expires_at && ps.expires_at - 60 > now) {
      return { token: ps.access_token, user: ps.user, source: 'shared' };
    }
    return null;
  }

  async function signIn(name, password) {
    const raw = String(name || '').trim();
    const folded = normalizeUsername(raw);
    const email = raw.indexOf('@') > 0 ? raw.toLowerCase() : (folded ? folded + '@' + USER_DOMAIN : '');
    if (!email) return { error: 'Type the name you sign in to Flux with.' };
    if (!password) return { error: 'Type your password.' };
    let res;
    try {
      res = await fetch(SB_URL + '/auth/v1/token?grant_type=password', {
        method: 'POST',
        headers: { apikey: SB_ANON, 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email, password: password }),
      });
    } catch (e) {
      return { error: 'Could not reach Flux. Check your connection and try again.' };
    }
    const j = await res.json().catch(() => ({}));
    if (!res.ok) {
      if (res.status === 400 || res.status === 401) return { error: 'That name and password do not match a Flux account.' };
      if (res.status === 429) return { error: 'Too many tries. Wait a minute and try again.' };
      return { error: (j && (j.msg || j.error_description || j.message)) || 'Sign-in failed (' + res.status + ').' };
    }
    write(OWN_KEY, pack(j));
    write(OPTED_OUT_KEY, null);
    return { ok: true };
  }

  function signOut() {
    const own = read(OWN_KEY);
    write(OWN_KEY, null);
    // Stop borrowing a planner session in this browser until the next explicit sign-in.
    write(OPTED_OUT_KEY, 1);
    if (own && own.access_token) {
      fetch(SB_URL + '/auth/v1/logout', {
        method: 'POST', headers: { apikey: SB_ANON, Authorization: 'Bearer ' + own.access_token },
      }).catch(() => {});
    }
  }

  /* ── Rows ───────────────────────────────────────────────────────────── */

  async function rest(s, path, opts) {
    const o = opts || {};
    const headers = { apikey: SB_ANON, Authorization: 'Bearer ' + s.token, 'Content-Type': 'application/json' };
    if (o.prefer) headers.Prefer = o.prefer;
    let res;
    try {
      res = await fetch(SB_URL + '/rest/v1/' + path, {
        method: o.method || 'GET', headers: headers, body: o.body ? JSON.stringify(o.body) : undefined,
      });
    } catch (e) {
      throw new Error('Could not reach Flux. Check your connection.');
    }
    if (res.status === 401) {
      if (s.source === 'grapher') write(OWN_KEY, null);
      const err = new Error('Your sign-in has expired. Sign in again.');
      err.auth = true;
      throw err;
    }
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      throw new Error((j && j.message) || 'Flux could not do that (' + res.status + ').');
    }
    if (res.status === 204) return null;
    const text = await res.text();
    return text ? JSON.parse(text) : null;
  }

  function list(s) {
    return rest(s, 'flux_graphs?select=id,kind,title,updated_at&order=updated_at.desc&limit=200');
  }
  async function get(s, id) {
    if (!UUID.test(id)) throw new Error('That graph link is not valid.');
    const rows = await rest(s, 'flux_graphs?id=eq.' + id + '&select=id,kind,title,payload,updated_at');
    if (!rows || !rows[0]) throw new Error('That graph is not in your account any more.');
    return rows[0];
  }
  async function put(s, doc, id) {
    const body = { kind: doc.kind, title: String(doc.title || 'Untitled graph').slice(0, 120) || 'Untitled graph', payload: doc.payload };
    if (id && UUID.test(id)) {
      const rows = await rest(s, 'flux_graphs?id=eq.' + id + '&select=id,title', { method: 'PATCH', body: body, prefer: 'return=representation' });
      if (rows && rows[0]) return rows[0];
      // Deleted from another device since — save it as a new graph rather than failing.
    }
    const rows = await rest(s, 'flux_graphs?select=id,title', { method: 'POST', body: body, prefer: 'return=representation' });
    return rows[0];
  }
  function remove(s, id) {
    if (!UUID.test(id)) return Promise.resolve();
    return rest(s, 'flux_graphs?id=eq.' + id, { method: 'DELETE' });
  }

  /* ── Sheets ─────────────────────────────────────────────────────────── */

  /** A modal card. onClosed runs however it closes. */
  function sheet(html, onMount, onClosed) {
    const back = document.createElement('div');
    back.className = 'fgc-back';
    back.innerHTML = '<div class="fgc-sheet" role="dialog" aria-modal="true">' + html + '</div>';
    document.body.appendChild(back);
    const box = back.firstChild;
    const prevFocus = document.activeElement;
    let closed = false;
    function close() {
      if (closed) return;
      closed = true;
      document.removeEventListener('keydown', onKey, true);
      back.classList.add('is-out');
      setTimeout(() => { if (back.parentNode) back.parentNode.removeChild(back); }, 160);
      if (prevFocus && prevFocus.focus) { try { prevFocus.focus(); } catch (e) {} }
      if (onClosed) onClosed();
    }
    function onKey(e) {
      if (e.key === 'Escape') { e.stopPropagation(); close(); return; }
      if (e.key === 'Tab') {
        // Keep the keyboard inside the sheet while it is open.
        const f = box.querySelectorAll('button:not([disabled]), input, a[href]');
        if (!f.length) return;
        const first = f[0], last = f[f.length - 1];
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    }
    document.addEventListener('keydown', onKey, true);
    back.addEventListener('pointerdown', (e) => { if (e.target === back) close(); });
    box.addEventListener('click', (e) => { if (e.target.closest('[data-close]')) close(); });
    if (onMount) onMount(box, close);
    return close;
  }

  const LOGO = '<span class="fgc-logo" aria-hidden="true"><svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 3v18h18"/><path d="m7 14 4-4 3 3 5-6"/></svg></span>';
  const CLOSE = '<button type="button" class="fgc-x" data-close aria-label="Close"><svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M18 6 6 18M6 6l12 12"/></svg></button>';

  /** Resolves true once signed in, false if the sheet is dismissed. */
  function signInSheet(reason) {
    return new Promise((resolve) => {
      let ok = false;
      sheet(CLOSE + LOGO
        + '<h2 class="fgc-h">Sign in to ' + (reason === 'open' ? 'open your graphs' : 'save') + '</h2>'
        + '<p class="fgc-sub">Graphs go to your Flux account, and show up in Flux Planner too. Everything else works without signing in.</p>'
        + '<form class="fgc-form" novalidate>'
        + '<label class="fgc-f"><span>Name</span><input name="n" autocomplete="username" autocapitalize="off" spellcheck="false" placeholder="First Last"></label>'
        + '<label class="fgc-f"><span>Password</span><input name="p" type="password" autocomplete="current-password"></label>'
        + '<div class="fgc-err" role="alert" hidden></div>'
        + '<button type="submit" class="fgc-btn">Sign in</button>'
        + '</form>'
        + '<p class="fgc-foot">No account? <a href="index.html" target="_blank" rel="noopener">Make one free in Flux Planner</a>. '
        + 'Signed in with Google before? Open the planner once to set your password.</p>', (box, close) => {
        const form = box.querySelector('form'), err = box.querySelector('.fgc-err'), btn = box.querySelector('.fgc-btn');
        const n = form.elements.n, p = form.elements.p;
        const prev = read(PLANNER_KEY);
        const pu = prev && (prev.currentSession || prev).user;
        if (pu) n.value = displayName(pu);
        (n.value ? p : n).focus();
        form.addEventListener('submit', async (e) => {
          e.preventDefault();
          err.hidden = true;
          btn.disabled = true;
          btn.textContent = 'Signing in…';
          const r = await signIn(n.value, p.value);
          btn.disabled = false;
          btn.textContent = 'Sign in';
          if (r.error) { err.textContent = r.error; err.hidden = false; p.select(); return; }
          ok = true;
          close();
          emitAccount();
        });
      }, () => resolve(ok));
    });
  }

  async function need(reason) {
    let s = await session();
    if (s) return s;
    if (inPlanner()) { toast('Sign in to Flux Planner to save graphs.', 'warning'); return null; }
    if (!(await signInSheet(reason))) return null;
    s = await session();
    return s;
  }

  function nameSheet(initial) {
    return new Promise((resolve) => {
      let result = null;
      sheet(CLOSE + '<h2 class="fgc-h">Name this graph</h2>'
        + '<form class="fgc-form"><label class="fgc-f"><span>Name</span><input name="t" maxlength="120" value="' + esc(initial) + '"></label>'
        + '<button type="submit" class="fgc-btn">Save</button></form>', (box, close) => {
        const inp = box.querySelector('input');
        inp.focus();
        inp.select();
        box.querySelector('form').addEventListener('submit', (e) => {
          e.preventDefault();
          result = inp.value.trim() || initial || 'Untitled graph';
          close();
        });
      }, () => resolve(result));
    });
  }

  let saving = false;
  /** Save the graph: the first time asks for a name, after that it updates in place. */
  async function save(inst, opts) {
    if (!inst || saving) return false;
    const o = opts || {};
    const s = await need('save');
    if (!s) return false;
    const doc = inst.getDoc();
    let id = inst.cloud && inst.cloud.id;
    if (!id || o.asNew) {
      const t = await nameSheet(o.asNew && inst.cloud ? inst.cloud.title + ' (copy)' : doc.title);
      if (t == null) return false;
      doc.title = t;
      if (o.asNew) id = null;
    } else {
      doc.title = inst.doc.title.trim() || inst.cloud.title || doc.title;
    }
    saving = true;
    try {
      const row = await put(s, doc, id);
      inst.markSaved({ id: row.id, title: row.title || doc.title });
      toast('Saved to your Flux account.', 'success');
      return true;
    } catch (e) {
      toast(e.message || 'Could not save.', 'error');
      if (e.auth) emitAccount();
      return false;
    } finally {
      saving = false;
    }
  }

  function ago(iso) {
    const t = Date.parse(iso);
    if (!Number.isFinite(t)) return '';
    const s = Math.max(0, (Date.now() - t) / 1000);
    if (s < 60) return 'just now';
    if (s < 3600) return Math.floor(s / 60) + ' min ago';
    if (s < 86400) return Math.floor(s / 3600) + ' h ago';
    if (s < 86400 * 7) return Math.floor(s / 86400) + ' d ago';
    return new Date(t).toLocaleDateString();
  }

  /** The list of saved graphs. onPick receives the full row. */
  async function open(onPick) {
    const s = await need('open');
    if (!s) return;
    sheet(CLOSE + '<h2 class="fgc-h">Your graphs</h2>'
      + '<div class="fgc-list" aria-live="polite"><div class="fgc-empty">Loading…</div></div>', async (box, close) => {
      const listEl = box.querySelector('.fgc-list');
      const paint = (rows) => {
        if (!rows.length) {
          listEl.innerHTML = '<div class="fgc-empty">Nothing saved yet. Save a graph and it will be here — and in Flux Planner.</div>';
          return;
        }
        listEl.innerHTML = rows.map((r) => '<div class="fgc-row">'
          + '<button type="button" class="fgc-open" data-open="' + esc(r.id) + '">'
          + '<span class="fgc-kind fgc-kind--' + esc(r.kind) + '" aria-hidden="true">' + (r.kind === 'functions' ? 'ƒ' : '±') + '</span>'
          + '<span class="fgc-title">' + esc(r.title) + '</span>'
          + '<span class="fgc-when">' + esc(ago(r.updated_at)) + '</span></button>'
          + '<button type="button" class="fgc-del" data-delrow="' + esc(r.id) + '" aria-label="Delete ' + esc(r.title) + '" title="Delete">'
          + '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M3 6h18M8 6V4h8v2M6 6l1 14h10l1-14"/></svg></button>'
          + '</div>').join('');
      };
      let rows = [];
      try {
        rows = (await list(s)) || [];
        paint(rows);
      } catch (e) {
        listEl.innerHTML = '<div class="fgc-empty fgc-empty--err">' + esc(e.message) + '</div>';
        return;
      }
      listEl.addEventListener('click', async (e) => {
        const del = e.target.closest('[data-delrow]');
        if (del) {
          const r = rows.find((x) => x.id === del.dataset.delrow);
          if (!r || !window.confirm('Delete "' + r.title + '"? This cannot be undone.')) return;
          try {
            await remove(s, r.id);
            rows = rows.filter((x) => x.id !== r.id);
            paint(rows);
          } catch (err) { toast(err.message, 'error'); }
          return;
        }
        const op = e.target.closest('[data-open]');
        if (!op) return;
        op.disabled = true;
        try {
          const row = await get(s, op.dataset.open);
          close();
          onPick(row);
        } catch (err) {
          op.disabled = false;
          toast(err.message, 'error');
        }
      });
    });
  }

  /* ── The account button on grapher.html ─────────────────────────────── */

  const accountListeners = [];
  function emitAccount() { accountListeners.forEach((fn) => { try { fn(); } catch (e) {} }); }
  function onAccount(fn) { accountListeners.push(fn); }

  async function accountMenu(anchor) {
    const s = await session();
    const P = G();
    if (!s) {
      if (await signInSheet('save')) toast('Signed in.', 'success');
      return;
    }
    const who = displayName(s.user);
    const html = '<div class="flg-menu fgc-acct"><div class="fgc-who"><span class="fgc-av">' + esc((who[0] || '?').toUpperCase()) + '</span>'
      + '<span><b>' + esc(who) + '</b><small>' + (s.source === 'shared' ? 'Signed in through Flux Planner' : 'Signed in') + '</small></span></div>'
      + '<a class="flg-menu-i" href="index.html" target="_blank" rel="noopener"><span>Open Flux Planner</span></a>'
      + '<button type="button" class="flg-menu-i is-danger" data-signout><span>Sign out of the grapher</span></button></div>';
    P.openPop(anchor, html, (el) => {
      el.querySelector('[data-signout]').addEventListener('click', () => {
        signOut();
        P.closePop();
        toast('Signed out. Your graphs stay in your account.', 'success');
        emitAccount();
      });
    });
  }

  window.FluxGraphCloud = {
    session: session,
    signIn: signIn,
    signOut: signOut,
    save: save,
    open: open,
    get: async function (id) { const s = await need('open'); if (!s) return null; return get(s, id); },
    accountMenu: accountMenu,
    onAccount: onAccount,
    displayName: displayName,
    normalizeUsername: normalizeUsername,
    _keys: { OWN_KEY: OWN_KEY, PLANNER_KEY: PLANNER_KEY, OPTED_OUT_KEY: OPTED_OUT_KEY },
  };
})();
