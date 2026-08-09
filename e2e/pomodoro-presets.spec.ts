import { test, expect } from '@playwright/test';
import {
  gotoScenario,
  openSidebarTab,
  watchForViolations,
  assertNoCspOrConsoleViolations,
} from './helpers';

// Regression guard for the preset-chip onclick quoting bug.
//
// renderBar() used to interpolate JSON.stringify(key) straight into a
// DOUBLE-quoted attribute, emitting onclick="…selectSubject("CLSe2e-math")".
// The parser closes the attribute at the second quote, so the handler text
// became the syntactically invalid `…selectSubject(` and `clse2e-math")"` was
// left behind as a stray attribute name — element.onclick was null and both chip
// actions were dead. Assertions therefore run against the PARSED DOM (onclick
// property, attribute names), never the source template, since only a real HTML
// parse reproduces the failure.
//
// Subject keys come from the scenario's own seeded classes (`CLS` + class id),
// so they carry hyphens — a useful shape, since the key must survive quoting
// intact rather than merely being alphanumeric.

test.describe('Pomodoro subject preset chips', () => {
  test('chip handlers parse into live functions and drive select/remove', async ({ page }) => {
    await watchForViolations(page);
    await page.addInitScript(() => {
      window.FLUX_EXPERIMENTS = {
        ...(window.FLUX_EXPERIMENTS || {}),
        enable_pomodoro_subject_presets: true,
      };
    });
    await gotoScenario(page, 'student-semester');
    await openSidebarTab(page, 'timer');

    // Save presets for the first two real subjects, through the real save path.
    const setup = await page.evaluate(() => {
      const P = window.FluxPomodoroPresets;
      if (!P) return { ok: false, reason: 'FluxPomodoroPresets not on window', keys: [] as string[] };
      if (!P.enabled()) return { ok: false, reason: 'feature flag resolved false', keys: [] as string[] };

      const sel = document.getElementById('timerSubject') as HTMLSelectElement | null;
      const work = document.getElementById('customWork') as HTMLInputElement | null;
      const short = document.getElementById('customShort') as HTMLInputElement | null;
      if (!sel || !work || !short) return { ok: false, reason: 'timer controls missing', keys: [] };

      const keys = [...sel.options].map((o) => o.value).filter(Boolean);
      if (keys.length < 2) {
        return { ok: false, reason: `need 2 subjects, got ${JSON.stringify(keys)}`, keys };
      }

      work.value = '45'; short.value = '10';
      P.savePresetForSubject(keys[0]);
      work.value = '30'; short.value = '7';
      P.savePresetForSubject(keys[1]);
      P.renderBar();

      return { ok: true, reason: '', keys: keys.slice(0, 2) };
    });
    expect(setup.ok, setup.reason).toBeTruthy();
    const [keyA, keyB] = setup.keys;
    expect(keyA).toContain('CLS');

    // ── the actual regression assertions, against the parsed DOM ──
    const chips = await page.evaluate(() => {
      const bar = document.getElementById('fluxPomoPresetBar');
      if (!bar) return null;
      return [...bar.querySelectorAll('button.flux-pomo-chip')].map((b) => {
        const x = b.querySelector('.flux-pomo-chip-x') as HTMLElement | null;
        return {
          onclickIsFn: typeof (b as HTMLElement).onclick === 'function',
          onclickAttr: b.getAttribute('onclick'),
          attrNames: b.getAttributeNames().sort(),
          xOnclickIsFn: typeof x?.onclick === 'function',
          xOnclickAttr: x?.getAttribute('onclick') ?? null,
        };
      });
    });
    expect(chips, 'preset bar was not rendered').not.toBeNull();
    expect(chips).toHaveLength(2);

    for (const [i, key] of [keyA, keyB].entries()) {
      const chip = chips![i];
      // 1. The handler actually compiled — this is null when the attribute is truncated.
      expect(chip.onclickIsFn, `chip onclick did not compile: ${chip.onclickAttr}`).toBe(true);
      expect(chip.xOnclickIsFn, `remove onclick did not compile: ${chip.xOnclickAttr}`).toBe(true);

      // 2. The attribute survived parsing with the key fully quoted and the call closed.
      expect(chip.onclickAttr).toBe(`FluxPomodoroPresets.selectSubject('${key}')`);
      expect(chip.xOnclickAttr).toBe(
        `event.stopPropagation();FluxPomodoroPresets.removePreset('${key}')`,
      );

      // 3. No stray attribute split off the key (the old bug left one named `clse2e-math")"`).
      expect(chip.attrNames).toEqual(['class', 'onclick', 'title', 'type']);
    }

    // ── clicking a chip applies that subject's preset ──
    await page.locator('#fluxPomoPresetBar button.flux-pomo-chip').nth(1).click();
    const afterSelect = await page.evaluate(() => ({
      subject: (document.getElementById('timerSubject') as HTMLSelectElement).value,
      work: (document.getElementById('customWork') as HTMLInputElement).value,
      short: (document.getElementById('customShort') as HTMLInputElement).value,
    }));
    expect(afterSelect.subject, 'clicking the chip did not select its subject').toBe(keyB);
    expect(afterSelect.work).toBe('30');
    expect(afterSelect.short).toBe('7');

    // ── clicking × removes that preset (and only that one) ──
    await page.locator('#fluxPomoPresetBar .flux-pomo-chip-x').first().click();
    await expect(page.locator('#fluxPomoPresetBar button.flux-pomo-chip')).toHaveCount(1);
    const remaining = await page.evaluate(() =>
      Object.keys(JSON.parse(localStorage.getItem('flux_pomodoro_presets_v1')!).bySubject),
    );
    expect(remaining, 'the × handler did not delete the preset from storage').toEqual([keyB]);

    assertNoCspOrConsoleViolations(page);
  });

  // Proves the assertions above can actually fail: parse the pre-fix markup and
  // confirm the browser produces exactly the dead-handler symptoms described.
  test('control: the pre-fix double-quoted markup yields a dead handler', async ({ page }) => {
    await gotoScenario(page, 'student-semester');
    const broken = await page.evaluate(() => {
      const key = 'CLSe2e-math';
      const host = document.createElement('div');
      // verbatim shape of the old template: JSON.stringify(key) inside "…"
      host.innerHTML =
        `<button type="button" onclick="FluxPomodoroPresets.selectSubject(${JSON.stringify(key)})">x</button>`;
      const b = host.querySelector('button')!;
      return {
        onclickIsFn: typeof b.onclick === 'function',
        onclickAttr: b.getAttribute('onclick'),
        attrNames: b.getAttributeNames(),
      };
    });

    expect(broken.onclickIsFn, 'old markup unexpectedly produced a working handler').toBe(false);
    expect(broken.onclickAttr).toBe('FluxPomodoroPresets.selectSubject(');
    expect(broken.attrNames).toContain('clse2e-math")"');
  });
});
