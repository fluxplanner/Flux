/* ============================================================================
   FLUX · Settings › Account › Your roles

   Shows the roles the owner gave this account (Owner Controls › Roles): each
   role's name and colour, and what it lets them do in plain words. The card
   stays hidden for anyone without a role.

   Being given a role also sends a pop-up: a database trigger writes it to
   owner_direct_messages, and flux-owner-messages.js shows it the next time
   the planner opens.

   Role names are typed by the owner, and go through esc() all the same.
   ========================================================================== */
(function () {
  'use strict';
  if (window.FluxMyRoles) return;

  function esc(v) {
    return String(v == null ? '' : v).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function sb() {
    try { return typeof window.getSB === 'function' ? window.getSB() : null; } catch (e) { return null; }
  }
  /* app.js keeps currentUser as a top-level `let`, shared by every classic
     script but not always copied onto window. */
  function signedIn() {
    try {
      /* global currentUser */
      var u = typeof currentUser !== 'undefined' ? currentUser : window.currentUser;
      return !!(u && u.id);
    } catch (e) { return false; }
  }
  function describe(key) {
    var v = window.FluxAppVisibility;
    return v && v.describe ? v.describe(key) : key;
  }
  function safeColor(c) {
    return /^#[0-9a-fA-F]{6}$/.test(c || '') ? c : '#7c5cff';
  }

  function paint(roles) {
    var card = document.getElementById('fluxMyRolesCard');
    var mount = document.getElementById('fluxMyRoles');
    if (!card || !mount) return;
    card.hidden = !roles.length;
    mount.innerHTML = roles.map(function (r) {
      var perms = (r.permissions || []).map(describe);
      return '<div class="srow fx-my-role" style="align-items:flex-start;gap:10px">' +
        '<span aria-hidden="true" style="width:12px;height:12px;border-radius:50%;flex:none;margin-top:5px;background:' + safeColor(r.color) + '"></span>' +
        '<div style="flex:1;min-width:0"><div class="slabel">' + esc(r.name) + '</div>' +
        '<div class="ssub">' + (perms.length ? esc(perms.join(' · ')) : 'Nothing switched on yet') + '</div></div></div>';
    }).join('');
  }

  var _inFlight = null;
  function refresh() {
    var c = sb();
    if (!c || typeof c.rpc !== 'function' || !signedIn()) { paint([]); return Promise.resolve([]); }
    if (_inFlight) return _inFlight;
    _inFlight = c.rpc('flux_my_roles').then(function (res) {
      var roles = res && !res.error && Array.isArray(res.data) ? res.data : [];
      paint(roles);
      return roles;
    }, function () { return []; }).then(function (roles) { _inFlight = null; return roles; });
    return _inFlight;
  }

  // Redrawn whenever Settings opens, and when this viewer's permissions change.
  document.addEventListener('flux-nav', function (ev) {
    if (ev.detail && ev.detail.panel === 'settings') refresh();
  });
  window.addEventListener('flux-app-visibility', function () {
    if (signedIn()) refresh();
  });

  window.FluxMyRoles = { refresh: refresh };
})();
