/* ============================================================================
   FLUX · Owner Controls panels that are not part of the original suite:
     · Today: what needs the owner, on one screen.
     · Password help: requests from the sign-in page. They were being saved with
       nothing anywhere showing them.
     · Planner tabs: hide a sidebar tab for everyone (moved from planner Settings).
     · Staff verify: the approval queue (moved from flux-staff-platform.js).
     · System health and the master backlog: moved from the planner.

   Rows here were written by other people, so they go through esc() and buttons
   carry data-* attributes. The database refuses all of this to anyone else.
   ========================================================================== */
(function () {
  'use strict';

  var SCHOOL_FALLBACK = 'International Academy East';
  /* The planner's sidebar tabs (DEFAULT_TABS in app.js). Dashboard and Settings
     are absent because they cannot be hidden: they are the way back. */
  var PLANNER_TABS = [
    ['calendar', 'Calendar'], ['school', 'School Info'], ['canvas', 'Canvas'], ['notes', 'Notebook'],
    ['timer', 'Time'], ['profile', 'Profile'], ['goals', 'College Prep'], ['mood', 'Mood'],
    ['toolbox', 'Study tools'], ['readingLog', 'Reading log'], ['schoology', 'Schoology'],
  ];

  function sb() { return window.getSB(); }
  function esc(v) {
    return String(v == null ? '' : v).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function when(v) { var d = new Date(v); return isNaN(d) ? '' : d.toLocaleString(); }
  function toast(m, k) { window.showToast(m, k || 'info'); }

  /* ---------- Today ---------- */

  function tile(label, value, go, tone, view) {
    return '<button type="button" class="own-tile' + (tone ? ' own-tile--' + tone : '') + '" data-go="' + esc(go) + '"' +
      (view ? ' data-go-view="' + esc(view) + '"' : '') + '>' +
      '<span class="own-tile__n">' + esc(value == null ? '—' : value) + '</span>' +
      '<span class="own-tile__l">' + esc(label) + '</span></button>';
  }
  function status(label, on, onText, offText, go, danger) {
    return '<button type="button" class="own-status' + (on && danger ? ' own-status--danger' : '') + '" data-go="' + esc(go) + '">' +
      '<span class="own-dot' + (on ? (danger ? ' own-dot--danger' : ' own-dot--on') : '') + '"></span>' +
      '<span><b>' + esc(label) + '</b><br><span class="own-muted">' + esc(on ? onText : offText) + '</span></span></button>';
  }

  async function count(table, build) {
    var q = sb().from(table).select('*', { count: 'exact', head: true });
    var res = await (build ? build(q) : q);
    return res.error ? null : res.count;
  }

  async function renderToday(mount) {
    mount.innerHTML = '<p class="own-muted">Loading…</p>';
    var sum = await sb().rpc('flux_owner_mod_summary');
    var s = sum.error ? {} : (sum.data || {});
    if (sum.error) {
      // Before the database update: the counts that need nothing new.
      var parts = await Promise.all([
        count('flux_password_help', function (q) { return q.eq('handled', false); }),
        count('staff_verification_requests', function (q) { return q.eq('verification_status', 'pending'); }),
        count('flux_bans', function (q) { return q.eq('active', true); }),
      ]);
      s = { password_help: parts[0], staff_waiting: parts[1], bans: parts[2] };
    }
    var log = await sb().from('flux_public_content_log').select('*').order('created_at', { ascending: false }).limit(100);
    var posts = log.error ? [] : (log.data || []).filter(function (r) { return r.source !== 'platform_settings'; });
    var textOf = function (r) { var c = r.content || {}; return [c.title, c.body, c.content, c.message, c.note, c.description].filter(Boolean).join(' — '); };
    var flagged = posts.filter(function (r) { return window.FluxOwnerModerationPanel.flagWord(textOf(r)); }).length;
    var inbox = window.load('flux_feedback_inbox', []) || [];
    var feedback24 = inbox.filter(function (e) { return e && Date.now() - Number(e.t || 0) < 864e5; }).length;
    var pc = window.getPlatformConfig();
    var gate = (window.FluxRelease && window.FluxRelease.getGate && window.FluxRelease.getGate()) || {};

    mount.innerHTML =
      '<h2 class="own-h2">Today</h2>' +
      '<div class="own-tiles">' +
        tile('Alerts', s.alerts, 'alerts', s.alerts ? 'danger' : '') +
        tile('Password help waiting', s.password_help, 'pwhelp', s.password_help ? 'warn' : '') +
        tile('Posts reported this week', s.reported_posts, 'reported', s.reported_posts ? 'warn' : '') +
        tile('Errors today', s.errors_24h, 'errors', s.errors_24h > 20 ? 'warn' : '') +
        tile('Teachers to verify', s.staff_waiting, 'staffverify', s.staff_waiting ? 'warn' : '') +
        tile('Watch-word matches', flagged, 'moderation', flagged ? 'danger' : '', 'archive') +
        tile('Feedback today', feedback24, 'feedback') +
        tile('Public posts today', s.posts_24h, 'moderation', '', 'archive') +
        tile('New accounts this week', s.new_accounts_7d, 'moderation', '', 'newaccounts') +
        tile('Addresses shared by accounts', s.shared_ips, 'moderation', '', 'people') +
        tile('Active bans', s.bans, 'moderation', '', 'bans') +
        tile('People with posting off', s.mutes, 'moderation', '', 'bans') +
        tile('Open study rooms', s.rooms_open, 'moderation', '', 'rooms') +
        tile('Active today', s.active_24h, 'moderation', '', 'people') +
        tile('Accounts', s.accounts, 'auth') +
      '</div>' +
      (sum.error ? '<p class="own-intro">Some numbers are missing until the database update that ships with Owner Controls is applied.</p>' : '') +
      '<h3 class="own-h3">Switches</h3><div class="own-statuses">' +
        status('Site mode', !!s.site_mode && s.site_mode !== 'normal',
          s.site_mode === 'read_only' ? 'Read-only: nothing is being saved' : 'Maintenance is set', 'Normal', 'sitemode', true) +
        status('Sign-ups', !!s.signup_mode && s.signup_mode !== 'open',
          s.signup_mode === 'closed' ? 'Closed' : 'Invite code only', 'Open to anyone', 'signups') +
        status('Posting lockdown', !!s.lockdown, 'Posting is paused for everyone', 'Posting is on', 'moderation', true) +
        status('Maintenance screen', !!pc.maintenanceMode, 'Everyone sees the update screen', 'Off', 'nuke', true) +
        status('Release gate', !!gate.stagingEnabled, 'New builds wait for you', 'New builds go straight out', 'release') +
        status('Sign-in pop-up', !!pc.signInPopup, 'Showing: ' + pc.signInPopupTitle, 'None set', 'nuke') +
      '</div>' +
      '<h3 class="own-h3">Latest public posts</h3>' +
      (posts.length ? posts.slice(0, 5).map(function (r) {
        return '<div class="own-card"><b>' + esc(r.source) + '</b> · ' + esc(r.action) + ' · <span class="own-muted">' + esc(when(r.created_at)) + '</span>' +
          '<div class="own-text">' + esc(textOf(r) || JSON.stringify(r.content || {})) + '</div>' +
          '<span class="own-muted">By ' + esc(r.author_label || 'unknown') + '</span></div>';
      }).join('') : '<p class="own-muted">Nothing posted yet.</p>');

    if (!mount.dataset.bound) {
      mount.dataset.bound = '1';
      mount.addEventListener('click', function (ev) {
        var el = ev.target.closest('[data-go]');
        if (!el) return;
        var view = el.getAttribute('data-go-view');
        var go = el.getAttribute('data-go');
        if (go === 'moderation') window.FluxOwnerModerationPanel.show(view || (el.classList.contains('own-status') ? 'rules' : 'archive'));
        else window.__osSetTab(go);
      });
    }
  }

  /* ---------- Password help ---------- */

  async function renderPasswordHelp(mount) {
    mount.innerHTML = '<p class="own-muted">Loading…</p>';
    var res = await sb().from('flux_password_help').select('*').order('created_at', { ascending: false }).limit(200);
    if (res.error) { mount.textContent = 'Could not load: ' + res.error.message; return; }
    var rows = res.data || [];
    var open = rows.filter(function (r) { return !r.handled; });
    var done = rows.filter(function (r) { return r.handled; });
    var row = function (r) {
      return '<div class="own-card"><b>@' + esc(r.username) + '</b> · <span class="own-muted">' + esc(when(r.created_at)) + '</span>' +
        (r.note ? '<div class="own-text">' + esc(r.note) + '</div>' : '') +
        '<div class="own-actions">' +
        (r.handled ? '' : '<button type="button" class="own-btn own-btn--sm own-btn--primary" data-pw="reset" data-username="' + esc(r.username) + '" data-id="' + esc(r.id) + '">Set a new password</button>') +
        '<button type="button" class="own-btn own-btn--sm" data-pw="file" data-username="' + esc(r.username) + '">Open file</button>' +
        (r.handled ? '' : '<button type="button" class="own-btn own-btn--sm" data-pw="done" data-id="' + esc(r.id) + '">Mark handled</button>') +
        '</div></div>';
    };
    mount.innerHTML = '<h2 class="own-h2">Password help</h2>' +
      '<p class="own-intro">People who asked for help from the sign-in page. Anyone can type any username there, so check it is really them before changing a password.</p>' +
      (open.length ? open.map(row).join('') : '<p class="own-muted">Nobody is waiting.</p>') +
      (done.length ? '<h3 class="own-h3">Handled</h3>' + done.map(row).join('') : '');
    if (!mount.dataset.bound) {
      mount.dataset.bound = '1';
      mount.addEventListener('click', function (ev) {
        var el = ev.target.closest('[data-pw]');
        if (!el) return;
        handlePassword(el, mount).catch(function (e) { toast(e.message || 'That did not work', 'error'); });
      });
    }
  }

  async function findUser(username) {
    var found = await sb().rpc('flux_owner_find_user', { p_username: username });
    if (found.error) throw found.error;
    if (!found.data) throw new Error('No account called ' + username);
    return found.data;
  }
  async function markHandled(id) {
    var res = await sb().from('flux_password_help').update({ handled: true }).eq('id', id);
    if (res.error) throw res.error;
  }
  async function handlePassword(el, mount) {
    var act = el.getAttribute('data-pw');
    var id = el.getAttribute('data-id');
    var username = el.getAttribute('data-username');
    if (act === 'done') {
      await markHandled(id);
      window.ownerAuditAppend('password_help_handled', { username: username });
      refreshBadges();
      return renderPasswordHelp(mount);
    }
    var uid = await findUser(username);
    if (act === 'file') return window.FluxOwnerModerationPanel.show('person', uid);
    await window.ownerAuthSetPasswordPrompt(uid);
    if (window.confirm('Mark this request as handled?')) {
      await markHandled(id);
      refreshBadges();
      renderPasswordHelp(mount);
    }
  }

  /* ---------- Planner tabs for everyone ---------- */

  async function renderPlannerTabs(mount) {
    mount.innerHTML = '<p class="own-muted">Loading…</p>';
    var res = await sb().from('platform_settings').select('value').eq('key', 'ui').maybeSingle();
    if (res.error) { mount.textContent = 'Could not load: ' + res.error.message; return; }
    var hidden = (res.data && res.data.value && res.data.value.hiddenTabs) || [];
    var known = PLANNER_TABS.slice();
    // A tab hidden earlier stays listed, so it can always be shown again.
    hidden.forEach(function (id) { if (!known.some(function (t) { return t[0] === id; })) known.push([id, id]); });
    mount.innerHTML = '<h2 class="own-h2">Planner tabs</h2>' +
      '<p class="own-intro">Untick a tab to hide it from every Flux planner, not just yours. Dashboard and Settings cannot be hidden, because they are the way back.</p>' +
      '<div class="own-card">' + known.map(function (t) {
        var off = hidden.indexOf(t[0]) >= 0;
        return '<label class="own-check own-check--row"><input type="checkbox" data-tab="' + esc(t[0]) + '"' + (off ? '' : ' checked') + '> ' + esc(t[1]) + '</label>';
      }).join('') + '<div class="own-actions"><button type="button" class="own-btn own-btn--primary" id="ownTabsSave">Save for everyone</button>' +
      '<button type="button" class="own-btn" id="ownTabsReset">Show all again</button></div></div>';
    async function saveTabs() {
      var next = [].slice.call(mount.querySelectorAll('[data-tab]')).filter(function (c) { return !c.checked; }).map(function (c) { return c.getAttribute('data-tab'); });
      var headers = await window.fluxAuthHeaders();
      var r = await fetch(window.SB_URL + '/functions/v1/release-admin', { method: 'POST', headers: headers, body: JSON.stringify({ action: 'set_platform_ui', hiddenTabs: next }) });
      var j = await r.json().catch(function () { return {}; });
      if (!r.ok) throw new Error(j.error || 'Save failed');
      window.ownerAuditAppend('planner_tabs', { hidden: next });
      toast('Saved for every planner', 'success');
    }
    mount.querySelector('#ownTabsSave').addEventListener('click', function () { saveTabs().catch(function (e) { toast(e.message, 'error'); }); });
    mount.querySelector('#ownTabsReset').addEventListener('click', function () {
      mount.querySelectorAll('[data-tab]').forEach(function (c) { c.checked = true; });
      saveTabs().catch(function (e) { toast(e.message, 'error'); });
    });
  }

  /* ---------- Staff verify ---------- */

  async function pendingStaffRequestCount() {
    var n = await count('staff_verification_requests', function (q) { return q.eq('verification_status', 'pending'); });
    return n || 0;
  }

  async function hydrateOwnerStaffVerification(mount, opts) {
    if (!mount) return;
    var silent = opts === true || (opts && opts.silent);
    if (!silent) mount.innerHTML = '<p class="own-muted">Loading requests…</p>';
    var res = await sb().from('staff_verification_requests').select('*').eq('verification_status', 'pending').order('created_at', { ascending: true });
    if (res.error) { mount.textContent = 'Could not load: ' + res.error.message; return; }
    var rows = res.data || [];
    mount.innerHTML = rows.length ? rows.map(function (r) {
      return '<div class="own-card"><b>' + esc(r.requested_name) + '</b><br><span class="own-muted">' + esc(r.requested_role) + ' · ' + esc(r.personal_gmail || '') + '</span>' +
        (r.applicant_note ? '<div class="own-text">“' + esc(r.applicant_note) + '”</div>' : '') +
        '<div class="own-actions"><button type="button" class="own-btn own-btn--sm own-btn--primary" data-sv="approve" data-user="' + esc(r.user_id) + '" data-role="' + esc(r.requested_role) + '" data-name="' + esc(r.requested_name) + '">Approve</button>' +
        '<button type="button" class="own-btn own-btn--sm" data-sv="reject" data-user="' + esc(r.user_id) + '">Reject</button></div></div>';
    }).join('') : '<p class="own-muted">No pending staff verification requests.</p>';
    if (!mount.dataset.bound) {
      mount.dataset.bound = '1';
      mount.addEventListener('click', function (ev) {
        var el = ev.target.closest('[data-sv]');
        if (!el) return;
        decideStaff(el, mount).catch(function (e) { toast(e.message || 'That did not work', 'error'); });
      });
    }
  }

  async function decideStaff(el, mount) {
    var userId = el.getAttribute('data-user');
    var approve = el.getAttribute('data-sv') === 'approve';
    if (approve) {
      var role = await sb().from('user_roles').update({
        role: el.getAttribute('data-role'),
        display_name: el.getAttribute('data-name'),
        school: SCHOOL_FALLBACK,
        updated_at: new Date().toISOString(),
      }).eq('user_id', userId);
      if (role.error) throw role.error;
    }
    var res = await sb().from('staff_verification_requests').update(approve
      ? { verification_status: 'approved', resolved_at: new Date().toISOString(), identity_confirmed: true }
      : { verification_status: 'rejected', resolved_at: new Date().toISOString() }).eq('user_id', userId);
    if (res.error) throw res.error;
    await window.FluxOwnerMessages.send(userId, approve ? 'Your staff access was approved' : 'Your staff request',
      approve ? 'Your staff access was approved. Sign out and back in if your dashboard does not update straight away.'
        : 'Your staff verification request was not approved. Contact your administrator if this is a mistake.');
    window.ownerAuditAppend(approve ? 'staff_approved' : 'staff_rejected', { userId: userId });
    toast(approve ? 'Approved' : 'Rejected', approve ? 'success' : 'info');
    refreshBadges();
    hydrateOwnerStaffVerification(mount);
  }

  window.FluxStaffPlatform = {
    pendingStaffRequestCount: pendingStaffRequestCount,
    hydrateOwnerStaffVerification: hydrateOwnerStaffVerification,
    teardownVerificationRealtime: function () {},
  };

  /* ---------- System health and backlog ---------- */

  function renderHealth(mount) {
    // The flag decides whether school admins see this widget. The owner always does.
    window.FluxFeatureFlags = window.FluxFeatureFlags || { isEnabled: function () { return true; } };
    mount.innerHTML = '<h2 class="own-h2">System health</h2><div id="ownHealth"></div>';
    window.FluxOpsHealth.renderHealthPanel(mount.querySelector('#ownHealth'));
  }

  function renderBacklog(mount) {
    mount.innerHTML = '<h2 class="own-h2">Master backlog</h2><p class="own-intro">Every improvement catalogued so far, with a filter.</p>' +
      '<button type="button" class="own-btn own-btn--primary" id="ownBacklogOpen">Open backlog</button>';
    mount.querySelector('#ownBacklogOpen').addEventListener('click', function () { window.openFluxMasterBacklog(); });
  }

  /* ---------- Sidebar badges ---------- */

  function setBadge(id, n) {
    var el = document.getElementById(id);
    if (!el) return;
    el.textContent = n > 99 ? '99+' : String(n || '');
    el.hidden = !n;
  }
  function refreshBadges() {
    pendingStaffRequestCount().then(function (n) { setBadge('osBadge-staffverify', n); });
    count('flux_password_help', function (q) { return q.eq('handled', false); }).then(function (n) { setBadge('osBadge-pwhelp', n); });
    var inbox = window.load('flux_feedback_inbox', []) || [];
    setBadge('osBadge-feedback', inbox.filter(function (e) { return e && Date.now() - Number(e.t || 0) < 864e5; }).length);
    count('flux_owner_alerts', function (q) { return q.is('seen_at', null); }).then(function (n) { setBadge('osBadge-alerts', n); });
  }

  window.FluxOwnerPanels = {
    renderToday: renderToday,
    renderPasswordHelp: renderPasswordHelp,
    renderPlannerTabs: renderPlannerTabs,
    renderHealth: renderHealth,
    renderBacklog: renderBacklog,
    refreshBadges: refreshBadges,
  };
})();
