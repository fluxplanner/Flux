import { test, expect } from '@playwright/test';
import { gotoScenario } from './helpers';

test.describe('Study tools — DP expansion', () => {
  test('toolbox renders the native study-hub subject rail', async ({ page }) => {
    await gotoScenario(page, 'student-semester');
    await page.evaluate(() => (window as any).nav?.('toolbox'));
    await page.waitForTimeout(800);

    // The Study Hub rebuild replaced the legacy #stSubjectHost IB sections with a
    // native subject rail (#fshRoot/#fshRail). Assert by data-sub so the icon glyph
    // inside each pill doesn't pollute the comparison.
    const { hubRendered, subjects } = await page.evaluate(() => ({
      hubRendered: !!document.getElementById('fshRoot'),
      subjects: [...document.querySelectorAll('#fshRail .fsh-pill')].map(
        (e) => (e as HTMLElement).dataset.sub || '',
      ),
    }));
    expect(hubRendered, 'native study hub (#fshRoot) did not render').toBe(true);
    expect(subjects).toEqual([
      'chemistry',
      'physics',
      'math',
      'music',
      'biology',
      'cs',
      'econ',
      'english',
      'history',
      'languages',
      'astronomy',
    ]);
  });

  test('quick-access strip records recents and deep-links back to a tool', async ({ page }) => {
    await gotoScenario(page, 'student-semester');
    await page.evaluate(() => (window as any).nav?.('toolbox'));
    await page.waitForTimeout(800);

    const res = await page.evaluate(async () => {
      const hub = (window as any).fluxStudyHub;
      hub.selectSubject('physics');
      await new Promise((r) => setTimeout(r, 300));
      hub.selectSubject('chemistry');
      await new Promise((r) => setTimeout(r, 300));
      const chips = [...document.querySelectorAll('#fshQuick .fsh-qchip')].map((c) => ({
        sid: (c as HTMLElement).dataset.sid,
        tid: (c as HTMLElement).dataset.tid,
      }));
      // click the physics chip — should switch subject back to physics
      const phys = [...document.querySelectorAll('#fshQuick .fsh-qchip')].find(
        (c) => (c as HTMLElement).dataset.sid === 'physics',
      ) as HTMLElement;
      phys?.click();
      await new Promise((r) => setTimeout(r, 300));
      return {
        chips,
        activeSubject: (document.querySelector('#fshRail .fsh-pill.active') as HTMLElement)?.dataset.sub,
      };
    });
    expect(res.chips.length).toBeGreaterThanOrEqual(2);
    expect(res.chips[0].sid).toBe('chemistry'); // most recent first
    expect(res.chips.some((c) => c.sid === 'physics')).toBe(true);
    expect(res.activeSubject).toBe('physics');
  });

  test('search finds chemistry built-in tabs and subjects; "/" focuses hub search only on Study tab', async ({ page }) => {
    await gotoScenario(page, 'student-semester');
    await page.evaluate(() => (window as any).nav?.('toolbox'));
    await page.waitForTimeout(800);

    const search = await page.evaluate(async () => {
      const si = document.getElementById('fshSearch') as HTMLInputElement;
      si.value = 'atom';
      si.dispatchEvent(new Event('input', { bubbles: true }));
      await new Promise((r) => setTimeout(r, 250));
      const atomHit = [...document.querySelectorAll('#fshStage .fsh-res-title')].some(
        (e) => e.textContent === '3D Atom Model',
      );
      si.value = 'physics';
      si.dispatchEvent(new Event('input', { bubbles: true }));
      await new Promise((r) => setTimeout(r, 250));
      const subjHit = !!document.querySelector('#fshStage [data-act="open-sub"][data-sid="physics"]');
      si.value = '';
      si.dispatchEvent(new Event('input', { bubbles: true }));
      return { atomHit, subjHit };
    });
    expect(search.atomHit, 'search "atom" should surface the 3D Atom chemistry tab').toBe(true);
    expect(search.subjHit, 'search "physics" should surface the subject shortcut').toBe(true);

    // "/" focuses the hub search while on the Study tab…
    const onStudy = await page.evaluate(async () => {
      (document.activeElement as HTMLElement)?.blur();
      document.body.dispatchEvent(new KeyboardEvent('keydown', { key: '/', bubbles: true, cancelable: true }));
      await new Promise((r) => setTimeout(r, 200));
      return document.activeElement?.id;
    });
    expect(onStudy).toBe('fshSearch');

    // …and still opens the app AI panel from any other tab
    const offStudy = await page.evaluate(async () => {
      (window as any).nav?.('dashboard');
      await new Promise((r) => setTimeout(r, 150));
      (document.activeElement as HTMLElement)?.blur();
      document.body.dispatchEvent(new KeyboardEvent('keydown', { key: '/', bubbles: true, cancelable: true }));
      await new Promise((r) => setTimeout(r, 300));
      return { panel: (window as any).__fluxLastNavPanel, focused: document.activeElement?.id };
    });
    // the app's own "/" shortcut must still win off the Study tab
    expect(offStudy.panel).toBe('ai');
    expect(offStudy.focused).not.toBe('fshSearch');
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
