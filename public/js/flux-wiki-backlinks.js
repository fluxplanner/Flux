/**
 * P31.1 — Wiki backlinks + graph ([[wikilink]] style).
 * Flag: enable_wiki_backlinks (default off).
 */
(function () {
  'use strict';

  const FLAG = 'enable_wiki_backlinks';
  const STORE_KEY = 'flux_wiki_backlinks_v1';
  const PANEL_ID = 'fluxWikiPanel';
  const BANNER_ID = 'fluxWikiBanner';
  const GRAPH_OVERLAY_ID = 'fluxWikiGraphOverlay';
  const WIKI_RE = /\[\[([^\]]+)\]\]/g;

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

  function stripHtml(html) {
    if (typeof window.strip === 'function') return window.strip(html);
    const d = document.createElement('div');
    d.innerHTML = html || '';
    return d.textContent || '';
  }

  function getPrefs() {
    const s = load(STORE_KEY, {});
    return { graphOpens: s.graphOpens || 0 };
  }

  function persistPrefs(patch) {
    const next = { ...getPrefs(), ...patch };
    save(STORE_KEY, next);
    try {
      if (typeof window.syncKey === 'function') window.syncKey('wikiBacklinks', getCloudSlice());
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

  function parseWikilinks(text) {
    const links = [];
    const src = String(text || '');
    let m;
    WIKI_RE.lastIndex = 0;
    while ((m = WIKI_RE.exec(src)) !== null) {
      const target = String(m[1] || '').trim();
      if (target) links.push(target);
    }
    return links;
  }

  function linksFromNote(note) {
    if (!note) return [];
    return parseWikilinks(stripHtml(note.body || '') + ' ' + (note.title || ''));
  }

  function resolveTarget(target, excludeId) {
    const t = String(target || '').trim();
    if (!t) return null;
    const list = notesList();
    if (/^\d+$/.test(t)) {
      const byId = list.find((n) => String(n.id) === t);
      return byId || null;
    }
    const lower = t.toLowerCase();
    return (
      list.find(
        (n) =>
          String(n.id) !== String(excludeId) &&
          String(n.title || 'Untitled').trim().toLowerCase() === lower,
      ) || null
    );
  }

  function targetMatchesNote(target, note) {
    if (!note) return false;
    const t = String(target || '').trim();
    if (/^\d+$/.test(t)) return String(note.id) === t;
    return String(note.title || 'Untitled').trim().toLowerCase() === t.toLowerCase();
  }

  function outlinksForNote(note) {
    const seen = new Set();
    const out = [];
    linksFromNote(note).forEach((target) => {
      const key = target.toLowerCase();
      if (seen.has(key)) return;
      seen.add(key);
      const resolved = resolveTarget(target, note.id);
      out.push({ target, note: resolved });
    });
    return out;
  }

  function backlinksForNote(note) {
    if (!note) return [];
    const hits = [];
    notesList().forEach((src) => {
      if (String(src.id) === String(note.id)) return;
      const links = linksFromNote(src);
      if (links.some((t) => targetMatchesNote(t, note))) {
        hits.push(src);
      }
    });
    return hits;
  }

  function graphData() {
    const list = notesList();
    const nodes = list.map((n) => ({
      id: n.id,
      title: n.title || T('wiki.untitled'),
    }));
    const edges = [];
    const edgeKeys = new Set();
    list.forEach((src) => {
      outlinksForNote(src).forEach(({ note: dst }) => {
        if (!dst) return;
        const k = `${src.id}->${dst.id}`;
        if (edgeKeys.has(k)) return;
        edgeKeys.add(k);
        edges.push({ from: src.id, to: dst.id });
      });
    });
    return { nodes, edges };
  }

  function totalLinkCount() {
    let n = 0;
    notesList().forEach((note) => {
      n += outlinksForNote(note).filter((x) => x.note).length;
    });
    return n;
  }

  function notesWithLinks() {
    return notesList().filter((n) => linksFromNote(n).length > 0);
  }

  function navigateToNote(id) {
    if (typeof window.openNote === 'function') window.openNote(id);
  }

  function renderLinkList(items, emptyKey) {
    if (!items.length) {
      return `<div class="flux-wiki-empty">${esc(T(emptyKey))}</div>`;
    }
    return `<ul class="flux-wiki-links">${items
      .map((item) => {
        const id = item.note ? item.note.id : item.id;
        const label = item.note
          ? item.note.title || T('wiki.untitled')
          : item.target || item.title || T('wiki.untitled');
        const broken = item.note === null && item.target !== undefined;
        const text = broken ? `${label} (${T('wiki.broken')})` : label;
        if (broken) {
          return `<li><span style="font-size:.74rem;color:var(--muted)">${esc(text)}</span></li>`;
        }
        return `<li><button type="button" data-wiki-nav="${id}">${esc(text)}</button></li>`;
      })
      .join('')}</ul>`;
  }

  function refreshPanel() {
    if (!enabled()) return;
    const noteId = window.currentNoteId;
    const host = document.getElementById('notesEditorView');
    if (!host) return;

    let panel = document.getElementById(PANEL_ID);
    if (!panel) {
      panel = document.createElement('div');
      panel.id = PANEL_ID;
      panel.className = 'flux-wiki-panel';
      const editor = document.getElementById('noteEditor');
      const ai = document.getElementById('aiNoteResult');
      if (ai) host.insertBefore(panel, ai);
      else if (editor) editor.insertAdjacentElement('afterend', panel);
      else host.appendChild(panel);
    }

    if (!noteId) {
      panel.style.display = 'none';
      return;
    }

    const note = notesList().find((n) => n.id === noteId);
    if (!note) {
      panel.style.display = 'none';
      return;
    }

    panel.style.display = 'block';
    const out = outlinksForNote(note);
    const back = backlinksForNote(note);

    panel.innerHTML = `<div class="flux-wiki-panel-head">
  <div class="flux-wiki-panel-title">${esc(T('wiki.panel_title'))}</div>
  <button type="button" class="btn-sec flux-wiki-graph-btn" style="font-size:.72rem;padding:5px 10px">${esc(T('wiki.graph'))}</button>
</div>
<div class="flux-wiki-cols">
  <div>
    <div class="flux-wiki-col-label">${esc(T('wiki.outlinks'))}</div>
    ${renderLinkList(
      out.map((o) => ({ target: o.target, note: o.note })),
      'wiki.no_outlinks',
    )}
  </div>
  <div>
    <div class="flux-wiki-col-label">${esc(T('wiki.backlinks'))}</div>
    ${renderLinkList(
      back.map((b) => ({ id: b.id, title: b.title, note: b })),
      'wiki.no_backlinks',
    )}
  </div>
</div>`;

    panel.querySelector('.flux-wiki-graph-btn')?.addEventListener('click', () => openGraph(noteId));
    panel.querySelectorAll('[data-wiki-nav]').forEach((btn) => {
      btn.addEventListener('click', () => {
        navigateToNote(parseInt(btn.getAttribute('data-wiki-nav'), 10));
        refreshPanel();
      });
    });
  }

  function closeGraph() {
    document.getElementById(GRAPH_OVERLAY_ID)?.remove();
  }

  function openGraph(focusId) {
    if (!enabled()) return;
    closeGraph();
    persistPrefs({ graphOpens: getPrefs().graphOpens + 1 });

    const { nodes, edges } = graphData();
    const w = 680;
    const h = 380;
    const cx = w / 2;
    const cy = h / 2;
    const r = Math.min(w, h) * 0.36;
    const positions = {};
    nodes.forEach((n, i) => {
      const angle = (i / Math.max(nodes.length, 1)) * Math.PI * 2 - Math.PI / 2;
      positions[n.id] = { x: cx + r * Math.cos(angle), y: cy + r * Math.sin(angle), ...n };
    });

    const edgeSvg = edges
      .map((e) => {
        const a = positions[e.from];
        const b = positions[e.to];
        if (!a || !b) return '';
        return `<line class="flux-wiki-graph-edge" x1="${a.x}" y1="${a.y}" x2="${b.x}" y2="${b.y}" />`;
      })
      .join('');

    const nodeSvg = nodes
      .map((n) => {
        const p = positions[n.id];
        const label = (n.title || '').slice(0, 18);
        const cur = String(n.id) === String(focusId) ? ' is-current' : '';
        return `<g class="flux-wiki-graph-node${cur}" data-wiki-node="${n.id}" transform="translate(${p.x},${p.y})">
  <circle r="18" />
  <text text-anchor="middle" dy="32">${esc(label)}</text>
</g>`;
      })
      .join('');

    const overlay = document.createElement('div');
    overlay.id = GRAPH_OVERLAY_ID;
    overlay.className = 'flux-wiki-graph-overlay';
    overlay.innerHTML = `<div class="flux-wiki-graph-panel" role="dialog">
  <div class="flux-wiki-graph-head">
    <div style="font-weight:800;font-size:.85rem">${esc(T('wiki.graph_title'))}</div>
    <button type="button" data-wiki-close style="background:none;border:none;color:var(--muted);cursor:pointer;font-size:1rem">✕</button>
  </div>
  <div class="flux-wiki-graph-svg-wrap">
    <svg class="flux-wiki-graph-svg" viewBox="0 0 ${w} ${h}" xmlns="http://www.w3.org/2000/svg">
      ${edgeSvg}
      ${nodeSvg}
    </svg>
  </div>
  <div style="padding:10px 18px;font-size:.68rem;color:var(--muted);border-top:1px solid var(--border2)">${esc(T('wiki.graph_hint'))}</div>
</div>`;

    document.body.appendChild(overlay);
    overlay.querySelector('[data-wiki-close]')?.addEventListener('click', closeGraph);
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) closeGraph();
    });
    overlay.querySelectorAll('[data-wiki-node]').forEach((g) => {
      g.addEventListener('click', () => {
        const id = parseInt(g.getAttribute('data-wiki-node'), 10);
        closeGraph();
        navigateToNote(id);
        refreshPanel();
      });
    });
  }

  function refreshBanner() {
    const host = document.getElementById('notesListView');
    if (!host || !enabled()) return;

    let banner = document.getElementById(BANNER_ID);
    if (!banner) {
      banner = document.createElement('div');
      banner.id = BANNER_ID;
      banner.className = 'flux-wiki-banner';
      const list = document.getElementById('notesList');
      if (list) host.insertBefore(banner, list);
      else host.appendChild(banner);
    }

    const linked = notesWithLinks().length;
    const edges = totalLinkCount();
    banner.innerHTML = `<div class="flux-wiki-banner-text">${esc(T('wiki.banner_lead'))} <strong>${linked}</strong> ${esc(T('wiki.notes_linked'))} · <strong>${edges}</strong> ${esc(T('wiki.links'))}</div>
<button type="button" class="btn-sec flux-wiki-banner-graph" style="font-size:.72rem;padding:6px 12px">${esc(T('wiki.graph'))}</button>`;
    banner.querySelector('.flux-wiki-banner-graph')?.addEventListener('click', () => openGraph(window.currentNoteId));
  }

  function insertWikilink() {
    const title = window.prompt(T('wiki.prompt_title'), '');
    if (title === null) return;
    const trimmed = String(title).trim();
    if (!trimmed) {
      toast(T('wiki.prompt_empty'), 'warning');
      return;
    }
    const el = document.getElementById('noteEditor');
    if (!el) return;
    el.focus();
    try {
      document.execCommand('insertText', false, `[[${trimmed}]]`);
    } catch (_) {
      el.innerHTML += esc(`[[${trimmed}]]`);
    }
    refreshPanel();
    toast(T('wiki.link_inserted'), 'success');
  }

  function ensureToolbarButtons() {
    const rtbar = document.querySelector('#notesEditorView .rtbar');
    if (!rtbar || document.getElementById('fluxWikiLinkBtn')) return;

    const btn = document.createElement('button');
    btn.type = 'button';
    btn.id = 'fluxWikiLinkBtn';
    btn.className = 'rtbtn';
    btn.title = T('wiki.insert_hint');
    btn.textContent = '[[ ]]';
    btn.addEventListener('click', insertWikilink);
    rtbar.appendChild(btn);
  }

  function ensureFilterButton() {
    const row = document.querySelector('#notesListView .tmode-btn')?.parentElement;
    if (!row || row.querySelector('[data-wiki-filter]')) return;
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'tmode-btn flux-wiki-filter-btn';
    btn.setAttribute('data-wiki-filter', '1');
    btn.textContent = '🔗 Linked';
    btn.addEventListener('click', () => {
      if (typeof window.setNoteFilter === 'function') window.setNoteFilter('linked', btn);
    });
    row.appendChild(btn);
  }

  function linkBadgeCount(note) {
    return linksFromNote(note).length;
  }

  function renderLinkedNotesList() {
    const el = document.getElementById('notesList');
    if (!el) return;
    const q = (document.getElementById('noteSearch')?.value || '').toLowerCase();
    let list = notesWithLinks();
    if (q) {
      list = list.filter(
        (n) =>
          (n.title || '').toLowerCase().includes(q) ||
          stripHtml(n.body || '').toLowerCase().includes(q),
      );
    }
    if (!list.length) {
      el.innerHTML = `<div class="empty">${esc(T('wiki.empty_filter'))}</div>`;
      refreshBanner();
      return;
    }
    const getSubjects =
      typeof window.getSubjects === 'function' ? window.getSubjects : () => ({});
    el.innerHTML = list
      .sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0))
      .map((n) => {
        const sub = getSubjects()[n.subject];
        const lc = linkBadgeCount(n);
        const bc = backlinksForNote(n).length;
        return `<div class="note-card" onclick="openNote(${n.id})"><div style="display:flex;align-items:center;gap:8px;margin-bottom:4px"><div class="note-title">${esc(n.title || 'Untitled')}</div>${n.starred ? '<span style="color:var(--gold)">⭐</span>' : ''}<span class="badge badge-blue" style="padding:2px 6px;font-size:.6rem">🔗 ${lc}</span>${bc ? `<span class="badge" style="padding:2px 6px;font-size:.6rem;background:rgba(var(--purple-rgb),.12);color:var(--purple)">← ${bc}</span>` : ''}</div>${sub ? `<span class="badge badge-blue" style="padding:2px 6px;font-size:.62rem;margin-bottom:4px">${sub.short}</span>` : ''}<div class="note-preview">${esc(stripHtml(n.body || ''))}</div><div style="font-size:.62rem;color:var(--muted);font-family:'JetBrains Mono',monospace;margin-top:5px">${new Date(n.updatedAt || Date.now()).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</div></div>`;
      })
      .join('');
    refreshBanner();
  }

  function wrapRenderNotesList() {
    const orig = window.renderNotesList;
    if (typeof orig !== 'function' || orig._fluxWikiWrapped) return;
    window.renderNotesList = function () {
      if (!enabled()) return orig.apply(this, arguments);
      ensureFilterButton();
      if (window.noteFilter === 'linked') {
        renderLinkedNotesList();
        return;
      }
      orig.apply(this, arguments);
      refreshBanner();
      document.querySelectorAll('#notes .note-card').forEach((cardEl) => {
        const onclick = cardEl.getAttribute('onclick') || '';
        const m = onclick.match(/openNote\((\d+)\)/);
        if (!m) return;
        const note = notesList().find((n) => String(n.id) === m[1]);
        if (!note) return;
        const lc = linkBadgeCount(note);
        if (!lc) return;
        const titleRow = cardEl.querySelector('div[style*="align-items"]');
        if (!titleRow || titleRow.querySelector('[data-wiki-badge]')) return;
        titleRow.insertAdjacentHTML(
          'beforeend',
          `<span data-wiki-badge class="badge badge-blue" style="padding:2px 6px;font-size:.6rem">🔗 ${lc}</span>`,
        );
      });
    };
    window.renderNotesList._fluxWikiWrapped = true;
  }

  function wrapOpenNote() {
    const orig = window.openNote;
    if (typeof orig !== 'function' || orig._fluxWikiWrapped) return;
    window.openNote = function () {
      const r = orig.apply(this, arguments);
      try {
        if (enabled()) {
          ensureToolbarButtons();
          refreshPanel();
        }
      } catch (_) {}
      return r;
    };
    window.openNote._fluxWikiWrapped = true;
  }

  function wrapOpenNewNote() {
    const orig = window.openNewNote;
    if (typeof orig !== 'function' || orig._fluxWikiWrapped) return;
    window.openNewNote = function () {
      const r = orig.apply(this, arguments);
      try {
        if (enabled()) {
          ensureToolbarButtons();
          refreshPanel();
        }
      } catch (_) {}
      return r;
    };
    window.openNewNote._fluxWikiWrapped = true;
  }

  function wrapSaveNote() {
    const orig = window.saveNote;
    if (typeof orig !== 'function' || orig._fluxWikiWrapped) return;
    window.saveNote = function () {
      const r = orig.apply(this, arguments);
      try {
        if (enabled()) {
          refreshPanel();
          refreshBanner();
        }
      } catch (_) {}
      return r;
    };
    window.saveNote._fluxWikiWrapped = true;
  }

  function getPaletteCommands(q) {
    if (!enabled()) return [];
    const needle = (q || '').toLowerCase();
    const label = T('wiki.palette');
    const keys = 'wiki backlink graph link note obsidian';
    if (
      needle &&
      !label.toLowerCase().includes(needle) &&
      !keys.split(' ').some((k) => needle.includes(k))
    ) {
      return [];
    }
    return [
      {
        icon: '🔗',
        label,
        cat: 'Navigation',
        action: () => {
          if (typeof window.closeCommandPalette === 'function') window.closeCommandPalette();
          if (typeof window.nav === 'function') {
            const tab = document.querySelector('[data-tab="notes"]');
            window.nav('notes', tab);
          }
          setTimeout(() => openGraph(window.currentNoteId), 300);
        },
      },
    ];
  }

  function install() {
    if (!enabled()) return false;
    wrapRenderNotesList();
    wrapOpenNote();
    wrapOpenNewNote();
    wrapSaveNote();
    ensureFilterButton();
    ensureToolbarButtons();
    refreshBanner();
    refreshPanel();
    return true;
  }

  window.FluxWikiBacklinks = {
    FLAG,
    enabled,
    parseWikilinks,
    resolveTarget,
    outlinksForNote,
    backlinksForNote,
    graphData,
    openGraph,
    insertWikilink,
    getCloudSlice,
    applyFromCloud,
    getPaletteCommands,
    install,
  };
})();
