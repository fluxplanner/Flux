/**
 * browser-shim.js — single source of truth for cross-browser extension APIs.
 *
 * Chrome / Edge / Brave / Arc expose `chrome.*`. Firefox exposes both `browser.*`
 * (promises) and `chrome.*` (callbacks). Safari exposes `browser.*` mostly,
 * with some MV3 features absent.
 *
 * Usage:
 *   import { ext, sidebar, sessionStorage, contextMenus } from './browser-shim.js';
 *   await sidebar.open({ tabId });
 */

export const ext = (typeof browser !== 'undefined' ? browser : chrome);

export function isChromium() {
  return typeof chrome !== 'undefined' && !!chrome.runtime;
}
export function isFirefox() {
  return typeof browser !== 'undefined' && navigator.userAgent.includes('Firefox');
}
export function isSafari() {
  return typeof browser !== 'undefined' && /Safari/.test(navigator.userAgent) && !/Chrome/.test(navigator.userAgent);
}

/** Promise-wrapped API call. Works whether the underlying API uses callbacks (Chrome MV2) or returns a promise (Firefox / Chrome MV3). */
export function asPromise(fn, ...args) {
  return new Promise((resolve, reject) => {
    try {
      const r = fn(...args, (result) => {
        const err = ext.runtime && ext.runtime.lastError;
        if (err) reject(new Error(err.message));
        else resolve(result);
      });
      if (r && typeof r.then === 'function') r.then(resolve, reject);
    } catch (e) {
      reject(e);
    }
  });
}

/* ───────── Sidebar / side panel ───────── */

export const sidebar = {
  /**
   * Open the side rail. Some Chromium shells (Arc, notably) implement the
   * chrome.sidePanel API but never render a panel — the call "succeeds" and
   * nothing appears. So after opening we verify a SIDE_PANEL context really
   * exists and otherwise pop the rail out as a window, which works everywhere.
   */
  open: async ({ tabId } = {}) => {
    const popout = () => {
      if (ext.windows && ext.windows.create) {
        return ext.windows.create({
          url: ext.runtime.getURL('sidebar/sidebar.html'),
          type: 'popup',
          width: 420,
          height: 720,
        });
      }
      return null;
    };
    try {
      if (ext.sidePanel && ext.sidePanel.open) {
        let target = { tabId };
        if (tabId == null && ext.windows && ext.windows.getCurrent) {
          const win = await ext.windows.getCurrent();
          target = { windowId: win.id };
        }
        await ext.sidePanel.open(target);
        if (ext.runtime.getContexts) {
          await new Promise((r) => setTimeout(r, 450));
          const ctxs = await ext.runtime
            .getContexts({ contextTypes: ['SIDE_PANEL'] })
            .catch(() => null);
          if (!ctxs || ctxs.length === 0) return popout();
        }
        return;
      }
      if (ext.sidebarAction && ext.sidebarAction.open) return ext.sidebarAction.open();
      if (ext.action && ext.action.openPopup) return ext.action.openPopup();
    } catch (e) {
      const w = popout();
      if (w) return w;
      throw e;
    }
    return popout();
  },
  setPanelEnabled: async (tabId, enabled = true) => {
    if (ext.sidePanel && ext.sidePanel.setOptions) {
      return ext.sidePanel.setOptions({ tabId, enabled, path: 'sidebar/sidebar.html' });
    }
  },
};

/* ───────── Storage with TTL polyfill (storage.session not in Firefox/Safari) ───────── */

export const sessionStorage = {
  async set(key, value, ttlSeconds = 3600) {
    if (ext.storage && ext.storage.session && ext.storage.session.set) {
      await ext.storage.session.set({ [key]: value });
      return;
    }
    await ext.storage.local.set({ [key]: { v: value, exp: Date.now() + ttlSeconds * 1000 } });
  },
  async get(key) {
    if (ext.storage && ext.storage.session && ext.storage.session.get) {
      const r = await ext.storage.session.get(key);
      return r ? r[key] : undefined;
    }
    const r = await ext.storage.local.get(key);
    const entry = r ? r[key] : undefined;
    if (!entry) return undefined;
    if (entry.exp && Date.now() > entry.exp) {
      ext.storage.local.remove(key);
      return undefined;
    }
    return entry.v;
  },
  async remove(key) {
    if (ext.storage && ext.storage.session && ext.storage.session.remove) {
      return ext.storage.session.remove(key);
    }
    return ext.storage.local.remove(key);
  },
};

export const localStorage = {
  async set(key, value) { return ext.storage.local.set({ [key]: value }); },
  async get(key) { const r = await ext.storage.local.get(key); return r ? r[key] : undefined; },
  async remove(key) { return ext.storage.local.remove(key); },
};

/* ───────── Context menus (Firefox uses identical API; Safari is absent) ───────── */

export const contextMenus = {
  create(spec) {
    if (!ext.contextMenus || !ext.contextMenus.create) return null;
    try { return ext.contextMenus.create(spec); } catch (_) { return null; }
  },
  onClicked: ext.contextMenus && ext.contextMenus.onClicked
    ? ext.contextMenus.onClicked
    : { addListener() {} },
};

/* ───────── Tabs ───────── */

export const tabs = {
  query: (q) => ext.tabs.query(q),
  active: async () => {
    const list = await ext.tabs.query({ active: true, currentWindow: true });
    return list && list[0];
  },
  captureVisible: async () => {
    if (ext.tabs && ext.tabs.captureVisibleTab) {
      return ext.tabs.captureVisibleTab(undefined, { format: 'png' });
    }
    return null;
  },
  sendMessage: (tabId, msg) => ext.tabs.sendMessage(tabId, msg),
};

/* ───────── Runtime / messaging ───────── */

export const runtime = {
  sendMessage: (msg) => ext.runtime.sendMessage(msg),
  onMessage: ext.runtime.onMessage,
  onMessageExternal: ext.runtime.onMessageExternal || { addListener() {} },
  getURL: (path) => ext.runtime.getURL(path),
  id: ext.runtime.id,
};

/* ───────── Identity / OAuth ───────── */

export const identity = {
  async launchWebAuthFlow({ url, interactive = true }) {
    if (ext.identity && ext.identity.launchWebAuthFlow) {
      return ext.identity.launchWebAuthFlow({ url, interactive });
    }
    // Safari fallback: open in a popup window and rely on the redirect page to postMessage back.
    return new Promise((resolve, reject) => {
      try {
        const w = window.open(url, 'flux-auth', 'width=520,height=720');
        if (!w) return reject(new Error('Popup blocked'));
        const onMsg = (e) => {
          if (!e.data || e.data.type !== 'flux-auth-result') return;
          window.removeEventListener('message', onMsg);
          try { w.close(); } catch (_) {}
          resolve(e.data.url);
        };
        window.addEventListener('message', onMsg);
      } catch (e) {
        reject(e);
      }
    });
  },
  getRedirectURL() {
    if (ext.identity && ext.identity.getRedirectURL) return ext.identity.getRedirectURL();
    return (ext.runtime && ext.runtime.getURL) ? ext.runtime.getURL('auth-callback.html') : '';
  },
};

/* ───────── Notifications ───────── */

export const notifications = {
  create(id, options) {
    if (ext.notifications && ext.notifications.create) return ext.notifications.create(id, options);
    return null;
  },
};
