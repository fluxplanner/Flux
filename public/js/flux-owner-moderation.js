/* ============================================================================
   FLUX · Owner moderation

   Two halves, both added after the 2026-11-05 incident:

     · Everyone — on load and on sign-in, report this browser's device id, and
       show a lock screen if the server says this person, address or device is
       banned.
     · Owner — the Moderation tab in Owner Controls: the archive of everything
       posted publicly, the accounts seen with their addresses and devices,
       bans, and the saved-for-report list.

   Enforcement lives on the server (flux_check_request), not here. The lock
   screen is only what a banned person sees, so deleting this file from a
   browser gets them a broken app rather than access.

   "Device" is a random id kept in this browser, not a hardware id. Web pages
   cannot read one. Fingerprinting was rejected on purpose: school-issued laptops
   are near identical, so a fingerprint ban would catch innocent classmates.

   Everything shown in the archive was written by other people, intruders
   included, so it goes through esc() and buttons carry data-* attributes rather
   than inline handlers.
   ========================================================================== */
(function () {
  'use strict';
  if (window.FluxOwnerModeration) return;

  var DEVICE_KEY = 'flux_device_id_v1';
  var RECHECK_MS = 5 * 60 * 1000;
  var LOG_LIMIT = 300;
  var _view = 'archive';
  var _lastUser = null;

  function sb() {
    try { return typeof window.getSB === 'function' ? window.getSB() : null; }
    catch (e) { return null; }
  }
  function me() {
    try { return window.currentUser || null; } catch (e) { return null; }
  }
  function esc(v) {
    return String(v == null ? '' : v).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function toast(msg, kind) {
    try { if (typeof window.showToast === 'function') window.showToast(msg, kind || 'info'); }
    catch (e) { /* a missing toast must not stop the action */ }
  }
  function when(v) {
    var d = new Date(v);
    return isNaN(d) ? '' : d.toLocaleString();
  }

  /* ---------- Device id and ban check, for everyone ---------- */

  function randomId() {
    if (window.crypto && crypto.randomUUID) return crypto.randomUUID();
    var bytes = crypto.getRandomValues(new Uint8Array(16));
    return Array.prototype.map.call(bytes, function (b) {
      return ('0' + b.toString(16)).slice(-2);
    }).join('');
  }
  function readCookie() {
    var m = document.cookie.match(new RegExp('(?:^|; )' + DEVICE_KEY + '=([a-f0-9-]+)'));
    return m ? m[1] : '';
  }
  /* Kept in two places so that clearing one does not hand out a new id. */
  function deviceId() {
    var id = '';
    try { id = localStorage.getItem(DEVICE_KEY) || ''; } catch (e) { /* private mode */ }
    id = id || readCookie() || randomId();
    try { localStorage.setItem(DEVICE_KEY, id); } catch (e) { /* private mode */ }
    document.cookie = DEVICE_KEY + '=' + id + ';path=/;max-age=63072000;SameSite=Lax;Secure';
    return id;
  }

  function showLock() {
    if (document.getElementById('fluxBanLock')) return;
    var el = document.createElement('div');
    el.id = 'fluxBanLock';
    el.setAttribute('role', 'alertdialog');
    el.setAttribute('aria-modal', 'true');
    el.style.cssText = 'position:fixed;inset:0;z-index:2147483647;display:flex;align-items:center;' +
      'justify-content:center;padding:24px;background:#0b0d12;color:#f2f4f8;text-align:center;' +
      'font-family:system-ui,sans-serif';
    el.innerHTML = '<div style="max-width:420px"><h1 style="font-size:1.4rem;margin:0 0 10px">' +
      'Access to Flux has been removed</h1><p style="margin:0;line-height:1.6;opacity:.8">' +
      'This account, device or network has been blocked. If you think this is a mistake, ' +
      'speak to your school.</p></div>';
    document.body.appendChild(el);
  }

  function isBanError(err) {
    return !!err && (err.code === 'PT403' || err.message === 'flux_banned');
  }

  function checkIn() {
    var c = sb();
    if (!c) return;
    try {
      c.rpc('flux_device_checkin', { p_device: deviceId() }).then(function (res) {
        if (isBanError(res.error) || (res.data && res.data.banned)) showLock();
      }, function () { /* being offline is not being banned */ });
    } catch (e) { /* the check must never break the planner */ }
  }

  function watchSignIn() {
    var u = me();
    var id = u ? u.id : null;
    if (id !== _lastUser) {
      _lastUser = id;
      checkIn();
    }
  }

  /* ---------- Owner tab ---------- */

  var BTN = 'flux-mod-btn';
  var BTN_STYLE = 'padding:5px 10px;font-size:.7rem;font-weight:700;border-radius:8px;cursor:pointer;' +
    'background:var(--card2,transparent);color:var(--text,inherit);border:1px solid var(--border)';

  function button(label, action, data) {
    var attrs = Object.keys(data || {}).map(function (k) {
      return ' data-' + k + '="' + esc(data[k]) + '"';
    }).join('');
    return '<button type="button" class="' + BTN + '" style="' + BTN_STYLE + '" data-act="' +
      esc(action) + '"' + attrs + '>' + esc(label) + '</button>';
  }
  function card(inner) {
    return '<div style="padding:10px 12px;border:1px solid var(--border);border-radius:10px;' +
      'margin-bottom:8px;font-size:.76rem;line-height:1.5;word-break:break-word">' + inner + '</div>';
  }
  function muted(text) {
    return '<span style="color:var(--muted)">' + esc(text) + '</span>';
  }

  function contentText(row) {
    var c = row.content || {};
    var parts = [c.title, c.body, c.content, c.message, c.note].filter(Boolean);
    if (parts.length) return parts.join(' — ');
    return JSON.stringify(c);
  }

  async function renderArchive(body) {
    var res = await sb().from('flux_public_content_log').select('*')
      .order('created_at', { ascending: false }).limit(LOG_LIMIT);
    if (res.error) throw res.error;
    var rows = res.data || [];
    window.__fluxModArchive = rows;
    body.innerHTML =
      '<p style="font-size:.76rem;color:var(--muted2);margin:0 0 10px">Every banner, announcement, ' +
      'feed post, assignment and no-homework day, from anyone who can post, kept even after it is ' +
      'edited or deleted. Showing the newest ' + LOG_LIMIT + '.</p>' +
      '<div style="margin-bottom:10px">' + button('Download CSV', 'archive-csv') + '</div>' +
      (rows.length ? rows.map(function (r) {
        return card(
          '<b>' + esc(r.source) + '</b> · ' + esc(r.action) + ' · ' + muted(when(r.created_at)) +
          '<div style="margin:4px 0">' + esc(contentText(r)) + '</div>' +
          muted('By ' + (r.author_label || 'unknown') + (r.author_ip ? ' · ' + r.author_ip : ''))
        );
      }).join('') : muted('Nothing has been posted since the archive started.'));
  }

  function downloadCsv() {
    var rows = window.__fluxModArchive || [];
    var cell = function (v) { return '"' + String(v == null ? '' : v).replace(/"/g, '""') + '"'; };
    var lines = ['time,source,action,author,author_id,ip,content'].concat(rows.map(function (r) {
      return [r.created_at, r.source, r.action, r.author_label, r.author_id, r.author_ip, contentText(r)]
        .map(cell).join(',');
    }));
    var a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([lines.join('\n')], { type: 'text/csv' }));
    a.download = 'flux-public-archive.csv';
    a.click();
    URL.revokeObjectURL(a.href);
  }

  async function renderPeople(body) {
    var res = await sb().rpc('flux_owner_user_intel');
    if (res.error) throw res.error;
    var rows = res.data || [];
    body.innerHTML =
      '<p style="font-size:.76rem;color:var(--muted2);margin:0 0 10px">Addresses and devices appear ' +
      'here the next time each person opens Flux. Roles are set in Users &amp; roster.</p>' +
      (rows.length ? rows.map(function (r) {
        var shared = Number(r.accounts_on_ip) > 1;
        return card(
          '<b>' + esc(r.display_name || r.username || r.user_id) + '</b> ' +
          muted('@' + (r.username || 'deleted') + ' · ' + (r.role || 'no role')) +
          '<div>' + esc(r.ip || 'no address') +
          (shared ? ' <b style="color:var(--red)">shared by ' + esc(r.accounts_on_ip) + ' accounts</b>' : '') +
          '</div>' + muted('Device ' + r.device_id + ' · last seen ' + when(r.last_seen)) +
          '<div style="display:flex;flex-wrap:wrap;gap:6px;margin-top:8px">' +
          button('Ban account', 'ban-user', { value: r.user_id, label: r.username || r.user_id, deleted: r.deleted ? '1' : '' }) +
          (r.ip ? button('Ban IP', 'ban-ip', { value: r.ip, shared: r.accounts_on_ip }) : '') +
          button('Ban device', 'ban-device', { value: r.device_id, label: r.username || '' }) +
          button('Save to report', 'report', { value: r.user_id }) +
          '</div>'
        );
      }).join('') : muted('Nobody has checked in yet.'));
  }

  async function renderBans(body) {
    var res = await sb().from('flux_bans').select('*').eq('active', true)
      .order('created_at', { ascending: false });
    if (res.error) throw res.error;
    var rows = res.data || [];
    body.innerHTML =
      '<p style="font-size:.76rem;color:var(--muted2);margin:0 0 10px">An IP ban blocks everyone on ' +
      'that network, and all of a school shares one address. A device ban stops one browser, so ' +
      'another browser or a private window gets around it.</p>' +
      '<div style="display:flex;gap:6px;margin-bottom:12px">' +
      '<input id="fluxModIp" class="flux-mod-input" type="text" placeholder="IP address" ' +
      'style="flex:1;min-width:0;padding:6px 10px;border-radius:8px;border:1px solid var(--border);' +
      'background:transparent;color:inherit">' + button('Ban this IP', 'ban-ip-typed') + '</div>' +
      (rows.length ? rows.map(function (r) {
        return card('<b>' + esc(r.kind) + '</b> ' + esc(r.label || r.value) +
          '<div>' + muted((r.reason || 'No reason given') + ' · ' + when(r.created_at)) + '</div>' +
          '<div style="margin-top:8px">' + button('Lift ban', 'lift', { id: r.id, kind: r.kind, value: r.value }) + '</div>');
      }).join('') : muted('No active bans.'));
  }

  async function renderReports(body) {
    var res = await sb().from('flux_reported_users').select('*')
      .order('saved_at', { ascending: false });
    if (res.error) throw res.error;
    var rows = res.data || [];
    window.__fluxModReports = rows;
    body.innerHTML =
      '<p style="font-size:.76rem;color:var(--muted2);margin:0 0 10px">Saved copies of an account, ' +
      'its addresses and its public posts. These stay even if the account is deleted.</p>' +
      (rows.length ? rows.map(function (r) {
        return card('<b>' + esc(r.display_name || r.username || r.user_id) + '</b> ' +
          muted('@' + (r.username || 'unknown') + ' · saved ' + when(r.saved_at)) +
          '<div>' + esc(r.reason || 'No reason given') + '</div>' +
          (r.notes ? '<div>' + esc(r.notes) + '</div>' : '') +
          '<div style="margin-top:8px">' + button('Download record', 'report-download', { value: r.user_id }) + '</div>');
      }).join('') : muted('Nobody has been saved yet.'));
  }

  var VIEWS = {
    archive: { label: 'Public archive', paint: renderArchive },
    people: { label: 'People & devices', paint: renderPeople },
    bans: { label: 'Bans', paint: renderBans },
    reports: { label: 'Saved for report', paint: renderReports },
  };

  async function addBan(kind, value, label, reason) {
    return sb().from('flux_bans').insert({
      kind: kind, value: value, label: label || null, reason: reason || null,
      created_by: me() ? me().id : null,
    });
  }
  /* The account ban is what stops new sign-ins. flux_bans is what stops the
     hour-long token they already hold. Both, or the ban leaks. */
  async function setAccountBan(userId, banned) {
    if (!window.FluxRelease || !FluxRelease.invokeOwnerReleaseAdmin) return;
    await FluxRelease.invokeOwnerReleaseAdmin({ action: 'auth_ban_user', userId: userId, banned: banned });
  }
  function audit(action, detail) {
    try { if (typeof window.ownerAuditAppend === 'function') window.ownerAuditAppend(action, detail); }
    catch (e) { /* the audit trail must not block the action */ }
  }

  async function handle(el, mount) {
    var act = el.getAttribute('data-act');
    var value = el.getAttribute('data-value') || '';
    if (act === 'archive-csv') return downloadCsv();
    if (act === 'report-download') {
      var row = (window.__fluxModReports || []).find(function (r) { return r.user_id === value; });
      var link = document.createElement('a');
      link.href = URL.createObjectURL(new Blob([JSON.stringify(row, null, 2)], { type: 'application/json' }));
      link.download = 'flux-report-' + value + '.json';
      link.click();
      URL.revokeObjectURL(link.href);
      return;
    }
    if (act === 'report') {
      var why = window.prompt('Why are you saving this person? (optional)', '');
      if (why === null) return;
      var saved = await sb().rpc('flux_owner_save_report', { p_user: value, p_reason: why || null, p_notes: null });
      if (saved.error) throw saved.error;
      audit('moderation_save_report', { userId: value });
      toast('Saved for report', 'success');
      return;
    }
    if (act === 'lift') {
      if (!window.confirm('Lift this ban?')) return;
      var lifted = await sb().from('flux_bans')
        .update({ active: false, lifted_at: new Date().toISOString() })
        .eq('id', el.getAttribute('data-id'));
      if (lifted.error) throw lifted.error;
      if (el.getAttribute('data-kind') === 'user') await setAccountBan(value, false);
      audit('moderation_lift_ban', { kind: el.getAttribute('data-kind'), value: value });
      toast('Ban lifted', 'success');
      return paint(mount);
    }

    var kind = act === 'ban-user' ? 'user' : act === 'ban-device' ? 'device' : 'ip';
    var label = el.getAttribute('data-label') || '';
    if (act === 'ban-ip-typed') {
      var input = document.getElementById('fluxModIp');
      value = input ? input.value.trim() : '';
      if (!/^[0-9a-fA-F:.]{3,45}$/.test(value)) return toast('Enter a valid IP address', 'error');
    }
    if (kind === 'ip') {
      var shared = Number(el.getAttribute('data-shared') || 0);
      var warning = shared > 1
        ? 'This address is shared by ' + shared + ' accounts. Banning it blocks ALL of them, and everyone else on that network. Continue?'
        : 'This blocks everyone on ' + value + ', including anyone else on that network. Continue?';
      if (!window.confirm(warning)) return;
    }
    var reason = window.prompt('Reason for this ban?', '');
    if (reason === null) return;
    var added = await addBan(kind, value, label, reason);
    if (added.error && added.error.code !== '23505') throw added.error;
    if (kind === 'user' && !el.getAttribute('data-deleted')) await setAccountBan(value, true);
    audit('moderation_ban', { kind: kind, value: value, reason: reason });
    toast('Banned', 'success');
  }

  async function paint(mount) {
    var tabs = Object.keys(VIEWS).map(function (k) {
      var on = k === _view;
      return '<button type="button" class="' + BTN + '" data-view="' + k + '" style="' + BTN_STYLE +
        (on ? ';background:var(--accent);color:#fff;border-color:var(--accent)' : '') + '">' +
        esc(VIEWS[k].label) + '</button>';
    }).join('');
    mount.innerHTML = '<div style="display:flex;flex-wrap:wrap;gap:6px;margin-bottom:12px">' + tabs +
      '</div><div id="fluxModBody">Loading…</div>';
    var body = mount.querySelector('#fluxModBody');
    try {
      await VIEWS[_view].paint(body);
    } catch (e) {
      body.textContent = 'Could not load: ' + (e && e.message ? e.message : e);
    }
  }

  function render(mount) {
    if (!mount || !sb()) return;
    if (!mount.dataset.fluxModBound) {
      mount.dataset.fluxModBound = '1';
      mount.addEventListener('click', function (ev) {
        var tab = ev.target.closest('[data-view]');
        if (tab) {
          _view = tab.getAttribute('data-view');
          paint(mount);
          return;
        }
        var el = ev.target.closest('[data-act]');
        if (!el) return;
        handle(el, mount).catch(function (e) {
          toast(e && e.message ? e.message : 'That did not work', 'error');
        });
      });
    }
    paint(mount);
  }

  window.FluxOwnerModeration = { render: render, checkIn: checkIn };

  setInterval(watchSignIn, 2000);
  setInterval(checkIn, RECHECK_MS);
  setTimeout(checkIn, 1500);
})();
