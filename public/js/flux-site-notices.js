/* ============================================================================
   FLUX  ·  flux-site-notices.js
   What the owner tells everyone, on every Flux page:

   - Site mode (Owner Controls › Site mode, platform_settings 'site_mode'):
       read-only    a notice that changes are not being saved to the cloud
       maintenance  a screen over the page with the owner's message and a
                    countdown; before it starts, a banner saying when
   - Announcements (Owner Controls › Announcements, table flux_announcements):
       a banner for every app, or only the one named. Closing one hides it on
       this device. Signed-in people are counted as having seen it.

   A plain script that depends on nothing, like flux-app-visibility.js, because
   most Flux apps run without the Supabase library. Everything shown came from
   the owner, but it still goes in as text, never as HTML.

   The database enforces read-only and maintenance (flux_check_request). This
   only tells people why their changes are not saving.

   Fails quietly: a school network that blocks Supabase shows nothing.
   ========================================================================== */
(function () {
  'use strict';
  if (window.FluxSiteNotices) return;

  var SB_URL = 'https://lfigdijuqmbensebnevo.supabase.co';
  var SB_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxmaWdkaWp1cW1iZW5zZWJuZXZvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMzNjEzMDgsImV4cCI6MjA4ODkzNzMwOH0.qG1d9DLKrs0qqLgAp-6UGdaU7xWvlg2sWq-oD-y2kVo';
  var SESSION_KEY = 'sb-lfigdijuqmbensebnevo-auth-token';
  var OWNER_UID = 'eabe2b1f-e428-4181-8530-8e5366eb3975';
  var CLOSED_KEY = 'flux_closed_announcements_v1';
  var REFRESH_MS = 2 * 60 * 1000;

  var host = location.hostname;
  var local = host === 'localhost' || host === '127.0.0.1' || host === '[::1]';
  if (local && !window.__FLUX_SITE_NOTICES_TEST) return;

  /* Which app this page is: the data-app its visibility script declares, or
     the file name. The planner is index.html, or the bare folder. */
  function pageApp() {
    var tagged = document.querySelector('script[data-app]');
    if (tagged) return tagged.getAttribute('data-app');
    var file = location.pathname.split('/').pop() || 'index.html';
    var name = file.replace(/\.html?$/, '');
    return name === 'index' || name === '' ? 'planner' : name;
  }
  var APP = pageApp();
  /* Owner Controls has its own view of all this. */
  if (APP === 'owner') return;

  function readJSON(key) {
    try { return JSON.parse(localStorage.getItem(key) || 'null'); } catch (e) { return null; }
  }
  function session() { return readJSON(SESSION_KEY) || {}; }
  function isOwner() { var s = session(); return !!(s.user && s.user.id === OWNER_UID); }

  function get(path) {
    return fetch(SB_URL + '/rest/v1/' + path, {
      headers: { apikey: SB_ANON, Authorization: 'Bearer ' + SB_ANON },
      cache: 'no-store',
    }).then(function (res) {
      if (!res.ok) throw new Error(path + ' ' + res.status);
      return res.json();
    });
  }

  function el(tag, css, text) {
    var n = document.createElement(tag);
    if (css) n.style.cssText = css;
    if (text != null) n.textContent = text;
    return n;
  }

  function until(iso) {
    var ms = new Date(iso).getTime() - Date.now();
    if (!isFinite(ms) || ms <= 0) return '';
    var m = Math.round(ms / 60000);
    if (m < 1) return 'less than a minute';
    if (m < 60) return m + ' minute' + (m === 1 ? '' : 's');
    var h = Math.floor(m / 60);
    var rest = m % 60;
    if (h < 48) return h + ' hour' + (h === 1 ? '' : 's') + (rest ? ' ' + rest + ' min' : '');
    return Math.round(h / 24) + ' days';
  }

  /* ---------- The stack of banners, bottom left ---------- */

  function stack() {
    var s = document.getElementById('fluxSiteNotices');
    if (s) return s;
    s = el('div', 'position:fixed;left:12px;right:12px;bottom:calc(12px + env(safe-area-inset-bottom,0px));z-index:10060;' +
      'display:flex;flex-direction:column;align-items:flex-start;gap:8px;pointer-events:none;max-width:460px');
    s.id = 'fluxSiteNotices';
    s.setAttribute('role', 'region');
    s.setAttribute('aria-label', 'Notices from Flux');
    (document.body || document.documentElement).appendChild(s);
    return s;
  }

  var TONES = {
    info: { bar: '#60a5fa', bg: 'rgba(15,23,42,.96)' },
    warning: { bar: '#fbbf24', bg: 'rgba(30,22,6,.96)' },
    urgent: { bar: '#f87171', bg: 'rgba(40,10,14,.97)' },
  };

  function banner(id, tone, title, body, onClose) {
    var t = TONES[tone] || TONES.info;
    var b = el('div', 'pointer-events:auto;width:100%;box-sizing:border-box;display:flex;gap:10px;align-items:flex-start;' +
      'padding:12px 14px;border-radius:14px;background:' + t.bg + ';color:#eef2f8;border:1px solid rgba(255,255,255,.12);' +
      'border-left:4px solid ' + t.bar + ';box-shadow:0 12px 32px rgba(0,0,0,.4);font:500 14px/1.45 system-ui,-apple-system,Segoe UI,Roboto,sans-serif');
    b.setAttribute('data-notice', id);
    b.setAttribute('role', tone === 'urgent' ? 'alert' : 'status');
    var text = el('div', 'flex:1;min-width:0');
    text.appendChild(el('div', 'font-weight:700', title));
    if (body) text.appendChild(el('div', 'margin-top:3px;opacity:.85;white-space:pre-wrap;word-break:break-word', body));
    b.appendChild(text);
    if (onClose) {
      var x = el('button', 'flex:none;min-width:32px;min-height:32px;border:0;border-radius:8px;background:rgba(255,255,255,.08);' +
        'color:inherit;font-size:18px;line-height:1;cursor:pointer', '×');
      x.type = 'button';
      x.setAttribute('aria-label', 'Close this notice');
      x.addEventListener('click', function () { b.remove(); onClose(); });
      b.appendChild(x);
    }
    return b;
  }

  /* ---------- Maintenance screen ---------- */

  var _tick = 0;
  function showScreen(v) {
    var screen = document.getElementById('fluxSiteMaintenance');
    if (!screen) {
      screen = el('div', 'position:fixed;inset:0;z-index:2147483600;display:flex;align-items:center;justify-content:center;padding:24px;' +
        'background:radial-gradient(circle at 50% 35%,#101a30 0%,#06080f 70%);color:#e6edf6;text-align:center;' +
        'font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif');
      screen.id = 'fluxSiteMaintenance';
      screen.setAttribute('role', 'alertdialog');
      screen.setAttribute('aria-modal', 'true');
      screen.setAttribute('aria-labelledby', 'fluxSiteMaintTitle');
      var box = el('div', 'max-width:460px');
      box.appendChild(el('div', 'font:700 12px/1 ui-monospace,monospace;letter-spacing:.2em;text-transform:uppercase;color:#fbbf24;margin-bottom:12px', 'Maintenance'));
      var h = el('h1', 'margin:0 0 12px;font-size:1.7rem;font-weight:800', 'Flux is being worked on');
      h.id = 'fluxSiteMaintTitle';
      box.appendChild(h);
      var msg = el('p', 'margin:0 0 10px;line-height:1.55;color:#a9b3c6');
      msg.setAttribute('data-maint-msg', '');
      box.appendChild(msg);
      var left = el('p', 'margin:0 0 22px;font-weight:700');
      left.setAttribute('data-maint-left', '');
      box.appendChild(left);
      var again = el('button', 'min-height:44px;padding:10px 20px;border-radius:12px;border:1px solid rgba(255,255,255,.2);' +
        'background:rgba(255,255,255,.06);color:inherit;font-weight:700;cursor:pointer', 'Try again');
      again.type = 'button';
      again.addEventListener('click', function () { location.reload(); });
      box.appendChild(again);
      screen.appendChild(box);
      (document.body || document.documentElement).appendChild(screen);
    }
    screen.querySelector('[data-maint-msg]').textContent = v.message || 'Everything you saved is safe. Please come back a little later.';
    var paintLeft = function () {
      var u = v.ends_at ? until(v.ends_at) : '';
      screen.querySelector('[data-maint-left]').textContent = u ? 'Back in about ' + u + '.' : '';
      if (v.ends_at && new Date(v.ends_at) <= new Date()) refresh();
    };
    paintLeft();
    clearInterval(_tick);
    _tick = setInterval(paintLeft, 30000);
  }
  function hideScreen() {
    clearInterval(_tick);
    var s = document.getElementById('fluxSiteMaintenance');
    if (s) s.remove();
  }

  /* ---------- Site mode ---------- */

  /* A role (Owner Controls › Roles) can let its members keep using Flux during
     maintenance or keep saving while it is read-only. The database honours the
     same permissions (flux_site_read_only). */
  function roleCan(perm) {
    var v = window.FluxAppVisibility;
    return !!(v && v.can && v.can(perm));
  }

  var _wasReadOnly = false;
  var _lastSiteMode = null;
  function applySiteMode(v) {
    _lastSiteMode = v;
    var mode = (v && v.mode) || 'normal';
    var now = Date.now();
    var starts = v && v.starts_at ? new Date(v.starts_at).getTime() : 0;
    var ends = v && v.ends_at ? new Date(v.ends_at).getTime() : Infinity;
    var maintNow = mode === 'maintenance' && starts <= now && now < ends;
    var maintSoon = mode === 'maintenance' && starts > now;
    var owner = isOwner();
    var allowed = maintNow ? roleCan('site:maintenance') : roleCan('site:read_only');
    var readOnly = (mode === 'read_only' || maintNow) && !allowed;

    if (maintNow && !owner && !allowed) showScreen(v); else hideScreen();

    var s = stack();
    var old = s.querySelector('[data-notice="site"]');
    if (old) old.remove();
    if ((mode === 'read_only' || maintNow) && !owner && allowed) {
      s.insertBefore(banner('site', 'info',
        'Flux is ' + (maintNow ? 'in maintenance' : 'read-only') + ' for everyone else',
        'Your role lets you keep using it and saving as normal.'), s.firstChild);
    } else if (readOnly && (owner || !maintNow)) {
      s.insertBefore(banner('site', 'warning',
        owner ? 'You set Flux to ' + (maintNow ? 'maintenance' : 'read-only') : 'Flux is read-only for a little while',
        owner ? 'Everyone else cannot save or post. Switch back in Owner Controls › Site mode.'
          : (v.message ? v.message + '\n' : '') + 'You can look at everything, but changes are not being saved to the cloud yet. ' +
            'They stay on this device and save once Flux is back to normal. Do not sign out until then.'), s.firstChild);
    } else if (maintSoon) {
      s.insertBefore(banner('site', 'warning', 'Flux goes down for maintenance in ' + until(v.starts_at),
        (v.message ? v.message + '\n' : '') + 'Save what you are working on before then.'), s.firstChild);
    }

    /* Back to normal: push whatever piled up while saving was refused. */
    if (_wasReadOnly && !readOnly) {
      try { if (window._fluxSyncFailed && typeof window.forceSyncNow === 'function') window.forceSyncNow(); } catch (e) { /* the next edit saves it */ }
    }
    _wasReadOnly = readOnly;
  }

  /* ---------- Announcements ---------- */

  function closedIds() { var c = readJSON(CLOSED_KEY); return Array.isArray(c) ? c : []; }
  var _counted = {};

  function markSeen(id) {
    var s = session();
    if (!s.access_token || !s.user || _counted[id]) return;
    _counted[id] = true;
    fetch(SB_URL + '/rest/v1/rpc/flux_mark_announcement_read', {
      method: 'POST',
      headers: { apikey: SB_ANON, Authorization: 'Bearer ' + s.access_token, 'Content-Type': 'application/json' },
      body: JSON.stringify({ p_id: id }),
    }).catch(function () { /* a missed count is not worth an error */ });
  }

  function applyAnnouncements(rows) {
    var s = stack();
    Array.prototype.forEach.call(s.querySelectorAll('[data-notice^="ann-"]'), function (n) { n.remove(); });
    var closed = closedIds();
    rows.filter(function (a) {
      return (!a.app || a.app === APP) && (a.level === 'urgent' || closed.indexOf(a.id) < 0);
    }).slice(0, 3).forEach(function (a) {
      s.appendChild(banner('ann-' + a.id, a.level, a.title, a.body, a.level === 'urgent' ? null : function () {
        var c = closedIds();
        c.push(a.id);
        try { localStorage.setItem(CLOSED_KEY, JSON.stringify(c.slice(-200))); } catch (e) { /* storage blocked */ }
      }));
      markSeen(a.id);
    });
  }

  /* ---------- Fetching ---------- */

  function refresh() {
    get('platform_settings?key=eq.site_mode&select=value').then(function (rows) {
      applySiteMode(rows && rows[0] ? rows[0].value : null);
    }, function () { /* unreachable: say nothing */ });
    get('flux_announcements?select=id,title,body,app,level&order=created_at.desc&limit=10').then(applyAnnouncements, function () {});
  }

  function start() {
    refresh();
    setInterval(refresh, REFRESH_MS);
    // This viewer's role permissions arrived or changed.
    window.addEventListener('flux-app-visibility', function () {
      if (_lastSiteMode) applySiteMode(_lastSiteMode);
    });
    document.addEventListener('visibilitychange', function () {
      if (document.visibilityState === 'visible') refresh();
    });
  }

  window.FluxSiteNotices = { refresh: refresh, app: APP };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
})();
