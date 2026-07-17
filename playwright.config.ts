import { defineConfig, devices } from '@playwright/test';

/**
 * Deliberately not 3000.
 *
 * With `reuseExistingServer`, Playwright will happily attach to whatever is
 * already listening — and on a developer's machine that is very often a
 * different project's dev server. This suite spent a run testing an unrelated
 * app and reporting its accessibility violations as ours. A dedicated port
 * makes the E2E suite test the thing it was written for.
 */
const PORT = 3117;
const BASE_URL = `http://127.0.0.1:${PORT}`;

export default defineConfig({
  testDir: './e2e',
  // Serial, single-worker: these tests drive one shared, stateful server (a live
  // simulator clock and an in-memory incident log), so they are not independent.
  // Running them in parallel had workers competing for that server, making the
  // time-sensitive escalation flaky and letting one test's incidents bleed into
  // another's log. One worker matches how the app is actually used.
  fullyParallel: false,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 1,
  workers: 1,
  reporter: process.env.CI ? [['html'], ['list']] : [['list']],
  use: {
    baseURL: BASE_URL,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: `npm run build && npm run start -- --port ${PORT}`,
    url: BASE_URL,
    // Never reuse: the only server this suite should ever talk to is the one it
    // just built. See the note on PORT.
    reuseExistingServer: false,
    timeout: 240_000,
    // The suite runs a production build with no Firebase project, so it opts
    // into the explicit, test-only auth bypass. Real deployments never set this.
    env: { AUTH_BYPASS: '1' },
  },
});
