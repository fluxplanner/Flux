import { test, expect } from '@playwright/test';
import { gotoScenario } from './helpers';

/**
 * Flux Agent Loop — the model can call planner tools and gets the results fed
 * back as a hidden "TOOL RESULTS" message so it can keep reasoning
 * (flux-agent-loop.js + sendAI in app.js).
 */
test.describe('Flux AI agent loop', () => {
  test('tool registry exposes planner + study tools and askFlux global', async ({ page }) => {
    await gotoScenario(page, 'student-semester');
    await page.waitForTimeout(1600);
    const res = await page.evaluate(() => ({
      agentLoop: !!(window as any).FluxAgentLoop,
      askFlux: typeof (window as any).askFlux,
      defs: ((window as any).FluxOrchestrator?.TOOL_DEFS || []).map((d: any) => d.name),
      chip: !!document.getElementById('fluxAskSelChip'),
    }));
    expect(res.agentLoop).toBe(true);
    expect(res.askFlux).toBe('function');
    for (const t of ['listTasks', 'addTask', 'updateTask', 'completeTask', 'deleteTask',
      'addNote', 'searchNotes', 'readNote', 'getPlannerStats', 'navigate',
      'balanceEquation', 'optimizeDayPlan']) {
      expect(res.defs, `tool ${t} missing from registry`).toContain(t);
    }
    expect(res.chip).toBe(true);
  });

  test('model tool calls execute, results loop back, and the planner mutates', async ({ page }) => {
    await gotoScenario(page, 'student-semester');
    await page.waitForTimeout(1200);

    // Script the "model": round 1 calls tools, round 2 answers plainly.
    let round = 0;
    const requests: any[] = [];
    await page.route('**/functions/v1/ai-proxy*', async (route) => {
      const body = JSON.parse(route.request().postData() || '{}');
      requests.push(body);
      round++;
      const text = round === 1
        ? 'Checking your planner first.\n```flux_tool\n{"name":"getPlannerStats","args":{}}\n```\n```flux_tool\n{"name":"addTask","args":{"name":"E2E agent loop task","date":"2026-06-12","priority":"high"}}\n```'
        : 'Added "E2E agent loop task" for June 12 — your stats came back fine.';
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ content: [{ text }] }),
      });
    });

    await page.evaluate(() => (window as any).nav('ai'));
    await page.waitForTimeout(400);
    await page.evaluate(() => {
      const inp = document.getElementById('aiInput') as HTMLTextAreaElement;
      inp.value = 'Add my review task for Friday';
      (window as any).sendAI();
    });
    await page.waitForTimeout(2500);

    const res = await page.evaluate(() => ({
      taskAdded: ((window as any).tasks || []).some((t: any) => t.name === 'E2E agent loop task'),
      toolCard: !!document.querySelector('.flux-tool-card'),
      lastBot: [...document.querySelectorAll('#aiMsgs .ai-bub.bot')].slice(-1)[0]?.textContent || '',
      visibleToolResultsBubbles: [...document.querySelectorAll('#aiMsgs .ai-bub.user')]
        .filter((b) => (b.textContent || '').startsWith('TOOL RESULTS')).length,
    }));

    expect(round, 'model should be called twice (tool round + final answer)').toBe(2);
    const lastMsg = requests[1].messages[requests[1].messages.length - 1];
    expect(lastMsg.role).toBe('user');
    expect(String(lastMsg.content)).toMatch(/^TOOL RESULTS/);
    expect(String(lastMsg.content)).toContain('"pending"'); // real stats payload
    expect(res.taskAdded, 'addTask tool should mutate the planner').toBe(true);
    expect(res.toolCard).toBe(true);
    expect(res.lastBot).toContain('E2E agent loop task');
    expect(res.visibleToolResultsBubbles, 'TOOL RESULTS must stay hidden').toBe(0);
  });

  test('askFlux prefills the AI composer with context from anywhere', async ({ page }) => {
    await gotoScenario(page, 'student-semester');
    await page.waitForTimeout(1200);
    const res = await page.evaluate(async () => {
      (window as any).askFlux('What should I focus on?', { context: 'E2E context block' });
      await new Promise((r) => setTimeout(r, 500));
      return {
        panel: (window as any).__fluxLastNavPanel,
        value: (document.getElementById('aiInput') as HTMLTextAreaElement)?.value,
      };
    });
    expect(res.panel).toBe('ai');
    expect(res.value).toContain('What should I focus on?');
    expect(res.value).toContain('E2E context block');
  });
});
