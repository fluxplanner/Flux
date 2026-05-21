/**
 * P12.1 — Entity deep links (?task= ?note= ?focus=) + share URLs.
 * Flag: enable_deep_links (default off).
 */
(function () {
  'use strict';

  const FLAG = 'enable_deep_links';

  function enabled() {
    try {
      return !!window.FluxFeatureFlags?.isEnabled(FLAG, false);
    } catch (_) {
      return false;
    }
  }

  function T(key, vars) {
    if (typeof window.fluxT === 'function') return window.fluxT(key, vars);
    return key;
  }

  function parseId(raw) {
    if (raw == null || raw === '') return null;
    const n = Number(String(raw).trim());
    if (!Number.isFinite(n) || n <= 0) return null;
    return n;
  }

  function buildUrl(params) {
    const base = location.origin + location.pathname;
    const u = new URL(base);
    if (params.task != null) u.searchParams.set('task', String(params.task));
    if (params.note != null) u.searchParams.set('note', String(params.note));
    if (params.focus != null) u.searchParams.set('focus', String(params.focus));
    if (params.panel) u.searchParams.set('panel', String(params.panel));
    if (params.edit) u.searchParams.set('edit', '1');
    return u.toString();
  }

  function stripParams(keys) {
    try {
      const u = new URL(location.href);
      keys.forEach((k) => u.searchParams.delete(k));
      const qs = u.searchParams.toString();
      history.replaceState({}, '', u.pathname + (qs ? '?' + qs : '') + u.hash);
    } catch (_) {}
  }

  function flashTask(id) {
    if (typeof window.__fluxEnhFlashTask === 'function') window.__fluxEnhFlashTask(id);
    else {
      const el = document.querySelector(`[data-task-id="${id}"]`);
      if (el) {
        el.classList.add('flux-enh-task-flash');
        setTimeout(() => el.classList.remove('flux-enh-task-flash'), 1400);
      }
    }
  }

  function focusTask(id, opts) {
    if (typeof window.nav === 'function') window.nav('dashboard');
    setTimeout(() => {
      const el = document.querySelector(`[data-task-id="${id}"]`);
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      flashTask(id);
      if (opts?.edit && typeof window.openEdit === 'function') window.openEdit(id);
    }, 420);
  }

  function resolveFromUrl() {
    if (!enabled()) return false;
    let u;
    try {
      u = new URL(location.href);
    } catch (_) {
      return false;
    }

    const taskId = parseId(u.searchParams.get('task'));
    const noteId = parseId(u.searchParams.get('note'));
    const focusId = parseId(u.searchParams.get('focus') || u.searchParams.get('focusTask'));
    const panel = (u.searchParams.get('panel') || '').trim();
    const edit = u.searchParams.get('edit') === '1';

    if (taskId) {
      const list = typeof window.tasks !== 'undefined' && Array.isArray(window.tasks) ? window.tasks : [];
      if (list.some((t) => t && t.id === taskId)) focusTask(taskId, { edit });
      else if (typeof window.showToast === 'function') window.showToast(T('deeplink.task_missing'), 'info');
      stripParams(['task', 'edit']);
      return true;
    }

    if (noteId) {
      const list = typeof window.notes !== 'undefined' && Array.isArray(window.notes) ? window.notes : [];
      if (list.some((n) => n && n.id === noteId)) {
        if (typeof window.nav === 'function') window.nav('notes');
        setTimeout(() => {
          if (typeof window.openNote === 'function') window.openNote(noteId);
        }, 420);
      } else if (typeof window.showToast === 'function') window.showToast(T('deeplink.note_missing'), 'info');
      stripParams(['note']);
      return true;
    }

    if (focusId || u.searchParams.has('focus') || u.searchParams.has('focusTask')) {
      const list = typeof window.tasks !== 'undefined' && Array.isArray(window.tasks) ? window.tasks : [];
      const t = focusId ? list.find((x) => x && x.id === focusId) : null;
      setTimeout(() => {
        if (typeof window.startDeepWork === 'function') window.startDeepWork(t ? t.id : undefined);
      }, 480);
      stripParams(['focus', 'focusTask']);
      return true;
    }

    if (panel && typeof window.nav === 'function' && document.getElementById(panel)) {
      window.nav(panel);
      stripParams(['panel']);
      return true;
    }

    return false;
  }

  async function copyToClipboard(url) {
    try {
      await navigator.clipboard.writeText(url);
      if (typeof window.showToast === 'function') window.showToast(T('deeplink.copied'), 'info');
      return true;
    } catch (_) {
      if (typeof window.showToast === 'function') window.showToast(T('deeplink.copy_failed'), 'error');
      return false;
    }
  }

  function copyLink(type, id) {
    if (!enabled() || id == null) return;
    const params =
      type === 'note' ? { note: id } : type === 'focus' ? { focus: id } : { task: id };
    return copyToClipboard(buildUrl(params));
  }

  function copyCurrentNoteLink() {
    const id = typeof window.currentNoteId !== 'undefined' ? window.currentNoteId : null;
    if (id) copyLink('note', id);
  }

  function getPaletteCommands(q) {
    if (!enabled()) return [];
    const cmds = [];
    const needle = (q || '').toLowerCase();
    const match = (label) => !needle || label.toLowerCase().includes(needle);

    if (match('copy link task') && typeof window.editingId !== 'undefined' && window.editingId) {
      cmds.push({
        icon: '🔗',
        label: T('deeplink.cmd_task'),
        cat: 'Deep links',
        action: () => {
          if (typeof window.closeCommandPalette === 'function') window.closeCommandPalette();
          copyLink('task', window.editingId);
        },
      });
    }
    if (match('copy link note') && typeof window.currentNoteId !== 'undefined' && window.currentNoteId) {
      cmds.push({
        icon: '🔗',
        label: T('deeplink.cmd_note'),
        cat: 'Deep links',
        action: () => {
          if (typeof window.closeCommandPalette === 'function') window.closeCommandPalette();
          copyCurrentNoteLink();
        },
      });
    }
    return cmds;
  }

  function install() {
    const legacy = window.handleDeepLinkParams;
    window.handleDeepLinkParams = function () {
      const handled = enabled() && resolveFromUrl();
      if (!handled && typeof legacy === 'function') legacy();
    };
  }

  install();

  window.fluxCopyTaskLink = function (id) {
    copyLink('task', id);
  };
  window.fluxCopyNoteLink = copyCurrentNoteLink;

  window.FluxDeepLinks = {
    FLAG,
    enabled,
    buildUrl,
    resolveFromUrl,
    copyLink,
    copyCurrentNoteLink,
    focusTask,
    getPaletteCommands,
    install,
  };
})();
