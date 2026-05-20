/**
 * Teacher lesson plan generator (AI).
 * Flag: enable_teacher_ai (default off). Copilot is a separate roadmap step.
 */
(function () {
  'use strict';

  const DRAFTS_KEY = 'flux_teacher_lesson_drafts_v1';
  const MAX_DRAFTS = 30;

  function enabled() {
    try {
      return !!window.FluxFeatureFlags?.isEnabled('enable_teacher_ai', false);
    } catch (_) {
      return false;
    }
  }

  function esc(s) {
    if (typeof window.esc === 'function') return window.esc(s);
    return String(s || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }

  function formatLesson(raw) {
    if (typeof window.fmtAI === 'function') return window.fmtAI(raw);
    return esc(raw).replace(/\n/g, '<br>');
  }

  function loadDrafts() {
    try {
      const fs = window.FluxStorage;
      let list = [];
      if (fs && typeof fs.load === 'function') list = fs.load(DRAFTS_KEY, []) || [];
      else if (typeof load === 'function') list = load(DRAFTS_KEY, []) || [];
      return Array.isArray(list) ? list : [];
    } catch (_) {
      return [];
    }
  }

  function saveDraft(entry) {
    try {
      let list = loadDrafts();
      list = [entry, ...list.filter((d) => d.id !== entry.id)].slice(0, MAX_DRAFTS);
      const fs = window.FluxStorage;
      if (fs && typeof fs.save === 'function') fs.save(DRAFTS_KEY, list);
      else if (typeof save === 'function') save(DRAFTS_KEY, list);
    } catch (_) {}
  }

  function buildPrompt(form) {
    const lines = [
      `Topic: ${form.topic}`,
      `Class period length: ${form.minutes} minutes`,
      form.className ? `Class: ${form.className}` : '',
      form.subject ? `Subject: ${form.subject}` : '',
      form.grade ? `Grade level: ${form.grade}` : '',
      form.standards ? `Standards / goals: ${form.standards}` : '',
      form.notes ? `Teacher notes: ${form.notes}` : '',
    ].filter(Boolean);
    return lines.join('\n');
  }

  async function generateLesson(form) {
    const system =
      'You are an expert K-12 lesson planner. Write a practical, time-boxed lesson plan in markdown. ' +
      'Use exactly these sections (## headings): Learning objectives, Hook (5 min), Instruction, ' +
      'Guided practice, Independent practice, Exit ticket, Materials & differentiation. ' +
      'Align activities to the stated class length. No preamble outside the sections.';
    const user = buildPrompt(form);
    if (typeof window.fluxAiSimple === 'function') {
      return window.fluxAiSimple(system, user);
    }
    if (typeof API === 'undefined' || !API.ai || typeof window.fluxAuthHeaders !== 'function') {
      throw new Error('AI unavailable');
    }
    const res = await fetch(API.ai, {
      method: 'POST',
      headers: await window.fluxAuthHeaders(),
      body: JSON.stringify({
        system,
        messages: [{ role: 'user', content: user }],
      }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || 'AI request failed');
    return String(data.content?.[0]?.text || '').trim();
  }

  function closeModal() {
    document.getElementById('fluxTeacherLessonModal')?.remove();
  }

  function open(ctx) {
    if (!enabled()) return;
    if (document.getElementById('fluxTeacherLessonModal')) return;
    ctx = ctx || {};

    const modal = document.createElement('div');
    modal.id = 'fluxTeacherLessonModal';
    modal.className = 'flux-lesson-ai-overlay';
    modal.setAttribute('role', 'dialog');
    modal.setAttribute('aria-modal', 'true');

    modal.innerHTML = `
      <div class="flux-lesson-ai-card">
        <div class="flux-lesson-ai-head">
          <div>
            <h2 class="flux-lesson-ai-title">Lesson generator</h2>
            <p class="flux-lesson-ai-sub">AI draft — review before teaching. Not shared with students automatically.</p>
          </div>
          <button type="button" class="flux-lesson-ai-close" data-close aria-label="Close">✕</button>
        </div>
        <form id="fluxLessonAiForm" class="flux-lesson-ai-form">
          <label class="flux-lesson-ai-label" for="fluxLessonTopic">Topic *</label>
          <input id="fluxLessonTopic" class="flux-lesson-ai-input" required maxlength="200" placeholder="e.g. Photosynthesis — light reactions" value="${esc(ctx.topic || '')}" />
          <div class="flux-lesson-ai-row">
            <div>
              <label class="flux-lesson-ai-label" for="fluxLessonMinutes">Minutes</label>
              <input id="fluxLessonMinutes" type="number" class="flux-lesson-ai-input" min="20" max="120" value="${esc(String(ctx.minutes || 45))}" />
            </div>
            <div>
              <label class="flux-lesson-ai-label" for="fluxLessonGrade">Grade</label>
              <input id="fluxLessonGrade" class="flux-lesson-ai-input" maxlength="40" placeholder="e.g. 10th" value="${esc(ctx.grade || '')}" />
            </div>
          </div>
          <label class="flux-lesson-ai-label" for="fluxLessonClass">Class (optional)</label>
          <input id="fluxLessonClass" class="flux-lesson-ai-input" maxlength="120" placeholder="Class name" value="${esc(ctx.className || '')}" data-class-id="${esc(ctx.classId || '')}" />
          <label class="flux-lesson-ai-label" for="fluxLessonSubject">Subject</label>
          <input id="fluxLessonSubject" class="flux-lesson-ai-input" maxlength="80" value="${esc(ctx.subject || (typeof FluxRole !== 'undefined' && FluxRole.profile?.subject) || '')}" />
          <label class="flux-lesson-ai-label" for="fluxLessonStandards">Standards / objectives</label>
          <textarea id="fluxLessonStandards" class="flux-lesson-ai-input" rows="2" maxlength="600" placeholder="State standards or I can… statements"></textarea>
          <label class="flux-lesson-ai-label" for="fluxLessonNotes">Extra context</label>
          <textarea id="fluxLessonNotes" class="flux-lesson-ai-input" rows="2" maxlength="400" placeholder="Prior lesson, student needs, lab constraints…"></textarea>
          <button type="submit" class="flux-lesson-ai-primary" id="fluxLessonGenerateBtn">Generate lesson plan</button>
        </form>
        <div id="fluxLessonAiResult" class="flux-lesson-ai-result" hidden>
          <div class="flux-lesson-ai-result-head">
            <h3>Generated plan</h3>
            <div class="flux-lesson-ai-result-actions">
              <button type="button" class="flux-lesson-ai-secondary" id="fluxLessonCopyBtn">Copy</button>
              <button type="button" class="flux-lesson-ai-secondary" id="fluxLessonRegenBtn">Regenerate</button>
            </div>
          </div>
          <div id="fluxLessonAiBody" class="flux-lesson-ai-body"></div>
        </div>
        <div id="fluxLessonAiError" class="flux-lesson-ai-error" hidden></div>
      </div>`;

    document.body.appendChild(modal);
    modal.addEventListener('click', (e) => {
      if (e.target === modal || e.target.closest('[data-close]')) closeModal();
    });

    const formEl = modal.querySelector('#fluxLessonAiForm');
    const resultWrap = modal.querySelector('#fluxLessonAiResult');
    const resultBody = modal.querySelector('#fluxLessonAiBody');
    const errEl = modal.querySelector('#fluxLessonAiError');
    let lastMarkdown = '';

    async function runGenerate() {
      const topic = modal.querySelector('#fluxLessonTopic')?.value?.trim();
      if (!topic) return;
      const btn = modal.querySelector('#fluxLessonGenerateBtn');
      const regen = modal.querySelector('#fluxLessonRegenBtn');
      if (btn) {
        btn.disabled = true;
        btn.textContent = 'Generating…';
      }
      if (regen) regen.disabled = true;
      errEl.hidden = true;
      resultWrap.hidden = false;
      resultBody.innerHTML =
        '<div class="flux-lesson-ai-loading"><span></span><span></span><span></span> Drafting lesson…</div>';

      const form = {
        topic,
        minutes: Number(modal.querySelector('#fluxLessonMinutes')?.value) || 45,
        grade: modal.querySelector('#fluxLessonGrade')?.value?.trim() || '',
        className: modal.querySelector('#fluxLessonClass')?.value?.trim() || '',
        subject: modal.querySelector('#fluxLessonSubject')?.value?.trim() || '',
        standards: modal.querySelector('#fluxLessonStandards')?.value?.trim() || '',
        notes: modal.querySelector('#fluxLessonNotes')?.value?.trim() || '',
        classId: modal.querySelector('#fluxLessonClass')?.getAttribute('data-class-id') || '',
      };

      try {
        lastMarkdown = await generateLesson(form);
        resultBody.innerHTML = formatLesson(lastMarkdown);
        saveDraft({
          id: `${Date.now()}`,
          createdAt: new Date().toISOString(),
          topic: form.topic,
          className: form.className,
          markdown: lastMarkdown,
        });
        try {
          if (typeof window.FluxBus !== 'undefined') {
            window.FluxBus.emit('lesson_ai_generated', {
              class_id: form.classId || null,
              minutes: form.minutes,
            });
          }
        } catch (_) {}
      } catch (e) {
        resultWrap.hidden = true;
        errEl.hidden = false;
        errEl.textContent = e.message || 'Could not generate lesson plan.';
      } finally {
        if (btn) {
          btn.disabled = false;
          btn.textContent = 'Generate lesson plan';
        }
        if (regen) regen.disabled = false;
      }
    }

    formEl?.addEventListener('submit', (e) => {
      e.preventDefault();
      runGenerate();
    });
    modal.querySelector('#fluxLessonRegenBtn')?.addEventListener('click', runGenerate);
    modal.querySelector('#fluxLessonCopyBtn')?.addEventListener('click', () => {
      if (!lastMarkdown) return;
      const done = () => {
        if (typeof window.showToast === 'function') window.showToast('Lesson plan copied', 'success', 1800);
      };
      if (navigator.clipboard?.writeText) {
        navigator.clipboard.writeText(lastMarkdown).then(done).catch(() => {});
      }
    });
  }

  function dashboardButtonHtml() {
    if (!enabled()) return '';
    return '<button type="button" class="teacher-action-btn" data-action="lesson-ai"><span>✨</span> Lesson AI</button>';
  }

  function classButtonHtml(classId, className, subject) {
    if (!enabled()) return '';
    return `<button type="button" class="teacher-action-btn flux-lesson-ai-class-btn" data-lesson-ai-class="${esc(classId)}" data-lesson-class-name="${esc(className || '')}" data-lesson-subject="${esc(subject || '')}">✨ Lesson plan</button>`;
  }

  function install() {
    return enabled();
  }

  window.FluxTeacherLessonAI = {
    enabled,
    open,
    closeModal,
    generateLesson,
    loadDrafts,
    dashboardButtonHtml,
    classButtonHtml,
    install,
  };
})();
