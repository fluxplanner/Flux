// Lichess client: OAuth (PKCE, no app registration needed), JSON calls and
// ndjson streams. Docs: https://lichess.org/api

export const HOST = 'https://lichess.org';
const CLIENT_ID = 'flux-chess';
const SCOPES = 'board:play challenge:read challenge:write';
const TOKEN_KEY = 'fxc.token';
const PKCE_KEY = 'fxc.pkce';

const store = {
  get(k) { try { return localStorage.getItem(k); } catch { return null; } },
  set(k, v) { try { v == null ? localStorage.removeItem(k) : localStorage.setItem(k, v); } catch { /* private mode */ } },
};

export let token = store.get(TOKEN_KEY);

const redirectUri = () => location.origin + location.pathname;

function b64url(bytes) {
  return btoa(String.fromCharCode(...new Uint8Array(bytes))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export async function login() {
  const verifier = b64url(crypto.getRandomValues(new Uint8Array(48)));
  const state = b64url(crypto.getRandomValues(new Uint8Array(16)));
  const challenge = b64url(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier)));
  sessionStorage.setItem(PKCE_KEY, JSON.stringify({ verifier, state }));
  const q = new URLSearchParams({
    response_type: 'code',
    client_id: CLIENT_ID,
    redirect_uri: redirectUri(),
    scope: SCOPES,
    code_challenge_method: 'S256',
    code_challenge: challenge,
    state,
  });
  location.assign(`${HOST}/oauth?${q}`);
}

// Finishes the OAuth round trip if the URL carries ?code=…; returns an error
// message or null.
export async function handleRedirect() {
  const url = new URL(location.href);
  const code = url.searchParams.get('code');
  const err = url.searchParams.get('error');
  if (!code && !err) return null;
  history.replaceState(null, '', redirectUri() + url.hash);
  if (err) return url.searchParams.get('error_description') || err;
  let saved = null;
  try { saved = JSON.parse(sessionStorage.getItem(PKCE_KEY)); } catch { /* ignore */ }
  sessionStorage.removeItem(PKCE_KEY);
  if (!saved || saved.state !== url.searchParams.get('state')) return 'Login expired — try again.';
  const res = await fetch(`${HOST}/api/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      code_verifier: saved.verifier,
      redirect_uri: redirectUri(),
      client_id: CLIENT_ID,
    }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.access_token) return data.error_description || data.error || 'Lichess refused the login.';
  token = data.access_token;
  store.set(TOKEN_KEY, token);
  return null;
}

export async function logout() {
  if (token) fetch(`${HOST}/api/token`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } }).catch(() => {});
  token = null;
  store.set(TOKEN_KEY, null);
}

function headers(extra) {
  const h = { ...extra };
  if (token) h.Authorization = `Bearer ${token}`;
  return h;
}

export class LichessError extends Error {}

export async function api(path, { method = 'GET', form, signal } = {}) {
  const init = { method, headers: headers({ Accept: 'application/json' }), signal };
  if (form) {
    init.body = new URLSearchParams(Object.entries(form).filter(([, v]) => v !== undefined && v !== null && v !== ''));
    init.headers['Content-Type'] = 'application/x-www-form-urlencoded';
  }
  const res = await fetch(HOST + path, init);
  if (res.status === 401) { token = null; store.set(TOKEN_KEY, null); }
  const text = await res.text();
  let data = null;
  try { data = text ? JSON.parse(text) : null; } catch { data = text; }
  if (!res.ok) {
    const msg = (data && (data.error || data.message)) || `${res.status} ${res.statusText}`;
    throw new LichessError(typeof msg === 'string' ? msg : JSON.stringify(msg));
  }
  return data;
}

// Reads an ndjson stream, calling onEvent for each object. Resolves when the
// server closes it; rejects on HTTP errors. Abort with the signal.
export async function stream(path, onEvent, { method = 'GET', form, signal } = {}) {
  const init = { method, headers: headers({ Accept: 'application/x-ndjson' }), signal };
  if (form) {
    init.body = new URLSearchParams(Object.entries(form).filter(([, v]) => v !== undefined && v !== null && v !== ''));
    init.headers['Content-Type'] = 'application/x-www-form-urlencoded';
  }
  const res = await fetch(HOST + path, init);
  if (!res.ok) {
    const data = await res.json().catch(() => null);
    throw new LichessError((data && (data.error || JSON.stringify(data))) || `${res.status} ${res.statusText}`);
  }
  const reader = res.body.getReader();
  const dec = new TextDecoder();
  let buf = '';
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buf += dec.decode(value, { stream: true });
    let nl;
    while ((nl = buf.indexOf('\n')) >= 0) {
      const line = buf.slice(0, nl).trim();
      buf = buf.slice(nl + 1);
      if (line) {
        try { onEvent(JSON.parse(line)); } catch (e) { console.warn('[lichess] bad line', e); }
      }
    }
  }
}
