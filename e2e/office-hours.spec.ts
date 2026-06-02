import { test, expect } from '@playwright/test';
import { gotoScenario, openSidebarTab } from './helpers';

test.describe('Office hours', () => {
  test('FluxOfficeHours module loads with expected public surface', async ({ page }) => {
    await gotoScenario(page, 'student-semester');
    const surface = await page.evaluate(() => ({
      moduleType: typeof (window as any).FluxOfficeHours,
      enabledType: typeof (window as any).FluxOfficeHours?.enabled,
      injectType: typeof (window as any).FluxOfficeHours?.inject,
      refreshType: typeof (window as any).FluxOfficeHours?.refresh,
      enabledNow: (window as any).FluxOfficeHours?.enabled?.(),
      // Internal helpers exposed for tests
      fmtTime: (window as any).FluxOfficeHours?._fmtTime?.('15:30'),
      validSlotGood: (window as any).FluxOfficeHours?._validSlot?.({
        day_of_week: 'monday', start_time: '15:00', end_time: '16:00',
      }),
      validSlotBad: (window as any).FluxOfficeHours?._validSlot?.({
        day_of_week: 'monday', start_time: '16:00', end_time: '15:00',
      }),
    }));
    expect(surface.moduleType).toBe('object');
    expect(surface.enabledType).toBe('function');
    expect(surface.injectType).toBe('function');
    expect(surface.refreshType).toBe('function');
    expect(surface.enabledNow).toBe(true);
    expect(surface.fmtTime).toBe('3:30 PM');
    expect(surface.validSlotGood).toBe(true);
    expect(surface.validSlotBad).toBe(false);
  });

  test('student sees Staff office hours card on School panel', async ({ page }) => {
    await gotoScenario(page, 'student-semester');
    await openSidebarTab(page, 'school');
    // Trigger inject; the observer would normally do this when #school renders,
    // but force it deterministically so the test doesn't race the observer's debounce.
    await page.evaluate(() => (window as any).FluxOfficeHours?.inject?.());

    const card = page.locator('#fluxOfficeHoursStudentCard');
    await expect(card).toBeAttached({ timeout: 5_000 });
    await expect(card.locator('h3')).toContainText(/staff office hours/i);
    // No real data without Supabase — student should see the empty-state copy.
    await expect(card).toContainText(/no staff office hours/i);
  });

  test('groupByStaff sorts alphabetically and slots within group by day order', async ({ page }) => {
    await gotoScenario(page, 'student-semester');
    const result = await page.evaluate(() => {
      const groups = (window as any).FluxOfficeHours._groupByStaff([
        { staff_id: 'b', staff_name: 'Zara Young', day_of_week: 'tuesday', start_time: '10:00', end_time: '10:30' },
        { staff_id: 'a', staff_name: 'Aaron Smith', day_of_week: 'friday', start_time: '14:00', end_time: '15:00' },
        { staff_id: 'a', staff_name: 'Aaron Smith', day_of_week: 'monday', start_time: '09:00', end_time: '09:30' },
      ]);
      return {
        count: groups.length,
        firstName: groups[0]?.name,
        firstSlot0Day: groups[0]?.slots[0]?.day_of_week,
        firstSlot1Day: groups[0]?.slots[1]?.day_of_week,
        secondName: groups[1]?.name,
      };
    });
    expect(result.count).toBe(2);
    expect(result.firstName).toBe('Aaron Smith'); // alpha order
    expect(result.firstSlot0Day).toBe('monday');  // day-of-week order within group
    expect(result.firstSlot1Day).toBe('friday');
    expect(result.secondName).toBe('Zara Young');
  });
});
