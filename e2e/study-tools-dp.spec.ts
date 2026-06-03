import { test, expect } from '@playwright/test';
import { gotoScenario } from './helpers';

test.describe('Study tools — DP expansion', () => {
  test('toolbox renders the rebalanced IB subject groups', async ({ page }) => {
    await gotoScenario(page, 'student-semester');
    await page.evaluate(() => (window as any).nav?.('toolbox'));
    await page.waitForTimeout(800);

    const sections = await page.evaluate(() =>
      [...document.querySelectorAll('#stSubjectHost .st-section .st-section-name')].map(
        (e) => (e.textContent || '').trim(),
      ),
    );
    expect(sections).toEqual([
      'Sciences',
      'Mathematics',
      'Individuals & Societies',
      'Language & Literature',
      'Language Acquisition',
      'The Arts',
      'Computer Science',
    ]);
  });

  test('all new DP reference tools open with content and tabs', async ({ page }) => {
    await gotoScenario(page, 'student-semester');
    const res = await page.evaluate(async () => {
      const fns = [
        'openPsychReference',
        'openLitReference',
        'openGermanReference',
        'openGlobalPoliticsReference',
        'openVisualArtsReference',
        'openMusicTheoryReference',
        'openMathAnalysisReference',
        'openHistorySkillsReference',
      ];
      const out: Record<string, { opened: boolean; content: boolean; tabs: number; err: string | null }> = {};
      for (const fn of fns) {
        document.querySelectorAll('[class*="tool-modal"], .ref-tool-modal').forEach((m) => m.remove());
        let opened = false, content = false, tabs = 0, err: string | null = null;
        try {
          (window as any)[fn]();
          await new Promise((r) => setTimeout(r, 150));
          const modal = document.querySelector('[class*="tool-modal"], .ref-tool-modal');
          opened = !!modal;
          if (modal) {
            content = (modal as HTMLElement).innerText.length > 100;
            tabs = modal.querySelectorAll('[class*="tab"]').length;
          }
        } catch (e: any) { err = String(e?.message || e); }
        out[fn] = { opened, content, tabs, err };
        document.querySelectorAll('[class*="tool-modal"], .ref-tool-modal').forEach((m) => m.remove());
      }
      return out;
    });
    for (const fn of Object.keys(res)) {
      expect(res[fn].err, `${fn} threw`).toBeNull();
      expect(res[fn].opened, `${fn} did not open`).toBe(true);
      expect(res[fn].content, `${fn} had no content`).toBe(true);
      expect(res[fn].tabs, `${fn} had no tabs`).toBeGreaterThan(0);
    }
  });

  test('reorganization preserved inline tool rendering', async ({ page }) => {
    await gotoScenario(page, 'student-semester');
    const res = await page.evaluate(async () => {
      const tb = (window as any).fluxToolbox;
      const scratch = document.createElement('div');
      document.body.appendChild(scratch);
      // Every inline tool referenced by the new layout must still render.
      const layout = tb.UNIFIED_LAYOUT as any[];
      const broken: string[] = [];
      for (const sec of layout) {
        for (const t of sec.tools) {
          if (t.mode !== 'inline') continue;
          const subj = tb.SUBJECTS.find((s: any) => s.id === t.sub);
          const tool = subj?.tools.find((x: any) => x.id === t.tid);
          scratch.innerHTML = '';
          try {
            tool.render(scratch);
            if (scratch.innerHTML.length < 20) broken.push(`${t.sub}/${t.tid} (empty)`);
          } catch (e: any) {
            broken.push(`${t.sub}/${t.tid} (${e?.message || e})`);
          }
        }
      }
      scratch.remove();
      return { broken };
    });
    expect(res.broken).toEqual([]);
  });
});
