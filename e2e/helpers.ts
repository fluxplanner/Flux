import { expect, type Page } from '@playwright/test';

export async function gotoScenario(page: Page, scenario: string) {
  await page.goto(`/?e2e=1&scenario=${encodeURIComponent(scenario)}`);
  await expect(page.locator('#app')).toHaveClass(/visible/);
}

export async function openSidebarTab(page: Page, tab: string) {
  const item = page.locator(`#sidebar .nav-item[data-tab="${tab}"]`).first();
  await expect(item).toBeVisible();
  await item.click();
  await expect(page.locator(`#${tab}.panel.active`)).toBeVisible({ timeout: 15_000 });
}
