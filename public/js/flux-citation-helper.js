/**
 * P35.1 — Citation helper (saved library + note insert + bibliography export).
 * Flag: enable_citation_helper (default off).
 */
(function () {
  'use strict';

  const FLAG = 'enable_citation_helper';
  const STORE_KEY = 'flux_citation_helper_v1';
  const OVERLAY_ID = 'fluxCitationOverlay';
  const BANNER_ID = 'fluxCitationBanner';

  const FIELDS = {
    book: [
      ['lastName', 'Author last name'],
      ['firstName', 'Author first name'],
      ['title', 'Book title'],
      ['publisher', 'Publisher'],
      ['year', 'Year'],
      ['city', 'City (Chicago only)'],
    ],
    journal: [
      ['lastName', 'Author last name'],
      ['firstName', 'Author first name'],
      ['title', 'Article title'],
      ['journal', 'Journal name'],
      ['vol', 'Volume'],
      ['issue', 'Issue'],
      ['year', 'Year'],
      ['pages', 'Pages (e.g., 12-34)'],
      ['doi', 'DOI (optional)'],
    ],
    web: [
      ['lastName', 'Author last name (optional)'],
      ['firstName', 'Author first name (optional)'],
      ['title', 'Page title'],
      ['site', 'Website name'],
      ['year', 'Year published'],
      ['accessed', 'Date accessed (MLA)'],
      ['url', 'URL'],
    ],
    news: [
      ['lastName', 'Author last name'],
      ['firstName', 'Author first name'],
      ['title', 'Article title'],
      ['publication', 'Newspaper/Magazine name'],
      ['year', 'Year'],
      ['date', 'Full date (e.g., March 3, 2024)'],
      ['url', 'URL (if online)'],
    ],
  };

  let uiStyle = 'MLA';
  let uiType = 'web';

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

  function getStore() {
    const s = load(STORE_KEY, {});
    return {
      entries: Array.isArray(s.entries) ? s.entries : [],
      exports: s.exports || 0,
    };
  }

  function persistStore(data) {
    save(STORE_KEY, data);
    try {
      if (typeof window.syncKey === 'function') window.syncKey('citationHelper', getCloudSlice());
    } catch (_) {}
  }

  function getCloudSlice() {
    const s = getStore();
    return { entries: s.entries, exports: s.exports };
  }

  function applyFromCloud(data) {
    if (!data || typeof data !== 'object') return;
    persistStore({
      entries: Array.isArray(data.entries) ? data.entries : [],
      exports: data.exports || 0,
    });
    refreshBanner();
  }

  function htmlToPlain(html) {
    const d = document.createElement('div');
    d.innerHTML = html || '';
    return (d.textContent || '').trim();
  }

  function buildCitation(style, type, v) {
    let cit = '';
    if (style === 'MLA') {
      const author = v.lastName
        ? `${v.lastName}, ${v.firstName || ''}`.trim().replace(/,\s*$/, '')
        : '';
      if (type === 'book') {
        cit = `${author ? author + '. ' : ''}<em>${esc(v.title)}</em>. ${esc(v.publisher || '')}${v.publisher ? ', ' : ''}${esc(v.year || '')}.`;
      } else if (type === 'journal') {
        cit = `${author ? author + '. ' : ''}"${esc(v.title)}." <em>${esc(v.journal)}</em>, vol. ${esc(v.vol || '')}, no. ${esc(v.issue || '')}, ${esc(v.year || '')}, pp. ${esc(v.pages || '')}${v.doi ? ', doi:' + esc(v.doi) : ''}.`;
      } else if (type === 'web') {
        cit = `${author ? author + '. ' : ''}"${esc(v.title)}." <em>${esc(v.site)}</em>, ${esc(v.year || '')}${v.url ? ', ' + esc(v.url) : ''}${v.accessed ? '. Accessed ' + esc(v.accessed) : ''}.`;
      } else if (type === 'news') {
        cit = `${author ? author + '. ' : ''}"${esc(v.title)}." <em>${esc(v.publication)}</em>, ${esc(v.date || v.year || '')}${v.url ? ', ' + esc(v.url) : ''}.`;
      }
    } else if (style === 'APA') {
      const init = v.firstName
        ? v.firstName.split(/\s+/).map((s) => s[0] + '.').join(' ')
        : '';
      const author = v.lastName ? `${v.lastName}, ${init}`.trim() : '';
      if (type === 'book') {
        cit = `${author ? author + ' ' : ''}(${esc(v.year || 'n.d.')}). <em>${esc(v.title)}</em>. ${esc(v.publisher || '')}.`;
      } else if (type === 'journal') {
        cit = `${author ? author + ' ' : ''}(${esc(v.year || 'n.d.')}). ${esc(v.title)}. <em>${esc(v.journal)}</em>, ${esc(v.vol || '')}${v.issue ? '(' + esc(v.issue) + ')' : ''}, ${esc(v.pages || '')}.${v.doi ? ' https://doi.org/' + esc(v.doi) : ''}`;
      } else if (type === 'web') {
        cit = `${author ? author + ' ' : ''}(${esc(v.year || 'n.d.')}). ${esc(v.title)}. <em>${esc(v.site)}</em>.${v.url ? ' ' + esc(v.url) : ''}`;
      } else if (type === 'news') {
        cit = `${author ? author + ' ' : ''}(${esc(v.date || v.year || 'n.d.')}). ${esc(v.title)}. <em>${esc(v.publication)}</em>.${v.url ? ' ' + esc(v.url) : ''}`;
      }
    } else if (style === 'Chicago') {
      const author = v.lastName
        ? `${v.lastName}, ${v.firstName || ''}`.trim().replace(/,\s*$/, '')
        : '';
      if (type === 'book') {
        cit = `${author ? author + '. ' : ''}<em>${esc(v.title)}</em>. ${v.city ? esc(v.city) + ': ' : ''}${esc(v.publisher || '')}, ${esc(v.year || '')}.`;
      } else if (type === 'journal') {
        cit = `${author ? author + '. ' : ''}"${esc(v.title)}." <em>${esc(v.journal)}</em> ${esc(v.vol || '')}, no. ${esc(v.issue || '')} (${esc(v.year || '')}): ${esc(v.pages || '')}.${v.doi ? ' https://doi.org/' + esc(v.doi) : ''}`;
      } else if (type === 'web') {
        cit = `${author ? author + '. ' : ''}"${esc(v.title)}." <em>${esc(v.site)}</em>, ${esc(v.year || '')}.${v.url ? ' ' + esc(v.url) : ''}${v.accessed ? ' Accessed ' + esc(v.accessed) : ''}.`;
      } else if (type === 'news') {
        cit = `${author ? author + '. ' : ''}"${esc(v.title)}." <em>${esc(v.publication)}</em>, ${esc(v.date || v.year || '')}.${v.url ? ' ' + esc(v.url) : ''}`;
      }
    }
    return cit.trim();
  }

  function readFormValues(root) {
    const out = {};
    root.querySelectorAll('[data-cite-k]').forEach((i) => {
      out[i.dataset.citeK] = i.value.trim();
    });
    return out;
  }

  function entryLabel(v, type) {
    return v.title || v.journal || v.site || v.publication || type;
  }

  function saveEntry(style, type, v, html) {
    const store = getStore();
    const entry = {
      id: Date.now(),
      style,
      type,
      label: entryLabel(v, type),
      citationHtml: html,
      citationPlain: htmlToPlain(html),
      fields: v,
      savedAt: Date.now(),
    };
    store.entries.unshift(entry);
    if (store.entries.length > 80) store.entries = store.entries.slice(0, 80);
    persistStore(store);
    return entry;
  }

  function insertIntoNote(html) {
    const plain = htmlToPlain(html);
    if (!plain) {
      toast(T('cite.empty'), 'warning');
      return false;
    }
    const editor = document.getElementById('noteEditor');
    if (!editor) {
      toast(T('cite.open_note'), 'warning');
      return false;
    }
    editor.innerHTML =
      (editor.innerHTML || '') + `<p class="flux-cite-insert">${html}</p>`;
    toast(T('cite.inserted'), 'success');
    return true;
  }

  function copyHtml(html) {
    const plain = htmlToPlain(html);
    if (!plain) return;
    navigator.clipboard
      .writeText(plain)
      .then(() => toast(T('cite.copied'), 'success'))
      .catch(() => toast(T('cite.copy_fail'), 'warning'));
  }

  function exportBibliography() {
    const store = getStore();
    if (!store.entries.length) {
      toast(T('cite.no_saved'), 'warning');
      return;
    }
    const lines = store.entries
      .slice()
      .sort((a, b) => (a.label || '').localeCompare(b.label || ''))
      .map((e, i) => `${i + 1}. ${e.citationPlain}`);
    const blob = new Blob([lines.join('\n\n') + '\n'], {
      type: 'text/plain;charset=utf-8',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'flux-bibliography.txt';
    a.click();
    URL.revokeObjectURL(url);
    store.exports = (store.exports || 0) + 1;
    persistStore(store);
    toast(T('cite.exported'), 'success');
  }

  function renderLibrary(container) {
    const store = getStore();
    if (!store.entries.length) {
      container.innerHTML = `<div style="font-size:.72rem;color:var(--muted);font-style:italic">${esc(T('cite.lib_empty'))}</div>`;
      return;
    }
    container.innerHTML = store.entries
      .map(
        (e) => `<div class="flux-cite-lib-item" data-cite-entry="${e.id}">
  <div class="flux-cite-lib-meta">${esc(e.style)} · ${esc(e.type)}</div>
  <div class="flux-cite-lib-text">${e.citationHtml}</div>
</div>`,
      )
      .join('');
    container.querySelectorAll('[data-cite-entry]').forEach((el) => {
      el.addEventListener('click', () => {
        const id = parseInt(el.getAttribute('data-cite-entry'), 10);
        const entry = store.entries.find((x) => x.id === id);
        if (!entry) return;
        insertIntoNote(entry.citationHtml);
      });
    });
  }

  function drawFields(main) {
    const fieldsEl = main.querySelector('#fluxCiteFields');
    if (!fieldsEl) return;
    fieldsEl.innerHTML = (FIELDS[uiType] || [])
      .map(
        ([k, lbl]) =>
          `<label class="flux-cite-field"><span>${esc(lbl)}</span><input type="text" data-cite-k="${k}" autocomplete="off" /></label>`,
      )
      .join('');
  }

  function refreshPreview(main) {
    const preview = main.querySelector('#fluxCitePreview');
    if (!preview) return;
    const v = readFormValues(main);
    preview.innerHTML = buildCitation(uiStyle, uiType, v) || `<span style="color:var(--muted)">${esc(T('cite.preview_empty'))}</span>`;
    return v;
  }

  function closeModal() {
    document.getElementById(OVERLAY_ID)?.remove();
  }

  function openHelper() {
    if (!enabled()) return;
    closeModal();
    uiStyle = 'MLA';
    uiType = 'web';

    const overlay = document.createElement('div');
    overlay.id = OVERLAY_ID;
    overlay.className = 'flux-cite-overlay';
    overlay.innerHTML = `<div class="flux-cite-panel" role="dialog">
  <div class="flux-cite-head">
    <div style="font-weight:800;font-size:.85rem">${esc(T('cite.title'))}</div>
    <button type="button" data-cite-close style="background:none;border:none;color:var(--muted);cursor:pointer;font-size:1rem">✕</button>
  </div>
  <div class="flux-cite-body">
    <div class="flux-cite-main">
      <div class="flux-cite-seg" data-cite-styles>
        <button type="button" class="active" data-style="MLA">MLA 9</button>
        <button type="button" data-style="APA">APA 7</button>
        <button type="button" data-style="Chicago">Chicago 17</button>
      </div>
      <label class="flux-cite-field"><span>${esc(T('cite.source_type'))}</span>
        <select id="fluxCiteType">
          <option value="web">${esc(T('cite.type_web'))}</option>
          <option value="book">${esc(T('cite.type_book'))}</option>
          <option value="journal">${esc(T('cite.type_journal'))}</option>
          <option value="news">${esc(T('cite.type_news'))}</option>
        </select>
      </label>
      <div id="fluxCiteFields"></div>
      <div class="flux-cite-preview-label" style="font-size:.65rem;text-transform:uppercase;color:var(--muted);margin-top:8px">${esc(T('cite.preview'))}</div>
      <div id="fluxCitePreview" class="flux-cite-preview"></div>
      <div class="flux-cite-actions">
        <button type="button" data-cite-save>${esc(T('cite.save'))}</button>
        <button type="button" class="btn-sec" data-cite-insert>${esc(T('cite.insert'))}</button>
        <button type="button" class="btn-sec" data-cite-copy>${esc(T('cite.copy'))}</button>
        <button type="button" class="btn-sec" data-cite-export>${esc(T('cite.export_bib'))}</button>
      </div>
    </div>
    <div class="flux-cite-lib">
      <div style="font-size:.68rem;text-transform:uppercase;color:var(--muted);margin-bottom:8px;font-family:'JetBrains Mono',monospace">${esc(T('cite.library'))}</div>
      <div id="fluxCiteLibrary"></div>
    </div>
  </div>
</div>`;

    document.body.appendChild(overlay);
    const main = overlay.querySelector('.flux-cite-main');
    const lib = overlay.querySelector('#fluxCiteLibrary');

    drawFields(main);
    refreshPreview(main);
    renderLibrary(lib);

    overlay.querySelector('[data-cite-close]')?.addEventListener('click', closeModal);
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) closeModal();
    });

    overlay.querySelectorAll('[data-cite-styles] button').forEach((btn) => {
      btn.addEventListener('click', () => {
        overlay.querySelectorAll('[data-cite-styles] button').forEach((b) => b.classList.remove('active'));
        btn.classList.add('active');
        uiStyle = btn.getAttribute('data-style');
        refreshPreview(main);
      });
    });

    overlay.querySelector('#fluxCiteType')?.addEventListener('change', (e) => {
      uiType = e.target.value;
      drawFields(main);
      refreshPreview(main);
    });

    main.addEventListener('input', () => refreshPreview(main));

    overlay.querySelector('[data-cite-save]')?.addEventListener('click', () => {
      const v = readFormValues(main);
      const html = buildCitation(uiStyle, uiType, v);
      if (!htmlToPlain(html)) {
        toast(T('cite.fill_fields'), 'warning');
        return;
      }
      saveEntry(uiStyle, uiType, v, html);
      renderLibrary(lib);
      refreshBanner();
      toast(T('cite.saved'), 'success');
    });

    overlay.querySelector('[data-cite-insert]')?.addEventListener('click', () => {
      const html = buildCitation(uiStyle, uiType, readFormValues(main));
      if (insertIntoNote(html)) closeModal();
    });

    overlay.querySelector('[data-cite-copy]')?.addEventListener('click', () => {
      copyHtml(buildCitation(uiStyle, uiType, readFormValues(main)));
    });

    overlay.querySelector('[data-cite-export]')?.addEventListener('click', exportBibliography);
  }

  function refreshBanner() {
    const host = document.getElementById('notesListView');
    if (!host || !enabled()) return;

    let banner = document.getElementById(BANNER_ID);
    if (!banner) {
      banner = document.createElement('div');
      banner.id = BANNER_ID;
      banner.className = 'flux-cite-banner';
      const list = document.getElementById('notesList');
      if (list) host.insertBefore(banner, list);
      else host.appendChild(banner);
    }

    const count = getStore().entries.length;
    banner.innerHTML = `<div class="flux-cite-banner-text">${esc(T('cite.banner_lead'))} <strong>${count}</strong> ${esc(T('cite.saved_count'))}</div>
<button type="button" class="btn-sec flux-cite-open" style="font-size:.72rem;padding:6px 12px">${esc(T('cite.open'))}</button>
<button type="button" class="btn-sec flux-cite-export-banner" style="font-size:.72rem;padding:6px 12px">${esc(T('cite.export_bib'))}</button>`;
    banner.querySelector('.flux-cite-open')?.addEventListener('click', openHelper);
    banner.querySelector('.flux-cite-export-banner')?.addEventListener('click', exportBibliography);
  }

  function enhanceNotesToolbar() {
    const toolbar = document.querySelector('#notesEditorView [onclick*="saveNote"]')?.parentElement;
    if (!toolbar || document.getElementById('fluxCiteNoteBtn')) return;

    const btn = document.createElement('button');
    btn.type = 'button';
    btn.id = 'fluxCiteNoteBtn';
    btn.className = 'flux-cite-note-btn';
    btn.textContent = '❝ ' + T('cite.btn');
    btn.title = T('cite.btn_hint');
    btn.addEventListener('click', openHelper);

    const saveBtn = toolbar.querySelector('[onclick*="saveNote"]');
    if (saveBtn) saveBtn.insertAdjacentElement('afterend', btn);
    else toolbar.appendChild(btn);
  }

  function wrapRenderNotesList() {
    const orig = window.renderNotesList;
    if (typeof orig !== 'function' || orig._fluxCiteWrapped) return;
    window.renderNotesList = function () {
      const r = orig.apply(this, arguments);
      try {
        if (enabled()) refreshBanner();
      } catch (_) {}
      return r;
    };
    window.renderNotesList._fluxCiteWrapped = true;
  }

  function wrapOpenNote() {
    const orig = window.openNote;
    if (typeof orig !== 'function' || orig._fluxCiteWrapped) return;
    window.openNote = function () {
      const r = orig.apply(this, arguments);
      try {
        if (enabled()) enhanceNotesToolbar();
      } catch (_) {}
      return r;
    };
    window.openNote._fluxCiteWrapped = true;
  }

  function wrapOpenNewNote() {
    const orig = window.openNewNote;
    if (typeof orig !== 'function' || orig._fluxCiteWrapped) return;
    window.openNewNote = function () {
      const r = orig.apply(this, arguments);
      try {
        if (enabled()) enhanceNotesToolbar();
      } catch (_) {}
      return r;
    };
    window.openNewNote._fluxCiteWrapped = true;
  }

  function getPaletteCommands(q) {
    if (!enabled()) return [];
    const needle = (q || '').toLowerCase();
    const label = T('cite.palette');
    const keys = 'citation mla apa chicago bibliography cite source';
    if (
      needle &&
      !label.toLowerCase().includes(needle) &&
      !keys.split(' ').some((k) => needle.includes(k))
    ) {
      return [];
    }
    return [
      {
        icon: '❝',
        label,
        cat: 'Actions',
        action: () => {
          if (typeof window.closeCommandPalette === 'function') window.closeCommandPalette();
          if (typeof window.nav === 'function') {
            const tab = document.querySelector('[data-tab="notes"]');
            window.nav('notes', tab);
          }
          setTimeout(openHelper, 300);
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
    enhanceNotesToolbar();
    return true;
  }

  window.FluxCitationHelper = {
    FLAG,
    enabled,
    buildCitation,
    openHelper,
    exportBibliography,
    getCloudSlice,
    applyFromCloud,
    getPaletteCommands,
    install,
  };
})();
