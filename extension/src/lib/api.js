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
  // Baked-in defaults so the extension works out of the box; the live
  // <app_url>/config.json overrides these, and popup → "Planner host"
  // overrides where that config is fetched from.
  ai_proxy_url: 'https://lfigdijuqmbensebnevo.supabase.co/functions/v1/ai-proxy',
  app_url: 'https://fluxplanner.github.io/Flux/',
  // Supabase publishable anon key (same one the web app ships in app.js) —
  // the platform rejects requests with no Authorization header.
  anon_key: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxmaWdkaWp1cW1iZW5zZWJuZXZvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMzNjEzMDgsImV4cCI6MjA4ODkzNzMwOH0.qG1d9DLKrs0qqLgAp-6UGdaU7xWvlg2sWq-oD-y2kVo',
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
        // Merge over the baked-in defaults so an older config.json that lacks
        // newer fields (e.g. anon_key) still yields a complete config.
        const v = { ...FALLBACK_CONFIG, ...(await res.json()) };
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
  // The proxy only understands {system, messages, model} — fold page context
  // into the system prompt so the model actually sees it.
  let sys = system || '';
  if (context) sys += '\n\n## Current page context\n' + String(context).slice(0, 6000);
  const res = await fetch(cfg.ai_proxy_url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...auth },
    body: JSON.stringify({ system: sys, messages, model }),
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
  if (tok) return { 'Authorization': 'Bearer ' + tok };
  // Signed out: authenticate as anon, like the web app does — Supabase
  // rejects requests with no Authorization header at the platform level.
  const cfg = await getConfig();
  if (cfg.anon_key) {
    return { 'Authorization': 'Bearer ' + cfg.anon_key, 'apikey': cfg.anon_key };
  }
  return {};
}
