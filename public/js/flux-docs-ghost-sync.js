/**
 * Google Docs ↔ Ghost draft bidirectional sync (per task).
 * Flag: enable_docs_ghost_sync (default off).
 */
(function () {
  'use strict';

  const LS_LINKS = 'flux_docs_ghost_links_v1';

  function enabled() {
    try {
      return !!window.FluxFeatureFlags?.isEnabled('enable_docs_ghost_sync', false);
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

  function escapeAttr(s) {
    return esc(s).replace(/"/g, '&quot;');
  }

  function toast(msg, kind) {
    if (typeof window.showToast === 'function') window.showToast(msg, kind || 'info');
    else console.log('[docs-ghost]', msg);
  }

  function docsApi() {
    return window.FluxGoogleDocs || null;
  }

  function taskList() {
    return Array.isArray(window.tasks) ? window.tasks : [];
  }

  function findTask(id) {
    return taskList().find((t) => t && String(t.id) === String(id)) || null;
  }

  function persistTasks() {
    try {
      if (typeof save === 'function') save('tasks', taskList());
    } catch (_) {}
    try {
      if (typeof syncKey === 'function') syncKey('tasks', taskList());
    } catch (_) {}
    try {
      if (typeof renderTasks === 'function') renderTasks();
    } catch (_) {}
  }

  function linksMap() {
    const m = load(LS_LINKS, {});
    return m && typeof m === 'object' ? m : {};
  }

  function saveLinks(m) {
    save(LS_LINKS, m || {});
  }

  function getLink(taskId) {
    const task = findTask(taskId);
    const map = linksMap();
    const key = String(taskId);
    if (map[key]) return map[key];
    if (task?.googleDocId) {
      return {
        docId: task.googleDocId,
        url: task.googleDocUrl || docsApi()?.docUrl?.(task.googleDocId),
      };
    }
    if (task?.googleDocUrl) {
      const id = docsApi()?.extractId?.(task.googleDocUrl);
      if (id) return { docId: id, url: task.googleDocUrl };
    }
    return null;
  }

  function setLink(taskId, docId, url) {
    const map = linksMap();
    map[String(taskId)] = { docId, url: url || docsApi()?.docUrl?.(docId), updatedAt: Date.now() };
    saveLinks(map);
    const task = findTask(taskId);
    if (task) {
      task.googleDocId = docId;
      task.googleDocUrl = map[String(taskId)].url;
      persistTasks();
    }
  }

  function htmlToPlain(html) {
    const el = document.createElement('div');
    el.innerHTML = String(html || '');
    return (el.textContent || el.innerText || '').trim();
  }

  function draftPlain(task) {
    if (!task) return '';
    if (task.ghostDraft) return htmlToPlain(task.ghostDraft) || String(task.ghostDraft).trim();
    const parts = [`# ${task.name || 'Task'}`];
    if (task.notes) parts.push(String(task.notes).trim());
    if (task.date) parts.push(`Due: ${task.date}`);
    return parts.join('\n\n').trim();
  }

  async function createAndLink(taskId) {
    const api = docsApi();
    const task = findTask(taskId);
    if (!api || !task) {
      toast('Google Docs API not loaded', 'warning');
      return null;
    }
    try {
      const title = `Flux — ${(task.name || 'Ghost draft').slice(0, 80)}`;
      const doc = await api.createDocument(title);
      const docId = doc.documentId || doc.document_id;
      if (!docId) throw new Error('No document id');
      const url = api.docUrl(docId);
      setLink(taskId, docId, url);
      toast('Created Google Doc and linked to task', 'success');
      return { docId, url };
    } catch (e) {
      toast(e.message || String(e), 'error');
      return null;
    }
  }

  async function pushToDoc(taskId) {
    const api = docsApi();
    const task = findTask(taskId);
    if (!api || !task) return false;
    let link = getLink(taskId);
    if (!link?.docId) {
      link = await createAndLink(taskId);
      if (!link) return false;
    }
    const text = draftPlain(task);
    if (!text) {
      toast('Nothing to push — generate a ghost draft first', 'warning');
      return false;
    }
    try {
      const header = `Flux Ghost draft — ${task.name || 'Task'}\nLast pushed: ${new Date().toLocaleString()}\n\n`;
      await api.replaceBody(link.docId, header + text);
      const map = linksMap();
      const key = String(taskId);
      if (map[key]) {
        map[key].lastPush = Date.now();
        saveLinks(map);
      }
      toast('Pushed ghost draft to Google Doc', 'success');
      return true;
    } catch (e) {
      if (String(e.message || '').includes('403') && typeof window.fluxReconnectGoogleDocs === 'function') {
        if (confirm('Google Docs write access needed. Reconnect now?')) window.fluxReconnectGoogleDocs();
      } else toast(e.message || String(e), 'error');
      return false;
    }
  }

  async function pullFromDoc(taskId) {
    const api = docsApi();
    const task = findTask(taskId);
    if (!api || !task) return false;
    const link = getLink(taskId);
    if (!link?.docId) {
      toast('Link or create a Google Doc first', 'warning');
      return false;
    }
    try {
      let text = await api.getPlainText(link.docId);
      const marker = 'Flux Ghost draft —';
      const idx = text.indexOf(marker);
      if (idx >= 0) {
        const after = text.indexOf('\n\n', idx);
        text = after >= 0 ? text.slice(after + 2).trim() : text.slice(idx).trim();
      }
      if (!text) {
        toast('Document is empty', 'warning');
        return false;
      }
      task.ghostDraft = text;
      task.ghostDraftSource = 'google_docs';
      const map = linksMap();
      const key = String(taskId);
      if (map[key]) {
        map[key].lastPull = Date.now();
        saveLinks(map);
      }
      persistTasks();
      toast('Pulled Doc text into ghost draft', 'success');
      return true;
    } catch (e) {
      toast(e.message || String(e), 'error');
      return false;
    }
  }

  function linkPrimaryDoc(taskId) {
    const api = docsApi();
    const url = api?.getPrimaryUrl?.() || '';
    const id = api?.extractId?.(url);
    if (!id) {
      toast('Set a primary Google Doc URL in Settings or the Docs hub tab first', 'warning');
      return false;
    }
    setLink(taskId, id, url);
    toast('Linked primary Google Doc to this task', 'success');
    return true;
  }

  function docBarHtml(task) {
    if (!enabled() || !task || task.done) return '';
    const link = getLink(task.id);
    const linkLine = link?.url
      ? `<a class="flux-docs-ghost-link" href="${escapeAttr(link.url)}" target="_blank" rel="noopener">Open linked Doc</a>`
      : '<span class="flux-docs-ghost-meta">No Doc linked — create or use primary doc.</span>';
    const meta = [];
    if (link?.lastPush) meta.push(`Pushed ${new Date(link.lastPush).toLocaleTimeString()}`);
    if (link?.lastPull) meta.push(`Pulled ${new Date(link.lastPull).toLocaleTimeString()}`);

    return `<div class="flux-docs-ghost-bar" data-flux-docs-task="${task.id}">
      <span class="flux-docs-ghost-label">Docs ↔ Ghost draft</span>
      ${linkLine}
      <div class="flux-docs-ghost-actions">
        <button type="button" data-flux-docs-create="${task.id}">Create &amp; link</button>
        <button type="button" data-flux-docs-primary="${task.id}">Use primary doc</button>
        <button type="button" data-flux-docs-push="${task.id}"${task.ghostDraft ? '' : ' title="Uses task name + notes if no draft"'}>Push → Doc</button>
        <button type="button" data-flux-docs-pull="${task.id}"${link ? '' : ' disabled'}>Pull ← Doc</button>
      </div>
      ${meta.length ? `<div class="flux-docs-ghost-meta">${esc(meta.join(' · '))}</div>` : ''}
    </div>`;
  }

  function appendToGhostCard(html, task) {
    if (!html || !task) return html;
    const bar = docBarHtml(task);
    if (!bar) return html;
    const close = html.lastIndexOf('</div>');
    if (close < 0) return html + bar;
    return html.slice(0, close) + bar + html.slice(close);
  }

  function hubExtraHtml() {
    if (!enabled()) return '';
    return `<div class="flux-docs-ghost-hub">
      <h4>Per-task Ghost ↔ Docs sync</h4>
      <p>On each task card with a ghost scaffold, use <strong>Push → Doc</strong> to send your draft to Google Docs, edit there, then <strong>Pull ← Doc</strong> to refresh the in-app ghost draft. Links are stored per task on this device.</p>
    </div>`;
  }

  function wireClicks() {
    if (window._fluxDocsGhostWired) return;
    window._fluxDocsGhostWired = true;
    document.addEventListener('click', (e) => {
      if (!enabled()) return;
      const push = e.target.closest('[data-flux-docs-push]');
      if (push) {
        e.preventDefault();
        e.stopPropagation();
        void pushToDoc(push.getAttribute('data-flux-docs-push'));
        return;
      }
      const pull = e.target.closest('[data-flux-docs-pull]');
      if (pull && !pull.disabled) {
        e.preventDefault();
        e.stopPropagation();
        void pullFromDoc(pull.getAttribute('data-flux-docs-pull'));
        return;
      }
      const create = e.target.closest('[data-flux-docs-create]');
      if (create) {
        e.preventDefault();
        e.stopPropagation();
        void createAndLink(create.getAttribute('data-flux-docs-create'));
        return;
      }
      const primary = e.target.closest('[data-flux-docs-primary]');
      if (primary) {
        e.preventDefault();
        e.stopPropagation();
        linkPrimaryDoc(primary.getAttribute('data-flux-docs-primary'));
      }
    });
  }

  function wrapGhostCardHtml() {
    if (!window.FluxGhostDraftV2 || window._fluxDocsGhostCardWrapped) return;
    const orig = FluxGhostDraftV2.cardHtml;
    if (typeof orig !== 'function') return;
    window._fluxDocsGhostCardWrapped = true;
    FluxGhostDraftV2.cardHtml = function (task) {
      const base = orig(task);
      if (!base) return base;
      return appendToGhostCard(base, task);
    };
  }

  function enhanceLegacyGhostBars() {
    document.querySelectorAll('.ghost-draft[data-ghost-task-id]:not(.flux-ghost-draft-v2)').forEach((el) => {
      if (el.querySelector('.flux-docs-ghost-bar')) return;
      const task = findTask(el.getAttribute('data-ghost-task-id'));
      if (!task) return;
      const bar = docBarHtml(task);
      if (bar) el.insertAdjacentHTML('beforeend', bar);
    });
  }

  function wrapRenderTasks() {
    if (window._fluxDocsGhostRenderWrapped || typeof window.renderTasks !== 'function') return;
    window._fluxDocsGhostRenderWrapped = true;
    const orig = window.renderTasks;
    window.renderTasks = function () {
      orig.apply(this, arguments);
      if (enabled()) enhanceLegacyGhostBars();
    };
  }

  function install() {
    if (!enabled()) return false;
    wireClicks();
    wrapGhostCardHtml();
    wrapRenderTasks();
    return true;
  }

  window.FluxDocsGhostSync = {
    enabled,
    install,
    docBarHtml,
    pushToDoc,
    pullFromDoc,
    createAndLink,
    linkPrimaryDoc,
    getLink,
    hubExtraHtml,
  };
})();
