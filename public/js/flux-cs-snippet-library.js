/**
 * P24.1 — CS code snippet library (local, tag search, light syntax highlight).
 * Flag: enable_cs_snippet_library (default off).
 */
(function () {
  'use strict';

  const FLAG = 'enable_cs_snippet_library';
  const STORE_KEY = 'flux_cs_snippet_library_v1';
  const TOOL_ID = 'cs-snippets';

  const STARTER = [
    {
      id: 'starter_py_bsearch',
      title: 'Binary search (Python)',
      lang: 'python',
      tags: ['python', 'algorithm', 'search'],
      code: 'def binary_search(arr, target):\n    lo, hi = 0, len(arr) - 1\n    while lo <= hi:\n        mid = (lo + hi) // 2\n        if arr[mid] == target:\n            return mid\n        if arr[mid] < target:\n            lo = mid + 1\n        else:\n            hi = mid - 1\n    return -1',
    },
    {
      id: 'starter_js_fetch',
      title: 'Fetch JSON (JavaScript)',
      lang: 'javascript',
      tags: ['javascript', 'web', 'async'],
      code: 'async function loadData(url) {\n  const res = await fetch(url);\n  if (!res.ok) throw new Error(`HTTP ${res.status}`);\n  return res.json();\n}',
    },
    {
      id: 'starter_java_sort',
      title: 'Sort ArrayList (Java)',
      lang: 'java',
      tags: ['java', 'collections'],
      code: 'import java.util.*;\n\nList<String> items = new ArrayList<>();\nitems.add("beta");\nitems.add("alpha");\nCollections.sort(items);\nSystem.out.println(items);',
    },
    {
      id: 'starter_sql_join',
      title: 'INNER JOIN (SQL)',
      lang: 'sql',
      tags: ['sql', 'database'],
      code: 'SELECT t.id, t.title, c.name AS class_name\nFROM tasks t\nINNER JOIN classes c ON c.id = t.class_id\nWHERE t.done = false\nORDER BY t.due_date;',
    },
    {
      id: 'starter_cpp_vector',
      title: 'Vector loop (C++)',
      lang: 'cpp',
      tags: ['cpp', 'stl'],
      code: '#include <vector>\n#include <iostream>\n\nint main() {\n  std::vector<int> nums = {1, 2, 3};\n  for (int n : nums) std::cout << n << "\\n";\n  return 0;\n}',
    },
  ];

  const KEYWORDS = {
    javascript: /\b(const|let|var|function|return|if|else|for|while|async|await|throw|new|class|import|export|from|try|catch|typeof|null|undefined|true|false)\b/g,
    python: /\b(def|return|if|elif|else|for|while|in|import|from|class|try|except|raise|with|as|pass|break|continue|True|False|None|lambda|yield)\b/g,
    java: /\b(public|private|protected|class|interface|extends|implements|static|void|int|long|double|boolean|String|return|if|else|for|while|new|import|package|final|this|super|null|true|false)\b/g,
    sql: /\b(SELECT|FROM|WHERE|JOIN|INNER|LEFT|RIGHT|OUTER|ON|GROUP|BY|ORDER|HAVING|INSERT|INTO|VALUES|UPDATE|SET|DELETE|CREATE|TABLE|INDEX|AS|AND|OR|NOT|NULL|IS|IN|LIMIT|DISTINCT|COUNT|SUM|AVG|MAX|MIN|CASE|WHEN|THEN|ELSE|END|ASC|DESC|FALSE|TRUE)\b/gi,
    cpp: /\b(include|using|namespace|std|int|void|return|if|else|for|while|class|struct|public|private|protected|const|auto|true|false|nullptr|template|typename|vector|string|cout|cin|endl)\b/g,
  };

  let selectedId = null;
  let modalOpen = false;

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
    let snippets = Array.isArray(s.snippets) ? s.snippets.filter((x) => x && x.id && x.code) : [];
    if (!snippets.length && !s.seeded) {
      snippets = STARTER.map((x) => ({ ...x, seeded: true, createdAt: Date.now() }));
      persistStore({ snippets, seeded: true });
    }
    return { snippets, seeded: !!s.seeded };
  }

  function persistStore(data) {
    save(STORE_KEY, data);
    try {
      if (typeof window.syncKey === 'function') window.syncKey('csSnippetLibrary', getCloudSlice());
    } catch (_) {}
  }

  function getCloudSlice() {
    const s = getStore();
    return {
      snippets: s.snippets.map((sn) => ({
        id: sn.id,
        title: sn.title,
        lang: sn.lang,
        tags: sn.tags,
        code: sn.code,
        createdAt: sn.createdAt,
      })),
      seeded: s.seeded,
    };
  }

  function applyFromCloud(data) {
    if (!data || typeof data !== 'object') return;
    persistStore({
      snippets: Array.isArray(data.snippets) ? data.snippets : [],
      seeded: data.seeded !== false,
    });
    if (modalOpen) renderModalBody();
  }

  function highlightCode(code, lang) {
    let html = esc(code);
    const strRe = /(&quot;[^&]*?&quot;|'[^']*?'|`[^`]*?`)/g;
    html = html.replace(strRe, '<span class="csl-str">$1</span>');
    const cmtRe = /(\/\/[^\n]*|#(?!!)[^\n]*|\/\*[\s\S]*?\*\/)/g;
    html = html.replace(cmtRe, '<span class="csl-cmt">$1</span>');
    const numRe = /\b(\d+\.?\d*)\b/g;
    html = html.replace(numRe, '<span class="csl-num">$1</span>');
    const kw = KEYWORDS[lang] || KEYWORDS.javascript;
    html = html.replace(kw, '<span class="csl-kw">$&</span>');
    return html;
  }

  function filterSnippets(query) {
    const q = (query || '').trim().toLowerCase();
    const { snippets } = getStore();
    if (!q) return snippets;
    return snippets.filter((sn) => {
      const hay = `${sn.title} ${sn.lang} ${(sn.tags || []).join(' ')} ${sn.code}`.toLowerCase();
      return hay.includes(q);
    });
  }

  function findSnippet(id) {
    return getStore().snippets.find((s) => s.id === id) || null;
  }

  function copyCode(code) {
    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(code).then(
        () => toast(T('csl.copied'), 'success'),
        () => toast(code, 'info'),
      );
      return;
    }
    toast(code, 'info');
  }

  function deleteSnippet(id) {
    const store = getStore();
    const sn = store.snippets.find((s) => s.id === id);
    if (sn?.seeded && !confirm(T('csl.confirm_delete_starter'))) return;
    store.snippets = store.snippets.filter((s) => s.id !== id);
    persistStore(store);
    if (selectedId === id) selectedId = store.snippets[0]?.id || null;
    renderModalBody();
    toast(T('csl.deleted'), 'info');
  }

  function saveNewSnippet() {
    const title = document.getElementById('cslNewTitle')?.value.trim();
    const lang = document.getElementById('cslNewLang')?.value || 'javascript';
    const tagsRaw = document.getElementById('cslNewTags')?.value || '';
    const code = document.getElementById('cslNewCode')?.value || '';
    if (!title || !code.trim()) {
      toast(T('csl.need_title_code'), 'warning');
      return;
    }
    const tags = tagsRaw
      .split(/[,;\s]+/)
      .map((t) => t.trim().toLowerCase())
      .filter(Boolean);
    const store = getStore();
    const id = 'user_' + Date.now();
    store.snippets.unshift({ id, title, lang, tags, code, createdAt: Date.now() });
    persistStore(store);
    selectedId = id;
    renderModalBody();
    toast(T('csl.saved'), 'success');
  }

  function exportJson() {
    const payload = { v: 1, snippets: getStore().snippets };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'flux-cs-snippets.json';
    a.click();
    URL.revokeObjectURL(url);
    toast(T('csl.exported'), 'info');
  }

  function importJson(text) {
    let raw;
    try {
      raw = JSON.parse(text);
    } catch (_) {
      toast(T('csl.import_invalid'), 'error');
      return;
    }
    const incoming = Array.isArray(raw.snippets) ? raw.snippets : Array.isArray(raw) ? raw : [];
    const cleaned = incoming
      .map((sn, i) => ({
        id: sn.id || 'import_' + Date.now() + '_' + i,
        title: String(sn.title || 'Snippet').trim(),
        lang: sn.lang || 'javascript',
        tags: Array.isArray(sn.tags) ? sn.tags : [],
        code: String(sn.code || ''),
        createdAt: sn.createdAt || Date.now(),
      }))
      .filter((sn) => sn.title && sn.code);
    if (!cleaned.length) {
      toast(T('csl.import_invalid'), 'error');
      return;
    }
    const store = getStore();
    store.snippets = [...cleaned, ...store.snippets];
    persistStore(store);
    selectedId = cleaned[0].id;
    renderModalBody();
    toast(T('csl.import_ok', { n: cleaned.length }), 'success');
  }

  function insertIntoNote(code, title) {
    if (typeof window.notes === 'undefined' || !Array.isArray(window.notes)) {
      copyCode(code);
      return;
    }
    const body = '```\n' + code + '\n```\n';
    const note = {
      id: Date.now(),
      title: title || T('csl.note_title'),
      body,
      tags: ['#code'],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    window.notes.unshift(note);
    if (typeof window.save === 'function') window.save('notes', window.notes);
    try {
      if (typeof window.syncKey === 'function') window.syncKey('notes', window.notes);
    } catch (_) {}
    try {
      if (typeof window.renderNotesList === 'function') window.renderNotesList();
    } catch (_) {}
    toast(T('csl.note_added'), 'success');
  }

  function renderModalBody() {
    const body = document.getElementById('refToolBody');
    if (!body) return;

    const query = document.getElementById('cslSearch')?.value || '';
    const list = filterSnippets(query);
    if (!selectedId || !list.some((s) => s.id === selectedId)) {
      selectedId = list[0]?.id || null;
    }
    const active = selectedId ? findSnippet(selectedId) : null;

    const listHtml = list.length
      ? list
          .map(
            (sn) => `<button type="button" class="flux-csl-item${sn.id === selectedId ? ' active' : ''}" data-csl-id="${esc(sn.id)}">
  <div class="flux-csl-item-name">${esc(sn.title)}</div>
  <div class="flux-csl-item-meta">${esc(sn.lang)}</div>
  <div class="flux-csl-tags">${(sn.tags || []).map((t) => `<span class="flux-csl-tag">${esc(t)}</span>`).join('')}</div>
</button>`,
          )
          .join('')
      : `<p style="font-size:.72rem;color:var(--muted);padding:12px">${esc(T('csl.no_match'))}</p>`;

    body.innerHTML = `<div class="flux-csl-search">
  <input type="search" id="cslSearch" class="ref-search-input" placeholder="${esc(T('csl.search_ph'))}" value="${esc(query)}" />
</div>
<div class="flux-csl-layout">
  <div class="flux-csl-list">${listHtml}</div>
  <div class="flux-csl-editor">
    ${
      active
        ? `<div style="font-size:.82rem;font-weight:800">${esc(active.title)}</div>
<pre class="flux-csl-code" id="cslCodeView">${highlightCode(active.code, active.lang)}</pre>
<div class="flux-csl-actions">
  <button type="button" class="btn-sec" id="cslCopyBtn">${esc(T('csl.copy'))}</button>
  <button type="button" class="btn-sec" id="cslNoteBtn">${esc(T('csl.to_note'))}</button>
  <button type="button" class="btn-sec" id="cslDeleteBtn">${esc(T('csl.delete'))}</button>
</div>`
        : `<p style="font-size:.72rem;color:var(--muted)">${esc(T('csl.pick_one'))}</p>`
    }
    <div class="flux-csl-form">
      <div style="font-size:.65rem;text-transform:uppercase;letter-spacing:2px;color:var(--muted);font-family:'JetBrains Mono',monospace">${esc(T('csl.add_new'))}</div>
      <input type="text" id="cslNewTitle" placeholder="${esc(T('csl.title_ph'))}" />
      <select id="cslNewLang">
        <option value="javascript">JavaScript</option>
        <option value="python">Python</option>
        <option value="java">Java</option>
        <option value="sql">SQL</option>
        <option value="cpp">C++</option>
      </select>
      <input type="text" id="cslNewTags" placeholder="${esc(T('csl.tags_ph'))}" />
      <textarea id="cslNewCode" placeholder="${esc(T('csl.code_ph'))}"></textarea>
      <div class="flux-csl-actions">
        <button type="button" class="btn-sec" id="cslSaveBtn">${esc(T('csl.save'))}</button>
        <button type="button" class="btn-sec" id="cslExportBtn">${esc(T('csl.export'))}</button>
        <button type="button" class="btn-sec" id="cslImportBtn">${esc(T('csl.import'))}</button>
        <input type="file" id="cslImportFile" accept="application/json,.json" hidden />
      </div>
    </div>
  </div>
</div>`;

    body.querySelector('#cslSearch')?.addEventListener('input', renderModalBody);
    body.querySelectorAll('[data-csl-id]').forEach((btn) => {
      btn.addEventListener('click', () => {
        selectedId = btn.getAttribute('data-csl-id');
        renderModalBody();
      });
    });
    body.querySelector('#cslCopyBtn')?.addEventListener('click', () => {
      if (active) copyCode(active.code);
    });
    body.querySelector('#cslNoteBtn')?.addEventListener('click', () => {
      if (active) insertIntoNote(active.code, active.title);
    });
    body.querySelector('#cslDeleteBtn')?.addEventListener('click', () => {
      if (active) deleteSnippet(active.id);
    });
    body.querySelector('#cslSaveBtn')?.addEventListener('click', saveNewSnippet);
    body.querySelector('#cslExportBtn')?.addEventListener('click', exportJson);
    body.querySelector('#cslImportBtn')?.addEventListener('click', () => {
      document.getElementById('cslImportFile')?.click();
    });
    body.querySelector('#cslImportFile')?.addEventListener('change', (e) => {
      const file = e.target.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => importJson(String(reader.result || ''));
      reader.readAsText(file);
      e.target.value = '';
    });
  }

  function openLibrary() {
    if (!enabled()) return;
    if (typeof window.fluxOpenToolModal !== 'function') {
      toast(T('csl.unavailable'), 'warning');
      return;
    }
    modalOpen = true;
    if (!selectedId) selectedId = getStore().snippets[0]?.id || null;
    window.fluxOpenToolModal({
      id: TOOL_ID,
      emoji: '📋',
      title: T('csl.title'),
      wide: true,
      renderBody: (body) => {
        renderModalBody();
      },
    });
    const overlay = document.getElementById('refToolOverlay');
    if (overlay) {
      const obs = new MutationObserver(() => {
        if (!document.getElementById('refToolOverlay')) {
          modalOpen = false;
          obs.disconnect();
        }
      });
      obs.observe(document.body, { childList: true, subtree: true });
    }
  }

  function registerToolbox() {
    const layout = window.fluxToolbox?.UNIFIED_LAYOUT;
    if (!layout || !enabled()) return;
    const cs = layout.find((s) => s.id === 'cs');
    if (!cs || cs.tools.some((t) => t.id === TOOL_ID)) return;
    cs.tools.push({
      id: TOOL_ID,
      label: T('csl.tool_label'),
      icon: '📋',
      desc: T('csl.tool_desc'),
      mode: 'modal',
      fn: 'openCsSnippetLibrary',
    });
  }

  function getPaletteCommands(q) {
    if (!enabled()) return [];
    const needle = (q || '').toLowerCase();
    const label = T('csl.palette');
    const keys = 'cs snippet code library javascript python java sql';
    if (
      needle &&
      !label.toLowerCase().includes(needle) &&
      !keys.split(' ').some((k) => needle.includes(k))
    ) {
      return [];
    }
    return [
      {
        icon: '📋',
        label,
        cat: 'Navigation',
        action: () => {
          if (typeof window.closeCommandPalette === 'function') window.closeCommandPalette();
          if (typeof window.nav === 'function') {
            const tab = document.querySelector('[data-tab="toolbox"]');
            window.nav('toolbox', tab);
          }
          setTimeout(() => openLibrary(), 250);
        },
      },
    ];
  }

  function install() {
    if (!enabled()) return false;
    registerToolbox();
    try {
      if (window.fluxToolbox?.render) window.fluxToolbox.render();
    } catch (_) {}
    return true;
  }

  window.openCsSnippetLibrary = openLibrary;
  window.FluxCsSnippetLibrary = {
    FLAG,
    enabled,
    getStore,
    openLibrary,
    highlightCode,
    getCloudSlice,
    applyFromCloud,
    getPaletteCommands,
    install,
  };
})();
