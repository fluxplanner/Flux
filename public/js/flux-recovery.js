/**
 * flux-recovery.js — recovery email and "forgot my password" by email.
 *
 * The browser side of supabase/functions/account-recovery. Three jobs:
 *
 *   1. Settings → Account → "Recovery email": add, change or remove the one
 *      real address kept beside an account. It is used for a reset link and
 *      nothing else, and it only counts once the person has clicked the
 *      confirmation link sent to it.
 *   2. The links in those emails land on index.html#flux-verify=… and
 *      index.html#flux-reset=…  They are handled here, and the token is taken
 *      out of the address bar straight away so it is not left in history.
 *   3. requestReset(name), called by the sign-in screen's "Forgot your
 *      password?" button.
 *
 * Nothing is stored in the browser. Every button here carries a class: the
 * planner turns a class-less button into a primary pill.
 */
(function () {
  'use strict';
  if (window.FluxRecovery) return;

  var MODAL_ID = 'fluxRecoveryModal';
  var lastStatusAt = 0;

  function el(id) { return document.getElementById(id); }
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  /** POST to the function. Never throws: { ok:false, error } on any failure. */
  async function call(action, payload, signedIn) {
    try {
      var token = SB_ANON;
      if (signedIn) {
        var sb = typeof getSB === 'function' ? getSB() : null;
        var s = sb && sb.auth ? await sb.auth.getSession() : null;
        token = s && s.data && s.data.session ? s.data.session.access_token : '';
        if (!token) return { ok: false, error: 'You need to be signed in.' };
      }
      var res = await fetch(SB_URL + '/functions/v1/account-recovery', {
        method: 'POST',
        headers: { Authorization: 'Bearer ' + token, apikey: SB_ANON, 'Content-Type': 'application/json' },
        body: JSON.stringify(Object.assign({ action: action }, payload || {})),
      });
      var data = await res.json().catch(function () { return {}; });
      if (!res.ok) return Object.assign({}, data, { ok: false, error: data.error || 'Something went wrong. Try again in a moment.' });
      return Object.assign({ ok: true }, data);
    } catch (e) {
      return { ok: false, error: 'Could not reach Flux. Check your internet connection.' };
    }
  }

  /* ── 1. Settings card ─────────────────────────────────────────────────── */

  function setMsg(text, kind) {
    var m = el('recMsg');
    if (!m) return;
    m.textContent = text || '';
    m.classList.toggle('ok', kind === 'ok');
    m.classList.toggle('bad', kind === 'bad');
  }

  function paint(st) {
    var status = el('recStatus');
    var input = el('recEmail');
    var remove = el('recRemoveBtn');
    var save = el('recSaveBtn');
    if (!status || !input) return;
    var has = !!(st && st.email);
    if (!has) {
      status.textContent = 'Add an email so you can reset a forgotten password yourself. It is used for that and nothing else.';
    } else if (st.verified) {
      status.textContent = 'Reset links go to ' + st.email + '. Confirmed.';
    } else {
      status.textContent = 'Waiting for you to click the link sent to ' + st.email + '. Until then it cannot be used. Save again to send a new link.';
    }
    if (has && document.activeElement !== input) input.value = st.email;
    if (remove) remove.hidden = !has;
    if (save) save.textContent = has ? 'Save and send a new link' : 'Save and send confirmation';
  }

  async function refresh(force) {
    if (!el('fluxRecoveryCard')) return;
    if (!force && Date.now() - lastStatusAt < 20000) return;
    lastStatusAt = Date.now();
    var r = await call('status', null, true);
    if (r.ok) paint(r);
  }

  async function withButton(id, busyText, fn) {
    var b = el(id);
    var prev = b ? b.textContent : '';
    if (b) { b.disabled = true; b.textContent = busyText; }
    try { return await fn(); } finally { if (b) { b.disabled = false; if (b.textContent === busyText) b.textContent = prev; } }
  }

  function save() {
    var email = (el('recEmail') && el('recEmail').value || '').trim();
    var password = el('recPassword') ? el('recPassword').value : '';
    if (!email) { setMsg('Type the email address first.', 'bad'); return; }
    if (!password) { setMsg('Type your current password too, so we know it is you.', 'bad'); return; }
    setMsg('');
    return withButton('recSaveBtn', 'Sending…', async function () {
      var r = await call('set_email', { email: email, password: password }, true);
      if (el('recPassword')) el('recPassword').value = '';
      if (!r.ok && r.code !== 'send_failed') { setMsg(r.error, 'bad'); return; }
      paint(r);
      if (r.ok && r.verified) setMsg('That address is already confirmed.', 'ok');
      else if (r.ok) setMsg('Check ' + r.email + ' and click the link to confirm it.', 'ok');
      else setMsg(r.error, 'bad');
    });
  }

  function remove() {
    var password = el('recPassword') ? el('recPassword').value : '';
    if (!password) { setMsg('Type your current password to remove the email.', 'bad'); return; }
    setMsg('');
    return withButton('recRemoveBtn', 'Removing…', async function () {
      var r = await call('remove_email', { password: password }, true);
      if (el('recPassword')) el('recPassword').value = '';
      if (!r.ok) { setMsg(r.error, 'bad'); return; }
      if (el('recEmail')) el('recEmail').value = '';
      paint(r);
      setMsg('Removed. Flux no longer has an email for you.', 'ok');
    });
  }

  /** Right after sign-up, with the password the person has just typed. */
  async function setAfterSignup(email, password) {
    email = String(email || '').trim();
    if (!email) return { ok: false, skipped: true };
    return call('set_email', { email: email, password: password }, true);
  }

  /* The card asks for its status when it scrolls into view, so it needs no
     hook into how Settings is opened. */
  function watchCard() {
    var card = el('fluxRecoveryCard');
    if (!card || !('IntersectionObserver' in window)) return;
    new IntersectionObserver(function (entries) {
      if (entries.some(function (e) { return e.isIntersecting; })) refresh(false);
    }).observe(card);
  }

  /* ── 3. Sign-in screen ────────────────────────────────────────────────── */

  function requestReset(username) { return call('request_reset', { username: username }, false); }

  /* ── 2. Links from the emails ─────────────────────────────────────────── */

  function closeModal() { var m = el(MODAL_ID); if (m) m.remove(); }

  function modal(title, bodyHtml) {
    closeModal();
    var ov = document.createElement('div');
    ov.id = MODAL_ID;
    ov.className = 'modal-overlay frc-overlay';
    ov.style.display = 'flex';
    // The sign-in screen is itself a full-page layer; this has to sit above it.
    ov.style.zIndex = '2147483000';
    ov.setAttribute('data-flux-no-dismiss', '');
    ov.innerHTML =
      '<div class="modal frc-modal" role="dialog" aria-modal="true" aria-labelledby="frcTitle">' +
        '<h3 class="frc-title" id="frcTitle">' + esc(title) + '</h3>' + bodyHtml +
      '</div>';
    document.body.appendChild(ov);
    return ov;
  }

  function note(title, text) {
    var ov = modal(title,
      '<p class="frc-text">' + esc(text) + '</p>' +
      '<div class="frc-foot"><button type="button" class="frc-btn frc-btn--primary" id="frcOk">OK</button></div>');
    ov.querySelector('#frcOk').addEventListener('click', closeModal);
    try { ov.querySelector('#frcOk').focus(); } catch (e) {}
  }

  async function handleVerify(token) {
    var r = await call('verify_email', { token: token }, false);
    if (r.ok) {
      note('Email confirmed', 'Reset links for your Flux account will go to ' + r.email + '. You can close this and carry on.');
      lastStatusAt = 0;
      refresh(true);
    } else {
      note('That link did not work', r.error + ' You can send a new one from Settings, under Account.');
    }
  }

  async function handleReset(token) {
    var check = await call('confirm_reset', { token: token }, false);
    if (!check.ok) {
      note('That link did not work', check.error + ' Use "Forgot your password?" on the sign-in screen to get another.');
      return;
    }
    var ov = modal('Choose a new password',
      '<p class="frc-text">For the Flux account <strong>' + esc(check.username) + '</strong>.</p>' +
      '<label class="frc-field">New password<input type="password" class="frc-input" id="frcPw1" autocomplete="new-password"></label>' +
      '<label class="frc-field">Type it again<input type="password" class="frc-input" id="frcPw2" autocomplete="new-password"></label>' +
      '<div class="frc-msg" id="frcMsg" role="status" aria-live="polite"></div>' +
      '<div class="frc-foot">' +
        '<button type="button" class="frc-btn frc-btn--ghost" id="frcCancel">Cancel</button>' +
        '<button type="button" class="frc-btn frc-btn--primary" id="frcSave">Save password</button>' +
      '</div>');
    var msg = ov.querySelector('#frcMsg');
    var saveBtn = ov.querySelector('#frcSave');
    ov.querySelector('#frcCancel').addEventListener('click', closeModal);
    async function submit() {
      var a = ov.querySelector('#frcPw1').value;
      var b = ov.querySelector('#frcPw2').value;
      if (!a) { msg.textContent = 'Type a new password.'; return; }
      if (a !== b) { msg.textContent = 'Those two passwords are not the same.'; return; }
      var weak = typeof window.fluxWeakPasswordReason === 'function' ? window.fluxWeakPasswordReason(a, check.username) : '';
      if (weak) { msg.textContent = weak; return; }
      msg.textContent = '';
      saveBtn.disabled = true; saveBtn.textContent = 'Saving…';
      var r = await call('confirm_reset', { token: token, password: a }, false);
      if (!r.ok) {
        msg.textContent = r.error;
        saveBtn.disabled = false; saveBtn.textContent = 'Save password';
        return;
      }
      /* Every device was signed out on the server. Drop this browser's copy of
         the old session too, then reload so the sign-in screen is what shows. */
      try { var sb = typeof getSB === 'function' ? getSB() : null; if (sb) await sb.auth.signOut({ scope: 'local' }); } catch (e) {}
      var okOv = modal('Password changed',
        '<p class="frc-text">Sign in as <strong>' + esc(r.username) + '</strong> with your new password. Every device that was signed in has been signed out.</p>' +
        '<div class="frc-foot"><button type="button" class="frc-btn frc-btn--primary" id="frcOk">Go to sign in</button></div>');
      okOv.querySelector('#frcOk').addEventListener('click', function () {
        try { sessionStorage.setItem('flux_reset_name', r.username); } catch (e) {}
        location.href = location.pathname;
      });
    }
    saveBtn.addEventListener('click', submit);
    ov.addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); submit(); } });
    try { ov.querySelector('#frcPw1').focus(); } catch (e) {}
  }

  /** Reads #flux-verify= / #flux-reset= and removes it from the address bar. */
  function takeLinkToken() {
    var m = String(location.hash || '').match(/^#flux-(verify|reset)=([A-Za-z0-9_-]{20,100})$/);
    if (!m) return null;
    try { history.replaceState(null, '', location.pathname + location.search); } catch (e) {}
    return { kind: m[1], token: m[2] };
  }

  function boot() {
    watchCard();
    // After a reset, put the name back in the sign-in box.
    try {
      var name = sessionStorage.getItem('flux_reset_name');
      if (name) {
        sessionStorage.removeItem('flux_reset_name');
        var box = el('loginUsername');
        if (box && !box.value) box.value = name;
      }
    } catch (e) {}
    if (link) (link.kind === 'verify' ? handleVerify : handleReset)(link.token);
  }

  // Taken before anything else runs, so no other code sees the token in the URL.
  var link = takeLinkToken();
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();

  window.FluxRecovery = {
    save: save, remove: remove, refresh: refresh,
    requestReset: requestReset, setAfterSignup: setAfterSignup,
  };
})();
