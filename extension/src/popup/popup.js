import { ext, sidebar, tabs, runtime } from '../lib/browser-shim.js';
import { setPlannerHost, getConfig } from '../lib/api.js';

const $ = (id) => document.getElementById(id);

$('openSidebar').addEventListener('click', async () => {
  const t = await tabs.active();
  try {
    await sidebar.open({ tabId: t?.id });
    window.close();
  } catch (e) {
    $('status').textContent = 'Side rail not supported here; opening popup view.';
    setTimeout(() => window.close(), 1200);
  }
});

$('openWeb').addEventListener('click', async () => {
  const cfg = await getConfig();
  ext.tabs.create({ url: cfg.app_url || 'https://fluxplanner.github.io/Flux/' });
});

/* Sign in: open the planner with ?ext_auth=1 — after login it hands the
 * session back to the extension and the tab closes itself. */
async function refreshAuthUI() {
  let r = null;
  try { r = await runtime.sendMessage({ type: 'FLUX_GET_AUTH' }); } catch (_) {}
  const btn = $('signIn');
  if (r && r.ok && r.signedIn) {
    btn.textContent = 'Sign out' + (r.email ? ' (' + r.email + ')' : '');
    btn.dataset.mode = 'out';
  } else {
    btn.textContent = 'Sign in to Flux';
    btn.dataset.mode = 'in';
  }
}

$('signIn').addEventListener('click', async () => {
  if ($('signIn').dataset.mode === 'out') {
    try { await runtime.sendMessage({ type: 'FLUX_LOGOUT_FROM_WEB' }); } catch (_) {}
    $('status').textContent = '✓ Signed out.';
    refreshAuthUI();
    return;
  }
  const cfg = await getConfig();
  const base = (cfg.app_url || 'https://fluxplanner.github.io/Flux/').replace(/\/+$/, '');
  ext.tabs.create({ url: base + '/?ext_auth=1' });
  window.close();
});

refreshAuthUI();

getConfig().then((cfg) => {
  const host = (cfg && cfg.app_url) || '';
  $('host').value = host;
});

$('saveHost').addEventListener('click', async () => {
  const v = ($('host').value || '').trim();
  if (!v) return;
  try {
    await setPlannerHost(v);
    $('status').textContent = '✓ Host saved.';
  } catch (e) {
    $('status').textContent = '✗ ' + e.message;
  }
});
