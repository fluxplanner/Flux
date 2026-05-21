/**
 * P32.1 — Notion / Obsidian export (Markdown + YAML front matter).
 * Flag: enable_notion_obsidian_export (default off).
 */
(function () {
  'use strict';

  const FLAG = 'enable_notion_obsidian_export';
  const STORE_KEY = 'flux_obsidian_export_v1';
  const BANNER_ID = 'fluxNoxBanner';
  const JSZIP_URL = 'https://cdn.jsdelivr.net/npm/jszip@3.10.1/dist/jszip.min.js';

  let jszipPromise = null;

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

  function esc(s) {
    if (typeof window.esc === 'function') return window.esc(s);
    return String(s || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }

  function T(key, vars) {
    if (typeof window.fluxT === 'function') return window.fluxT(key, vars);
    return key;
  }

  function toast(msg, kind) {
    if (typeof window.showToast === 'function') window.showToast(msg, kind || 'info');
  }

  function notesList() {
    return Array.isArray(window.notes) ? window.notes : [];
  }

  function getPrefs() {
    const s = load(STORE_KEY, {});
    return { exports: s.exports || 0 };
  }

  function persistPrefs(patch) {
    const next = { ...getPrefs(), ...patch };
    save(STORE_KEY, next);
    try {
      if (typeof window.syncKey === 'function') window.syncKey('notionObsidianExport', getCloudSlice());
    } catch (_) {}
    return next;
  }

  function getCloudSlice() {
    return getPrefs();
  }

  function applyFromCloud(data) {
    if (!data || typeof data !== 'object') return;
    persistPrefs(data);
  }

  function yamlQuote(s) {
    const v = String(s || '');
    if (/[:#\n"']/.test(v)) return `"${v.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;
    return v;
  }

  function slugify(title, id) {
    const base = String(title || T('nox.untitled'))
      .trim()
      .toLowerCase()
      .replace(/[^\w\s-]/g, '')
      .replace(/\s+/g, '-')
      .slice(0, 48);
    return (base || 'note') + '-' + String(id).slice(-6);
  }

  function htmlToMarkdown(html) {
    const root = document.createElement('div');
    root.innerHTML = html || '';

    function inner(node) {
      return Array.from(node.childNodes).map(walk).join('');
    }

    function walk(node) {
      if (node.nodeType === 3) return node.textContent || '';
      if (node.nodeType !== 1) return '';
      const tag = node.tagName.toLowerCase();
      if (tag === 'br') return '\n';
      if (tag === 'h1') return '# ' + inner(node).trim() + '\n\n';
      if (tag === 'h2') return '## ' + inner(node).trim() + '\n\n';
      if (tag === 'h3') return '### ' + inner(node).trim() + '\n\n';
      if (tag === 'h4') return '#### ' + inner(node).trim() + '\n\n';
      if (tag === 'strong' || tag === 'b') return '**' + inner(node) + '**';
      if (tag === 'em' || tag === 'i') return '*' + inner(node) + '*';
      if (tag === 'u') return inner(node);
      if (tag === 'code') return '`' + inner(node) + '`';
      if (tag === 'li') return inner(node).trim();
      if (tag === 'ul' || tag === 'ol') {
        const items = Array.from(node.querySelectorAll(':scope > li'));
        return (
          items
            .map((li) => '- ' + inner(li).trim())
            .join('\n') + '\n\n'
        );
      }
      if (tag === 'p') return inner(node).trim() + '\n\n';
      if (tag === 'hr') return '\n---\n\n';
      if (tag === 'div') return inner(node) + '\n';
      return inner(node);
    }

    return walk(root).replace(/\n{3,}/g, '\n\n').trim();
  }

  function noteToMarkdown(note, opts) {
    const options = opts || {};
    const title = note.title || T('nox.untitled');
    const tags = Array.isArray(note.fluxTags) ? note.fluxTags : [];
    const body = options.liveBody != null ? options.liveBody : note.body || '';
    const mdBody = htmlToMarkdown(body);
    const lines = [
      '---',
      `title: ${yamlQuote(title)}`,
      `flux_id: ${note.id}`,
    ];
    if (tags.length) {
      lines.push('tags:');
      tags.forEach((t) => lines.push(`  - ${yamlQuote(t)}`));
    }
    if (note.subject) lines.push(`subject: ${yamlQuote(note.subject)}`);
    if (note.starred) lines.push('starred: true');
    if (note.createdAt) lines.push(`created: ${new Date(note.createdAt).toISOString()}`);
    if (note.updatedAt) lines.push(`updated: ${new Date(note.updatedAt).toISOString()}`);
    if (note.flashcards?.length) lines.push(`flashcards: ${note.flashcards.length}`);
    lines.push('---', '', mdBody || '');
    return lines.join('\n');
  }

  function downloadBlob(filename, blob) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }

  function bumpExports() {
    persistPrefs({ exports: getPrefs().exports + 1 });
  }

  function exportNote(note, opts) {
    if (!note) return false;
    const md = noteToMarkdown(note, opts);
    const filename = slugify(note.title, note.id) + '.md';
    downloadBlob(filename, new Blob([md], { type: 'text/markdown;charset=utf-8' }));
    bumpExports();
    return true;
  }

  function exportCurrentNote() {
    const noteId = window.currentNoteId;
    let note = noteId ? notesList().find((n) => n.id === noteId) : null;
    if (note) {
      const liveTitle = document.getElementById('noteTitleInput')?.value?.trim();
      const liveBody = document.getElementById('noteEditor')?.innerHTML;
      note = {
        ...note,
        title: liveTitle || note.title,
        body: liveBody != null ? liveBody : note.body,
      };
    }
    if (!note) {
      toast(T('nox.open_note'), 'warning');
      return;
    }
    exportNote(note);
    toast(T('nox.exported_one'), 'success');
  }

  async function ensureJsZip() {
    if (window.JSZip) return window.JSZip;
    if (!jszipPromise) {
      jszipPromise = new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.src = JSZIP_URL;
        script.onload = () => {
          if (window.JSZip) resolve(window.JSZip);
          else reject(new Error('jszip missing'));
        };
        script.onerror = () => reject(new Error('jszip load failed'));
        document.head.appendChild(script);
      }).catch((err) => {
        jszipPromise = null;
        throw err;
      });
    }
    return jszipPromise;
  }

  async function exportAllZip() {
    const list = notesList();
    if (!list.length) {
      toast(T('nox.no_notes'), 'warning');
      return;
    }
    try {
      const JSZip = await ensureJsZip();
      const zip = new JSZip();
      const folder = zip.folder('flux-notes');
      list.forEach((note) => {
        folder.file(slugify(note.title, note.id) + '.md', noteToMarkdown(note));
      });
      folder.file(
        'README.md',
        `# Flux notes export\n\nExported ${list.length} notes on ${new Date().toISOString()}.\n\nImport this folder into Obsidian as a vault subfolder, or paste individual files into Notion.\n`,
      );
      const blob = await zip.generateAsync({ type: 'blob' });
      const stamp = new Date().toISOString().slice(0, 10);
      downloadBlob(`flux-notes-obsidian-${stamp}.zip`, blob);
      bumpExports();
      toast(T('nox.exported_zip', { n: list.length }), 'success');
    } catch (_) {
      toast(T('nox.zip_fail'), 'error');
    }
  }

  async function copyCurrentMarkdown() {
    const noteId = window.currentNoteId;
    const note = noteId ? notesList().find((n) => n.id === noteId) : null;
    if (!note) {
      toast(T('nox.open_note'), 'warning');
      return;
    }
    const liveTitle = document.getElementById('noteTitleInput')?.value?.trim();
    const liveBody = document.getElementById('noteEditor')?.innerHTML;
    const md = noteToMarkdown({
      ...note,
      title: liveTitle || note.title,
      body: liveBody != null ? liveBody : note.body,
    });
    try {
      await navigator.clipboard.writeText(md);
      bumpExports();
      toast(T('nox.copied'), 'success');
    } catch (_) {
      toast(T('nox.copy_fail'), 'warning');
    }
  }

  function refreshBanner() {
    const host = document.getElementById('notesListView');
    if (!host || !enabled()) return;

    let banner = document.getElementById(BANNER_ID);
    if (!banner) {
      banner = document.createElement('div');
      banner.id = BANNER_ID;
      banner.className = 'flux-nox-banner';
      const list = document.getElementById('notesList');
      if (list) host.insertBefore(banner, list);
      else host.appendChild(banner);
    }

    const count = notesList().length;
    banner.innerHTML = `<div class="flux-nox-banner-text">${esc(T('nox.banner_lead'))} <strong>${count}</strong> ${esc(T('nox.notes'))}</div>
<div class="flux-nox-banner-actions">
  <button type="button" class="flux-nox-zip">${esc(T('nox.export_zip'))}</button>
</div>`;
    banner.querySelector('.flux-nox-zip')?.addEventListener('click', () => exportAllZip());
  }

  function ensureEditorButtons() {
    const toolbar = document.querySelector('#notesEditorView [onclick*="saveNote"]')?.parentElement;
    if (!toolbar || document.getElementById('fluxNoxEditorBtns')) return;

    const wrap = document.createElement('span');
    wrap.id = 'fluxNoxEditorBtns';
    wrap.className = 'flux-nox-editor-actions';

    const mdBtn = document.createElement('button');
    mdBtn.type = 'button';
    mdBtn.className = 'btn-sec';
    mdBtn.textContent = '↓ MD';
    mdBtn.title = T('nox.export_one_hint');
    mdBtn.addEventListener('click', exportCurrentNote);

    const copyBtn = document.createElement('button');
    copyBtn.type = 'button';
    copyBtn.className = 'btn-sec';
    copyBtn.textContent = '📋';
    copyBtn.title = T('nox.copy_hint');
    copyBtn.addEventListener('click', copyCurrentMarkdown);

    wrap.appendChild(mdBtn);
    wrap.appendChild(copyBtn);

    const saveBtn = toolbar.querySelector('[onclick*="saveNote"]');
    if (saveBtn) saveBtn.insertAdjacentElement('afterend', wrap);
    else toolbar.appendChild(wrap);
  }

  function wrapRenderNotesList() {
    const orig = window.renderNotesList;
    if (typeof orig !== 'function' || orig._fluxNoxWrapped) return;
    window.renderNotesList = function () {
      const r = orig.apply(this, arguments);
      try {
        if (enabled()) refreshBanner();
      } catch (_) {}
      return r;
    };
    window.renderNotesList._fluxNoxWrapped = true;
  }

  function wrapOpenNote() {
    const orig = window.openNote;
    if (typeof orig !== 'function' || orig._fluxNoxWrapped) return;
    window.openNote = function () {
      const r = orig.apply(this, arguments);
      try {
        if (enabled()) ensureEditorButtons();
      } catch (_) {}
      return r;
    };
    window.openNote._fluxNoxWrapped = true;
  }

  function wrapOpenNewNote() {
    const orig = window.openNewNote;
    if (typeof orig !== 'function' || orig._fluxNoxWrapped) return;
    window.openNewNote = function () {
      const r = orig.apply(this, arguments);
      try {
        if (enabled()) ensureEditorButtons();
      } catch (_) {}
      return r;
    };
    window.openNewNote._fluxNoxWrapped = true;
  }

  function getPaletteCommands(q) {
    if (!enabled()) return [];
    const needle = (q || '').toLowerCase();
    const label = T('nox.palette');
    const keys = 'obsidian notion export markdown notes vault zip';
    if (
      needle &&
      !label.toLowerCase().includes(needle) &&
      !keys.split(' ').some((k) => needle.includes(k))
    ) {
      return [];
    }
    return [
      {
        icon: '📤',
        label,
        cat: 'Actions',
        action: () => {
          if (typeof window.closeCommandPalette === 'function') window.closeCommandPalette();
          if (typeof window.nav === 'function') {
            const tab = document.querySelector('[data-tab="notes"]');
            window.nav('notes', tab);
          }
          setTimeout(() => exportAllZip(), 300);
        },
      },
    ];
  }

  function install() {
    if (!enabled()) return false;
    wrapRenderNotesList();
    wrapOpenNote();
    wrapOpenNewNote();
    refreshBanner();
    ensureEditorButtons();
    return true;
  }

  window.FluxNotionObsidianExport = {
    FLAG,
    enabled,
    htmlToMarkdown,
    noteToMarkdown,
    exportNote,
    exportCurrentNote,
    exportAllZip,
    copyCurrentMarkdown,
    getCloudSlice,
    applyFromCloud,
    getPaletteCommands,
    install,
  };
})();
