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
export async function callAI(payload) {
  const { text } = await callAIStream(payload, null);
  return { text };
}

/**
 * Screenshots go through a two-stage pipeline: the vision model is only the
 * EYES (it transcribes the question/diagram literally — that it does well),
 * then the strong reasoning model does the actual solving. One-stage vision
 * models flub math constantly; this is the difference between Flux getting
 * homework right and wrong.
 */
async function transcribeScreen({ imageBase64, mimeType, messages }) {
  const last = messages && messages.length
    ? String(messages[messages.length - 1].content || '')
    : '';
  const res = await openAIRequest({
    system: 'You are the eyes of a tutoring assistant. Transcribe EXACTLY what is on the user\'s screen that is relevant to their request: the full question text, every answer choice, all given values and units, and a precise description of any diagram, graph, table, or equation. Be literal and complete. Do NOT solve, answer, or comment.',
    messages: [{ role: 'user', content: 'Transcribe the relevant parts of my screen. My request is: ' + last.slice(0, 500) }],
    imageBase64,
    mimeType,
    stream: false,
  });
  const data = await res.json().catch(() => null);
  return data?.content?.[0]?.text || '';
}

/**
 * Streaming variant — onDelta(textChunk) fires as tokens arrive.
 * Resolves with the full text. Falls back to a single JSON reply when the
 * proxy doesn't stream (direct vision, older deployments).
 */
export async function callAIStream({ system, messages, model, context, imageBase64, mimeType }, onDelta) {
  let sys = system || '';
  if (imageBase64) {
    const seen = await transcribeScreen({ imageBase64, mimeType, messages }).catch(() => '');
    if (seen) {
      sys += '\n\n## What is on the user\'s screen right now (transcribed from a live screenshot)\n' + seen.slice(0, 8000);
      imageBase64 = null;
      mimeType = null;
    }
    // Transcription failed → fall through with the image (direct vision).
  }
  const res = await openAIRequest({ system: sys, messages, model, context, imageBase64, mimeType, stream: !imageBase64 });
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
  // BYOK: route text turns through the user's own model when the planner
  // handed us a routing config (vision stays on the proxy's vision stack).
  if (!imageBase64) {
    try {
      const routing = await lsx.get('flux_ai_routing');
      if (routing && routing.mode) body.routing = routing;
    } catch (_) {}
  }
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
  const cfg = await getConfig();
  const bearer = (tok) => {
    const h = { 'Authorization': 'Bearer ' + tok };
    if (cfg.anon_key) h['apikey'] = cfg.anon_key;
    return h;
  };
  // Signed-in session handed off from the planner tab (see background.js
  // FLUX_AUTH_FROM_WEB); refresh it when it's about to expire.
  const sess = await lsx.get('flux_auth_session');
  if (sess && sess.access_token) {
    const expSoon = sess.expires_at && Date.now() / 1000 > sess.expires_at - 60;
    if (!expSoon) return bearer(sess.access_token);
    if (sess.refresh_token) {
      const next = await refreshSession(sess, cfg).catch(() => null);
      if (next) return bearer(next.access_token);
    }
    // Expired and unrefreshable — drop it and fall through to anon.
    await lsx.remove('flux_auth_session').catch(() => {});
  }
  // Signed out: authenticate as anon, like the web app does — Supabase
  // rejects requests with no Authorization header at the platform level.
  if (cfg.anon_key) return bearer(cfg.anon_key);
  return {};
}

async function refreshSession(sess, cfg) {
  const base = new URL(cfg.ai_proxy_url).origin; // https://<ref>.supabase.co
  const res = await fetch(base + '/auth/v1/token?grant_type=refresh_token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'apikey': cfg.anon_key || '' },
    body: JSON.stringify({ refresh_token: sess.refresh_token }),
  });
  if (!res.ok) throw new Error('refresh failed: ' + res.status);
  const j = await res.json();
  const next = {
    access_token: j.access_token,
    refresh_token: j.refresh_token || sess.refresh_token,
    expires_at: j.expires_at || Math.floor(Date.now() / 1000) + (j.expires_in || 3600),
    email: sess.email || j.user?.email || '',
  };
  await lsx.set('flux_auth_session', next);
  return next;
}
