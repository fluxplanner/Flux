import { test, expect } from '@playwright/test';
import { gotoScenario } from './helpers';

test.describe('Flux knowledge base', () => {
  test('stores docs and injects only matching ones into the system prompt', async ({ page }) => {
    await gotoScenario(page, 'student-semester');

    const result = await page.evaluate(() => {
      const K = (window as any).FluxKnowledge;
      if (!K) return { loaded: false };
      // clean slate
      K.list().forEach((d: any) => K.remove(d.id));
      K.add(
        'Physics formula sheet — forces',
        'Newton second law: F = ma. Weight W = mg with g = 9.8 m/s^2. ' +
          'Apparent weight in an elevator accelerating upward: N = m(g + a).',
        'Physics',
      );
      K.add('English essay rubric', 'Thesis must be arguable. Cite two sources minimum.', 'English');

      const sysMatch = K.appendToSystem('BASE', 'What does the scale read in an elevator accelerating upward?');
      const sysMiss = K.appendToSystem('BASE', 'completely unrelated cooking question about pasta');
      return {
        loaded: true,
        count: K.list().length,
        matchInjected: sysMatch.includes('knowledge_base') && sysMatch.includes('N = m(g + a)'),
        missClean: sysMiss === 'BASE',
      };
    });

    expect(result.loaded, 'FluxKnowledge did not load').toBe(true);
    expect(result.count).toBe(2);
    expect(result.matchInjected, 'matching doc was not injected').toBe(true);
    expect(result.missClean, 'non-matching query should inject nothing').toBe(true);
  });

  test('manager UI adds and deletes docs', async ({ page }) => {
    await gotoScenario(page, 'student-semester');
    await page.evaluate(() => {
      const K = (window as any).FluxKnowledge;
      K.list().forEach((d: any) => K.remove(d.id));
      K.openManager();
    });
    await page.fill('#fkbTitle', 'Chem polyatomic ions');
    await page.fill('#fkbContent', 'Nitrate NO3-, sulfate SO4 2-, phosphate PO4 3-');
    await page.click('#fkbAdd');
    await expect(page.locator('.fkb-item')).toHaveCount(1);
    await page.click('.fkb-del');
    await expect(page.locator('.fkb-item')).toHaveCount(0);
    await page.keyboard.press('Escape');
    await expect(page.locator('#fkbOverlay')).toHaveCount(0);
  });
});
