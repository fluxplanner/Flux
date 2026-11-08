/* ============================================================================
   FLUX · Owner Controls › site-wide controls and system checks

     Alerts          things that need the owner, raised by the database
     Site mode       normal, read-only, or maintenance with a countdown
     Sign-ins        sign out everyone
     Sign-ups        open, invite code only, or closed
     Profile review  names, bios and pictures people set themselves
     Reported posts  what people reported, and the report threshold
     Announcements   banners for every app or one app, with read counts
     Errors          what is breaking in people's browsers
     Uptime          the site checked every 5 minutes
     Database        size, slow queries, and stopping a stuck one
     Versions        what is live, and whether this tab is up to date

   Everything shown here was written by someone else, so it goes through
   esc(), and buttons carry data-* attributes. The database refuses all of it
   to anyone but the owner (migration 20261107230000_owner_controls_more).
   ========================================================================== */
(function () {
  'use strict';

  var APPS = [
    ['', 'Every app'], ['planner', 'Planner'], ['teacher', 'Teacher'], ['grapher', 'Grapher'],
    ['calculator', 'Calculator'], ['flashcards', 'Flashcards'], ['pixel', 'Pixel'], ['periodic', 'Periodic table'],
    ['composer', 'Composer'], ['translate', 'Translate'], ['synara', 'Synara'], ['suite', 'Flux Suite'],
  ];
  var LEVELS = [['info', 'Information'], ['warning', 'Warning'], ['urgent', 'Urgent']];

  function sb() { return window.getSB(); }
  function esc(v) {
    return String(v == null ? '' : v).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function when(v) {
    if (!v) return 'never';
    var d = new Date(v);
    return isNaN(d) ? '' : d.toLocaleString();
  }
  function ago(v) {
    var s = Math.round((Date.now() - new Date(v).getTime()) / 1000);
    if (!isFinite(s)) return '';
    if (s < 90) return 'just now';
    if (s < 5400) return Math.round(s / 60) + ' min ago';
    if (s < 129600) return Math.round(s / 3600) + ' h ago';
    return Math.round(s / 86400) + ' days ago';
  }
  function bytes(n) {
    n = Number(n) || 0;
    if (n < 1024 * 1024) return Math.round(n / 1024) + ' KB';
    return (n / 1024 / 1024).toFixed(1) + ' MB';
  }
  function toast(msg, kind) { window.showToast(msg, kind || 'info'); }
  function audit(action, detail) {
    try { window.ownerAuditAppend(action, detail); } catch (e) { /* never blocks the action */ }
  }
  function button(label, action, data, tone) {
    var attrs = Object.keys(data || {}).map(function (k) { return ' data-' + k + '="' + esc(data[k]) + '"'; }).join('');
    return '<button type="button" class="own-btn own-btn--sm' + (tone ? ' own-btn--' + tone : '') +
      '" data-act="' + esc(action) + '"' + attrs + '>' + esc(label) + '</button>';
  }
  function card(inner, cls) { return '<div class="own-card' + (cls ? ' ' + cls : '') + '">' + inner + '</div>'; }
  function muted(text) { return '<span class="own-muted">' + esc(text) + '</span>'; }
  function intro(text) { return '<p class="own-intro">' + esc(text) + '</p>'; }
  function actions(html) { return '<div class="own-actions">' + html + '</div>'; }
  function tag(text, tone) { return '<span class="own-tag' + (tone ? ' own-tag--' + tone : '') + '">' + esc(text) + '</span>'; }
  function options(list, current) {
    return list.map(function (o) {
      return '<option value="' + esc(o[0]) + '"' + (o[0] === current ? ' selected' : '') + '>' + esc(o[1]) + '</option>';
    }).join('');
  }
  function missingDb(e) {
    return !!e && (e.code === 'PGRST202' || e.code === '42P01' || e.code === 'PGRST205' || /Could not find the function/i.test(e.message || ''));
  }
  function friendly(e) {
    if (missingDb(e)) return 'This needs the database update that ships with these controls, which has not been applied yet.';
    return (e && e.message) || 'That did not work';
  }
  async function rpc(name, args) {
    var res = await sb().rpc(name, args || {});
    if (res.error) throw res.error;
    return res.data;
  }
  async function setting(key) {
    var res = await sb().from('platform_settings').select('value').eq('key', key).maybeSingle();
    if (res.error) throw res.error;
    return (res.data && res.data.value) || {};
  }
  function saveFile(name, text, type) {
    var a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([text], { type: type }));
    a.download = name;
    a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); }, 1000);
  }
  /* <input type="datetime-local"> speaks local time with no zone. */
  function toLocalInput(iso) {
    if (!iso) return '';
    var d = new Date(iso);
    if (isNaN(d)) return '';
    var p = function (n) { return String(n).padStart(2, '0'); };
    return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate()) + 'T' + p(d.getHours()) + ':' + p(d.getMinutes());
  }
  function fromLocalInput(v) {
    if (!v) return null;
    var d = new Date(v);
    return isNaN(d) ? null : d.toISOString();
  }
  /* Typed confirmation for the switches that touch everyone at once. */
  function typed(word, what) {
    var got = window.prompt(what + '\n\nType ' + word + ' to confirm.');
    return got != null && got.trim().toUpperCase() === word;
  }
  function flag(text) {
    try { return window.FluxOwnerModerationPanel.flagWord(text); } catch (e) { return ''; }
  }
  function openPerson(userId) { window.FluxOwnerModerationPanel.show('person', userId); }

  /* ---------- Alerts ---------- */

  var ALERT_KINDS = {
    owner_new_device: 'Security', ban_evasion: 'Ban evasion', reports: 'Reports', uptime: 'Uptime',
  };

  async function renderAlerts(body) {
    var res = await sb().from('flux_owner_alerts').select('*').order('created_at', { ascending: false }).limit(200);
    if (res.error) throw res.error;
    var rows = res.data || [];
    var unseen = rows.filter(function (r) { return !r.seen_at; }).length;
    body.innerHTML =
      intro('Raised by the database when: your account signs in on a device it has never used, a banned device ' +
        'signs in to another account, a post reaches the report limit, or Flux stops answering.') +
      (unseen ? actions(button('Mark all as seen', 'alerts-seen', null, 'primary')) : '') +
      (rows.length ? rows.map(function (r) {
        return card(tag(ALERT_KINDS[r.kind] || r.kind, r.seen_at ? '' : 'warn') + ' <b>' + esc(r.title) + '</b> · ' + muted(when(r.created_at)) +
          (r.detail ? '<div class="own-text">' + esc(r.detail) + '</div>' : '') +
          ((r.user_id || r.kind === 'reports') ? actions(
            (r.user_id ? button('Open file', 'open-person', { value: r.user_id }) : '') +
            (r.kind === 'reports' ? button('See reported posts', 'go', { value: 'reported' }) : '')) : ''),
        r.seen_at ? '' : 'own-card--warn');
      }).join('') : muted('No alerts yet.'));
  }

  /* ---------- Site mode ---------- */

  async function renderSiteMode(body) {
    var v = await setting('site_mode');
    var mode = v.mode || 'normal';
    var live = mode === 'read_only' || (mode === 'maintenance' &&
      (!v.starts_at || new Date(v.starts_at) <= new Date()) && (!v.ends_at || new Date(v.ends_at) > new Date()));
    body.innerHTML =
      card('<h3 class="own-h3">Right now</h3>' +
        (mode === 'normal' ? tag('Normal: everything works', 'ok')
          : tag((mode === 'read_only' ? 'Read-only' : 'Maintenance') + (live ? ' (on now)' : ' (scheduled)'), 'danger')) +
        (v.message ? '<div class="own-text">' + esc(v.message) + '</div>' : '') +
        (v.starts_at ? '<div>' + muted('Starts ' + when(v.starts_at)) + '</div>' : '') +
        (v.ends_at ? '<div>' + muted('Ends ' + when(v.ends_at)) + '</div>' : ''),
        live ? 'own-card--danger' : '') +
      card('<h3 class="own-h3">Change it</h3>' +
        '<p class="own-text"><b>Read-only</b>: people can open and look at everything, but nothing they change is saved to ' +
        'the cloud and nobody can post. Changes stay on their device and save once you switch back, unless they sign out ' +
        'first. A notice tells them. Use it while something is wrong and you do not want it getting worse.</p>' +
        '<p class="own-text"><b>Maintenance</b>: read-only, plus a screen covering every Flux app with your message and a ' +
        'countdown. Pick a start time to warn people first: they see a banner until it starts. Leave the end empty to keep ' +
        'it on until you switch back. You never see the screen yourself.</p>' +
        '<div class="own-filters">' +
        '<select id="ownSiteMode" class="own-input" aria-label="Site mode">' +
        options([['normal', 'Normal'], ['read_only', 'Read-only'], ['maintenance', 'Maintenance']], mode) + '</select></div>' +
        '<textarea id="ownSiteMsg" class="own-input" rows="2" placeholder="Message people see (optional)" aria-label="Message">' + esc(v.message || '') + '</textarea>' +
        '<div class="own-filters">' +
        '<label class="own-check own-check--row">Starts <input id="ownSiteStart" class="own-input" type="datetime-local" value="' + esc(toLocalInput(v.starts_at)) + '"></label>' +
        '<label class="own-check own-check--row">Ends <input id="ownSiteEnd" class="own-input" type="datetime-local" value="' + esc(toLocalInput(v.ends_at)) + '"></label>' +
        '</div>' + muted('Empty start means straight away.') +
        actions(button('Save', 'site-save', null, 'primary') + (mode !== 'normal' ? button('Back to normal now', 'site-normal') : '')));
  }

  async function saveSiteMode(normal) {
    var mode = normal ? 'normal' : document.getElementById('ownSiteMode').value;
    var value = { mode: mode };
    if (!normal) {
      value.message = document.getElementById('ownSiteMsg').value.trim();
      value.starts_at = fromLocalInput(document.getElementById('ownSiteStart').value);
      value.ends_at = fromLocalInput(document.getElementById('ownSiteEnd').value);
      if (value.ends_at && new Date(value.ends_at) <= new Date(value.starts_at || Date.now())) {
        toast('The end has to be after the start', 'error');
        return false;
      }
    }
    if (mode !== 'normal' && !window.confirm(mode === 'read_only'
      ? 'Stop everyone saving and posting until you switch back?'
      : 'Put every Flux app into maintenance' + (value.starts_at ? ' at ' + when(value.starts_at) : ' now') + '?')) return false;
    await rpc('flux_owner_set_setting', { p_key: 'site_mode', p_value: value });
    audit('site_mode', value);
    toast(mode === 'normal' ? 'Flux is back to normal' : 'Saved', 'success');
    return true;
  }

  /* ---------- Sign-ins ---------- */

  async function renderSessions(body) {
    var s = await rpc('flux_owner_mod_summary');
    body.innerHTML =
      card('<h3 class="own-h3">Sign out everyone</h3>' +
        '<p class="own-text">Ends every sign-in on every device, except yours. Within five minutes every open Flux ' +
        'goes back to the sign-in screen, and nobody can use an old sign-in again. Their planners are safe in the cloud ' +
        'and come back when they sign in. Only a change made in the last second or so before, not yet saved, could be lost.</p>' +
        '<p class="own-text">Use it if you think someone has got into accounts that are not theirs.</p>' +
        '<div>' + muted((s.signed_in == null ? '?' : s.signed_in) + ' sign-ins used in the last day.') + '</div>' +
        actions(button('Sign out everyone', 'signout-all', null, 'danger')), 'own-card--danger') +
      card('<h3 class="own-h3">One person</h3>' +
        '<p class="own-text">Open their file (Moderation › People & devices, or the search at the top) to see each device ' +
        'they are signed in on, end one of them, or sign them out everywhere.</p>');
  }

  /* ---------- Sign-ups ---------- */

  async function renderSignups(body) {
    var v = await setting('signup_policy');
    var mode = v.mode || 'open';
    var codes = await sb().from('flux_invite_codes').select('*').order('created_at', { ascending: false }).limit(200);
    if (codes.error) throw codes.error;
    var rows = codes.data || [];
    body.innerHTML =
      card('<h3 class="own-h3">Who can make an account</h3>' +
        '<p class="own-text"><b>Open</b>: anyone. <b>Invite code</b>: the sign-up form asks for a code you made below. ' +
        '<b>Closed</b>: nobody can sign up, but everyone who has an account can still sign in, and you can still make ' +
        'accounts from Users & roster.</p>' +
        '<div class="own-filters"><select id="ownSignupMode" class="own-input" aria-label="Sign-up mode">' +
        options([['open', 'Open'], ['invite', 'Invite code'], ['closed', 'Closed']], mode) + '</select>' +
        button('Save', 'signup-save', null, 'primary') + '</div>' +
        (mode === 'open' ? tag('Anyone can sign up', 'ok') : tag(mode === 'closed' ? 'Sign-ups are closed' : 'Invite code needed', 'warn'))) +
      card('<h3 class="own-h3">Invite codes</h3>' +
        '<p class="own-text">Hand a code to a class or a person. Each code can have a limit on uses and an end date. ' +
        'Codes only matter while sign-ups are set to Invite code.</p>' +
        '<div class="own-filters">' +
        '<input id="ownInviteNote" class="own-input" type="text" placeholder="Who it is for (only you see this)" aria-label="Who it is for">' +
        '<input id="ownInviteUses" class="own-input" type="number" min="0" placeholder="Uses (empty = no limit)" aria-label="Number of uses">' +
        '<input id="ownInviteDays" class="own-input" type="number" min="0" placeholder="Days it works (empty = forever)" aria-label="Days it works">' +
        button('Make a code', 'invite-new', null, 'primary') + '</div>' +
        (rows.length ? rows.map(function (c) {
          var expired = c.expires_at && new Date(c.expires_at) <= new Date();
          var used = c.max_uses && c.uses >= c.max_uses;
          var on = c.active && !expired && !used;
          return '<div class="own-card"><b class="own-code">' + esc(c.code) + '</b> ' +
            (on ? tag('Works', 'ok') : tag(!c.active ? 'Turned off' : expired ? 'Expired' : 'Used up')) +
            '<div>' + muted((c.note ? c.note + ' · ' : '') + c.uses + (c.max_uses ? ' of ' + c.max_uses : '') + ' used' +
              (c.expires_at ? ' · ends ' + when(c.expires_at) : '')) + '</div>' +
            actions(button('Copy', 'invite-copy', { value: c.code }) + (c.active ? button('Turn off', 'invite-off', { value: c.code }, 'danger') : '')) + '</div>';
        }).join('') : muted('No codes yet.')));
  }

  /* ---------- Profile review ---------- */

  async function renderProfiles(body) {
    var rows = await rpc('flux_owner_profiles', { p_limit: 300 });
    body.innerHTML =
      intro('Names, bios and profile pictures people set themselves, newest change first. Matches with your watch words ' +
        'are marked. A locked person keeps whatever you leave: anything they change later is ignored.') +
      '<div class="own-filters"><label class="own-check"><input id="ownProfFlagged" type="checkbox"> Only watch-word matches</label></div>' +
      '<div id="ownProfList"></div>';
    function paintList() {
      var only = body.querySelector('#ownProfFlagged').checked;
      var list = (rows || []).map(function (p) {
        return Object.assign({ hit: flag([p.display_name, p.bio].join(' ')) }, p);
      }).filter(function (p) { return !only || p.hit; });
      body.querySelector('#ownProfList').innerHTML = list.length ? list.map(function (p) {
        return card('<b>' + esc(p.display_name || '(no name)') + '</b> ' + muted('@' + (p.username || 'deleted') + ' · ' + (p.role || 'no role') + ' · changed ' + when(p.updated_at)) +
          (p.locked ? ' ' + tag('Locked', 'danger') : '') + (p.hit ? ' ' + tag('Matches “' + p.hit + '”', 'warn') : '') +
          (p.bio ? '<div class="own-text">' + esc(p.bio) + '</div>' : '') +
          /* Shown as text, never loaded: a picture address chosen by someone else
             would tell them when you looked, and from where. */
          (p.avatar_url ? '<div class="own-muted own-small">Picture: ' + esc(p.avatar_url) + '</div>' : '') +
          actions(
            button('Open file', 'open-person', { value: p.user_id }) +
            button('Change name', 'prof-name', { value: p.user_id, name: p.display_name || '' }) +
            (p.bio ? button('Remove bio', 'prof-clear', { value: p.user_id, field: 'bio' }, 'danger') : '') +
            (p.avatar_url ? button('Remove picture', 'prof-clear', { value: p.user_id, field: 'avatar_url' }, 'danger') : '') +
            (p.locked ? button('Unlock', 'prof-lock', { value: p.user_id, on: '' }) : button('Lock', 'prof-lock', { value: p.user_id, on: '1' }))),
          p.hit ? 'own-card--warn' : '');
      }).join('') : muted(only ? 'Nothing matches your watch words.' : 'Nobody has set a name, bio or picture yet.');
    }
    paintList();
    body.querySelector('#ownProfFlagged').addEventListener('change', paintList);
  }

  /* ---------- Reported posts ---------- */

  async function renderReported(body) {
    var policy = await setting('moderation_policy');
    var rows = await rpc('flux_owner_reported_posts');
    var threshold = policy.report_threshold || 3;
    body.innerHTML =
      card('<h3 class="own-h3">Report limit</h3>' +
        '<p class="own-text">Anyone signed in can report a feed post or announcement. When one post reaches this many ' +
        'reports from different people, you get an alert. Turn on taking it down automatically to have it removed at ' +
        'that point too; the archive keeps a copy.</p>' +
        '<div class="own-filters">' +
        '<input id="ownRepThreshold" class="own-input" type="number" min="1" max="50" value="' + esc(threshold) + '" aria-label="Reports needed">' +
        '<label class="own-check"><input id="ownRepAuto" type="checkbox"' + (policy.auto_hide ? ' checked' : '') + '> Take it down automatically</label>' +
        button('Save', 'rep-save', null, 'primary') + '</div>') +
      '<h3 class="own-h3">Reported</h3>' +
      ((rows || []).length ? rows.map(function (r) {
        var post = r.post || {};
        var c = post.content || {};
        var text = [c.title, c.body, c.content].filter(Boolean).join(' — ');
        var gone = post.action === 'DELETE';
        return card('<b>' + esc(r.reports) + ' report' + (r.reports === 1 ? '' : 's') + '</b> · ' + esc(r.source) + ' · ' + muted('last ' + when(r.last_at)) +
          (gone ? ' ' + tag('Taken down') : '') +
          '<div class="own-text">' + esc(text || '(post not in the archive)') + '</div>' +
          (post.author_label ? muted('By ' + post.author_label) : '') +
          ((r.reasons || []).length ? '<div class="own-muted own-small">Reasons: ' + esc(r.reasons.join(' · ')) + '</div>' : '') +
          actions(
            (post.author_id ? button('Open author file', 'open-person', { value: post.author_id }) : '') +
            (!gone ? button('Take down', 'rep-down', { source: r.source, id: r.source_id }, 'danger') : '') +
            button('Dismiss reports', 'rep-dismiss', { source: r.source, id: r.source_id })),
          r.reports >= threshold && !gone ? 'own-card--warn' : '');
      }).join('') : muted('Nothing has been reported.'));
  }

  /* ---------- Announcements ---------- */

  async function renderAnnouncements(body) {
    var data = await rpc('flux_owner_announcements');
    var items = data.items || [];
    var active = Number(data.active_7d) || 0;
    body.innerHTML =
      card('<h3 class="own-h3">New announcement</h3>' +
        '<p class="own-text">A banner at the top of the app you pick, for everyone or one app’s users, until it ends ' +
        'or they close it. Urgent ones cannot be closed. You can see how many people have seen each one.</p>' +
        '<input id="ownAnnTitle" class="own-input" type="text" maxlength="120" placeholder="Headline" aria-label="Headline">' +
        '<textarea id="ownAnnBody" class="own-input" rows="2" maxlength="600" placeholder="More detail (optional)" aria-label="Detail"></textarea>' +
        '<div class="own-filters">' +
        '<select id="ownAnnApp" class="own-input" aria-label="Which app">' + options(APPS, '') + '</select>' +
        '<select id="ownAnnLevel" class="own-input" aria-label="How important">' + options(LEVELS, 'info') + '</select>' +
        '<label class="own-check own-check--row">Ends <input id="ownAnnEnd" class="own-input" type="datetime-local"></label>' +
        '</div>' + actions(button('Post announcement', 'ann-new', null, 'primary'))) +
      '<h3 class="own-h3">Posted</h3>' +
      (items.length ? items.map(function (a) {
        var live = a.active && new Date(a.starts_at) <= new Date() && (!a.ends_at || new Date(a.ends_at) > new Date());
        var app = (APPS.find(function (x) { return x[0] === (a.app || ''); }) || ['', a.app])[1];
        var pct = active ? Math.min(100, Math.round(100 * a.reads / active)) : 0;
        return card(tag(live ? 'Showing' : 'Ended', live ? 'ok' : '') + ' ' + tag(app) +
          (a.level !== 'info' ? ' ' + tag(a.level === 'urgent' ? 'Urgent' : 'Warning', 'warn') : '') +
          ' <b>' + esc(a.title) + '</b>' + (a.body ? '<div class="own-text">' + esc(a.body) + '</div>' : '') +
          '<div>' + muted('Seen by ' + a.reads + ' people' + (active ? ' (' + pct + '% of the ' + active + ' active this week)' : '') +
            ' · posted ' + when(a.created_at) + (a.ends_at ? ' · ends ' + when(a.ends_at) : '')) + '</div>' +
          actions((live ? button('End it now', 'ann-end', { value: a.id }) : '') + button('Delete', 'ann-del', { value: a.id }, 'danger')));
      }).join('') : muted('Nothing posted yet.'));
  }

  /* ---------- Errors ---------- */

  var _errors = [];
  async function renderErrors(body) {
    _errors = (await rpc('flux_owner_errors', { p_days: 7 })) || [];
    body.innerHTML =
      intro('Errors people’s browsers hit in the last 7 days, grouped by message, most common first. Names, ' +
        'addresses and passwords are scrubbed before anything is sent. Kept for 30 days.') +
      actions(button('Download CSV', 'err-csv')) +
      (_errors.length ? _errors.map(function (e) {
        return card('<b>' + esc(e.times) + '×</b> ' + muted(e.people + ' ' + (e.people === 1 ? 'person' : 'people') + ' · last ' + ago(e.last_seen)) +
          '<div class="own-text"><code>' + esc(e.message) + '</code></div>' +
          muted([e.source, e.page, e.version].filter(Boolean).join(' · ')), e.people > 2 ? 'own-card--warn' : '');
      }).join('') : muted('No errors reported in the last 7 days.'));
  }

  /* ---------- Uptime ---------- */

  async function renderUptime(body) {
    var data = await rpc('flux_owner_uptime', { p_hours: 24 });
    var targets = data.targets || [];
    body.innerHTML =
      intro('The database asks for these pages every 5 minutes, from outside your network. Two failures in a row ' +
        'raise an alert. Showing the last 24 hours, newest on the left.') +
      (data.scheduled ? '' : card('<b>The 5-minute check is not running.</b> It starts when the database update is applied.', 'own-card--warn')) +
      (targets.length ? targets.map(function (t) {
        var total = (t.up || 0) + (t.down || 0);
        var pct = total ? (100 * t.up / total).toFixed(total === t.up ? 0 : 1) : '—';
        var strip = (t.recent || []).map(function (c) {
          return '<span class="own-uptick' + (c.ok ? '' : ' own-uptick--down') + '" title="' +
            esc(when(c.at) + ' · ' + (c.ok ? (c.ms + ' ms') : (c.error || ('status ' + c.status)))) + '"></span>';
        }).join('');
        return card('<b>' + esc(t.target.replace(/^https?:\/\//, '')) + '</b> ' +
          tag(pct + '% up', t.down ? 'warn' : 'ok') + ' ' + muted((t.avg_ms ? t.avg_ms + ' ms on average · ' : '') + total + ' checks') +
          '<div class="own-upstrip" aria-hidden="true">' + strip + '</div>');
      }).join('') : muted('No checks yet. The first arrives within 5 minutes of the database update.'));
  }

  /* ---------- Database ---------- */

  async function renderDatabase(body) {
    var d = await rpc('flux_owner_db_health');
    var pct = Math.min(100, Math.round(100 * d.size_bytes / d.limit_bytes));
    var conns = d.connections || {};
    body.innerHTML =
      card('<h3 class="own-h3">Space used</h3>' +
        '<div class="own-meter"><span style="width:' + pct + '%"' + (pct >= 80 ? ' class="own-meter--danger"' : '') + '></span></div>' +
        '<div>' + muted(bytes(d.size_bytes) + ' of ' + bytes(d.limit_bytes) + ' on the free plan (' + pct + '%).') + '</div>' +
        (pct >= 80 ? '<p class="own-text own-danger">Over 80%. At 100% the database stops accepting changes until it is upgraded or emptied.</p>' : ''),
        pct >= 80 ? 'own-card--danger' : '') +
      card('<h3 class="own-h3">Biggest tables</h3>' +
        (d.tables || []).map(function (t) { return '<div class="own-text">' + esc(t.name) + ' ' + muted(bytes(t.bytes) + (t.rows > 0 ? ' · about ' + t.rows + ' rows' : '')) + '</div>'; }).join('')) +
      card('<h3 class="own-h3">Running now</h3>' +
        muted('Connections: ' + Object.keys(conns).map(function (k) { return k + ' ' + conns[k]; }).join(', ')) +
        ((d.running || []).length ? d.running.map(function (q) {
          return '<div class="own-card"><b>' + esc(q.seconds) + ' s</b> ' + muted(q.role + ' · ' + q.state) +
            '<div class="own-text"><code>' + esc(q.query) + '</code></div>' +
            actions(button('Stop this query', 'db-cancel', { value: q.pid }, 'danger')) + '</div>';
        }).join('') : '<p class="own-text">Nothing has been running for more than 5 seconds.</p>')) +
      card('<h3 class="own-h3">Where the time goes</h3>' +
        '<p class="own-text">The database work that has taken the most time in total since it last restarted.</p>' +
        ((d.slow || []).length ? d.slow.map(function (q) {
          return '<div class="own-card">' + muted(q.calls + ' times · ' + q.mean_ms + ' ms each · ' + Math.round(q.total_ms / 1000) + ' s in all') +
            '<div class="own-text"><code>' + esc(q.query) + '</code></div></div>';
        }).join('') : muted('Not available.'))) +
      actions(button('Refresh', 'reload'));
  }

  /* ---------- Versions ---------- */

  function bundlesIn(html) {
    var out = [];
    String(html).replace(/(?:src|href)="(public\/bundles\/[^"?]+)"/g, function (m, p) { out.push(p); return m; });
    return out;
  }
  async function fetchText(path) {
    var res = await fetch(path, { cache: 'no-store' });
    if (!res.ok) throw new Error(path + ' answered ' + res.status);
    return { text: await res.text(), modified: res.headers.get('last-modified') };
  }

  async function renderVersions(body) {
    var index = await fetchText('index.html');
    var owner = await fetchText('owner.html');
    var live = bundlesIn(owner.text);
    var mine = Array.prototype.map.call(document.querySelectorAll('script[src*="public/bundles/"],link[href*="public/bundles/"]'), function (el) {
      return (el.getAttribute('src') || el.getAttribute('href')).split('?')[0];
    });
    var stale = live.some(function (p) { return mine.indexOf(p) < 0; });
    function list(paths) {
      return paths.map(function (p) { return '<div class="own-text"><code>' + esc(p.replace('public/bundles/', '')) + '</code></div>'; }).join('');
    }
    body.innerHTML =
      card('<h3 class="own-h3">This tab</h3>' +
        (stale ? tag('Out of date', 'warn') + '<p class="own-text">A newer Owner Controls is live.</p>' + actions(button('Reload', 'hard-reload', null, 'primary'))
          : tag('Up to date', 'ok')), stale ? 'own-card--warn' : '') +
      card('<h3 class="own-h3">Planner (live)</h3>' +
        muted('Last changed ' + (index.modified ? when(index.modified) : 'unknown')) + list(bundlesIn(index.text))) +
      card('<h3 class="own-h3">Owner Controls (live)</h3>' +
        muted('Last changed ' + (owner.modified ? when(owner.modified) : 'unknown')) + list(live)) +
      intro('A new version goes live a minute or two after a change is merged. People get it the next time they open ' +
        'Flux; Release & push can make them reload sooner. To undo a release, ask for the change to be reverted.');
  }

  /* ---------- Views and actions ---------- */

  var VIEWS = {
    alerts: renderAlerts, sitemode: renderSiteMode, sessions: renderSessions, signups: renderSignups,
    profiles: renderProfiles, reported: renderReported, announce: renderAnnouncements,
    errors: renderErrors, uptime: renderUptime, database: renderDatabase, versions: renderVersions,
  };

  async function handle(el, mount, view) {
    var act = el.getAttribute('data-act');
    var value = el.getAttribute('data-value') || '';
    var again = function () { return paint(mount, view); };

    if (act === 'open-person') return openPerson(value);
    if (act === 'go') return window.__osSetTab(value);
    if (act === 'reload') return again();
    if (act === 'hard-reload') return location.reload();

    if (act === 'alerts-seen') {
      var seen = await sb().from('flux_owner_alerts').update({ seen_at: new Date().toISOString() }).is('seen_at', null);
      if (seen.error) throw seen.error;
      refreshBadge();
      return again();
    }
    if (act === 'site-save' || act === 'site-normal') {
      if (await saveSiteMode(act === 'site-normal')) return again();
      return;
    }
    if (act === 'signout-all') {
      if (!typed('SIGN OUT', 'Sign out every account on every device, except yours?')) return;
      var n = await rpc('flux_owner_sign_out', { p_user: null, p_session: null });
      audit('sign_out_everyone', { sessions: n });
      toast('Ended ' + n + ' sign-ins. Everyone is back at the sign-in screen within 5 minutes.', 'success');
      return again();
    }
    if (act === 'signup-save') {
      var mode = document.getElementById('ownSignupMode').value;
      if (mode === 'closed' && !window.confirm('Stop all new sign-ups?')) return;
      await rpc('flux_owner_set_setting', { p_key: 'signup_policy', p_value: { mode: mode } });
      audit('signup_policy', { mode: mode });
      toast('Saved', 'success');
      return again();
    }
    if (act === 'invite-new') {
      var uses = parseInt(document.getElementById('ownInviteUses').value, 10);
      var days = parseInt(document.getElementById('ownInviteDays').value, 10);
      var code = await rpc('flux_owner_create_invite', {
        p_note: document.getElementById('ownInviteNote').value.trim() || null,
        p_max_uses: uses > 0 ? uses : null, p_days: days > 0 ? days : null,
      });
      audit('invite_code', { uses: uses, days: days });
      try { await navigator.clipboard.writeText(code); toast('Made ' + code + ' and copied it', 'success'); } catch (e) { toast('Made ' + code, 'success'); }
      return again();
    }
    if (act === 'invite-copy') {
      try { await navigator.clipboard.writeText(value); toast('Copied', 'success'); } catch (e) { toast(value); }
      return;
    }
    if (act === 'invite-off') {
      if (!window.confirm('Turn off ' + value + '? Nobody can sign up with it after this.')) return;
      var off = await sb().from('flux_invite_codes').update({ active: false }).eq('code', value);
      if (off.error) throw off.error;
      return again();
    }
    if (act === 'prof-name') {
      var name = window.prompt('New display name (empty removes it):', el.getAttribute('data-name') || '');
      if (name == null) return;
      await rpc('flux_owner_set_profile', { p_user: value, p_display_name: name.trim(), p_clear: [], p_lock: null, p_reason: null });
      audit('profile_name', { userId: value });
      toast('Name changed. Lock it too if they might change it back.', 'success');
      return again();
    }
    if (act === 'prof-clear') {
      var field = el.getAttribute('data-field');
      if (!window.confirm(field === 'bio' ? 'Remove their bio?' : 'Remove their profile picture?')) return;
      await rpc('flux_owner_set_profile', { p_user: value, p_display_name: null, p_clear: [field], p_lock: null, p_reason: null });
      audit('profile_clear', { userId: value, field: field });
      return again();
    }
    if (act === 'prof-lock') {
      var on = !!el.getAttribute('data-on');
      await rpc('flux_owner_set_profile', { p_user: value, p_display_name: null, p_clear: [], p_lock: on, p_reason: null });
      audit('profile_lock', { userId: value, on: on });
      toast(on ? 'Locked' : 'Unlocked', 'success');
      return again();
    }
    if (act === 'rep-save') {
      var threshold = parseInt(document.getElementById('ownRepThreshold').value, 10) || 3;
      var auto = document.getElementById('ownRepAuto').checked;
      await rpc('flux_owner_set_setting', { p_key: 'moderation_policy', p_value: { report_threshold: threshold, auto_hide: auto } });
      audit('report_policy', { threshold: threshold, auto: auto });
      toast('Saved', 'success');
      return again();
    }
    if (act === 'rep-down') {
      if (!window.confirm('Take this down for everyone? The archive keeps a copy.')) return;
      var gone = await rpc('flux_owner_remove_content', { p_source: el.getAttribute('data-source'), p_id: el.getAttribute('data-id'), p_reason: 'reported' });
      audit('report_take_down', { source: el.getAttribute('data-source'), id: el.getAttribute('data-id') });
      toast(gone ? 'Taken down' : 'It was already gone', 'success');
      return again();
    }
    if (act === 'rep-dismiss') {
      var dis = await sb().from('flux_post_reports').delete().eq('source', el.getAttribute('data-source')).eq('source_id', el.getAttribute('data-id'));
      if (dis.error) throw dis.error;
      return again();
    }
    if (act === 'ann-new') {
      var title = document.getElementById('ownAnnTitle').value.trim();
      if (!title) { document.getElementById('ownAnnTitle').focus(); return toast('Add a headline', 'error'); }
      var row = {
        title: title,
        body: document.getElementById('ownAnnBody').value.trim() || null,
        app: document.getElementById('ownAnnApp').value || null,
        level: document.getElementById('ownAnnLevel').value,
        ends_at: fromLocalInput(document.getElementById('ownAnnEnd').value),
        created_by: window.currentUser ? window.currentUser.id : null,
      };
      var made = await sb().from('flux_announcements').insert(row);
      if (made.error) throw made.error;
      audit('announcement', { app: row.app, level: row.level });
      toast('Posted. Open apps show it within a few minutes.', 'success');
      return again();
    }
    if (act === 'ann-end') {
      var ended = await sb().from('flux_announcements').update({ ends_at: new Date().toISOString() }).eq('id', value);
      if (ended.error) throw ended.error;
      return again();
    }
    if (act === 'ann-del') {
      if (!window.confirm('Delete this announcement and its read counts?')) return;
      var del = await sb().from('flux_announcements').delete().eq('id', value);
      if (del.error) throw del.error;
      return again();
    }
    if (act === 'err-csv') {
      var cell = function (v) { return '"' + String(v == null ? '' : v).replace(/"/g, '""') + '"'; };
      return saveFile('flux-errors.csv', ['times,people,last_seen,message,source,page,version'].concat(_errors.map(function (e) {
        return [e.times, e.people, e.last_seen, e.message, e.source, e.page, e.version].map(cell).join(',');
      })).join('\n'), 'text/csv');
    }
    if (act === 'db-cancel') {
      if (!window.confirm('Stop this query? Whoever started it gets an error and can try again.')) return;
      var stopped = await rpc('flux_owner_cancel_query', { p_pid: Number(value) });
      toast(stopped ? 'Stopped' : 'It had already finished', 'success');
      return again();
    }
  }

  async function paint(mount, view) {
    mount.innerHTML = '<div id="ownSecBody" class="own-muted">Loading…</div>';
    var body = mount.querySelector('#ownSecBody');
    try {
      await VIEWS[view](body);
      body.classList.remove('own-muted');
    } catch (e) {
      body.textContent = 'Could not load: ' + friendly(e);
    }
  }

  function refreshBadge() {
    try {
      sb().from('flux_owner_alerts').select('*', { count: 'exact', head: true }).is('seen_at', null).then(function (res) {
        var el = document.getElementById('osBadge-alerts');
        if (!el || res.error) return;
        el.textContent = res.count > 99 ? '99+' : String(res.count || '');
        el.hidden = !res.count;
      });
    } catch (e) { /* a badge is never worth an error */ }
  }

  window.FluxOwnerSecurityPanel = {
    views: Object.keys(VIEWS),
    render: function (view, mount) {
      if (!mount || !VIEWS[view]) return;
      mount.dataset.view = view;
      if (!mount.dataset.fluxSecBound) {
        mount.dataset.fluxSecBound = '1';
        mount.addEventListener('click', function (ev) {
          var el = ev.target.closest('[data-act]');
          if (!el || !mount.contains(el)) return;
          handle(el, mount, mount.dataset.view).catch(function (e) { toast(friendly(e), 'error'); });
        });
      }
      paint(mount, view);
    },
    refreshBadge: refreshBadge,
  };
})();
