/**
 * Ghost draft v2 — rubric-aware starting scaffolds on task cards.
 * Flag: enable_ghost_draft_v2 (default off). Falls back to legacy injectGhostDraft in app.js.
 */
(function () {
  'use strict';

  const RUBRIC_HEADER = /^rubric\s*:\s*$/im;
  const G_PHYSICS = 10.0;

  function enabled() {
    try {
      return !!window.FluxFeatureFlags?.isEnabled('enable_ghost_draft_v2', false);
    } catch (_) {
      return false;
    }
  }

  function escapeHtml(s) {
    return String(s || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }

  function escapeAttr(s) {
    return escapeHtml(s).replace(/"/g, '&quot;');
  }

  function taskList() {
    return typeof tasks !== 'undefined' && Array.isArray(tasks) ? tasks : [];
  }

  function findTask(id) {
    return taskList().find((t) => t && t.id === id) || null;
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

  function getSubjects() {
    if (typeof window.getSubjects === 'function') return window.getSubjects();
    return {};
  }

  /** @returns {{ label: string, points: string|null }[]} */
  function parseRubricLines(raw) {
    if (!raw) return [];
    if (Array.isArray(raw)) {
      return raw
        .map((r) => {
          if (!r) return null;
          if (typeof r === 'string') return { label: r.trim(), points: null };
          const label = String(r.description || r.label || r.name || '').trim();
          if (!label) return null;
          return { label, points: r.points != null ? String(r.points) : null };
        })
        .filter(Boolean);
    }
    const text = String(raw).trim();
    if (!text) return [];
    return text
      .split(/\n/)
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => {
        const bullet = line.replace(/^[-*•]\s*/, '');
        const m = bullet.match(/^(.+?)\s*(?:\((\d+)\s*pts?\)|\[\s*(\d+)\s*\])\s*$/i);
        if (m) return { label: m[1].trim(), points: m[2] || m[3] || null };
        const m2 = bullet.match(/^(.+?)\s*[-–—]\s*(\d+)\s*pts?$/i);
        if (m2) return { label: m2[1].trim(), points: m2[2] };
        return { label: bullet, points: null };
      });
  }

  function rubricFromNotes(notes) {
    const text = String(notes || '');
    const idx = text.search(RUBRIC_HEADER);
    if (idx < 0) return [];
    const block = text.slice(idx).replace(RUBRIC_HEADER, '');
    const end = block.search(/\n\s*\n[A-Z][a-z]+:/);
    const slice = end > 0 ? block.slice(0, end) : block;
    return parseRubricLines(slice);
  }

  function extractRubric(task) {
    if (!task) return [];
    if (task.ghostRubric) return parseRubricLines(task.ghostRubric);
    if (task.rubric) return parseRubricLines(task.rubric);
    return rubricFromNotes(task.notes);
  }

  function isPhysicsSubject(subj) {
    if (!subj || !subj.name) return false;
    return /physics|kinematics|mechanics|motion|force|energy/i.test(subj.name);
  }

  function buildPrompt(task, subj, criteria) {
    const subName = subj?.name || 'General';
    const type = task.type || 'hw';
    const diff = task.difficulty || 3;
    const notes = String(task.notes || '').slice(0, 600);
    let rubricBlock = '';
    if (criteria.length) {
      rubricBlock =
        '\n\nRubric criteria (address each with one concrete starter bullet):\n' +
        criteria.map((c, i) => `${i + 1}. ${c.label}${c.points ? ` (${c.points} pts)` : ''}`).join('\n');
    }
    const physics = isPhysicsSubject(subj);
    const gVal =
      typeof G !== 'undefined' && Number.isFinite(Number(G)) ? Number(G).toFixed(4) : G_PHYSICS.toFixed(4);
    const physicsNote = physics
      ? ` Use g = ${gVal} m/s² for physics. Show calculations to 4 decimal places where relevant.`
      : '';
    return (
      `Student task: "${task.name}"\n` +
      `Subject: ${subName} · Type: ${type} · Difficulty: ${diff}/5` +
      (notes ? `\nNotes excerpt: ${notes}` : '') +
      rubricBlock +
      '\n\nRespond in plain text with two sections:\n' +
      '1) "Rubric checklist" — one actionable starter per criterion (or skip section if no rubric).\n' +
      '2) "Starting points" — 3–5 concise bullets (concepts, formulas, or first steps).' +
      physicsNote +
      ' No markdown code fences. Keep under 220 words.'
    );
  }

  function formatDraftHtml(text) {
    const safe = escapeHtml(text);
    const lines = safe.split(/\n/);
    let html = '';
    let inList = false;
    lines.forEach((line) => {
      const trimmed = line.trim();
      if (!trimmed) {
        if (inList) {
          html += '</ul>';
          inList = false;
        }
        return;
      }
      const isBullet = /^[-*•]/.test(trimmed) || /^\d+\./.test(trimmed);
      if (isBullet) {
        if (!inList) {
          html += '<ul class="flux-ghost-draft-list">';
          inList = true;
        }
        html += `<li>${trimmed.replace(/^[-*•]\s*/, '').replace(/^\d+\.\s*/, '')}</li>`;
      } else {
        if (inList) {
          html += '</ul>';
          inList = false;
        }
        const isHead = /^(rubric checklist|starting points)/i.test(trimmed);
        html += isHead
          ? `<div class="flux-ghost-draft-heading">${trimmed}</div>`
          : `<p class="flux-ghost-draft-p">${trimmed}</p>`;
      }
    });
    if (inList) html += '</ul>';
    return html || `<p class="flux-ghost-draft-p">${safe}</p>`;
  }

  function setPending(task, pending) {
    const t = findTask(task.id);
    if (!t) return;
    if (pending) t.ghostDraftPending = true;
    else delete t.ghostDraftPending;
    persistTasks();
  }

  async function fetchDraft(task, criteria) {
    if (typeof API === 'undefined' || !API.ai || typeof fluxAuthHeaders !== 'function') return '';
    const subj = task.subject ? getSubjects()[task.subject] : null;
    const res = await fetch(API.ai, {
      method: 'POST',
      headers: await fluxAuthHeaders(),
      body: JSON.stringify({
        system:
          'You are a helpful study coach. Be practical, brief, and kind. Plain text only — no markdown fences.',
        messages: [{ role: 'user', content: buildPrompt(task, subj, criteria) }],
      }),
    });
    const data = await res.json();
    return String(data.content?.[0]?.text || '')
      .replace(/```[\s\S]*?```/g, '')
      .trim();
  }

  async function inject(task) {
    if (!enabled() || !task || !task.id) return;
    if (!task.subject) return;
    const subj = getSubjects()[task.subject];
    if (!subj) return;

    const criteria = extractRubric(task);
    setPending(task, true);

    try {
      const txt = await fetchDraft(task, criteria);
      if (!txt) {
        setPending(task, false);
        return;
      }
      const t = findTask(task.id);
      if (t) {
        t.ghostDraft = txt;
        t.ghostDraftMeta = {
          rubricCriteria: criteria.length,
          generatedAt: new Date().toISOString(),
          v: 2,
        };
        delete t.ghostDraftPending;
        persistTasks();
      }
    } catch (e) {
      console.warn('[FluxGhostDraftV2] inject failed:', e);
      setPending(task, false);
    }
  }

  function scheduleInject(task) {
    if (!task || !task.id) return;
    setTimeout(() => {
      inject(task);
    }, 1500);
  }

  function collapsibleHtml({ className = '', attrs = {}, summaryHtml, bodyHtml }) {
    const attrParts = Object.entries(attrs || {})
      .filter(([, v]) => v != null && v !== '')
      .map(([k, v]) => `${k}="${escapeAttr(v)}"`)
      .join(' ');
    return `<details class="ghost-draft ghost-draft--collapsible ${className}" ${attrParts}>
      <summary class="ghost-draft-summary">${summaryHtml}<span class="ghost-draft-chevron" aria-hidden="true"></span></summary>
      ${bodyHtml}
    </details>`;
  }

  function legacyGhostHtml(task) {
    if (!task.ghostDraft || task.done) return '';
    return collapsibleHtml({
      attrs: { 'data-ghost-task-id': task.id },
      summaryHtml: '<span class="ghost-draft-title">✦ Ghost draft</span>',
      bodyHtml: `<div class="ghost-draft-body">${formatDraftHtml(task.ghostDraft)}</div>`,
    });
  }

  function cardHtml(task) {
    if (!enabled() || !task || task.done) {
      if (task?.ghostDraft && !task.done) return legacyGhostHtml(task);
      return '';
    }

    if (task.ghostDraftPending) {
      return `<div class="ghost-draft flux-ghost-draft-v2 flux-ghost-draft-loading" data-task-id="${task.id}">
        <div class="ghost-draft-title">✦ Ghost scaffold</div>
        <div class="flux-ghost-draft-shimmer" aria-busy="true">Building rubric-aware starters…</div>
      </div>`;
    }

    if (!task.ghostDraft) {
      const criteria = extractRubric(task);
      if (!criteria.length && !['project', 'essay', 'lab'].includes(task.type || '')) return '';
      return `<div class="ghost-draft flux-ghost-draft-v2 flux-ghost-draft-empty" data-task-id="${task.id}">
        <div class="ghost-draft-title">✦ Ghost scaffold</div>
        <p class="flux-ghost-draft-hint">Add <code>Rubric:</code> in notes or tap below for smarter starters.</p>
        <div class="flux-ghost-draft-actions">
          <button type="button" class="flux-ghost-draft-btn" data-flux-ghost-gen="${task.id}">Generate</button>
          <button type="button" class="flux-ghost-draft-btn flux-ghost-draft-btn--muted" data-flux-ghost-rubric="${task.id}">Paste rubric</button>
        </div>
      </div>`;
    }

    const rubricN = task.ghostDraftMeta?.rubricCriteria || extractRubric(task).length;
    const rubricChip =
      rubricN > 0
        ? `<span class="flux-ghost-draft-chip" title="Rubric criteria used">${rubricN} rubric line${rubricN > 1 ? 's' : ''}</span>`
        : '';

    return collapsibleHtml({
      className: 'flux-ghost-draft-v2',
      attrs: { 'data-task-id': task.id },
      summaryHtml: `<span class="ghost-draft-summary-main"><span class="ghost-draft-title">✦ Ghost scaffold ${rubricChip}</span></span>
        <span class="flux-ghost-draft-actions flux-ghost-draft-actions--inline">
          <button type="button" class="flux-ghost-draft-btn flux-ghost-draft-btn--icon" data-flux-ghost-gen="${task.id}" title="Regenerate">↻</button>
          <button type="button" class="flux-ghost-draft-btn flux-ghost-draft-btn--icon" data-flux-ghost-rubric="${task.id}" title="Edit rubric">☰</button>
        </span>`,
      bodyHtml: `<div class="flux-ghost-draft-body">${formatDraftHtml(task.ghostDraft)}</div>`,
    });
  }

  function closeRubricModal() {
    document.getElementById('fluxGhostRubricModal')?.remove();
  }

  function promptRubric(taskId) {
    const task = findTask(taskId);
    if (!task) return;
    closeRubricModal();
    const existing = task.ghostRubric || '';
    const panel = document.createElement('div');
    panel.id = 'fluxGhostRubricModal';
    panel.className = 'flux-ghost-rubric-overlay';
    panel.setAttribute('role', 'dialog');
    panel.setAttribute('aria-modal', 'true');
    panel.setAttribute('aria-label', 'Paste assignment rubric');
    panel.innerHTML = `
      <div class="flux-ghost-rubric-card">
        <h3 class="flux-ghost-rubric-title">Rubric for “${escapeAttr(task.name.slice(0, 48))}”</h3>
        <p class="flux-ghost-rubric-hint">One criterion per line. Example: <code>Thesis (20 pts)</code></p>
        <textarea id="fluxGhostRubricInput" class="flux-ghost-rubric-input" rows="8" placeholder="- Thesis (20 pts): Clear claim&#10;- Evidence (30 pts): Cited sources">${escapeHtml(existing)}</textarea>
        <div class="flux-ghost-rubric-actions">
          <button type="button" class="flux-ghost-draft-btn flux-ghost-draft-btn--muted" data-flux-ghost-rubric-cancel>Cancel</button>
          <button type="button" class="flux-ghost-draft-btn" data-flux-ghost-rubric-save>Save &amp; generate</button>
        </div>
      </div>`;
    document.body.appendChild(panel);
    panel.addEventListener('click', (e) => {
      if (e.target === panel) closeRubricModal();
    });
    panel.querySelector('[data-flux-ghost-rubric-cancel]')?.addEventListener('click', closeRubricModal);
    panel.querySelector('[data-flux-ghost-rubric-save]')?.addEventListener('click', () => {
      const val = panel.querySelector('#fluxGhostRubricInput')?.value?.trim() || '';
      task.ghostRubric = val || undefined;
      if (!val) delete task.ghostRubric;
      persistTasks();
      closeRubricModal();
      inject(task);
    });
    panel.querySelector('#fluxGhostRubricInput')?.focus();
  }

  async function regenerate(taskId) {
    const task = findTask(taskId);
    if (!task) return;
    await inject(task);
  }

  function wireTaskListClicks() {
    if (window._fluxGhostDraftWired) return;
    window._fluxGhostDraftWired = true;
    document.addEventListener('click', (e) => {
      if (!enabled()) return;
      const gen = e.target.closest('[data-flux-ghost-gen]');
      if (gen) {
        e.preventDefault();
        e.stopPropagation();
        regenerate(Number(gen.getAttribute('data-flux-ghost-gen')));
        return;
      }
      const rub = e.target.closest('[data-flux-ghost-rubric]');
      if (rub) {
        e.preventDefault();
        e.stopPropagation();
        promptRubric(Number(rub.getAttribute('data-flux-ghost-rubric')));
      }
    });
  }

  function install() {
    if (!enabled()) return false;
    wireTaskListClicks();
    return true;
  }

  window.FluxGhostDraftV2 = {
    enabled,
    inject,
    scheduleInject,
    cardHtml,
    collapsibleHtml,
    extractRubric,
    parseRubricLines,
    regenerate,
    promptRubric,
    install,
  };
})();
