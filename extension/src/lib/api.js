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
export async function callAI({ system, messages, model, context, imageBase64, mimeType }) {
  const res = await openAIRequest({ system, messages, model, context, imageBase64, mimeType, stream: false });
  const data = await res.json().catch(() => null);
  const txt = data && data.content && data.content[0] && typeof data.content[0].text === 'string'
    ? data.content[0].text
    : '';
  return { text: txt, raw: data };
}

/**
 * Streaming variant — onDelta(textChunk) fires as tokens arrive.
 * Resolves with the full text. Falls back to a single JSON reply when the
 * proxy doesn't stream (vision requests, older deployments).
 */
export async function callAIStream({ system, messages, model, context, imageBase64, mimeType }, onDelta) {
  const res = await openAIRequest({ system, messages, model, context, imageBase64, mimeType, stream: true });
  const ctype = String(res.headers.get('content-type') || '');
  if (ctype.indexOf('text/event-stream') < 0 || !res.body) {
    const data = await res.json().catch(() => null);
    const txt = data?.content?.[0]?.text || '';
    if (txt && onDelta) onDelta(txt);
    return { text: txt };
  }
  const reader = res.body.getReader();
  const dec = new TextDecoder();
  let buf = '', full = '', streamErr = '';
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += dec.decode(value, { stream: true });
    let nl;
    while ((nl = buf.indexOf('\n')) >= 0) {
      const line = buf.slice(0, nl).trim();
      buf = buf.slice(nl + 1);
      if (line.indexOf('data:') !== 0) continue;
      const data = line.slice(5).trim();
      if (!data || data === '[DONE]') continue;
      let j = null;
      try { j = JSON.parse(data); } catch (_) { continue; }
      if (j && j.error) { streamErr = String(j.error); continue; }
      if (j && typeof j.delta === 'string' && j.delta) {
        full += j.delta;
        if (onDelta) onDelta(j.delta);
      }
    }
  }
  if (!full && streamErr) throw new Error(streamErr);
  return { text: full };
}

async function openAIRequest({ system, messages, model, context, imageBase64, mimeType, stream }) {
  const cfg = await getConfig();
  if (!cfg.ai_proxy_url) throw new Error('AI proxy URL not configured. Open the extension popup and set Planner host.');
  const auth = await getAuthHeaders();
  // The proxy only understands {system, messages, …} — fold page context
  // into the system prompt so the model actually sees it.
  let sys = system || '';
  if (context) sys += '\n\n## Current page context\n' + String(context).slice(0, 9000);
  const body = { system: sys, messages, model };
  if (imageBase64) { body.imageBase64 = imageBase64; body.mimeType = mimeType || 'image/png'; }
  else if (stream) body.stream = true;
  const res = await fetch(cfg.ai_proxy_url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...auth },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`AI ${res.status}: ${text.slice(0, 200)}`);
  }
  return res;
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
