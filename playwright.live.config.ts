import { defineConfig, devices } from '@playwright/test';

/*
 * Smoke tests against the real, deployed site (no local server, no mocks).
 * Run hourly by .github/workflows/live-smoke.yml. They only read: nothing here
 * signs in, saves, or sends anything.
 *
 *   npx playwright test -c playwright.live.config.ts
 *   LIVE_URL=https://staging.example/ npx playwright test -c playwright.live.config.ts
 */
const baseURL = (process.env.LIVE_URL || 'https://fluxplanner.github.io/Flux/').replace(/\/?$/, '/');

export default defineConfig({
  testDir: './e2e-live',
  fullyParallel: true,
  retries: 2, // the live site sits behind a CDN; one blip is not an outage
  workers: 2,
  reporter: process.env.CI ? [['github'], ['list']] : [['list']],
  timeout: 60_000,
  use: {
    baseURL,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    ...devices['Desktop Chrome'],
  },
});
