/* ============================================================================
   FLUX · Device check-in and ban lock screen

   Runs for everyone: on load and on sign-in, report this browser's device id,
   and show a lock screen if the server says this person, address or device is
   banned. The owner's side of moderation is in Owner Controls
   (flux-owner-moderation-panel.js).

   Enforcement lives on the server (flux_check_request), not here. The lock
   screen is only what a banned person sees, so deleting this file from a
   browser gets them a broken app rather than access.

   "Device" is a random id kept in this browser, not a hardware id. Web pages
   cannot read one. Fingerprinting was rejected on purpose: school-issued laptops
   are near identical, so a fingerprint ban would catch innocent classmates.
   ========================================================================== */
(function () {
  'use strict';
  if (window.FluxOwnerModeration) return;

  var DEVICE_KEY = 'flux_device_id_v1';
  var RECHECK_MS = 5 * 60 * 1000;
  var _lastUser = null;

  function sb() {
    try { return typeof window.getSB === 'function' ? window.getSB() : null; }
    catch (e) { return null; }
  }
  function me() {
    try { return window.currentUser || null; } catch (e) { return null; }
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

  window.FluxOwnerModeration = { checkIn: checkIn };

  setInterval(watchSignIn, 2000);
  setInterval(checkIn, RECHECK_MS);
  setTimeout(checkIn, 1500);
})();
