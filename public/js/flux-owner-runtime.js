/* ============================================================================
   FLUX · Owner Controls runtime (owner.html)

   Owner Controls is its own app and does not load the planner. The owner tools
   were written against the planner's globals (getSB, load, save, syncToCloud,
   showToast, currentUser, …), so this file supplies them.

   WHO GETS IN
   The page checks the session with the server (auth.getUser), not just what is
   stored in the browser. That only decides what is drawn. What protects the
   data is the database (flux_is_platform_admin) and release-admin, both of which
   refuse anyone else whatever this file does. GitHub Pages serves this code to
   anyone who asks, so it holds no secrets.

   THE SHARED ROW
   Owner settings live in the owner's user_data row beside the planner's tasks
   and notes, because release-admin and user-feedback read them from there. The
   planner may be open on another device, so a write here:
     · changes only the owner keys (OWNER_KEYS), never the whole row;
     · reads the row first and writes only if updated_at has not moved, the same
       rule as the planner's fluxWriteRow, so neither side overwrites the other.
   ========================================================================== */
(function () {
  'use strict';

  var SB_URL = 'https://lfigdijuqmbensebnevo.supabase.co';
  var SB_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxmaWdkaWp1cW1iZW5zZWJuZXZvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMzNjEzMDgsImV4cCI6MjA4ODkzNzMwOH0.qG1d9DLKrs0qqLgAp-6UGdaU7xWvlg2sWq-oD-y2kVo';
  var OWNER_UID = 'eabe2b1f-e428-4181-8530-8e5366eb3975';
  var OWNER_KEYS = [
    ['devAccounts', 'flux_dev_accounts', []],
    ['platformConfig', 'flux_platform_config', {}],
    ['ownerAuditLog', 'flux_owner_audit', []],
  ];
  /* Planner data shown read-only in My analytics and included in backups. */
  var PLANNER_FIELDS = ['tasks', 'notes', 'habits', 'goals', 'sessionLog'];

  var _sb = null;
  var _rowData = null;
  var _pulledAt = 0;
  var _pushing = null;
  var _pushAgain = false;
  var _timer = 0;

  window.SB_URL = SB_URL;
  window.SB_ANON = SB_ANON;
  window.OWNER_UID = OWNER_UID;
  window.currentUser = null;
  PLANNER_FIELDS.forEach(function (f) { window[f] = []; });

  window.getSB = function () {
    if (!_sb && window.supabase && window.supabase.createClient) {
      _sb = window.supabase.createClient(SB_URL, SB_ANON, {
        // No sign-in happens on this page, so no sign-in link is ever read from its address.
        auth: { detectSessionInUrl: false, persistSession: true, autoRefreshToken: true },
      });
    }
    return _sb;
  };

  window.isOwner = function () { return !!(window.currentUser && window.currentUser.id === OWNER_UID); };
  window.getMyRole = function () { return window.isOwner() ? 'owner' : 'user'; };
  window.canAccessMasterBacklog = window.isOwner;

  /* Same storage keys as the planner, so both read one copy on this device.
     The planner's impersonation prefix does not apply: the owner keys are global
     (FLUX_IMPERSONATION_GLOBAL_KEYS), and the planner's own data comes from the row. */
  window.fluxNamespacedKey = function (k) { return k; };
  window.load = function (k, def) {
    try { var v = localStorage.getItem(k); return v ? JSON.parse(v) : def; } catch (e) { return def; }
  };
  window.save = function (k, v) {
    try { localStorage.setItem(k, JSON.stringify(v)); }
    catch (e) { window.showToast('This browser is out of storage, so that was not saved here.', 'error'); }
  };
  window.fluxLoadStoredString = function (k, def) {
    var v = window.load(k, def);
    return typeof v === 'string' ? v : def;
  };

  window.fluxAuthHeaders = async function () {
    var s = await window.getSB().auth.getSession();
    var t = (s && s.data && s.data.session && s.data.session.access_token) || SB_ANON;
    return { 'Content-Type': 'application/json', Authorization: 'Bearer ' + t, apikey: SB_ANON };
  };

  /* ---------- Toasts ---------- */

  window.showToast = function (msg, kind, ms) {
    var host = document.getElementById('ownerToasts');
    if (!host) return;
    var el = document.createElement('div');
    el.className = 'own-toast own-toast--' + (kind || 'info');
    el.setAttribute('role', kind === 'error' ? 'alert' : 'status');
    el.textContent = String(msg == null ? '' : msg);
    host.appendChild(el);
    setTimeout(function () { el.remove(); }, ms || 4500);
  };

  /* ---------- The owner's row ---------- */

  function mergeFeedback(remoteInbox, remoteTomb) {
    // Same rule as the planner: dismissals are a union, or one device undoes another's.
    var tomb = new Set((window.load('flux_feedback_tombstones', []) || []).map(String));
    (remoteTomb || []).forEach(function (x) { if (x) tomb.add(String(x)); });
    var byId = new Map();
    (remoteInbox || []).concat(window.load('flux_feedback_inbox', []) || []).forEach(function (x) {
      if (x && x.id && !tomb.has(String(x.id))) byId.set(x.id, x);
    });
    var inbox = Array.from(byId.values()).sort(function (a, b) { return (a.t || 0) - (b.t || 0); }).slice(-300);
    var tombstones = Array.from(tomb).slice(-500);
    window.save('flux_feedback_inbox', inbox);
    window.save('flux_feedback_tombstones', tombstones);
    return { inbox: inbox, tombstones: tombstones };
  }

  async function readRow() {
    var res = await window.getSB().from('user_data').select('data,updated_at').eq('id', OWNER_UID).maybeSingle();
    if (res.error) throw res.error;
    return res.data;
  }

  function adopt(row) {
    var d = (row && row.data) || {};
    _rowData = d;
    _pulledAt = Date.now();
    OWNER_KEYS.forEach(function (o) { if (d[o[0]] !== undefined) window.save(o[1], d[o[0]]); });
    mergeFeedback(d.feedbackInbox, d.feedbackTombstones);
    PLANNER_FIELDS.forEach(function (f) { window[f] = Array.isArray(d[f]) ? d[f] : []; });
    window.extraGoals = Array.isArray(d.ecGoals) ? d.ecGoals : [];
  }

  window.fluxOwnerPull = async function () {
    adopt(await readRow());
  };

  /** Write to the row only if it has not moved since it was read. fn(data) returns the fields to change. */
  window.fluxOwnerPatchRow = async function (fn) {
    if (!window.isOwner()) throw new Error('Not signed in as the owner');
    for (var i = 0; i < 4; i++) {
      var row = await readRow();
      if (!row) throw new Error('Your account has no saved data yet. Open the planner once first.');
      var next = Object.assign({}, row.data, fn(row.data || {}));
      var q = window.getSB().from('user_data').update({ data: next, updated_at: new Date().toISOString() }).eq('id', OWNER_UID);
      q = row.updated_at == null ? q.is('updated_at', null) : q.eq('updated_at', row.updated_at);
      var res = await q.select('updated_at');
      if (res.error) throw res.error;
      if (res.data && res.data.length) { _rowData = next; return next; }
    }
    throw new Error('Your planner kept saving at the same moment. Try again.');
  };

  function ownerFields(remote) {
    var out = {};
    OWNER_KEYS.forEach(function (o) { out[o[0]] = window.load(o[1], o[2]); });
    // Entries another device logged since this page last read the row. A plain
    // union would bring back everything after "Clear audit log".
    var newer = (Array.isArray(remote.ownerAuditLog) ? remote.ownerAuditLog : []).filter(function (e) {
      return e && e.t > _pulledAt && !out.ownerAuditLog.some(function (m) { return m.t === e.t && m.action === e.action; });
    });
    if (newer.length) {
      out.ownerAuditLog = out.ownerAuditLog.concat(newer).sort(function (a, b) { return a.t - b.t; }).slice(-300);
      window.save('flux_owner_audit', out.ownerAuditLog);
    }
    var fb = mergeFeedback(remote.feedbackInbox, remote.feedbackTombstones);
    out.feedbackInbox = fb.inbox;
    out.feedbackTombstones = fb.tombstones;
    return out;
  }

  window.syncToCloud = function () {
    // Never write before the first read: an empty local copy would replace real settings.
    if (!window.isOwner() || !_pulledAt) return Promise.resolve();
    if (_pushing) { _pushAgain = true; return _pushing; }
    _pushing = window.fluxOwnerPatchRow(ownerFields).then(function () {
      _pulledAt = Date.now();
      setSyncState('Saved');
    }).catch(function (e) {
      setSyncState('Not saved');
      window.showToast('Saved on this device only: ' + (e.message || e), 'error', 7000);
    }).then(function () {
      _pushing = null;
      if (_pushAgain) { _pushAgain = false; return window.syncToCloud(); }
    });
    return _pushing;
  };

  window.syncKey = function () {
    if (!window.isOwner()) return;
    setSyncState('Saving…');
    clearTimeout(_timer);
    _timer = setTimeout(window.syncToCloud, 700);
  };

  window.forceSyncNow = async function () {
    await window.syncToCloud();
    try {
      await window.fluxOwnerPull();
      window.showToast('Synced', 'success');
    } catch (e) {
      window.showToast('Could not sync: ' + (e.message || e), 'error');
    }
  };

  /** The whole row with the latest owner settings: what a full backup contains. */
  window.getCloudPayload = function () {
    return Object.assign({}, _rowData, ownerFields(_rowData || {}));
  };

  function setSyncState(text) {
    var el = document.getElementById('ownerSyncState');
    if (el) el.textContent = text;
  }

  window.saveDevAccounts = function (list) {
    window.save('flux_dev_accounts', list);
    return window.syncToCloud();
  };

  /* ---------- What the tools expect from the planner ---------- */

  /* "Switch to staff" previews the planner, so it ends with a trip there. The
     planner reads this key on load and shows its own exit banner. */
  var IMP_KEY = 'flux_owner_impersonate';
  window.FluxImpersonate = {
    active: function () { return window.load(IMP_KEY, null); },
    set: function (r) {
      window.save(IMP_KEY, {
        role: r.role, name: r.name || '', subject: r.subject || '', email: r.email || '',
        mode: r.mode === 'personal' ? 'personal' : 'work',
      });
      setTimeout(function () { location.href = 'index.html'; }, 300);
    },
    clear: function () { localStorage.removeItem(IMP_KEY); },
  };

  /* Keeps other apps' on-device data, as the planner's own version does. */
  window.fluxClearLocalStorageKeepingApps = function () {
    var keep = {};
    Object.keys(localStorage).forEach(function (k) {
      if (k.indexOf('synara.') === 0 || k.indexOf('flux_tutor') === 0 || k === 'flux_teacher.beta.v1') keep[k] = localStorage.getItem(k);
    });
    localStorage.clear();
    Object.keys(keep).forEach(function (k) { localStorage.setItem(k, keep[k]); });
  };

  window.fluxOwnerClearAppCache = async function () {
    if (!window.confirm('Clear the saved copy of Flux on this device and reload? Your data is not touched.')) return;
    if (window.caches) {
      var names = await caches.keys();
      await Promise.all(names.map(function (n) { return caches.delete(n); }));
    }
    location.reload();
  };

  /* The sign-in pop-up preview, drawn from text only. */
  window.fluxShowSignInPopup = function (opts) {
    var o = opts || {};
    var box = document.createElement('dialog');
    box.className = 'own-dialog';
    var tag = document.createElement('div');
    tag.className = 'own-eyebrow';
    tag.textContent = o.preview ? 'Preview, not sent' : 'Message';
    var h = document.createElement('h2');
    h.textContent = o.title || 'A message from Flux';
    var p = document.createElement('p');
    p.style.whiteSpace = 'pre-wrap';
    p.textContent = o.body || '(empty)';
    var btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'own-btn own-btn--primary';
    btn.textContent = 'Got it';
    btn.addEventListener('click', function () { box.close(); box.remove(); });
    box.append(tag, h, p, btn);
    document.body.appendChild(box);
    box.showModal();
  };

  /* Tester emails are read by the planner on its next load, so nothing to redraw here. */
  window.checkTesterMode = function () {};
  window.renderTesterBadge = function () {};

  /* ---------- Two-step sign-in ----------
     The database and release-admin refuse owner actions from a session without
     an authenticator code from the last 12 hours, and role or password changes
     without one from the last 15 minutes. This only asks for the code; the
     server is what enforces it. */

  var MFA_MAX_AGE_S = 12 * 60 * 60;
  var MFA_REFRESH_BEFORE_S = 30 * 60;

  function el(tag, attrs, text) {
    var n = document.createElement(tag);
    Object.keys(attrs || {}).forEach(function (k) { n.setAttribute(k, attrs[k]); });
    if (text) n.textContent = text;
    return n;
  }

  function codeForm(onCode) {
    var form = el('form', { class: 'own-mfa-form' });
    var input = el('input', {
      type: 'text', inputmode: 'numeric', autocomplete: 'one-time-code',
      pattern: '[0-9]{6}', maxlength: '6', required: '', 'aria-label': '6-digit code',
      placeholder: '123456',
    });
    var btn = el('button', { type: 'submit', class: 'own-btn own-btn--primary' }, 'Continue');
    var err = el('p', { class: 'own-muted', role: 'alert' });
    form.append(input, btn, err);
    form.addEventListener('submit', async function (ev) {
      ev.preventDefault();
      btn.disabled = true;
      err.textContent = '';
      try { await onCode(input.value.replace(/\s+/g, '')); }
      catch (e) {
        err.textContent = (e && e.message) || 'That code did not work. Try the newest one.';
        input.value = '';
        input.focus();
      }
      btn.disabled = false;
    });
    setTimeout(function () { input.focus(); }, 0);
    return form;
  }

  function mfaAgeSeconds(aal) {
    var times = ((aal && aal.currentAuthenticationMethods) || [])
      .filter(function (m) { return m.method === 'totp'; })
      .map(function (m) { return m.timestamp; });
    return times.length ? Math.floor(Date.now() / 1000) - Math.max.apply(null, times) : null;
  }

  async function verifiedTotp(client) {
    var res = await client.auth.mfa.listFactors();
    if (res.error) throw res.error;
    return ((res.data && res.data.totp) || []).filter(function (f) { return f.status === 'verified'; });
  }

  /* Resolves once the session holds a fresh code. */
  function askForCode(client, factorId, mount, title, body) {
    return new Promise(function (resolve) {
      mount.replaceChildren(el('h1', null, title), el('p', null, body), codeForm(async function (code) {
        var r = await client.auth.mfa.challengeAndVerify({ factorId: factorId, code: code });
        if (r.error) throw r.error;
        resolve();
      }));
    });
  }

  async function enrol(client, mount) {
    // A half-finished set-up blocks a new one with the same name.
    var all = await client.auth.mfa.listFactors();
    var stale = ((all.data && all.data.all) || []).filter(function (f) { return f.status !== 'verified'; });
    for (var i = 0; i < stale.length; i++) await client.auth.mfa.unenroll({ factorId: stale[i].id });

    var en = await client.auth.mfa.enroll({ factorType: 'totp', friendlyName: 'Owner Controls ' + new Date().toISOString().slice(0, 10) });
    if (en.error) throw en.error;
    return new Promise(function (resolve) {
      mount.replaceChildren(
        el('h1', null, 'Set up two-step sign-in'),
        el('p', null, 'Owner Controls needs a code from an authenticator app (Google Authenticator, 1Password, Authy…) as well as your password.'),
        el('p', null, '1. Scan this with the app, or type the key under it.'),
        el('img', { src: en.data.totp.qr_code, alt: 'QR code for your authenticator app', width: '200', height: '200' }),
        el('p', { class: 'own-muted' }, 'Key: ' + en.data.totp.secret),
        el('p', null, '2. Type the 6-digit code the app shows.'),
        codeForm(async function (code) {
          var r = await client.auth.mfa.challengeAndVerify({ factorId: en.data.id, code: code });
          if (r.error) throw r.error;
          resolve();
        }));
    });
  }

  /* Makes sure the session has a code no older than maxAge seconds. */
  async function requireMfa(client, mount, maxAge) {
    var factors = await verifiedTotp(client);
    if (!factors.length) {
      await enrol(client, mount);
      return;
    }
    var aal = await client.auth.mfa.getAuthenticatorAssuranceLevel();
    if (aal.error) throw aal.error;
    var age = mfaAgeSeconds(aal.data);
    if (aal.data.currentLevel === 'aal2' && age !== null && age <= maxAge) return;
    await askForCode(client, factors[0].id, mount, 'Enter your code',
      'Open your authenticator app and type the 6-digit code for Flux.');
  }

  /* For actions the server refused with flux_step_up_required or owner_mfa_required. */
  window.fluxOwnerStepUp = async function () {
    var client = window.getSB();
    var box = el('dialog', { class: 'own-dialog' });
    document.body.appendChild(box);
    box.showModal();
    try {
      // -1: always ask. The server has just said the last code is too old.
      await requireMfa(client, box, -1);
      window.showToast('Code accepted. Try that again.', 'success');
    } finally {
      box.close();
      box.remove();
    }
  };

  // Server refusals reach the owner as toasts from many panels; catch them here
  // rather than in every panel.
  var plainToast = window.showToast;
  var stepUpOpen = false;
  window.showToast = function (msg, kind, ms) {
    if (/flux_step_up_required|owner_mfa_required/.test(String(msg || ''))) {
      if (!stepUpOpen) {
        stepUpOpen = true;
        plainToast('That needs your authenticator code again.', 'info');
        window.fluxOwnerStepUp().catch(function () {}).then(function () { stepUpOpen = false; });
      }
      return;
    }
    return plainToast(msg, kind, ms);
  };

  /* ---------- Boot ---------- */

  function showGate(html) {
    var gate = document.getElementById('ownerGate');
    gate.hidden = false;
    gate.innerHTML = html;
  }

  async function boot() {
    var client = window.getSB();
    if (!client) {
      showGate('<h1>Owner Controls could not start</h1><p>Reload the page. If that does not help, check your connection.</p>');
      return;
    }
    var res;
    try { res = await client.auth.getUser(); } catch (e) { res = { error: e }; }
    var user = res && res.data && res.data.user;
    if (!user) {
      showGate('<h1>Sign in first</h1><p>Owner Controls uses your Flux account. Sign in on the planner, then come back to this page.</p>' +
        '<a class="own-btn own-btn--primary" href="index.html">Open the planner</a>');
      return;
    }
    if (user.id !== OWNER_UID) {
      showGate('<h1>This page is private</h1><p>Your account does not have access.</p>' +
        '<a class="own-btn" href="suite.html">Back to Flux Suite</a>');
      return;
    }
    var gateEl = document.getElementById('ownerGate');
    try { await requireMfa(client, gateEl, MFA_MAX_AGE_S - MFA_REFRESH_BEFORE_S); }
    catch (e) {
      showGate('<h1>Two-step sign-in could not start</h1><p>Reload the page. If that does not help, check your connection.</p>');
      return;
    }
    gateEl.replaceChildren(el('p', { class: 'own-muted' }, 'Loading…'));

    window.currentUser = user;
    client.auth.onAuthStateChange(function (event, session) {
      if (event === 'SIGNED_OUT' || (session && session.user.id !== OWNER_UID)) location.reload();
    });
    try { await window.fluxOwnerPull(); }
    catch (e) { window.showToast('Your saved settings could not be read: ' + (e.message || e), 'error', 8000); }

    document.getElementById('ownerGate').hidden = true;
    var app = document.getElementById('ownerApp');
    app.hidden = false;
    var want = (location.hash || '').replace(/^#/, '');
    window.openOwnerSuite(want || undefined, { mount: app, skipNav: true });

    // Back from the planner, or another device changed something.
    // Owner powers lapse 12 hours after the last code; ask again before they do.
    var rechecking = false;
    async function recheckMfa() {
      if (rechecking) return;
      rechecking = true;
      try {
        var aal = await client.auth.mfa.getAuthenticatorAssuranceLevel();
        var age = mfaAgeSeconds(aal.data);
        if (aal.data && aal.data.currentLevel === 'aal2' && age !== null && age <= MFA_MAX_AGE_S - MFA_REFRESH_BEFORE_S) return;
        app.hidden = true;
        gateEl.hidden = false;
        await requireMfa(client, gateEl, MFA_MAX_AGE_S - MFA_REFRESH_BEFORE_S);
        gateEl.hidden = true;
        app.hidden = false;
      } catch (e) {
        window.showToast('Could not check your sign-in: ' + (e.message || e), 'error', 8000);
      } finally {
        rechecking = false;
      }
    }

    document.addEventListener('visibilitychange', function () {
      if (document.visibilityState !== 'visible') return;
      recheckMfa().then(function () { return window.fluxOwnerPull(); }).catch(function () {});
    });
    window.addEventListener('hashchange', function () {
      var t = (location.hash || '').replace(/^#/, '');
      if (t && t !== window.__osActiveTab && window.__osSetTab) window.__osSetTab(t);
    });
  }

  window.__FLUX_OWNER_APP = true;
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true });
  else boot();
})();
