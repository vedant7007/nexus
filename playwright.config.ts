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
    // Never reuse by default: the only server this suite should talk to is the
    // one it just built (see the note on PORT). The env override exists purely
    // for local debugging against an already-running build.
    reuseExistingServer: process.env.PW_REUSE_SERVER === '1',
    // Generous: a cold Next build plus server start can approach four minutes on
    // a loaded machine, and a webServer timeout reads as a spurious test failure.
    timeout: 360_000,
    // The suite runs a production build with no Firebase project, so it opts
    // into the explicit, test-only auth bypass. Real deployments never set this.
    env: { AUTH_BYPASS: '1' },
  },
});
