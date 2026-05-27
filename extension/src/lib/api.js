/**
 * api.js — fetch the planner's config (no hardcoded URLs) and call the AI proxy.
 *
 * Config priority:
 *   1. extension storage `flux_config` (cached for 24h)
 *   2. fetch from https://<configured-host>/config.json
 *   3. baked-in fallback (so the extension still works if the host is down)
 *
 * The user can override the host in popup → "Planner host".
 */
import { localStorage as lsx } from './browser-shim.js';

const CONFIG_CACHE_KEY = 'flux_config';
const HOST_OVERRIDE_KEY = 'flux_planner_host';

const FALLBACK_CONFIG = {
  // Replace at install time via popup → Planner host
  ai_proxy_url: '',
  app_url: 'https://azfermohammed.github.io/Fluxplanner/',
};

let _configPromise = null;

export async function getConfig({ refresh = false } = {}) {
  if (!refresh && _configPromise) return _configPromise;
  _configPromise = (async () => {
    const cached = await lsx.get(CONFIG_CACHE_KEY);
    if (!refresh && cached && cached.exp && Date.now() < cached.exp) return cached.v;
    const hostOverride = await lsx.get(HOST_OVERRIDE_KEY);
    const url = (hostOverride || FALLBACK_CONFIG.app_url).replace(/\/+$/, '') + '/config.json';
    try {
      const res = await fetch(url, { cache: 'no-cache' });
      if (res.ok) {
        const v = await res.json();
        await lsx.set(CONFIG_CACHE_KEY, { v, exp: Date.now() + 24 * 3600 * 1000 });
        return v;
      }
    } catch (_) {}
    return cached ? cached.v : FALLBACK_CONFIG;
  })();
  return _configPromise;
}

export async function setPlannerHost(host) {
  await lsx.set(HOST_OVERRIDE_KEY, host);
  _configPromise = null;
  return getConfig({ refresh: true });
}

/** Call the AI proxy. messages should follow the planner's existing shape. */
export async function callAI({ system, messages, model, context }) {
  const cfg = await getConfig();
  if (!cfg.ai_proxy_url) throw new Error('AI proxy URL not configured. Open the extension popup and set Planner host.');
  const auth = await getAuthHeaders();
  const res = await fetch(cfg.ai_proxy_url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...auth },
    body: JSON.stringify({ system, messages, model, context }),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`AI ${res.status}: ${text.slice(0, 200)}`);
  }
  const data = await res.json().catch(() => null);
  const txt = data && data.content && data.content[0] && typeof data.content[0].text === 'string'
    ? data.content[0].text
    : '';
  return { text: txt, raw: data };
}

async function getAuthHeaders() {
  const tok = await lsx.get('flux_auth_token');
  if (!tok) return {};
  return { 'Authorization': 'Bearer ' + tok };
}
