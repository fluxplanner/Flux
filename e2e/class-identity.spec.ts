import { test, expect } from '@playwright/test';
import { gotoScenario } from './helpers';

/*
 * Phase D — class-name preservation through onboarding (A1 regression).
 *
 * The original live bug: onboarding "Add class manually" with name
 * "AP Biology" and period "A1" rendered a chip "Biology" with badge "1"
 * (cleanClassName stripped level prefixes; the number input dropped the
 * period letter). These tests drive the REAL onboarding inputs and the
 * School-tab add flow and pin the acceptance: full names, verbatim
 * period labels, structured level fields.
 */

test.describe('Course identity preservation (A1)', () => {
  test('onboarding manual add keeps "AP Biology" with badge "A1"', async ({ page }) => {
    await gotoScenario(page, 'guest');
    const r = await page.evaluate(() => {
      const w = window as any;
      const p = document.getElementById('obManualPeriod') as HTMLInputElement;
      const n = document.getElementById('obManualName') as HTMLInputElement;
      if (!p || !n) return { error: 'onboarding inputs missing' };
      // The input must accept letters (was type=number, which ate "A1").
      const inputType = p.type;
      p.value = 'A1';
      n.value = 'AP Biology';
      (w.obExtractedClasses || []).length = 0;
      w.addObClass();
      const html = document.getElementById('obExtractedClasses')?.innerHTML || '';
      return { inputType, html };
    });
    expect(r.error).toBeUndefined();
    expect(r.inputType).toBe('text');
    expect(r.html).toContain('AP Biology');   // full name — never "Biology"
    expect(r.html).toContain('>A1<');          // verbatim period badge — never "1"
  });

  test('School-tab add stores full name, level, and verbatim period label', async ({ page }) => {
    await gotoScenario(page, 'guest');
    const stored = await page.evaluate(() => {
      const w = window as any;
      (document.getElementById('classPeriod') as HTMLInputElement).value = 'B4';
      (document.getElementById('className') as HTMLInputElement).value = 'IB DP Chemistry HL';
      (document.getElementById('classTeacher') as HTMLInputElement).value = 'Dr. K';
      (document.getElementById('classRoom') as HTMLInputElement).value = '112';
      w.addClass();
      const c = (w.load('flux_classes', []) || []).find((x: any) => x.name === 'IB DP Chemistry HL');
      return c ? { name: c.name, level: c.level, periodLabel: c.periodLabel, days: c.days } : null;
    });
    expect(stored).not.toBeNull();
    expect(stored!.name).toBe('IB DP Chemistry HL');
    expect(stored!.level).toBe('IB DP HL');
    expect(stored!.periodLabel).toBe('B4');
    expect(stored!.days).toBe('B Day');
  });

  test('trailing course numerals survive ("Spanish 3")', async ({ page }) => {
    await gotoScenario(page, 'guest');
    const r = await page.evaluate(() => {
      const w = window as any;
      return {
        clean: w.cleanClassName ? w.cleanClassName('Spanish 3') : null,
        parsed: w.parseClassLevel('Spanish 3'),
      };
    });
    expect(r.clean).toBe('Spanish 3');
    expect(r.parsed.name).toBe('Spanish 3');
    expect(r.parsed.level).toBe('');
  });
});
