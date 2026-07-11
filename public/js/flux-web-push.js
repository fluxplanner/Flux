/**
 * C7 — Web Push opt-in (flag enable_web_push).
 *
 * Settings → Alerts card: one switch. Opting in requests notification
 * permission, subscribes via the service worker's PushManager (VAPID public
 * key from window.FLUX_VAPID_PUBLIC_KEY, set at deploy), and stores the
 * subscription in push_subscriptions (owner-only RLS). Opting out
 * unsubscribes AND deletes the row.
 *
 * Sending policy lives server-side in notify-push (quiet hours, panic,
 * overnight suppression) — this module only manages the subscription.
 */
(function () {
  'use strict';
  if (window.FluxWebPush) return;

  const FLAG = 'enable_web_push';

  function enabled() {
    try { return !!window.FluxFeatureFlags?.isEnabled(FLAG, false); } catch (_) { return false; }
  }
  function client() { return typeof window.getSB === 'function' ? window.getSB() : null; }
  function vapidKey() { return String(window.FLUX_VAPID_PUBLIC_KEY || '').trim(); }

  function supported() {
    return 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
  }

  function urlBase64ToUint8Array(base64) {
    const pad = '='.repeat((4 - (base64.length % 4)) % 4);
    const b64 = (base64 + pad).replace(/-/g, '+').replace(/_/g, '/');
    const raw = atob(b64);
    return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)));
  }

  async function currentSubscription() {
    if (!supported()) return null;
    try {
      const reg = await navigator.serviceWorker.ready;
      return await reg.pushManager.getSubscription();
    } catch (_) { return null; }
  }

  async function subscribe() {
    if (!supported()) return { ok: false, error: 'Push is not supported in this browser.' };
    if (!vapidKey()) return { ok: false, error: 'Push keys are not configured for this deployment.' };
    const sb = client();
    if (!sb || !window.currentUser) return { ok: false, error: 'Sign in to enable reminders.' };
    try {
      const perm = await Notification.requestPermission();
      if (perm !== 'granted') return { ok: false, error: 'Notifications were not allowed.' };
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidKey()),
      });
      const j = sub.toJSON();
      const { error } = await sb.from('push_subscriptions').upsert({
        user_id: window.currentUser.id,
        endpoint: sub.endpoint,
        p256dh: j.keys?.p256dh || '',
        auth: j.keys?.auth || '',
        user_agent: String(navigator.userAgent || '').slice(0, 200),
      }, { onConflict: 'endpoint' });
      if (error) return { ok: false, error: error.message };
      try { window.FluxTelemetry?.track?.('web_push_opt_in', {}); } catch (_) {}
      return { ok: true };
    } catch (e) {
      return { ok: false, error: String(e && e.message || e) };
    }
  }

  async function unsubscribe() {
    const sb = client();
    try {
      const sub = await currentSubscription();
      if (sub) {
        if (sb) await sb.from('push_subscriptions').delete().eq('endpoint', sub.endpoint);
        await sub.unsubscribe();
      }
      return { ok: true };
    } catch (e) {
      return { ok: false, error: String(e && e.message || e) };
    }
  }

  /* ── Settings → Alerts card ── */

  function renderCard(host, state) {
    host.innerHTML = `<div style="font-weight:800;margin-bottom:2px">Due-soon reminders</div>
      <div style="font-size:.74rem;color:var(--muted2);margin-bottom:10px">A calm heads-up when work is due within a day — even with Flux closed. Honors your quiet hours; nothing sends overnight.</div>
      ${state.supported ? `
        <label style="display:flex;gap:8px;align-items:center;cursor:pointer;font-size:.84rem">
          <input type="checkbox" id="fluxPushToggle" ${state.subscribed ? 'checked' : ''}>
          Push notifications on this device
        </label>
        <div id="fluxPushStatus" style="font-size:.72rem;color:var(--muted);margin-top:6px">${state.subscribed ? 'On for this device.' : 'Off.'}</div>
      ` : '<div style="font-size:.78rem;color:var(--muted)">This browser does not support push notifications.</div>'}`;
    const toggle = host.querySelector('#fluxPushToggle');
    if (!toggle) return;
    toggle.addEventListener('change', async () => {
      const status = host.querySelector('#fluxPushStatus');
      toggle.disabled = true;
      const r = toggle.checked ? await subscribe() : await unsubscribe();
      toggle.disabled = false;
      if (!r.ok) {
        toggle.checked = !toggle.checked;
        if (status) status.textContent = r.error;
        return;
      }
      if (status) status.textContent = toggle.checked ? 'On for this device.' : 'Off.';
      showToast?.(toggle.checked ? 'Reminders on' : 'Reminders off', 'success');
    });
  }

  async function injectCard() {
    if (!enabled()) { document.getElementById('fluxWebPushCard')?.remove(); return; }
    const panel = document.getElementById('settings');
    if (!panel || document.getElementById('fluxWebPushCard')) return;
    const host = document.createElement('div');
    host.id = 'fluxWebPushCard';
    host.className = 'card';
    host.style.cssText = 'margin-top:14px;padding:16px';
    panel.appendChild(host);
    const sub = await currentSubscription();
    renderCard(host, { supported: supported(), subscribed: !!sub });
  }

  function boot() {
    document.addEventListener('flux-nav', (e) => {
      if (e?.detail?.panel === 'settings' && enabled()) setTimeout(injectCard, 400);
    });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();

  window.FluxWebPush = { FLAG, enabled, supported, subscribe, unsubscribe, currentSubscription, renderCard, injectCard };
})();
