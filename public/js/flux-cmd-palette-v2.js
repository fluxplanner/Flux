/**
 * P12.7 — Command palette v2: fuzzy match, recent commands, all tab surfaces.
 * Flag: enable_cmd_palette_v2 (default off).
 */
(function () {
  'use strict';

  const FLAG = 'enable_cmd_palette_v2';
  const STORE_KEY = 'flux_cmd_palette_recents_v1';
  const MAX_RECENTS = 10;

  function enabled() {
    try {
      return !!window.FluxFeatureFlags?.isEnabled(FLAG, false);
    } catch (_) {
      return false;
    }
  }

  function load(k, def) {
    if (typeof window.load === 'function') return window.load(k, def);
    try {
      const raw = localStorage.getItem(k);
      return raw ? JSON.parse(raw) : def;
    } catch (_) {
      return def;
    }
  }

  function save(k, v) {
    if (typeof window.save === 'function') window.save(k, v);
    else {
      try {
        localStorage.setItem(k, JSON.stringify(v));
      } catch (_) {}
    }
  }

  function fuzzyMatch(text, q) {
    if (!q) return true;
    const t = String(text || '').toLowerCase();
    const qq = String(q || '').toLowerCase().trim();
    if (!qq) return true;
    if (t.includes(qq)) return 2;
    let ti = 0;
    for (let qi = 0; qi < qq.length; qi++) {
      const c = qq[qi];
      let found = false;
      while (ti < t.length) {
        if (t[ti++] === c) {
          found = true;
          break;
        }
      }
      if (!found) return 0;
    }
    return 1;
  }

  function fuzzyScore(text, q) {
    const m = fuzzyMatch(text, q);
    return m === 2 ? 100 : m === 1 ? 50 : 0;
  }

  function cmdKey(cmd) {
    if (cmd?.id) return String(cmd.id);
    return `${cmd?.cat || 'cmd'}::${cmd?.label || ''}`;
  }

  function getRecents() {
    const rows = load(STORE_KEY, []);
    return Array.isArray(rows) ? rows : [];
  }

  function persistRecents(rows) {
    save(STORE_KEY, rows.slice(0, MAX_RECENTS));
    try {
      if (typeof window.syncKey === 'function') window.syncKey('cmdPaletteRecents', rows.slice(0, MAX_RECENTS));
    } catch (_) {}
  }

  function applyFromCloud(data) {
    if (!Array.isArray(data)) return;
    save(STORE_KEY, data.slice(0, MAX_RECENTS));
  }

  function getCloudSlice() {
    return getRecents();
  }

  function recordRecent(cmd) {
    if (!enabled() || !cmd?.label) return;
    const key = cmdKey(cmd);
    const row = {
      id: key,
      label: cmd.label,
      icon: cmd.icon || '⌘',
      cat: cmd.cat || 'Recent',
      sub: cmd.sub || '',
      ts: Date.now(),
    };
    const next = [row, ...getRecents().filter((r) => r.id !== key)].slice(0, MAX_RECENTS);
    persistRecents(next);
  }

  function scoreCommand(cmd, q) {
    if (!q) return 1;
    let score = fuzzyScore(cmd.label, q);
    if (cmd.sub) score += fuzzyScore(cmd.sub, q) * 0.35;
    if (cmd.cat) score += fuzzyScore(cmd.cat, q) * 0.15;
    (cmd._keys || []).forEach((k) => {
      score += fuzzyScore(k, q) * 0.25;
    });
    return score;
  }

  function matchesQuery(q, label, sub, keys) {
    if (!q) return true;
    if (fuzzyScore(label, q) > 0) return true;
    if (sub && fuzzyScore(sub, q) > 0) return true;
    return (keys || []).some((k) => fuzzyScore(k, q) > 0);
  }

  function refineCommands(cmds, q) {
    if (!enabled()) return cmds;
    const needle = (q || '').toLowerCase().trim();
    let list = cmds.slice();

    if (needle) {
      list = list
        .map((c) => ({ ...c, _score: scoreCommand(c, needle) }))
        .filter((c) => c._score > 0)
        .sort((a, b) => b._score - a._score);
    }

    if (!needle && getRecents().length) {
      const byKey = new Map(list.map((c) => [cmdKey(c), c]));
      const recentCmds = [];
      getRecents().forEach((r) => {
        const hit = byKey.get(r.id);
        if (hit && !recentCmds.includes(hit)) recentCmds.push({ ...hit, cat: 'Recent' });
      });
      const recentKeys = new Set(recentCmds.map(cmdKey));
      const rest = list.filter((c) => !recentKeys.has(cmdKey(c)));
      list = [...recentCmds, ...rest];
    }

    return list;
  }

  const SURFACE_SKIP = new Set(['gmail', 'periodic', 'grades', 'workspace']);

  function getSurfaceCommands() {
    if (!enabled()) return [];
    const tabs = typeof window.tabConfig !== 'undefined' && Array.isArray(window.tabConfig) ? window.tabConfig : load('flux_tabs', []);
    const seen = new Set([
      'dashboard',
      'calendar',
      'ai',
      'school',
      'notes',
      'timer',
      'goals',
      'mood',
      'canvas',
      'settings',
      'toolbox',
    ]);
    const out = [];
    tabs.forEach((t) => {
      if (!t || !t.id || !t.visible || SURFACE_SKIP.has(t.id) || seen.has(t.id)) return;
      seen.add(t.id);
      const label = String(t.label || t.id).trim();
      out.push({
        id: `surface:${t.id}`,
        icon: t.emoji || '📄',
        label: `Open ${label}`,
        cat: 'Surfaces',
        _keys: [t.id, label],
        action: () => {
          if (typeof window.nav === 'function') window.nav(t.id);
          if (typeof window.closeCommandPalette === 'function') window.closeCommandPalette();
        },
      });
    });
    return out;
  }

  function install() {
    return enabled();
  }

  window.FluxCmdPaletteV2 = {
    FLAG,
    enabled,
    matchesQuery,
    refineCommands,
    recordRecent,
    getSurfaceCommands,
    getCloudSlice,
    applyFromCloud,
    install,
  };
})();
