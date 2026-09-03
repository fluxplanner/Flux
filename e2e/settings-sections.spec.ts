import { test, expect } from '@playwright/test';
import { gotoScenario, openSidebarTab } from './helpers';

/**
 * Settings used to have six sections, one of which — "Data & info" — held
 * thirteen cards covering four unrelated jobs while Alerts and AI had two
 * each. It is now three sections: Your data, Help, About.
 *
 * The `data` id survived the split on purpose. flux-email-task-inbox.js:449
 * and flux-automation-hooks.js:211 both call switchStab('data') to reveal
 * their own injected card, and switchStab resolves ids by string
 * concatenation — `spane-` + id — so a rename would not have thrown, it
 * would have quietly done nothing. That is the regression these tests exist
 * to catch.
 */
test.describe('Settings sections', () => {
  test.beforeEach(async ({ page }) => {
    await gotoScenario(page, 'student-semester');
    await openSidebarTab(page, 'settings');
    await expect(page.locator('#settings.panel.active')).toBeVisible();
  });

  test('has eight sections, each with a pane behind it', async ({ page }) => {
    const wiring = await page.evaluate(() =>
      [...document.querySelectorAll('#settings .stab')].map((btn) => {
        const onclick = btn.getAttribute('onclick') || '';
        const id = (onclick.match(/switchStab\('([^']+)'/) || [])[1] || '';
        return { label: btn.textContent!.trim(), id, hasPane: !!document.getElementById('spane-' + id) };
      }),
    );

    expect(wiring.map((w) => w.label)).toEqual([
      'Look',
      'Alerts',
      'Connections',
      'AI',
      'Account',
      'Your data',
      'Help',
      'About',
    ]);
    // Every tab must point at a pane that exists. A tab whose pane is missing
    // looks selected but leaves the previous section's cards on screen —
    // silent, and the exact failure a rename of `spane-data` would produce.
    expect(wiring.filter((w) => !w.hasPane)).toEqual([]);
  });

  test('each new section shows its own cards and nothing else', async ({ page }) => {
    const headingsFor = (id: string) =>
      page.evaluate((paneId) => {
        const btn = [...document.querySelectorAll('#settings .stab')].find((b) =>
          (b.getAttribute('onclick') || '').includes(`'${paneId}'`),
        ) as HTMLButtonElement | undefined;
        btn?.click();
        const pane = document.getElementById('spane-' + paneId)!;
        return {
          active: pane.classList.contains('active'),
          activeCount: document.querySelectorAll('#settings .spane.active').length,
          headings: [...pane.querySelectorAll('h3')].map((h) => h.textContent!.trim()),
        };
      }, id);

    const data = await headingsFor('data');
    expect(data.active).toBe(true);
    expect(data.activeCount).toBe(1);
    expect(data.headings).toContain('Your data');
    expect(data.headings).toContain('Local storage');
    expect(data.headings).toContain('Your privacy');

    const help = await headingsFor('help');
    expect(help.active).toBe(true);
    expect(help.headings).toEqual([
      'Planner tour',
      'Keyboard',
      'FAQ',
      'Send feedback',
      'For schools & families',
    ]);

    const about = await headingsFor('about');
    expect(about.active).toBe(true);
    expect(about.headings).toContain('Tech Stack');
    expect(about.headings).toContain("What's changed");
    expect(about.headings).toContain('Your Flux Stats');
  });

  test('the cards other modules inject still land in a real pane', async ({ page }) => {
    // switchStab('data') is the escape hatch two modules use to reveal their
    // own card. It has to keep resolving, and the pane it lands on has to be
    // the one holding their mount points.
    const landed = await page.evaluate(() => {
      (window as unknown as { switchStab: (id: string) => void }).switchStab('data');
      const pane = document.getElementById('spane-data')!;
      return {
        active: pane.classList.contains('active'),
        mounts: ['fluxStorageRepairMount', 'fluxSyncConflictSettingsMount', 'fluxClaudeConnectMount'].map(
          (id) => document.getElementById(id)?.closest('.spane')?.id || 'absent',
        ),
      };
    });
    expect(landed.active).toBe(true);
    expect(landed.mounts).toEqual(['spane-data', 'spane-data', 'spane-data']);
  });

  test('on a phone every section is visible without sideways scrolling', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    // Eight tabs are ~570px of buttons. In one row they overflowed a 345px
    // strip by 586px with no edge cue, so Your data / Help / About sat off
    // screen entirely with nothing to suggest they existed.
    const strip = await page.evaluate(() => {
      const s = document.querySelector('#settings .stabs') as HTMLElement;
      const tabs = [...s.querySelectorAll('.stab')] as HTMLElement[];
      const box = s.getBoundingClientRect();
      return {
        rows: new Set(tabs.map((b) => Math.round(b.getBoundingClientRect().top))).size,
        clipped: tabs.filter((b) => {
          const r = b.getBoundingClientRect();
          return r.left < box.left - 1 || r.right > box.right + 1;
        }).length,
      };
    });
    expect(strip.rows).toBeGreaterThan(1);
    expect(strip.clipped).toBe(0);
  });

  test('every control in every section is big enough to tap', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });

    /*
     * Hit-tested, not measured. Painted size is not tap size: most of the
     * small-looking controls here — the switches, the accent swatches — are
     * drawn at 20-23px on purpose and carry an invisible ::before or ::after
     * expander that makes them 44. Reading offsetHeight alone reported ~70
     * failures that were not real; probing with elementFromPoint found the one
     * that was (Set custom accent, at 35px).
     *
     * Every pane is checked, not just the open one, by activating each in turn.
     */
    const bad = await page.evaluate(() => {
      const reach = (el: Element) => {
        const b = el.getBoundingClientRect();
        const cx = b.left + b.width / 2;
        const cy = b.top + b.height / 2;
        if (cx < 0 || cx > window.innerWidth || cy < 0 || cy > window.innerHeight) return null;
        let up = 0;
        let down = 0;
        for (let d = 0; d <= 22; d++) {
          const e = document.elementFromPoint(cx, cy - d);
          if (e === el || el.contains(e)) up = d; else break;
        }
        for (let d = 0; d <= 22; d++) {
          const e = document.elementFromPoint(cx, cy + d);
          if (e === el || el.contains(e)) down = d; else break;
        }
        return up + down;
      };

      const out: string[] = [];
      document.querySelectorAll('#settings .spane').forEach((pane) => {
        const was = pane.classList.contains('active');
        if (!was) pane.classList.add('active');
        pane
          .querySelectorAll('button,select,input:not([type=hidden]),a[href],summary')
          .forEach((el) => {
            const h = (el as HTMLElement).offsetHeight;
            if (!h || !(el as HTMLElement).offsetWidth || h >= 44) return;
            const v = reach(el);
            // 43 is what a genuine 44px box reads back: the probe steps +/-21.5
            // from the centre and counts whole pixels.
            if (v !== null && v < 43) {
              out.push(`${pane.id} ${el.id || el.tagName} paint=${h} reach=${v}`);
            }
          });
        if (!was) pane.classList.remove('active');
      });
      return out;
    });

    expect(bad, `controls too small to tap:\n${bad.join('\n')}`).toEqual([]);
  });
});
