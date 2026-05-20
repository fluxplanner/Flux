import { defineConfig, devices } from '@playwright/test';

const PORT = Number(process.env.E2E_PORT || 4173);
const baseURL = `http://127.0.0.1:${PORT}`;

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI ? [['github'], ['list']] : [['list']],
  timeout: 60_000,
  use: {
    baseURL,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    ...devices['Desktop Chrome'],
  },
  webServer: {
    command: `npx serve . -l ${PORT}`,
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
