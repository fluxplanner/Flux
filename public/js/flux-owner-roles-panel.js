/* ============================================================================
   FLUX · Owner Controls › Roles

   Roles the owner makes and hands out, like Discord roles: each has a name, a
   colour and a set of switches for what it allows. Anyone holding a role gets
   every switch that is on: hidden apps, hidden planner tabs, getting through
   maintenance or read-only mode, posting during a lockdown or slow-down, and
   tester mode. A partner previews their own app privately this way: hide the
   app (Hide apps), then give the partner a role that can see it.

   The database refuses all of this to anyone but the owner (migration
   20261108144649_flux_custom_roles). Visitors' pages learn their own
   permissions through flux_my_permissions() in flux-app-visibility.js.
   Usernames come from the database, so they go through esc().
   ========================================================================== */
(function () {
  'use strict';

  var COLORS = ['#7c5cff', '#e4776b', '#2fb380', '#3b8beb', '#f2a93b', '#e0569b', '#8a8f98'];
  var _roles = [];
  var _hidden = [];
  var _hiddenTabs = [];
  var _open = null;

  function sb() { return window.getSB(); }
  function esc(v) {
    return String(v == null ? '' : v).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function toast(msg, kind) { window.showToast(msg, kind || 'info'); }
  function audit(action, detail) {
    try { window.ownerAuditAppend(action, detail); } catch (e) { /* never blocks the action */ }
  }
  function friendly(e) {
    if (e && (e.code === 'PGRST202' || e.code === '42P01' || e.code === 'PGRST205')) {
      return 'Roles need their database update, which has not been applied yet.';
    }
    return (e && e.message) || 'That did not work';
  }
  /* A refused write under row-level security returns no rows and no error. */
  function saved(res) {
    if (res.error) throw res.error;
    if (!(res.data || []).length) throw new Error('The database refused the change');
    return res.data;
  }

  /** Every app a role can show: the Suite directory minus the planner and owner-only tiles. */
  function apps() {
    return ((window.FluxHub && window.FluxHub.PRODUCTS) || []).filter(function (p) {
      return p.id !== 'planner' && !p.ownerOnly;
    });
  }

  function dot(color) {
    return '<span class="own-role-dot" style="background:' + esc(color) + '"></span>';
  }

  function listHtml() {
    var rows = _roles.map(function (r) {
      return '<button type="button" class="own-role-item' + (r.id === _open ? ' is-open' : '') + '" data-act="open" data-id="' + esc(r.id) + '">' +
        dot(r.color) + '<span class="own-role-name">' + esc(r.name) + '</span>' +
        '<span class="own-muted">' + r.members.length + '</span></button>';
    }).join('');
    return '<div class="own-role-list">' +
      '<button type="button" class="own-btn own-btn--primary own-btn--sm" data-act="new">New role</button>' +
      (rows || '<p class="own-muted">No roles yet.</p>') + '</div>';
  }

  function plannerTabs() {
    return (window.FluxOwnerPanels && window.FluxOwnerPanels.PLANNER_TABS) || [];
  }

  /** Every switch a role can have, in groups: [{ title, items: [{ key, label, note, mark }] }]. */
  function catalog(role) {
    var hiddenNote = function (isHidden) {
      return isHidden ? 'Hidden from the public, so only roles with this (and you) see it'
        : 'Public right now: this only matters while it is hidden';
    };
    var appItems = [{ key: 'apps:all', label: 'See every hidden app', note: 'Every app you hide, now and later. Good for testers.' }]
      .concat(apps().map(function (p) {
        return { key: 'app:' + p.id, label: 'See ' + p.name, note: hiddenNote(_hidden.indexOf(p.id) >= 0), mark: p.mark };
      }));
    var tabItems = [{ key: 'tabs:all', label: 'See every hidden planner tab', note: 'Every tab you hide in Planner tabs, now and later.' }]
      .concat(plannerTabs().map(function (t) {
        return { key: 'tab:' + t[0], label: 'See the ' + t[1] + ' tab', note: hiddenNote(_hiddenTabs.indexOf(t[0]) >= 0) };
      }));
    var groups = [
      { title: 'Apps', items: appItems },
      { title: 'Planner tabs', items: tabItems },
      { title: 'Site mode', items: [
        { key: 'site:maintenance', label: 'Use Flux during maintenance', note: 'No maintenance screen, and saving still works.' },
        { key: 'site:read_only', label: 'Keep saving while Flux is read-only', note: 'Their changes still reach the cloud.' },
      ] },
      { title: 'Posting', items: [
        { key: 'posting:lockdown', label: 'Post while posting is paused', note: 'Ignores the lockdown in Moderation. A mute still applies.' },
        { key: 'posting:slow', label: 'Skip slow-downs', note: 'Posts without waiting, even if you slowed this account.' },
      ] },
      { title: 'Perks', items: [
        { key: 'perk:tester', label: 'Tester mode', note: 'Pro features and the tester badge, like the Testers list.' },
      ] },
    ];
    /* A permission no longer in the catalog (an app taken out of the directory) still shows, so it can be switched off. */
    var listed = [];
    groups.forEach(function (g) { g.items.forEach(function (i) { listed.push(i.key); }); });
    var extra = role.permissions.filter(function (k) { return listed.indexOf(k) < 0; });
    if (extra.length) groups.push({ title: 'Other', items: extra.map(function (k) { return { key: k, label: k, note: 'No longer listed' }; }) });
    return groups;
  }

  function permissionCount() {
    return catalog({ permissions: [] }).reduce(function (n, g) { return n + g.items.length; }, 0);
  }

  function permissionsHtml(role) {
    return catalog(role).map(function (g) {
      var on = g.items.filter(function (i) { return role.permissions.indexOf(i.key) >= 0; }).length;
      return '<div class="own-role-group"><div class="own-role-group-h">' + esc(g.title) +
        ' <span class="own-muted">' + on + ' of ' + g.items.length + ' on</span></div>' +
        g.items.map(function (i) {
          var isOn = role.permissions.indexOf(i.key) >= 0;
          return '<div class="tab-row">' +
            '<span class="tab-row-icon">' + (i.mark || '') + '</span>' +
            '<span class="tab-row-name">' + esc(i.label) +
            '<small style="display:block;font-size:.72rem;font-weight:400;color:var(--muted)">' + esc(i.note) + '</small></span>' +
            '<button type="button" class="tab-row-toggle' + (isOn ? ' on' : '') + '" role="switch" aria-checked="' + isOn +
            '" aria-label="' + esc(role.name) + ': ' + esc(i.label) + '" data-act="perm" data-perm="' + esc(i.key) + '"></button>' +
            '</div>';
        }).join('') + '</div>';
    }).join('');
  }

  function editorHtml() {
    var role = current();
    if (!role) return '<div class="own-card own-muted">Pick a role, or make a new one.</div>';
    var swatches = COLORS.map(function (c) {
      return '<button type="button" class="own-role-swatch' + (c === role.color ? ' is-on' : '') + '" style="background:' + c +
        '" data-act="color" data-color="' + c + '" aria-label="Colour ' + c + '"></button>';
    }).join('');
    var members = role.members.length ? role.members.map(function (m) {
      return '<div class="own-role-member">' + dot(role.color) + '<b>' + esc(m.username || m.user_id) + '</b>' +
        '<button type="button" class="own-btn own-btn--sm" data-act="unassign" data-user="' + esc(m.user_id) + '">Remove</button></div>';
    }).join('') : '<p class="own-muted">Nobody has this role yet.</p>';
    return '<div class="own-card">' +
      '<div class="own-eyebrow">Name and colour</div>' +
      '<div class="own-filters"><input id="ownRoleName" class="own-input" maxlength="40" value="' + esc(role.name) + '" aria-label="Role name">' +
      '<button type="button" class="own-btn own-btn--sm" data-act="rename">Save name</button></div>' +
      '<div class="own-role-swatches">' + swatches + '</div></div>' +
      '<div class="own-card"><div class="own-eyebrow">What this role can do (' + role.permissions.length + ' of ' + permissionCount() + ')</div>' +
      permissionsHtml(role) + '</div>' +
      '<div class="own-card"><div class="own-eyebrow">People with this role (' + role.members.length + ')</div>' +
      '<div class="own-filters"><input id="ownRoleUser" class="own-input" type="search" placeholder="Username" aria-label="Username to add" autocomplete="off">' +
      '<button type="button" class="own-btn own-btn--primary own-btn--sm" data-act="assign">Add</button></div>' +
      members + '</div>' +
      '<div class="own-actions"><button type="button" class="own-btn own-btn--sm own-btn--danger" data-act="delete">Delete role</button></div>';
  }

  function current() {
    return _roles.filter(function (r) { return r.id === _open; })[0];
  }

  function draw(mount) {
    mount.innerHTML =
      '<p class="own-intro">Make a role, switch on what it can do, and add people to it. Only you can see or change roles. ' +
      'To let a partner preview their app privately: hide the app in Hide apps, then give the partner a role that can see it.</p>' +
      '<div class="own-roles">' + listHtml() + '<div class="own-role-editor">' + editorHtml() + '</div></div>';
  }

  async function load(mount) {
    var res = await sb().rpc('flux_owner_roles');
    if (res.error) throw res.error;
    _roles = res.data || [];
    var hid = await sb().from('flux_hidden_apps').select('app_id');
    _hidden = hid.error ? [] : (hid.data || []).map(function (r) { return r.app_id; });
    var ui = await sb().from('platform_settings').select('value').eq('key', 'ui').maybeSingle();
    _hiddenTabs = (!ui.error && ui.data && ui.data.value && ui.data.value.hiddenTabs) || [];
    if (_open && !current()) _open = null;
    if (!_open && _roles.length) _open = _roles[0].id;
    draw(mount);
  }

  async function handle(el, mount) {
    var act = el.getAttribute('data-act');
    var role = current();
    if (act === 'open') {
      _open = el.getAttribute('data-id');
      return draw(mount);
    }
    if (act === 'new') {
      var name = (window.prompt('Name the new role') || '').trim().slice(0, 40);
      if (!name) return;
      var made = saved(await sb().from('flux_roles').insert({ name: name, color: COLORS[_roles.length % COLORS.length] }).select());
      _open = made[0].id;
      audit('role_created', { role: name });
      return load(mount);
    }
    if (!role) return;
    if (act === 'rename') {
      var next = document.getElementById('ownRoleName').value.trim().slice(0, 40);
      if (!next) return toast('Give the role a name', 'error');
      saved(await sb().from('flux_roles').update({ name: next }).eq('id', role.id).select());
      audit('role_renamed', { from: role.name, role: next });
      toast('Saved', 'success');
    } else if (act === 'color') {
      saved(await sb().from('flux_roles').update({ color: el.getAttribute('data-color') }).eq('id', role.id).select());
    } else if (act === 'perm') {
      var key = el.getAttribute('data-perm');
      var has = role.permissions.indexOf(key) >= 0;
      var perms = has ? role.permissions.filter(function (k) { return k !== key; }) : role.permissions.concat([key]);
      el.disabled = true;
      saved(await sb().from('flux_roles').update({ permissions: perms }).eq('id', role.id).select());
      audit(has ? 'role_permission_off' : 'role_permission_on', { role: role.name, permission: key });
    } else if (act === 'assign') {
      var typed = document.getElementById('ownRoleUser').value.trim();
      if (!typed) return;
      var found = await sb().rpc('flux_owner_find_user', { p_username: typed });
      if (found.error) throw found.error;
      if (!found.data) return toast('No account with that username', 'error');
      var add = await sb().from('flux_role_members').insert({ role_id: role.id, user_id: found.data }).select();
      if (add.error && add.error.code === '23505') return toast(typed + ' already has this role', 'info');
      saved(add);
      audit('role_assigned', { role: role.name, user: found.data });
      toast(typed + ' now has ' + role.name + '. It takes effect the next time they open a Flux page.', 'success');
    } else if (act === 'unassign') {
      var who = el.getAttribute('data-user');
      saved(await sb().from('flux_role_members').delete().eq('role_id', role.id).eq('user_id', who).select());
      audit('role_unassigned', { role: role.name, user: who });
    } else if (act === 'delete') {
      if (!window.confirm('Delete the role "' + role.name + '"? Everyone with it loses what it allowed.')) return;
      saved(await sb().from('flux_roles').delete().eq('id', role.id).select());
      audit('role_deleted', { role: role.name });
      _open = null;
    } else {
      return;
    }
    return load(mount);
  }

  function injectStyle() {
    if (document.getElementById('ownRolesStyle')) return;
    var st = document.createElement('style');
    st.id = 'ownRolesStyle';
    st.textContent =
      '.own-roles{display:grid;grid-template-columns:minmax(170px,230px) 1fr;gap:14px;align-items:start}' +
      '@media(max-width:720px){.own-roles{grid-template-columns:1fr}}' +
      '.own-role-list{display:flex;flex-direction:column;gap:4px}' +
      '.own-role-list .own-btn{margin-bottom:6px}' +
      '.own-role-item{display:flex!important;align-items:center;gap:8px;width:100%;padding:8px 10px!important;border-radius:8px!important;' +
      'background:transparent!important;border:1px solid transparent!important;color:inherit!important;text-align:left;font:inherit;cursor:pointer;box-shadow:none!important}' +
      '.own-role-item:hover,.own-role-item.is-open{background:var(--card2)!important}' +
      '.own-role-item.is-open{border-color:var(--border)!important}' +
      '.own-role-name{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-weight:600}' +
      '.own-role-dot{width:12px;height:12px;border-radius:50%;flex:none}' +
      '.own-role-swatches{display:flex;flex-wrap:wrap;gap:8px;margin-top:6px}' +
      '.own-role-swatch{width:30px!important;height:30px!important;min-height:0!important;padding:0!important;border-radius:50%!important;' +
      'border:2px solid transparent!important;cursor:pointer;box-shadow:none!important}' +
      '.own-role-swatch.is-on{border-color:var(--text)!important;box-shadow:0 0 0 2px var(--card)!important}' +
      '.own-role-group{display:flex;flex-direction:column;gap:8px;margin-top:12px}' +
      '.own-role-group:first-child{margin-top:4px}' +
      '.own-role-group-h{font-weight:700;font-size:.85rem}' +
      '.own-role-member{display:flex;align-items:center;gap:8px;padding:6px 0;border-top:1px solid var(--border)}' +
      '.own-role-member b{flex:1;min-width:0;overflow-wrap:anywhere}';
    document.head.appendChild(st);
  }

  window.FluxOwnerRolesPanel = {
    render: function (mount) {
      if (!mount) return;
      injectStyle();
      if (!mount.dataset.fluxRolesBound) {
        mount.dataset.fluxRolesBound = '1';
        mount.addEventListener('click', function (ev) {
          var el = ev.target.closest('[data-act]');
          if (!el || !mount.contains(el)) return;
          handle(el, mount).catch(function (e) {
            toast(friendly(e), 'error');
            load(mount).catch(function () { /* the toast already says why */ });
          });
        });
        mount.addEventListener('keydown', function (ev) {
          if (ev.key !== 'Enter') return;
          var act = ev.target.id === 'ownRoleUser' ? 'assign' : ev.target.id === 'ownRoleName' ? 'rename' : '';
          var btn = act && mount.querySelector('[data-act="' + act + '"]');
          if (btn) { ev.preventDefault(); btn.click(); }
        });
      }
      mount.textContent = 'Loading…';
      load(mount).catch(function (e) { mount.textContent = 'Could not load roles: ' + friendly(e); });
    },
  };
})();
