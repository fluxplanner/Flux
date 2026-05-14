/* global chrome */
/**
 * Google sign-in for the side panel — same Supabase project / PKCE flow as the Flux web app.
 * Requires Supabase Dashboard → Authentication → URL Configuration:
 * add the URL from chrome.identity.getRedirectURL() (use “Copy redirect URL” below).
 */
(function () {
  'use strict';

  const SB_URL = 'https://lfigdijuqmbensebnevo.supabase.co';
  const SB_ANON =
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxmaWdkaWp1cW1iZW5zZWJuZXZvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMzNjEzMDgsImV4cCI6MjA4ODkzNzMwOH0.qG1d9DLKrs0qqLgAp-6UGdaU7xWvlg2sWq-oD-y2kVo';

  const GOOGLE_SCOPES =
    'https://www.googleapis.com/auth/gmail.readonly https://www.googleapis.com/auth/calendar.readonly';

  function dec2hex(dec) {
    return ('0' + dec.toString(16)).substr(-2);
  }

  function generatePKCEVerifier() {
    const verifierLength = 56;
    const array = new Uint32Array(verifierLength);
    crypto.getRandomValues(array);
    return Array.from(array, dec2hex).join('');
  }

  async function sha256Utf8(verifier) {
    const enc = new TextEncoder();
    const buf = await crypto.subtle.digest('SHA-256', enc.encode(verifier));
    const bytes = new Uint8Array(buf);
    return Array.from(bytes, (c) => String.fromCharCode(c)).join('');
  }

  function stringToBase64URL(binStr) {
    return btoa(binStr).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
  }

  async function generatePKCEChallenge(verifier) {
    const hashed = await sha256Utf8(verifier);
    return stringToBase64URL(hashed);
  }

  function parseAuthCode(responseUrl) {
    const u = new URL(responseUrl);
    let code = u.searchParams.get('code');
    if (!code && u.hash && u.hash.length > 1) {
      const h = new URLSearchParams(u.hash.slice(1));
      code = h.get('code');
    }
    return code;
  }

  function jwtEmail(token) {
    try {
      const p = token.split('.')[1];
      const pad = p.length % 4 === 0 ? '' : '='.repeat(4 - (p.length % 4));
      const json = atob(p.replace(/-/g, '+').replace(/_/g, '/') + pad);
      const payload = JSON.parse(json);
      return payload.email || payload.user_metadata?.email || '';
    } catch {
      return '';
    }
  }

  /** @returns {number} JWT exp in ms, or 0 if missing */
  function decodeJwtExpMs(token) {
    if (!token || typeof token !== 'string') return 0;
    try {
      const p = token.split('.')[1];
      const pad = p.length % 4 === 0 ? '' : '='.repeat(4 - (p.length % 4));
      const json = JSON.parse(atob(p.replace(/-/g, '+').replace(/_/g, '/') + pad));
      return typeof json.exp === 'number' ? json.exp * 1000 : 0;
    } catch {
      return 0;
    }
  }

  /**
   * Supabase access tokens expire (~1h). Refresh using fluxRefreshToken so Edge getUser() stops returning Invalid JWT.
   */
  async function refreshSessionIfNeeded() {
    const store = await chrome.storage.local.get([
      'fluxAuthToken',
      'fluxRefreshToken',
      'fluxUserId',
      'fluxUserEmail',
    ]);
    let { fluxAuthToken, fluxRefreshToken, fluxUserId, fluxUserEmail } = store;
    if (!fluxRefreshToken) return;

    const expMs = decodeJwtExpMs(fluxAuthToken || '');
    const skewMs = 120000;
    const needsRefresh = !fluxAuthToken || !expMs || Date.now() >= expMs - skewMs;
    if (!needsRefresh) return;

    const tokenRes = await fetch(`${SB_URL}/auth/v1/token?grant_type=refresh_token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', apikey: SB_ANON },
      body: JSON.stringify({ refresh_token: fluxRefreshToken }),
    });
    const tokenJson = await tokenRes.json().catch(() => ({}));
    if (!tokenRes.ok) {
      const msg =
        tokenJson.error_description ||
        tokenJson.msg ||
        tokenJson.message ||
        tokenJson.error ||
        `Session refresh failed (${tokenRes.status})`;
      throw new Error(String(msg));
    }
    const access_token = tokenJson.access_token;
    const refresh_token = tokenJson.refresh_token || fluxRefreshToken;
    const user = tokenJson.user;
    const email = user?.email || jwtEmail(access_token || '') || fluxUserEmail || '';
    await chrome.storage.local.set({
      fluxAuthToken: access_token,
      fluxRefreshToken: refresh_token,
      fluxUserId: user?.id || fluxUserId || '',
      fluxUserEmail: email,
    });
  }

  async function refreshAuthBar() {
    const out = document.getElementById('fluxAuthSignedOut');
    const inn = document.getElementById('fluxAuthSignedIn');
    const emailEl = document.getElementById('fluxAuthEmail');
    const hint = document.getElementById('fluxAuthHint');
    const { fluxAuthToken, fluxUserEmail } = await chrome.storage.local.get(['fluxAuthToken', 'fluxUserEmail']);
    if (fluxAuthToken) {
      const em = fluxUserEmail || jwtEmail(fluxAuthToken) || 'Signed in';
      if (emailEl) emailEl.textContent = em;
      if (out) out.style.display = 'none';
      if (inn) inn.style.display = 'flex';
    } else {
      if (out) out.style.display = 'block';
      if (inn) inn.style.display = 'none';
      if (hint && !hint.dataset.sticky) hint.textContent = '';
    }
  }

  function syncRedirectUrlField() {
    const field = document.getElementById('fluxRedirectUrlField');
    if (!field) return;
    field.value = chrome.identity.getRedirectURL();
  }

  async function copyRedirectUrl() {
    const hint = document.getElementById('fluxAuthHint');
    const url = chrome.identity.getRedirectURL();
    syncRedirectUrlField();
    const field = document.getElementById('fluxRedirectUrlField');
    if (field) {
      field.focus();
      field.select();
    }
    try {
      await navigator.clipboard.writeText(url);
      if (hint) {
        hint.dataset.sticky = '1';
        hint.textContent =
          'Copied. Paste into Supabase → Authentication → URL Configuration → Redirect URLs, then save.';
        setTimeout(() => {
          delete hint.dataset.sticky;
        }, 10000);
      }
    } catch (e) {
      if (hint) {
        hint.dataset.sticky = '1';
        hint.textContent =
          'Clipboard blocked — the URL is selected above; press Ctrl+C (⌘C on Mac) to copy, then paste in Supabase Redirect URLs.';
      }
    }
  }

  async function signInWithGoogleExtension() {
    const hint = document.getElementById('fluxAuthHint');
    const setHint = (t) => {
      if (hint) {
        hint.textContent = t || '';
        if (t) hint.dataset.sticky = '1';
        else delete hint.dataset.sticky;
      }
    };

    setHint('Opening Google…');
    try {
      const redirectTo = chrome.identity.getRedirectURL();
      const verifier = generatePKCEVerifier();
      const codeChallenge = await generatePKCEChallenge(verifier);
      await chrome.storage.local.set({ flux_pkce_verifier: verifier });

      const params = new URLSearchParams({
        provider: 'google',
        redirect_to: redirectTo,
        scopes: GOOGLE_SCOPES,
        code_challenge: codeChallenge,
        code_challenge_method: 's256',
        skip_http_redirect: 'true',
        access_type: 'offline',
        prompt: 'select_account',
      });
      const authorizeUrl = `${SB_URL}/auth/v1/authorize?${params.toString()}`;

      const responseUrl = await new Promise((resolve, reject) => {
        chrome.identity.launchWebAuthFlow({ url: authorizeUrl, interactive: true }, (u) => {
          if (chrome.runtime.lastError) {
            reject(new Error(chrome.runtime.lastError.message));
            return;
          }
          resolve(u);
        });
      });

      const code = parseAuthCode(responseUrl);
      const { flux_pkce_verifier: storedVerifier } = await chrome.storage.local.get('flux_pkce_verifier');
      await chrome.storage.local.remove('flux_pkce_verifier');

      if (!code) {
        throw new Error(
          'No OAuth code returned. Add this extension’s redirect URL in Supabase (use the URL in the side panel + Copy URL).',
        );
      }
      if (!storedVerifier) {
        throw new Error('PKCE verifier missing — try signing in again.');
      }

      const tokenRes = await fetch(`${SB_URL}/auth/v1/token?grant_type=pkce`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', apikey: SB_ANON },
        body: JSON.stringify({ auth_code: code, code_verifier: storedVerifier }),
      });
      const tokenJson = await tokenRes.json().catch(() => ({}));
      if (!tokenRes.ok) {
        const msg =
          tokenJson.error_description ||
          tokenJson.msg ||
          tokenJson.message ||
          tokenJson.error ||
          `Sign-in failed (${tokenRes.status})`;
        throw new Error(String(msg));
      }

      const access_token = tokenJson.access_token;
      const refresh_token = tokenJson.refresh_token;
      const user = tokenJson.user;
      const email = user?.email || jwtEmail(access_token) || '';

      await chrome.storage.local.set({
        fluxAuthToken: access_token,
        fluxRefreshToken: refresh_token || '',
        fluxUserId: user?.id || '',
        fluxUserEmail: email,
      });

      setHint('');
      await refreshAuthBar();
    } catch (e) {
      const msg = String(e.message || e);
      if (/canceled|aborted|Closed|USER_CANCEL/i.test(msg)) {
        setHint('');
      } else {
        setHint(msg);
      }
    }
  }

  async function signOutExtension() {
    await chrome.storage.local.remove([
      'fluxAuthToken',
      'fluxRefreshToken',
      'fluxUserId',
      'fluxUserEmail',
      'flux_pkce_verifier',
    ]);
    const hint = document.getElementById('fluxAuthHint');
    if (hint) {
      delete hint.dataset.sticky;
      hint.textContent = '';
    }
    await refreshAuthBar();
  }

  function init() {
    syncRedirectUrlField();
    document.getElementById('fluxGoogleSignIn')?.addEventListener('click', () => signInWithGoogleExtension());
    document.getElementById('fluxSignOutBtn')?.addEventListener('click', () => signOutExtension());
    document.getElementById('fluxAuthCopyRedirect')?.addEventListener('click', () => copyRedirectUrl());
    refreshAuthBar();
  }

  window.FluxExtAuth = {
    init,
    refreshAuthBar,
    refreshSessionIfNeeded,
    signInWithGoogleExtension,
    copyRedirectUrl,
    signOutExtension,
    getRedirectURL: () => chrome.identity.getRedirectURL(),
  };
})();
