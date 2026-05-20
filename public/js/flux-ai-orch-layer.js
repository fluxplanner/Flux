/**
 * P7-AI-ORCH — multi-agent orchestration on FluxOrchestrator + role specialists.
 * Flag: enable_ai_orchestration (default off).
 * Requires: flux-ai-orchestrator.js, migration 20260525410000_ai_orchestration.sql
 */
(function () {
  'use strict';

  const LS_ROUTE = 'flux_ai_last_route_v1';
  let _lastRoute = null;

  const AGENTS = {
    student_planner: {
      id: 'student_planner',
      label: 'Planner',
      roles: ['student'],
      workMode: false,
      keywords: [/plan|schedule|task|deadline|homework|assign|optimize|fix/i],
      tools: true,
      prefix:
        'You are the **Flux Planner** agent — prioritize actionable study order, calendar blocks, and tool calls when useful.',
    },
    student_momentum: {
      id: 'student_momentum',
      label: 'Momentum',
      roles: ['student'],
      workMode: false,
      keywords: [/energy|tired|burnout|overwhelm|break|focus|pomodoro|momentum|stress/i],
      tools: true,
      prefix:
        'You are the **Flux Momentum** agent — emphasize sustainable pacing, energy-aware task order, and recovery. Prefer adjustForEnergyLevel and lighter blocks when energy is low.',
    },
    student_college: {
      id: 'student_college',
      label: 'College',
      roles: ['student'],
      workMode: false,
      keywords: [/college|university|essay|common app|admission|sat|act|fafsa|ec\b|extracurricular/i],
      tools: false,
      prefix:
        'You are the **Flux College** agent — admissions and application strategy only. Do not invent deadlines; remind students to verify on official sites. No tool calls unless the student asks to block time on the planner.',
    },
    educator_instruction: {
      id: 'educator_instruction',
      label: 'Instruction',
      roles: ['teacher', 'staff'],
      workMode: true,
      keywords: [/lesson|class|grade|rubric|assignment|parent|iep|differentiat/i],
      tools: false,
      prefix:
        'You are the **Flux Instruction** agent for educators. Give concise teaching workflow advice. Do not invent student names or grades. Suggest opening **Teacher Copilot** for class-scoped help when they need roster context.',
      copilot: 'teacher',
    },
    counselor_support: {
      id: 'counselor_support',
      label: 'Counselor',
      roles: ['counselor'],
      workMode: true,
      keywords: [/caseload|wellness|consent|outreach|crisis|schedule|appointment|504|iep/i],
      tools: false,
      prefix:
        'You are the **Flux Counselor** agent — caseload workflow and student support planning at an aggregate level only. Never diagnose. Suggest **Counselor Copilot** for dashboard-scoped summaries.',
      copilot: 'counselor',
    },
    admin_ops: {
      id: 'admin_ops',
      label: 'Admin',
      roles: ['admin'],
      workMode: true,
      keywords: [/school|district|rollout|policy|staff|emergency|broadcast|admin/i],
      tools: false,
      prefix:
        'You are the **Flux Admin** agent — school operations, rollout, and staff workflows. Stay at policy/process level; no student PII.',
    },
  };

  function enabled() {
    try {
      return !!window.FluxFeatureFlags?.isEnabled('enable_ai_orchestration', false);
    } catch (_) {
      return false;
    }
  }

  function roleContext() {
    const fr = window.FluxRole;
    const current = fr && fr.current ? fr.current : 'student';
    const work = fr && fr.isWorkMode && fr.isWorkMode();
    return { current, work };
  }

  function scoreAgent(agent, text, ctx) {
    const personalEdu =
      window.FluxRole?.isEducator?.() && window.FluxRole?.isPersonalMode?.();
    if (agent.workMode) {
      if (!ctx.work || !agent.roles.includes(ctx.current)) return -1;
    } else if (agent.roles.includes('student')) {
      if (ctx.current !== 'student' && !personalEdu) return -1;
    } else if (agent.roles.length && !agent.roles.includes(ctx.current)) {
      return -1;
    }
    let score = 0;
    (agent.keywords || []).forEach((re) => {
      if (re.test(text)) score += 3;
    });
    if (agent.id === 'student_planner' && ctx.current === 'student' && !ctx.work) score += 1;
    if (agent.id === 'educator_instruction' && ctx.current === 'teacher') score += 2;
    if (agent.id === 'counselor_support' && ctx.current === 'counselor') score += 2;
    if (agent.id === 'admin_ops' && ctx.current === 'admin') score += 2;
    return score;
  }

  function route(userText) {
    const text = String(userText || '');
    const ctx = roleContext();
    const ranked = Object.values(AGENTS)
      .map((a) => ({ agent: a, score: scoreAgent(a, text, ctx) }))
      .filter((r) => r.score >= 0)
      .sort((a, b) => b.score - a.score);

    let primary = ranked[0]?.agent || AGENTS.student_planner;
    if (ctx.current === 'student' && !ctx.work) {
      const studentAgents = ranked.filter((r) => r.agent.roles.includes('student'));
      if (studentAgents.length) primary = studentAgents[0].agent;
    }

    let secondary = null;
    if (ranked.length > 1 && ranked[1].score > 0 && ranked[0].score - ranked[1].score <= 2) {
      secondary = ranked[1].agent;
    }

    const intent = text.slice(0, 48).replace(/\s+/g, ' ').trim() || 'general';
    _lastRoute = { primary: primary.id, secondary: secondary?.id || null, intent, at: Date.now() };
    try {
      localStorage.setItem(LS_ROUTE, JSON.stringify(_lastRoute));
    } catch (_) {}

    return { primary, secondary, intent, ctx };
  }

  function lastRoute() {
    if (_lastRoute) return Object.assign({}, _lastRoute);
    try {
      const raw = localStorage.getItem(LS_ROUTE);
      return raw ? JSON.parse(raw) : null;
    } catch (_) {
      return null;
    }
  }

  async function recordRun(route) {
    if (!enabled() || !route?.primary) return;
    if (window.FluxBus && typeof FluxBus.emit === 'function') {
      FluxBus.emit('ai_agent_routed', {
        agent_id: route.primary.id,
        secondary: route.secondary?.id || null,
        intent: route.intent,
      });
    }
    const sb = typeof window.getSB === 'function' ? window.getSB() : null;
    const u = typeof currentUser !== 'undefined' ? currentUser : window.currentUser;
    if (!sb || !u?.id) return;
    try {
      await sb.rpc('flux_record_agent_runs', {
        p_runs: [
          {
            agent_id: route.primary.id,
            secondary: route.secondary?.id || null,
            intent: String(route.intent || '').slice(0, 64),
            payload: { schema_version: 1 },
          },
        ],
      });
    } catch (e) {
      console.warn('[FluxAiOrchestration] recordRun', e);
    }
  }

  function specialistBlock(secondary) {
    if (!secondary) return '';
    return `\n### Specialist consult (${secondary.label})\n${secondary.prefix}\nUse this lens only where it complements the primary agent; do not contradict planner tools.\n`;
  }

  function augmentSystemPrompt(base, userText) {
    if (!enabled()) {
      return window.FluxOrchestrator?.augmentSystemPrompt
        ? FluxOrchestrator.augmentSystemPrompt(base, userText)
        : base;
    }
    const routed = route(userText);
    recordRun(routed).catch(() => {});

    let system = base;
    system += `\n\n---\n## Flux multi-agent routing\nActive agent: **${routed.primary.label}** (\`${routed.primary.id}\`).\n${routed.primary.prefix}\n`;
    if (routed.secondary) system += specialistBlock(routed.secondary);
    if (routed.primary.copilot === 'teacher' && window.FluxTeacherCopilot?.enabled?.()) {
      system +=
        '\nTeacher Copilot is available in the class view — recommend it for roster-specific questions.\n';
    }
    if (routed.primary.copilot === 'counselor' && window.FluxCounselorCopilot?.enabled?.()) {
      system +=
        '\nCounselor Copilot is available on the counselor dashboard for caseload-scoped summaries.\n';
    }
    system += '---\n';

    if (routed.primary.tools && window.FluxOrchestrator?.augmentSystemPrompt) {
      system = FluxOrchestrator.augmentSystemPrompt(system, userText);
    }
    return system;
  }

  function beginThinking(thinkEl) {
    if (window.FluxOrchestrator?.beginThinking) FluxOrchestrator.beginThinking(thinkEl);
    if (!enabled() || !window.FluxOrchestrator?.thinkingStep) return;
    const lr = lastRoute();
    if (lr?.primary) {
      const a = AGENTS[lr.primary] || { label: lr.primary };
      FluxOrchestrator.thinkingStep(`Agent: ${a.label || lr.primary}…`);
    }
  }

  function thinkingStep(msg) {
    if (window.FluxOrchestrator?.thinkingStep) FluxOrchestrator.thinkingStep(msg);
  }

  function processAssistantReply(rawReply, toolsRun) {
    const routed = lastRoute();
    const useTools = !enabled() || !routed?.primary || AGENTS[routed.primary]?.tools !== false;
    if (useTools && window.FluxOrchestrator?.processAssistantReply) {
      FluxOrchestrator.processAssistantReply(rawReply, toolsRun);
      return;
    }
    if (window.FluxOrchestrator?.stripFluxTools && window.FluxOrchestrator.updateScratchFromAssistant) {
      const clean = FluxOrchestrator.stripFluxTools(rawReply);
      FluxOrchestrator.updateScratchFromAssistant(clean);
      if (clean && FluxOrchestrator.recordRecommendation) FluxOrchestrator.recordRecommendation(clean, toolsRun);
    }
    maybeSuggestCopilot(routed);
  }

  function maybeSuggestCopilot(lr) {
    if (!lr?.primary) return;
    const agent = AGENTS[lr.primary];
    if (!agent?.copilot) return;
    const toast = typeof window.showToast === 'function' ? window.showToast : null;
    if (agent.copilot === 'teacher' && window.FluxTeacherCopilot?.enabled?.()) {
      toast?.('Tip: open Teacher Copilot on a class for roster-scoped AI', 'info');
    }
    if (agent.copilot === 'counselor' && window.FluxCounselorCopilot?.enabled?.()) {
      toast?.('Tip: Counselor Copilot uses your dashboard caseload context', 'info');
    }
  }

  function handleSlashCommand(text) {
    if (!enabled()) {
      return window.FluxOrchestrator?.handleSlashCommand
        ? FluxOrchestrator.handleSlashCommand(text)
        : null;
    }
    const t = String(text || '').trim();
    if (t.startsWith('/agent')) {
      const lr = lastRoute();
      const label = lr?.primary ? AGENTS[lr.primary]?.label || lr.primary : 'Planner';
      return `Active Flux agent: **${label}**. Use /plan, /optimize, or /fix as usual when Planner tools are enabled.`;
    }
    return window.FluxOrchestrator?.handleSlashCommand ? FluxOrchestrator.handleSlashCommand(text) : null;
  }

  function getPaletteCommands(q) {
    const cmds = [];
    if (!enabled()) return cmds;
    const qq = (q || '').toLowerCase();
    if (!qq || qq.includes('agent') || qq.includes('/agent')) {
      cmds.push({
        icon: '🤖',
        label: 'AI: /agent — show routed specialist',
        cat: 'Flux AI',
        action: () => {
          if (typeof window.closeCommandPalette === 'function') window.closeCommandPalette();
          if (typeof window.openFluxAgent === 'function') {
            window.openFluxAgent({ prefill: '/agent Which specialist is handling my chat?' });
          }
        },
      });
    }
    if (!qq || qq.includes('momentum')) {
      cmds.push({
        icon: '🔋',
        label: 'AI: Momentum agent — energy-aware plan',
        cat: 'Flux AI',
        action: () => {
          if (typeof window.closeCommandPalette === 'function') window.closeCommandPalette();
          if (typeof window.openFluxAgent === 'function') {
            window.openFluxAgent({
              prefill: 'Help me plan today with low energy — use momentum-friendly ordering.',
            });
          }
        },
      });
    }
    return cmds;
  }

  function install() {
    return enabled();
  }

  window.FluxAiOrchestration = {
    enabled,
    AGENTS,
    route,
    lastRoute,
    augmentSystemPrompt,
    beginThinking,
    thinkingStep,
    processAssistantReply,
    handleSlashCommand,
    getPaletteCommands,
    install,
    recordRun,
  };
})();
