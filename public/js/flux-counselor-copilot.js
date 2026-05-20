/**
 * Counselor copilot — caseload summaries only (no student names), audit log.
 * Flag: enable_counselor_copilot (default off).
 */
(function () {
  'use strict';

  let _messages = [];
  let _ctx = null;
  let _open = false;
  let _counselorDbId = null;

  function enabled() {
    try {
      return !!window.FluxFeatureFlags?.isEnabled('enable_counselor_copilot', false);
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

  function formatReply(raw) {
    if (typeof window.fmtAI === 'function') return window.fmtAI(raw);
    return esc(raw).replace(/\n/g, '<br>');
  }

  function truncate(s, max) {
    const t = String(s || '').trim();
    if (t.length <= max) return t;
    return `${t.slice(0, max - 1)}…`;
  }

  function buildContextFromDashboard(input) {
    const caseload = input?.caseload || {};
    const consented = caseload.consented || [];
    const queue = input?.queue?.items || [];
    const priority = consented.filter((s) => s.band === 'priority').length;
    const watch = consented.filter((s) => s.band === 'watch').length;
    const stable = consented.filter((s) => s.band === 'stable').length;
    const wellness = consented.filter((s) => s.consentTier === 'wellness').length;
    const highSignals = queue.filter((q) => q.severity === 'high').length;
    const medSignals = queue.filter((q) => q.severity === 'medium').length;

    return {
      assignedTotal: caseload.total ?? 0,
      consentedCount: consented.length,
      awaitingConsent: caseload.awaitingConsent ?? 0,
      priorityCount: priority,
      watchCount: watch,
      stableCount: stable,
      wellnessTierCount: wellness,
      outreachHigh: highSignals,
      outreachMedium: medSignals,
      outreachTotal: queue.length,
      todayApptCount: Number(input?.todayApptCount) || 0,
      upcomingApptCount: Number(input?.upcomingApptCount) || 0,
      unreadMessages: Number(input?.unreadMessages) || 0,
    };
  }

  function contextSummary(ctx) {
    if (!ctx) return 'Load the counselor dashboard for caseload context.';
    return [
      `${ctx.assignedTotal} students assigned`,
      `${ctx.consentedCount} opted in to insights`,
      ctx.awaitingConsent ? `${ctx.awaitingConsent} awaiting consent` : '',
      `Engagement bands: ${ctx.priorityCount} priority · ${ctx.watchCount} watch · ${ctx.stableCount} stable`,
      ctx.wellnessTierCount ? `${ctx.wellnessTierCount} on wellness tier` : '',
      ctx.outreachTotal
        ? `${ctx.outreachTotal} outreach signals (${ctx.outreachHigh} high · ${ctx.outreachMedium} medium)`
        : 'No active outreach signals',
      `${ctx.todayApptCount} appointments today · ${ctx.upcomingApptCount} upcoming`,
      `${ctx.unreadMessages} unread messages`,
    ]
      .filter(Boolean)
      .join(' · ');
  }

  function systemPrompt(ctx) {
    return (
      'You are Flux Counselor Copilot — a concise K-12 counseling workflow assistant. ' +
      'Use only the aggregate caseload context provided. Do NOT invent or request individual student names, grades, diagnoses, or assignment titles. ' +
      'Frame suggestions as outreach and engagement support, not clinical treatment. Keep replies under 250 words unless asked for detail.\n\n' +
      `Caseload context (aggregates only):\n${contextSummary(ctx)}`
    );
  }

  async function logAudit(userPrompt, reply, ctx) {
    const sb = typeof window.getSB === 'function' ? window.getSB() : null;
    const uid =
      typeof window.currentUser !== 'undefined' && window.currentUser
        ? window.currentUser.id
        : null;
    if (!sb || !uid || !_counselorDbId) return;
    try {
      await sb.from('counselor_copilot_audit').insert({
        counselor_id: _counselorDbId,
        counselor_user_id: uid,
        prompt_summary: truncate(userPrompt, 400),
        reply_summary: truncate(reply, 400),
        context_snapshot: ctx || {},
      });
    } catch (e) {
      console.warn('[FluxCounselorCopilot] audit', e);
    }
  }

  async function chat(userText, ctx) {
    const messages = [
      { role: 'system', content: systemPrompt(ctx) },
      ..._messages.slice(-12).map((m) => ({ role: m.role, content: m.text })),
      { role: 'user', content: userText },
    ];
    if (typeof window.fluxAuthHeaders !== 'function' || typeof API === 'undefined' || !API.ai) {
      throw new Error('AI unavailable');
    }
    const res = await fetch(API.ai, {
      method: 'POST',
      headers: await window.fluxAuthHeaders(),
      body: JSON.stringify({ messages }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || 'AI request failed');
    return String(data.content?.[0]?.text || '').trim();
  }

  function ensureShell() {
    if (document.getElementById('fluxCounselorCopilotPanel')) return;
    const backdrop = document.createElement('div');
    backdrop.id = 'fluxCounselorCopilotBackdrop';
    backdrop.className = 'flux-ccopilot-backdrop';
    backdrop.addEventListener('click', close);

    const panel = document.createElement('div');
    panel.id = 'fluxCounselorCopilotPanel';
    panel.className = 'flux-ccopilot-panel';
    panel.setAttribute('role', 'dialog');
    panel.setAttribute('aria-label', 'Counselor copilot');
    panel.innerHTML = `
      <header class="flux-ccopilot-head">
        <div>
          <h2 class="flux-ccopilot-title">Counselor copilot</h2>
          <p class="flux-ccopilot-sub">Caseload summaries only · audited</p>
        </div>
        <button type="button" class="flux-ccopilot-close" data-ccopilot-close aria-label="Close">✕</button>
      </header>
      <p id="fluxCcopilotContext" class="flux-ccopilot-context" style="padding:10px 16px;margin:0;border-bottom:1px solid var(--border)"></p>
      <div class="flux-ccopilot-chips">
        <button type="button" class="flux-ccopilot-chip" data-prompt="Who should I prioritize for outreach today based on this caseload?">Prioritize outreach</button>
        <button type="button" class="flux-ccopilot-chip" data-prompt="Draft a brief check-in message template I can personalize (no student names).">Check-in template</button>
        <button type="button" class="flux-ccopilot-chip" data-prompt="Summarize what the outreach queue signals mean in plain language.">Explain signals</button>
      </div>
      <div id="fluxCcopilotMessages" class="flux-ccopilot-messages"></div>
      <div class="flux-ccopilot-compose">
        <textarea id="fluxCcopilotInput" class="flux-ccopilot-input" rows="3" placeholder="Ask about your caseload…" maxlength="1200"></textarea>
        <button type="button" id="fluxCcopilotSend" class="flux-ccopilot-send">Send</button>
        <p class="flux-ccopilot-foot">Aggregates only · not a diagnosis · prompts are audit-logged</p>
      </div>`;

    document.body.appendChild(backdrop);
    document.body.appendChild(panel);

    panel.querySelector('[data-ccopilot-close]')?.addEventListener('click', close);
    panel.querySelector('#fluxCcopilotSend')?.addEventListener('click', () => send());
    panel.querySelector('#fluxCcopilotInput')?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        send();
      }
    });
    panel.querySelectorAll('[data-prompt]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const inp = panel.querySelector('#fluxCcopilotInput');
        if (inp) inp.value = btn.getAttribute('data-prompt') || '';
        send();
      });
    });
  }

  function ensureFab() {
    if (!enabled() || document.getElementById('fluxCounselorCopilotFab')) return;
    try {
      if (window.FluxRole && !FluxRole.isCounselor()) return;
    } catch (_) {}
    const fab = document.createElement('button');
    fab.type = 'button';
    fab.id = 'fluxCounselorCopilotFab';
    fab.className = 'flux-ccopilot-fab';
    fab.textContent = '✦ Copilot';
    fab.title = 'Counselor copilot';
    fab.addEventListener('click', () => open());
    document.body.appendChild(fab);
  }

  function renderMessages() {
    const el = document.getElementById('fluxCcopilotMessages');
    if (!el) return;
    if (!_messages.length) {
      el.innerHTML =
        '<div class="flux-ccopilot-msg flux-ccopilot-msg--bot">Ask how to prioritize outreach, draft check-ins, or interpret engagement signals — context uses caseload aggregates only.</div>';
      return;
    }
    el.innerHTML = _messages
      .map((m) => {
        const cls = m.role === 'user' ? 'flux-ccopilot-msg--user' : 'flux-ccopilot-msg--bot';
        const body = m.role === 'user' ? esc(m.text) : formatReply(m.text);
        return `<div class="flux-ccopilot-msg ${cls}">${body}</div>`;
      })
      .join('');
    el.scrollTop = el.scrollHeight;
  }

  function updateContextLine() {
    const line = document.getElementById('fluxCcopilotContext');
    if (line) line.textContent = contextSummary(_ctx);
  }

  function setDashboardContext(input) {
    if (!input) return;
    _counselorDbId = input.counselorDbId || _counselorDbId;
    _ctx = buildContextFromDashboard(input);
    if (_open) updateContextLine();
  }

  async function send() {
    const inp = document.getElementById('fluxCcopilotInput');
    const text = inp?.value?.trim();
    if (!text) return;
    const btn = document.getElementById('fluxCcopilotSend');
    if (btn) btn.disabled = true;
    if (inp) inp.value = '';
    _messages.push({ role: 'user', text });
    renderMessages();
    const think = document.createElement('div');
    think.className = 'flux-ccopilot-msg flux-ccopilot-msg--bot';
    think.innerHTML =
      '<div class="flux-ccopilot-thinking"><span></span><span></span><span></span></div>';
    document.getElementById('fluxCcopilotMessages')?.appendChild(think);
    try {
      const reply = await chat(text, _ctx);
      think.remove();
      _messages.push({ role: 'assistant', text: reply });
      renderMessages();
      await logAudit(text, reply, _ctx);
    } catch (e) {
      think.remove();
      _messages.push({
        role: 'assistant',
        text: e.message || 'Could not reach Flux AI. Check your connection or daily limit.',
      });
      renderMessages();
    } finally {
      if (btn) btn.disabled = false;
    }
  }

  function open(ctx) {
    if (!enabled()) return;
    if (ctx) setDashboardContext(ctx);
    ensureShell();
    ensureFab();
    _open = true;
    document.body.classList.add('flux-ccopilot-open');
    updateContextLine();
    renderMessages();
  }

  function close() {
    _open = false;
    document.body.classList.remove('flux-ccopilot-open');
  }

  function dashboardButtonHtml() {
    if (!enabled()) return '';
    return '<button type="button" class="teacher-action-btn" data-action="counselor-copilot"><span>✦</span> Copilot</button>';
  }

  function install() {
    if (!enabled()) return false;
    try {
      if (window.FluxRole?.isCounselor?.()) ensureFab();
    } catch (_) {}
    return true;
  }

  window.FluxCounselorCopilot = {
    enabled,
    open,
    close,
    setDashboardContext,
    buildContextFromDashboard,
    dashboardButtonHtml,
    install,
  };
})();
