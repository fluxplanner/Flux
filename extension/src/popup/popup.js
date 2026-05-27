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
  ext.tabs.create({ url: cfg.app_url || 'https://azfermohammed.github.io/Fluxplanner/' });
});

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
