/* ============================================================================
   FLUX · Owner Controls › Moderation

   Everything here prints text written by other people, intruders included, so
   it all goes through esc(), and buttons carry data-* attributes rather than
   inline handlers. Enforcement is on the server (flux_check_request and
   flux_enforce_posting_rules); this is only the owner's view of it.

   The device check-in and lock screen everyone needs stay in the planner, in
   flux-owner-moderation.js.
   ========================================================================== */
(function () {
  'use strict';

  var LOG_LIMIT = 300;
  /* Which archive sources flux_owner_remove_content can take down. */
  var REMOVABLE = {
    school_feed: 1, school_announcements: 1, teacher_announcements: 1,
    teacher_assignments: 1, no_homework_days: 1, flux_school_broadcast: 1,
  };
  var DURATIONS = [
    ['', 'Until I lift it'], ['1', '1 hour'], ['24', '1 day'], ['168', '1 week'], ['720', '30 days'],
  ];
  var KIND_NAMES = { user: 'Account ban', ip: 'IP ban', device: 'Device ban', mute: 'Posting off' };

  var _view = 'archive';
  var _person = null;
  var _archive = [];
  var _reports = [];
  var _archiveFilter = { q: '', source: '', flaggedOnly: false };
  var _peopleQuery = '';

  function sb() { return window.getSB(); }
  function me() { return window.currentUser; }
  function esc(v) {
    return String(v == null ? '' : v).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function toast(msg, kind) { window.showToast(msg, kind || 'info'); }
  function when(v) {
    if (!v) return 'never';
    var d = new Date(v);
    return isNaN(d) ? '' : d.toLocaleString();
  }
  function audit(action, detail) {
    try { window.ownerAuditAppend(action, detail); } catch (e) { /* the audit trail must not block the action */ }
  }
  function button(label, action, data, tone) {
    var attrs = Object.keys(data || {}).map(function (k) {
      return ' data-' + k + '="' + esc(data[k]) + '"';
    }).join('');
    return '<button type="button" class="own-btn own-btn--sm' + (tone ? ' own-btn--' + tone : '') +
      '" data-act="' + esc(action) + '"' + attrs + '>' + esc(label) + '</button>';
  }
  function card(inner, cls) { return '<div class="own-card' + (cls ? ' ' + cls : '') + '">' + inner + '</div>'; }
  function muted(text) { return '<span class="own-muted">' + esc(text) + '</span>'; }
  function intro(text) { return '<p class="own-intro">' + esc(text) + '</p>'; }
  function actions(html) { return '<div class="own-actions">' + html + '</div>'; }

  /* The migration that ships with this app may not be applied yet. */
  function missingDb(e) {
    return !!e && (e.code === 'PGRST202' || e.code === '42P01' || e.code === 'PGRST205' || /Could not find the function/i.test(e.message || ''));
  }
  function friendly(e) {
    if (missingDb(e)) return 'This needs the database update that ships with Owner Controls, which has not been applied yet.';
    return (e && e.message) || 'That did not work';
  }

  function contentText(row) {
    var c = row.content || {};
    var parts = [c.title, c.body, c.content, c.message, c.note, c.description].filter(Boolean);
    return parts.length ? parts.join(' — ') : JSON.stringify(c);
  }
  function watchWords() {
    var raw = window.getPlatformConfig().modWatchWords;
    return Array.isArray(raw) ? raw : [];
  }
  function flagWord(text) {
    var hay = String(text || '').toLowerCase();
    return watchWords().find(function (w) { return hay.indexOf(String(w).toLowerCase()) >= 0; }) || '';
  }

  /* ---------- A small form in a dialog, in place of prompt() ---------- */

  function ask(opts) {
    return new Promise(function (resolve) {
      var box = document.createElement('dialog');
      box.className = 'own-dialog';
      var h = document.createElement('h2');
      h.textContent = opts.title;
      box.appendChild(h);
      if (opts.text) {
        var p = document.createElement('p');
        p.textContent = opts.text;
        box.appendChild(p);
      }
      var area = document.createElement('textarea');
      area.className = 'own-input';
      area.rows = 3;
      area.placeholder = opts.placeholder || '';
      area.value = opts.value || '';
      area.setAttribute('aria-label', opts.placeholder || opts.title);
      box.appendChild(area);
      var select = null;
      if (opts.duration) {
        select = document.createElement('select');
        select.className = 'own-input';
        select.setAttribute('aria-label', 'How long');
        DURATIONS.forEach(function (d) {
          var o = document.createElement('option');
          o.value = d[0];
          o.textContent = d[1];
          select.appendChild(o);
        });
        box.appendChild(select);
      }
      var row = document.createElement('div');
      row.className = 'own-actions';
      var ok = document.createElement('button');
      ok.type = 'button';
      ok.className = 'own-btn own-btn--' + (opts.tone || 'primary');
      ok.textContent = opts.confirm || 'OK';
      var no = document.createElement('button');
      no.type = 'button';
      no.className = 'own-btn';
      no.textContent = 'Cancel';
      row.append(ok, no);
      box.appendChild(row);
      function done(v) { box.close(); box.remove(); resolve(v); }
      ok.addEventListener('click', function () {
        if (opts.required && !area.value.trim()) { area.focus(); return; }
        done({ text: area.value.trim(), hours: select && select.value ? Number(select.value) : null });
      });
      no.addEventListener('click', function () { done(null); });
      box.addEventListener('cancel', function (e) { e.preventDefault(); done(null); });
      document.body.appendChild(box);
      box.showModal();
      area.focus();
    });
  }

  /* ---------- Views ---------- */

  async function renderArchive(body) {
    var res = await sb().from('flux_public_content_log').select('*')
      .order('created_at', { ascending: false }).limit(LOG_LIMIT);
    if (res.error) throw res.error;
    _archive = res.data || [];
    var sources = [];
    _archive.forEach(function (r) { if (sources.indexOf(r.source) < 0) sources.push(r.source); });
    body.innerHTML =
      intro('Every banner, announcement, feed post, assignment and no-homework day, from anyone who can post, ' +
        'kept even after it is edited or deleted. Showing the newest ' + LOG_LIMIT + '.') +
      '<div class="own-filters">' +
      '<input id="modArchiveQ" class="own-input" type="search" placeholder="Search posts and authors" aria-label="Search posts and authors" value="' + esc(_archiveFilter.q) + '">' +
      '<select id="modArchiveSource" class="own-input" aria-label="Kind of post"><option value="">Every kind</option>' +
      sources.map(function (s) { return '<option value="' + esc(s) + '"' + (s === _archiveFilter.source ? ' selected' : '') + '>' + esc(s) + '</option>'; }).join('') +
      '</select>' +
      '<label class="own-check"><input id="modArchiveFlagged" type="checkbox"' + (_archiveFilter.flaggedOnly ? ' checked' : '') + '> Only watch-word matches</label>' +
      button('Download CSV', 'archive-csv') + '</div><div id="modArchiveList"></div>';
    paintArchiveList(body);
    body.querySelector('#modArchiveQ').addEventListener('input', function (e) { _archiveFilter.q = e.target.value; paintArchiveList(body); });
    body.querySelector('#modArchiveSource').addEventListener('change', function (e) { _archiveFilter.source = e.target.value; paintArchiveList(body); });
    body.querySelector('#modArchiveFlagged').addEventListener('change', function (e) { _archiveFilter.flaggedOnly = e.target.checked; paintArchiveList(body); });
  }

  function archiveRows() {
    var q = _archiveFilter.q.trim().toLowerCase();
    return _archive.filter(function (r) {
      var text = contentText(r);
      if (_archiveFilter.source && r.source !== _archiveFilter.source) return false;
      if (_archiveFilter.flaggedOnly && !flagWord(text)) return false;
      return !q || (text + ' ' + (r.author_label || '') + ' ' + (r.author_ip || '')).toLowerCase().indexOf(q) >= 0;
    });
  }

  function archiveRow(r) {
    var flag = flagWord(contentText(r));
    var buttons = '';
    if (r.author_id) buttons += button('Open file', 'open-person', { value: r.author_id });
    if (REMOVABLE[r.source] && r.source_id && r.action !== 'DELETE') {
      buttons += button('Take down', 'take-down', { source: r.source, id: r.source_id }, 'danger');
    }
    return card(
      '<b>' + esc(r.source) + '</b> · ' + esc(r.action) + ' · ' + muted(when(r.created_at)) +
      (flag ? ' <span class="own-tag own-tag--warn">Matches “' + esc(flag) + '”</span>' : '') +
      '<div class="own-text">' + esc(contentText(r)) + '</div>' +
      muted('By ' + (r.author_label || 'unknown') + (r.author_ip ? ' · ' + r.author_ip : '')) +
      (buttons ? actions(buttons) : ''),
      flag ? 'own-card--warn' : ''
    );
  }

  function paintArchiveList(body) {
    var rows = archiveRows();
    body.querySelector('#modArchiveList').innerHTML = rows.length
      ? rows.map(archiveRow).join('')
      : muted(_archive.length ? 'Nothing matches that search.' : 'Nothing has been posted since the archive started.');
  }

  function downloadCsv() {
    var cell = function (v) { return '"' + String(v == null ? '' : v).replace(/"/g, '""') + '"'; };
    var lines = ['time,source,action,author,author_id,ip,content'].concat(archiveRows().map(function (r) {
      return [r.created_at, r.source, r.action, r.author_label, r.author_id, r.author_ip, contentText(r)].map(cell).join(',');
    }));
    saveFile('flux-public-archive.csv', lines.join('\n'), 'text/csv');
  }
  function saveFile(name, text, type) {
    var a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([text], { type: type }));
    a.download = name;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  function sightingButtons(s, username, userId) {
    return (s.ip ? button('Ban IP', 'ban-ip', { value: s.ip, shared: s.accounts_on_ip }, 'danger') : '') +
      button('Ban device', 'ban-device', { value: s.device_id, label: username || '', user: userId || '' }, 'danger');
  }
  function sightingLine(s) {
    var shared = Number(s.accounts_on_ip) > 1;
    return '<div class="own-text">' + esc(s.ip || 'no address') +
      (shared ? ' <b class="own-danger">shared by ' + esc(s.accounts_on_ip) + ' accounts</b>' : '') +
      '<br>' + muted('Device ' + s.device_id + ' · last seen ' + when(s.last_seen)) + '</div>';
  }

  async function renderPeople(body) {
    var res = await sb().rpc('flux_owner_user_intel');
    if (res.error) throw res.error;
    var byUser = new Map();
    (res.data || []).forEach(function (r) {
      if (!byUser.has(r.user_id)) byUser.set(r.user_id, Object.assign({}, r, { seen: [] }));
      byUser.get(r.user_id).seen.push(r);
    });
    var people = Array.from(byUser.values());
    body.innerHTML =
      intro('Addresses and devices appear here the next time each person opens Flux. Roles are set in Users & roster.') +
      '<div class="own-filters"><input id="modPeopleQ" class="own-input" type="search" placeholder="Search name, username, IP or device" aria-label="Search people" value="' + esc(_peopleQuery) + '"></div>' +
      '<div id="modPeopleList"></div>';
    function paintList() {
      var q = _peopleQuery.trim().toLowerCase();
      var rows = people.filter(function (p) {
        var hay = [p.display_name, p.username, p.role].concat(p.seen.map(function (s) { return s.ip + ' ' + s.device_id; })).join(' ').toLowerCase();
        return !q || hay.indexOf(q) >= 0;
      });
      body.querySelector('#modPeopleList').innerHTML = rows.length ? rows.map(function (p) {
        var label = p.username || p.user_id;
        return card(
          '<b>' + esc(p.display_name || label) + '</b> ' + muted('@' + (p.username || 'deleted') + ' · ' + (p.role || 'no role')) +
          p.seen.map(function (s) { return sightingLine(s) + actions(sightingButtons(s, p.username, p.user_id)); }).join('') +
          actions(
            button('Open file', 'open-person', { value: p.user_id }, 'primary') +
            button('Warn', 'warn', { value: p.user_id }) +
            button('Turn off posting', 'mute', { value: p.user_id, label: label }) +
            button('Ban account', 'ban-user', { value: p.user_id, label: label, deleted: p.deleted ? '1' : '' }, 'danger') +
            button('Save to report', 'report', { value: p.user_id })
          )
        );
      }).join('') : muted(people.length ? 'Nobody matches that search.' : 'Nobody has checked in yet.');
    }
    paintList();
    body.querySelector('#modPeopleQ').addEventListener('input', function (e) { _peopleQuery = e.target.value; paintList(); });
  }

  async function renderPerson(body) {
    var res = await sb().rpc('flux_owner_person', { p_user: _person });
    if (res.error) throw res.error;
    var f = res.data || {};
    var a = f.account || {};
    var pr = f.profile || {};
    var label = a.username || _person;
    var liveBans = (f.bans || []).filter(function (b) { return b.active && (!b.expires_at || new Date(b.expires_at) > new Date()); });
    var warnings = (f.actions || []).filter(function (x) { return x.kind === 'warning'; }).length;
    body.innerHTML =
      actions(button('← Back to people', 'view-people')) +
      card(
        '<h3 class="own-h3">' + esc(pr.display_name || label) + '</h3>' +
        muted('@' + (a.username || 'deleted') + ' · ' + (pr.role || 'no role') + (pr.school ? ' · ' + pr.school : '')) +
        '<div class="own-text">Joined ' + esc(when(a.created_at)) + ' · last sign-in ' + esc(when(a.last_sign_in_at)) + '</div>' +
        '<div class="own-tags">' +
        '<span class="own-tag' + (warnings ? ' own-tag--warn' : '') + '">' + warnings + ' warning' + (warnings === 1 ? '' : 's') + '</span>' +
        liveBans.map(function (b) { return '<span class="own-tag own-tag--danger">' + esc(KIND_NAMES[b.kind] || b.kind) + (b.expires_at ? ' until ' + esc(when(b.expires_at)) : '') + '</span>'; }).join('') +
        (f.report ? '<span class="own-tag">Saved for report</span>' : '') +
        '</div>' +
        actions(
          button('Warn', 'warn', { value: _person }) +
          button('Add note', 'note', { value: _person }) +
          button('Turn off posting', 'mute', { value: _person, label: label }) +
          button('Sign out everywhere', 'revoke', { value: _person }) +
          button('Save to report', 'report', { value: _person }) +
          button('Ban account', 'ban-user', { value: _person, label: label, deleted: a.username ? '' : '1' }, 'danger')
        )
      ) +
      '<h3 class="own-h3">Addresses and devices</h3>' +
      ((f.sightings || []).length ? f.sightings.map(function (s) {
        return card(sightingLine(s) + '<div class="own-muted own-small">' + esc(s.user_agent || '') + '</div>' + actions(sightingButtons(s, a.username, _person)));
      }).join('') : muted('Not seen since sightings began.')) +
      '<h3 class="own-h3">Public posts</h3>' +
      ((f.posts || []).length ? f.posts.map(function (r) { return archiveRow(Object.assign({ author_label: label }, r, { author_id: null })); }).join('') : muted('No public posts.')) +
      '<h3 class="own-h3">Bans</h3>' +
      ((f.bans || []).length ? f.bans.map(banRow).join('') : muted('Never banned.')) +
      '<h3 class="own-h3">Warnings and notes</h3>' +
      ((f.actions || []).length ? f.actions.map(actionRow).join('') : muted('Nothing recorded.'));
  }

  function banRow(r) {
    var expired = r.expires_at && new Date(r.expires_at) <= new Date();
    var live = r.active && !expired;
    return card('<b>' + esc(KIND_NAMES[r.kind] || r.kind) + '</b> ' + esc(r.label || r.value) +
      '<div>' + muted((r.reason || 'No reason given') + ' · ' + when(r.created_at) +
        (r.expires_at ? (expired ? ' · ended ' : ' · ends ') + when(r.expires_at) : '') +
        (!r.active ? ' · lifted' : '')) + '</div>' +
      (live ? actions(button(r.kind === 'mute' ? 'Turn posting back on' : 'Lift ban', 'lift', { id: r.id, kind: r.kind, value: r.value })) : ''));
  }

  async function renderBans(body) {
    var res = await sb().from('flux_bans').select('*').eq('active', true).order('created_at', { ascending: false });
    if (res.error) throw res.error;
    var rows = (res.data || []).filter(function (r) { return !r.expires_at || new Date(r.expires_at) > new Date(); });
    body.innerHTML =
      intro('An IP ban blocks everyone on that network, and all of a school shares one address. A device ban stops one ' +
        'browser, so another browser or a private window gets around it. Turning off posting leaves the rest of Flux working for that person.') +
      '<div class="own-filters"><input id="fluxModIp" class="own-input" type="text" placeholder="IP address" aria-label="IP address">' + button('Ban this IP', 'ban-ip-typed', null, 'danger') + '</div>' +
      '<div class="own-filters"><input id="fluxModUser" class="own-input" type="text" placeholder="Username" aria-label="Username">' + button('Ban this account', 'ban-username', null, 'danger') + button('Open file', 'open-username') + '</div>' +
      (rows.length ? rows.map(banRow).join('') : muted('No active bans.'));
  }

  async function renderNewAccounts(body) {
    var res = await sb().rpc('flux_owner_new_accounts', { p_days: 14 });
    if (res.error) throw res.error;
    var rows = res.data || [];
    body.innerHTML = intro('Accounts created in the last 14 days, newest first. Check these after any sign of trouble.') +
      (rows.length ? rows.map(function (r) {
        var label = r.username || r.user_id;
        return card('<b>' + esc(r.display_name || label) + '</b> ' + muted('@' + label + ' · ' + (r.role || 'no role')) +
          '<div>' + muted('Joined ' + when(r.created_at) + ' · last sign-in ' + when(r.last_sign_in_at)) + '</div>' +
          actions(button('Open file', 'open-person', { value: r.user_id }, 'primary') + button('Ban account', 'ban-user', { value: r.user_id, label: label }, 'danger')));
      }).join('') : muted('No new accounts.'));
  }

  async function renderRooms(body) {
    var res = await sb().rpc('flux_owner_study_rooms');
    if (res.error) throw res.error;
    var rows = res.data || [];
    body.innerHTML = intro('Study rooms students have opened. Closing one removes it for everyone in it.') +
      (rows.length ? rows.map(function (r) {
        return card('<b>' + esc(r.label || r.code) + '</b> ' +
          (r.active ? '<span class="own-tag own-tag--ok">Open</span>' : '<span class="own-tag">Ended</span>') +
          '<div>' + muted('Code ' + r.code + ' · host @' + (r.host_username || 'unknown') + ' · ' + (r.participants || 0) + ' in room · last active ' + when(r.last_seen_at)) + '</div>' +
          actions((r.host_id ? button('Open host file', 'open-person', { value: r.host_id }) : '') +
            button('Close room', 'take-down', { source: 'flux_study_rooms', id: r.id, reload: 1 }, 'danger')));
      }).join('') : muted('No study rooms.'));
  }

  async function renderReports(body) {
    var res = await sb().from('flux_reported_users').select('*').order('saved_at', { ascending: false });
    if (res.error) throw res.error;
    _reports = res.data || [];
    body.innerHTML = intro('Saved copies of an account, its addresses and its public posts. These stay even if the account is deleted.') +
      (_reports.length ? _reports.map(function (r) {
        return card('<b>' + esc(r.display_name || r.username || r.user_id) + '</b> ' + muted('@' + (r.username || 'unknown') + ' · saved ' + when(r.saved_at)) +
          '<div>' + esc(r.reason || 'No reason given') + '</div>' + (r.notes ? '<div>' + esc(r.notes) + '</div>' : '') +
          actions(button('Open file', 'open-person', { value: r.user_id }) + button('Download record', 'report-download', { value: r.user_id })));
      }).join('') : muted('Nobody has been saved yet.'));
  }

  async function renderRules(body) {
    var state = await sb().from('platform_settings').select('value').eq('key', 'posting_lockdown').maybeSingle();
    var locked = !!(state.data && state.data.value && state.data.value.on);
    body.innerHTML =
      card('<h3 class="own-h3">Posting lockdown</h3>' +
        '<p class="own-text">Stops every banner, announcement, feed post, assignment and no-homework day from anyone but you. ' +
        'Already-posted content stays up, and everything else in Flux keeps working. Use it when something bad is being posted faster than you can remove it.</p>' +
        (locked ? '<span class="own-tag own-tag--danger">Posting is paused for everyone</span>' : '<span class="own-tag own-tag--ok">Posting is on</span>') +
        actions(locked ? button('Allow posting again', 'lockdown-off', null, 'primary') : button('Pause all posting', 'lockdown-on', null, 'danger')),
        locked ? 'own-card--danger' : '') +
      card('<h3 class="own-h3">Watch words</h3>' +
        '<p class="own-text">Posts containing these are marked in the Public archive and counted on Today. One per line. Only you can see this list. It marks posts and does not block them.</p>' +
        '<textarea id="modWatchWords" class="own-input" rows="6" aria-label="Watch words">' + esc(watchWords().join('\n')) + '</textarea>' +
        actions(button('Save watch words', 'save-watch', null, 'primary')));
  }

  function actionRow(a) {
    return card('<b>' + esc(a.kind) + '</b> · ' + muted(when(a.created_at)) +
      (a.detail ? '<div class="own-text">' + esc(a.detail) + '</div>' : '') +
      (a.user_id && _view !== 'person' ? actions(button('Open file', 'open-person', { value: a.user_id })) : ''));
  }
  async function renderLog(body) {
    var res = await sb().from('flux_mod_actions').select('*').order('created_at', { ascending: false }).limit(200);
    if (res.error) throw res.error;
    body.innerHTML = intro('Warnings, notes, take-downs and lockdowns. Kept on the server, and kept if the account is deleted.') +
      ((res.data || []).length ? res.data.map(actionRow).join('') : muted('Nothing recorded yet.'));
  }

  var VIEWS = {
    archive: { label: 'Public archive', paint: renderArchive },
    people: { label: 'People & devices', paint: renderPeople },
    newaccounts: { label: 'New accounts', paint: renderNewAccounts },
    bans: { label: 'Bans', paint: renderBans },
    rooms: { label: 'Study rooms', paint: renderRooms },
    rules: { label: 'Lockdown & watch words', paint: renderRules },
    reports: { label: 'Saved for report', paint: renderReports },
    log: { label: 'Action log', paint: renderLog },
    person: { label: 'Person file', paint: renderPerson, hidden: true },
  };

  /* ---------- Actions ---------- */

  async function logAction(userId, kind, detail) {
    var res = await sb().from('flux_mod_actions').insert({ user_id: userId || null, kind: kind, detail: detail || null, created_by: me() ? me().id : null });
    if (res.error && !missingDb(res.error)) throw res.error;
  }

  /* The account ban is what stops new sign-ins. flux_bans is what stops the
     hour-long token they already hold. A permanent ban needs both, or it leaks.
     A timed ban is flux_bans alone: the account has to work again by itself. */
  async function setAccountBan(userId, banned) {
    await window.FluxRelease.invokeOwnerReleaseAdmin({ action: 'auth_ban_user', userId: userId, banned: banned });
  }

  async function addBan(kind, value, label, reason, hours) {
    var expires = hours ? new Date(Date.now() + hours * 3600000).toISOString() : null;
    var res = await sb().rpc('flux_owner_ban', { p_kind: kind, p_value: value, p_label: label || null, p_reason: reason || null, p_expires: expires });
    if (res.error && missingDb(res.error) && !hours && kind !== 'mute') {
      // Before the update is applied, a plain ban must still work.
      res = await sb().from('flux_bans').insert({ kind: kind, value: value, label: label || null, reason: reason || null, created_by: me() ? me().id : null });
      if (res.error && res.error.code === '23505') return;
    }
    if (res.error) throw res.error;
  }

  async function doBan(kind, value, label, opts) {
    var o = opts || {};
    if (kind === 'ip') {
      var shared = Number(o.shared || 0);
      var warning = shared > 1
        ? 'This address is shared by ' + shared + ' accounts. Banning it blocks ALL of them, and everyone else on that network. Continue?'
        : 'This blocks everyone on ' + value + ', including anyone else on that network. Continue?';
      if (!window.confirm(warning)) return false;
    }
    var isMute = kind === 'mute';
    var form = await ask({
      title: isMute ? 'Turn off posting for ' + (label || value) : 'Ban ' + (label || value),
      placeholder: 'Reason',
      duration: true,
      confirm: isMute ? 'Turn off posting' : 'Ban',
      tone: 'danger',
    });
    if (!form) return false;
    await addBan(kind, value, label, form.text, form.hours);
    if (kind === 'user' && !o.deleted && !form.hours) await setAccountBan(value, true);
    var who = kind === 'user' || kind === 'mute' ? value : o.user;
    if (who) await logAction(who, kind === 'mute' ? 'posting off' : kind + ' ban', form.text + (form.hours ? ' (' + form.hours + 'h)' : ''));
    audit('moderation_ban', { kind: kind, value: value, reason: form.text, hours: form.hours });
    toast(isMute ? 'Posting turned off' : 'Banned', 'success');
    return true;
  }

  async function findUsername(typed) {
    var found = await sb().rpc('flux_owner_find_user', { p_username: typed });
    if (found.error) throw found.error;
    if (!found.data) toast('No account with that username', 'error');
    return found.data || null;
  }

  function openPerson(userId, mount) {
    _person = userId;
    _view = 'person';
    return paint(mount);
  }

  async function handle(el, mount) {
    var act = el.getAttribute('data-act');
    var value = el.getAttribute('data-value') || '';
    var label = el.getAttribute('data-label') || '';

    if (act === 'archive-csv') return downloadCsv();
    if (act === 'open-person') return openPerson(value, mount);
    if (act === 'view-people') { _view = 'people'; return paint(mount); }
    if (act === 'report-download') {
      var row = _reports.find(function (r) { return r.user_id === value; });
      return saveFile('flux-report-' + value + '.json', JSON.stringify(row, null, 2), 'application/json');
    }
    if (act === 'report') {
      var why = await ask({ title: 'Save this person to report', placeholder: 'Why? (optional)', confirm: 'Save' });
      if (!why) return;
      var saved = await sb().rpc('flux_owner_save_report', { p_user: value, p_reason: why.text || null, p_notes: null });
      if (saved.error) throw saved.error;
      audit('moderation_save_report', { userId: value });
      return toast('Saved for report', 'success');
    }
    if (act === 'warn') {
      var w = await ask({ title: 'Warn this person', text: 'They see this as a pop-up the next time they open the planner, and it goes on their file.', placeholder: 'What they need to stop doing', required: true, confirm: 'Send warning' });
      if (!w) return;
      var sent = await window.FluxOwnerMessages.send(value, 'A warning from Flux', w.text);
      if (!sent) throw new Error('Could not send: ' + window.FluxOwnerMessages.lastError());
      await logAction(value, 'warning', w.text);
      audit('moderation_warn', { userId: value });
      toast('Warning sent', 'success');
      return _view === 'person' ? paint(mount) : undefined;
    }
    if (act === 'note') {
      var n = await ask({ title: 'Add a note', text: 'Only you can see this.', placeholder: 'Note', required: true, confirm: 'Add note' });
      if (!n) return;
      var noted = await sb().from('flux_mod_actions').insert({ user_id: value, kind: 'note', detail: n.text, created_by: me().id });
      if (noted.error) throw noted.error;
      return paint(mount);
    }
    if (act === 'revoke') {
      if (!window.confirm('Sign this person out on every device?')) return;
      await window.FluxRelease.invokeOwnerReleaseAdmin({ action: 'auth_revoke_sessions', userId: value });
      await logAction(value, 'signed out', 'Signed out everywhere');
      audit('moderation_revoke', { userId: value });
      return toast('Signed out everywhere', 'success');
    }
    if (act === 'take-down') {
      var t = await ask({ title: 'Take this down', text: 'It disappears for everyone straight away. The archive keeps a copy.', placeholder: 'Reason (optional)', confirm: 'Take down', tone: 'danger' });
      if (!t) return;
      var gone = await sb().rpc('flux_owner_remove_content', { p_source: el.getAttribute('data-source'), p_id: el.getAttribute('data-id'), p_reason: t.text || null });
      if (gone.error) throw gone.error;
      audit('moderation_take_down', { source: el.getAttribute('data-source'), id: el.getAttribute('data-id') });
      toast(gone.data ? 'Taken down' : 'It was already gone', gone.data ? 'success' : 'info');
      return paint(mount);
    }
    if (act === 'lift') {
      if (!window.confirm('Lift this?')) return;
      var lifted = await sb().from('flux_bans').update({ active: false, lifted_at: new Date().toISOString() }).eq('id', el.getAttribute('data-id'));
      if (lifted.error) throw lifted.error;
      if (el.getAttribute('data-kind') === 'user') await setAccountBan(value, false);
      audit('moderation_lift_ban', { kind: el.getAttribute('data-kind'), value: value });
      toast('Lifted', 'success');
      return paint(mount);
    }
    if (act === 'lockdown-on' || act === 'lockdown-off') {
      var on = act === 'lockdown-on';
      if (on && !window.confirm('Pause all public posting for everyone but you?')) return;
      var locked = await sb().rpc('flux_owner_set_lockdown', { p_on: on });
      if (locked.error) throw locked.error;
      audit('moderation_lockdown', { on: on });
      toast(on ? 'All posting paused' : 'Posting allowed again', 'success');
      return paint(mount);
    }
    if (act === 'save-watch') {
      var words = document.getElementById('modWatchWords').value.split('\n').map(function (s) { return s.trim(); }).filter(Boolean);
      window.savePlatformConfig({ modWatchWords: words.slice(0, 200) });
      audit('moderation_watch_words', { n: words.length });
      return toast('Watch words saved', 'success');
    }

    /* Everything left is a ban of some kind. */
    if (act === 'open-username' || act === 'ban-username') {
      var typedName = document.getElementById('fluxModUser').value.trim();
      var uid = await findUsername(typedName);
      if (!uid) return;
      if (act === 'open-username') return openPerson(uid, mount);
      value = uid;
      label = typedName;
      act = 'ban-user';
    }
    if (act === 'ban-ip-typed') {
      value = document.getElementById('fluxModIp').value.trim();
      if (!/^[0-9a-fA-F:.]{3,45}$/.test(value)) return toast('Enter a valid IP address', 'error');
    }
    var kind = { 'ban-user': 'user', 'ban-device': 'device', mute: 'mute' }[act] || 'ip';
    var done = await doBan(kind, value, label, {
      shared: el.getAttribute('data-shared'),
      deleted: el.getAttribute('data-deleted'),
      user: el.getAttribute('data-user'),
    });
    if (done && (_view === 'bans' || _view === 'person')) paint(mount);
  }

  async function paint(mount) {
    var tabs = Object.keys(VIEWS).filter(function (k) { return !VIEWS[k].hidden; }).map(function (k) {
      var on = k === _view || (_view === 'person' && k === 'people');
      return '<button type="button" class="own-pill' + (on ? ' is-on' : '') + '" data-view="' + k + '" aria-pressed="' + on + '">' + esc(VIEWS[k].label) + '</button>';
    }).join('');
    mount.innerHTML = '<div class="own-pills">' + tabs + '</div><div id="fluxModBody" class="own-muted">Loading…</div>';
    var body = mount.querySelector('#fluxModBody');
    try {
      await VIEWS[_view].paint(body);
      body.classList.remove('own-muted');
    } catch (e) {
      body.textContent = 'Could not load: ' + friendly(e);
    }
  }

  window.FluxOwnerModerationPanel = {
    render: function (mount) {
      if (!mount) return;
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
          handle(el, mount).catch(function (e) { toast(friendly(e), 'error'); });
        });
      }
      paint(mount);
    },
    /** Jump here from elsewhere in the app. */
    show: function (view, userId) {
      _view = view;
      if (userId) _person = userId;
      window.__osSetTab('moderation');
    },
    flagWord: flagWord,
  };
})();
