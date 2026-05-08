/* ════════════════════════════════════════════════════════════════════════
   FLUX · Google Docs (Docs API) — create, read, replace body text
   ------------------------------------------------------------------------
   OAuth adds https://www.googleapis.com/auth/documents alongside existing
   Gmail/Calendar scopes (same provider_token as gmailToken).
   Uses honest batchUpdate; Google Docs still records version history — we
   do not simulate human typing to obscure edits.
   ════════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  const LS_PRIMARY_URL = 'flux_google_docs_primary_url';
  const SS_SCOPE_OK = 'flux_docs_scope_ok';

  /** @param {string} raw */
  function extractGoogleDocId(raw) {
    const s = String(raw || '').trim();
    const m = s.match(/\/d\/([a-zA-Z0-9-_]+)/);
    if (m) return m[1];
    if (/^[a-zA-Z0-9-_]{20,}$/.test(s)) return s;
    return '';
  }

  function getToken() {
    return window.gmailToken || sessionStorage.getItem('flux_gmail_token') || null;
  }

  function toast(msg, kind) {
    if (typeof window.showToast === 'function') window.showToast(msg, kind || 'info');
    else console.log('[flux-docs]', msg);
  }

  function docJsonToPlain(doc) {
    const parts = [];
    function walkParagraph(p) {
      if (!p || !p.elements) return;
      for (const pe of p.elements) {
        if (pe.textRun && pe.textRun.content) parts.push(pe.textRun.content);
      }
      parts.push('\n');
    }
    function walkTable(t) {
      for (const row of t.tableRows || []) {
        for (const cell of row.tableCells || []) {
          walkContent(cell.content || []);
        }
        parts.push('\n');
      }
    }
    function walkContent(arr) {
      for (const el of arr || []) {
        if (el.paragraph) walkParagraph(el.paragraph);
        else if (el.table) walkTable(el.table);
      }
    }
    walkContent(doc.body && doc.body.content);
    return parts.join('').replace(/\n+$/, '');
  }

  function fluxGoogleDocsScopeCached() {
    try {
      return sessionStorage.getItem(SS_SCOPE_OK) === '1';
    } catch (e) {
      return false;
    }
  }

  async function apiBatchUpdate(documentId, requests) {
    const token = getToken();
    if (!token) throw new Error('Sign in with Google first.');
    const res = await fetch(
      'https://docs.googleapis.com/v1/documents/' + encodeURIComponent(documentId) + ':batchUpdate',
      {
        method: 'POST',
        headers: {
          Authorization: 'Bearer ' + token,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ requests: requests || [] }),
      }
    );
    if (res.status === 401 || res.status === 403) {
      try {
        sessionStorage.removeItem(SS_SCOPE_OK);
      } catch (e) {}
      throw new Error(
        res.status === 403
          ? 'Google Docs permission denied — tap “Connect Google Docs” in Settings.'
          : 'Session expired — sign in again.'
      );
    }
    const data = await res.json().catch(function () {
      return {};
    });
    if (!res.ok) throw new Error(data.error && data.error.message ? data.error.message : 'Docs batchUpdate failed');
    try {
      sessionStorage.setItem(SS_SCOPE_OK, '1');
    } catch (e) {}
    return data;
  }

  /** @returns {Promise<object>} Docs API document */
  async function apiGetDocument(documentId) {
    const token = getToken();
    if (!token) throw new Error('Sign in with Google first.');
    const res = await fetch(
      'https://docs.googleapis.com/v1/documents/' + encodeURIComponent(documentId),
      { headers: { Authorization: 'Bearer ' + token } }
    );
    if (res.status === 401 || res.status === 403) {
      try {
        sessionStorage.removeItem(SS_SCOPE_OK);
      } catch (e) {}
      throw new Error(
        res.status === 403
          ? 'Google Docs permission denied — connect Docs in Settings.'
          : 'Session expired — sign in again.'
      );
    }
    const data = await res.json().catch(function () {
      return {};
    });
    if (!res.ok) throw new Error(data.error && data.error.message ? data.error.message : 'Could not read document');
    try {
      sessionStorage.setItem(SS_SCOPE_OK, '1');
    } catch (e) {}
    return data;
  }

  async function replaceEntireBodyText(documentId, newText) {
    const doc = await apiGetDocument(documentId);
    let endIndex = 1;
    for (const el of (doc.body && doc.body.content) || []) {
      if (typeof el.endIndex === 'number') endIndex = Math.max(endIndex, el.endIndex);
    }
    const requests = [];
    if (endIndex > 2) {
      requests.push({
        deleteContentRange: {
          range: { startIndex: 1, endIndex: endIndex - 1 },
        },
      });
    }
    requests.push({
      insertText: {
        location: { index: 1 },
        text: String(newText == null ? '' : newText),
      },
    });
    await apiBatchUpdate(documentId, requests);
  }

  async function createDocument(title) {
    const token = getToken();
    if (!token) throw new Error('Sign in with Google first.');
    const res = await fetch('https://docs.googleapis.com/v1/documents', {
      method: 'POST',
      headers: {
        Authorization: 'Bearer ' + token,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ title: title || 'Flux document' }),
    });
    if (res.status === 401 || res.status === 403) {
      try {
        sessionStorage.removeItem(SS_SCOPE_OK);
      } catch (e) {}
      throw new Error(
        res.status === 403
          ? 'Need Google Docs access — use Connect Google Docs in Settings.'
          : 'Session expired.'
      );
    }
    const data = await res.json().catch(function () {
      return {};
    });
    if (!res.ok) throw new Error(data.error && data.error.message ? data.error.message : 'Could not create document');
    try {
      sessionStorage.setItem(SS_SCOPE_OK, '1');
    } catch (e) {}
    return data;
  }

  async function fluxReconnectGoogleDocs() {
    var sb = typeof window.getSB === 'function' ? window.getSB() : null;
    if (!sb) {
      toast('Auth not available — refresh the page', 'error');
      return;
    }
    try {
      if (typeof window.initOAuthPostMessageListener === 'function') window.initOAuthPostMessageListener();
      var redirectTo =
        typeof window.getRedirectURL === 'function' ? window.getRedirectURL() : window.location.origin + window.location.pathname;
      var scopes = [
        'https://www.googleapis.com/auth/gmail.readonly',
        'https://www.googleapis.com/auth/calendar.readonly',
        'https://www.googleapis.com/auth/calendar.events',
        'https://www.googleapis.com/auth/documents',
      ].join(' ');
      var result = await sb.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: redirectTo,
          skipBrowserRedirect: true,
          scopes: scopes,
          queryParams: { access_type: 'offline', prompt: 'consent' },
        },
      });
      if (result.error) throw result.error;
      if (!result.data || !result.data.url) {
        toast('Could not start Google sign-in', 'error');
        return;
      }
      var feat = 'width=520,height=720,left=80,top=60,scrollbars=yes,resizable=yes';
      var w = window.open(result.data.url, 'fluxGoogleDocsOAuth', feat);
      if (!w) {
        window.location.href = result.data.url;
        return;
      }
      try {
        w.focus();
      } catch (e) {}
      toast('Approve Google Docs access in the pop-up', 'info');
    } catch (e) {
      console.error('[flux-docs] oauth', e);
      toast('Sign-in failed: ' + (e.message || e), 'error');
    }
  }

  /** Cached plain text for Flux AI (filled in beforeSend). */
  window.fluxGoogleDocsCachedSnippet = '';

  function isGoogleDocsConnectionEnabled() {
    try {
      var raw = localStorage.getItem('flux_ai_connections_items_v1');
      var o = raw ? JSON.parse(raw) : {};
      return !!(o.google_docs && o.google_docs.enabled);
    } catch (e) {
      return false;
    }
  }

  async function fluxRefreshGoogleDocsContextForAI() {
    window.fluxGoogleDocsCachedSnippet = '';
    if (!isGoogleDocsConnectionEnabled()) return;
    var urlOrId = '';
    try {
      urlOrId = localStorage.getItem(LS_PRIMARY_URL) || '';
    } catch (e) {}
    var id = extractGoogleDocId(urlOrId);
    if (!id) return;
    try {
      var doc = await apiGetDocument(id);
      var text = docJsonToPlain(doc).trim();
      window.fluxGoogleDocsCachedSnippet = text.slice(0, 12000);
    } catch (e) {
      console.warn('[flux-docs] AI context', e);
    }
  }

  function fluxGoogleDocsSavePrimaryUrl() {
    var inp = document.getElementById('fluxDocsPrimaryUrl');
    var v = inp ? inp.value.trim() : '';
    try {
      localStorage.setItem(LS_PRIMARY_URL, v);
    } catch (e) {}
    toast(v ? 'Primary doc URL saved' : 'Cleared primary doc URL', 'success');
  }

  async function fluxGoogleDocsCreateAndOpen() {
    var titleEl = document.getElementById('fluxDocsNewTitle');
    var title = titleEl && titleEl.value.trim() ? titleEl.value.trim() : 'Flux — study doc';
    try {
      var doc = await createDocument(title);
      var id = doc.documentId || doc.document_id;
      if (!id) throw new Error('No document id returned');
      var url = 'https://docs.google.com/document/d/' + id + '/edit';
      toast('Created Google Doc', 'success');
      try {
        localStorage.setItem(LS_PRIMARY_URL, url);
        var pu = document.getElementById('fluxDocsPrimaryUrl');
        if (pu) pu.value = url;
      } catch (e) {}
      window.open(url, '_blank', 'noopener,noreferrer');
    } catch (e) {
      toast(e.message || String(e), 'error');
    }
  }

  async function fluxGoogleDocsPullNow() {
    try {
      await fluxRefreshGoogleDocsContextForAI();
      var st = document.getElementById('fluxGoogleDocsStatus');
      var n = (window.fluxGoogleDocsCachedSnippet || '').length;
      if (st) {
        st.textContent = n
          ? 'Pulled ~' + n + ' characters into Flux AI context for your next message.'
          : 'Nothing pulled — check the doc URL and Docs access.';
      }
      if (n) toast('Doc text cached for Flux AI', 'success');
      else toast('No text pulled — verify URL and connection', 'warning');
    } catch (e) {
      toast(e.message || String(e), 'error');
    }
  }

  async function fluxGoogleDocsPushFromTextarea() {
    var ta = document.getElementById('fluxDocsPushBody');
    var text = ta ? ta.value : '';
    var urlOrId = '';
    try {
      urlOrId = localStorage.getItem(LS_PRIMARY_URL) || '';
    } catch (e) {}
    var id = extractGoogleDocId(urlOrId);
    if (!id) {
      toast('Set and save a primary Google Doc URL first', 'warning');
      return;
    }
    try {
      await replaceEntireBodyText(id, text);
      toast('Replaced document body (plain text)', 'success');
    } catch (e) {
      toast(e.message || String(e), 'error');
    }
  }

  function fluxGoogleDocsLoadSettingsUI() {
    var inp = document.getElementById('fluxDocsPrimaryUrl');
    if (inp) {
      try {
        inp.value = localStorage.getItem(LS_PRIMARY_URL) || '';
      } catch (e) {}
    }
    var st = document.getElementById('fluxGoogleDocsStatus');
    if (st) {
      st.textContent = fluxGoogleDocsScopeCached()
        ? 'Docs API has succeeded at least once this session.'
        : 'Connect Google Docs, then pull or push to verify.';
    }
  }

  try {
    window.fluxGoogleDocsExtractId = extractGoogleDocId;
    window.fluxReconnectGoogleDocs = fluxReconnectGoogleDocs;
    window.fluxGoogleDocsCreateAndOpen = fluxGoogleDocsCreateAndOpen;
    window.fluxGoogleDocsSavePrimaryUrl = fluxGoogleDocsSavePrimaryUrl;
    window.fluxGoogleDocsPullNow = fluxGoogleDocsPullNow;
    window.fluxGoogleDocsPushFromTextarea = fluxGoogleDocsPushFromTextarea;
    window.fluxGoogleDocsLoadSettingsUI = fluxGoogleDocsLoadSettingsUI;
    window.fluxRefreshGoogleDocsContextForAI = fluxRefreshGoogleDocsContextForAI;
    window.fluxGoogleDocsScopeCached = fluxGoogleDocsScopeCached;
  } catch (e) {}
})();
