import AxeBuilder from '@axe-core/playwright';
import { type Page, expect, test } from '@playwright/test';

/**
 * End-to-end coverage of the demo arc and the accessibility guarantees.
 *
 * These run against a real browser, which matters for two things jsdom cannot
 * do: colour-contrast checks (axe needs canvas to compute them) and genuine
 * keyboard focus order.
 *
 * The suite runs with no GEMINI_API_KEY, so every AI panel is exercised in
 * rule-based mode. That is deliberate — it is the "AI is down" path, and it is
 * the one that must never dead-end.
 */

/** Asserts a page has no axe violations. */
async function expectAccessible(page: Page): Promise<void> {
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .analyze();

  expect(results.violations).toEqual([]);
}

test.describe('accessibility', () => {
  for (const path of ['/', '/login', '/dashboard', '/incidents', '/methodology']) {
    test(`${path} has no axe violations`, async ({ page }) => {
      await page.goto(path);
      await page.waitForLoadState('networkidle');
      await expectAccessible(page);
    });
  }

  test('every page has exactly one h1', async ({ page }) => {
    for (const path of ['/', '/login', '/dashboard', '/incidents', '/methodology']) {
      await page.goto(path);
      await page.waitForLoadState('networkidle');
      await expect(page.locator('h1')).toHaveCount(1);
    }
  });

  test('skip link is the first thing a keyboard user reaches', async ({ page }) => {
    await page.goto('/dashboard');
    // Wait for hydration before driving the keyboard: tabbing into a
    // not-yet-interactive page focuses nothing and flakes.
    await expect(page.getByRole('link', { name: 'Skip to main content' })).toBeAttached();
    await page.waitForLoadState('networkidle');

    await page.keyboard.press('Tab');
    await expect(page.getByRole('link', { name: 'Skip to main content' })).toBeFocused();
  });
});

test.describe('the demo arc', () => {
  test('gate surge escalates status and produces a recommendation with a real number', async ({
    page,
  }) => {
    await page.goto('/dashboard');
    await page.waitForLoadState('networkidle');

    // Establish the baseline first: a normal matchday is not in crisis.
    await expect(page.getByText(/Overall:\s*Normal/)).toBeVisible({ timeout: 20_000 });

    // The scenario picker is a Radix Select and must be fully keyboard-operable.
    await page.getByRole('combobox', { name: /scenario/i }).click();
    await page.getByRole('option', { name: /Gate C surge/ }).click();

    // The engine detects the surge and the status pill escalates as the clock
    // advances. Generous timeout: the escalation is genuinely time-based, so
    // this waits for real simulated minutes to pass rather than polling a mock.
    await expect(page.getByText(/Overall:\s*(High|Critical)/)).toBeVisible({ timeout: 40_000 });

    // The briefing panel renders — in rule mode here, which is the point.
    const briefing = page.getByRole('region', { name: /AI Situational Briefing/i });
    await expect(briefing).toBeVisible();
    await expect(briefing.getByText(/Overall status is/)).toBeVisible({ timeout: 20_000 });

    // A recommendation appears with an engine-computed before/after figure.
    const recommendations = page.getByRole('region', { name: /AI Recommendations/i });
    await expect(recommendations.getByText('Computed impact').first()).toBeVisible({
      timeout: 30_000,
    });
    await expect(
      recommendations.getByText(/\d+(\.\d+)?%\s*→\s*\d+(\.\d+)?%/).first(),
    ).toBeVisible();
  });

  test('a Spanish incident is triaged to SEV-1 and logged, with the AI unavailable', async ({
    page,
  }) => {
    await page.goto('/incidents');
    await page.waitForLoadState('networkidle');

    await page
      .getByLabel(/Report an incident in any language/)
      .fill('hay una persona desmayada en la sección 114');
    await page.getByRole('button', { name: 'Triage' }).click();

    // Severity is rule-based, so it holds even though Gemini is not configured.
    await expect(page.getByText('SEV-1')).toBeVisible({ timeout: 20_000 });
    await expect(page.getByText(/Life safety/)).toBeVisible();
    await expect(page.getByText(/Rule-based · not AI/)).toBeVisible();

    await page.getByRole('button', { name: /Confirm and log|Log incident/ }).click();

    const log = page.getByRole('region', { name: /Incident Log/i });
    await expect(log.getByText(/desmayada/).first()).toBeVisible({ timeout: 20_000 });
  });
});

test.describe('degradation', () => {
  test('the command center still works when the AI endpoints fail', async ({ page }) => {
    // Simulate Gemini being down hard, not merely unconfigured.
    await page.route('**/api/ai/**', (route) => route.fulfill({ status: 503, body: '{}' }));

    await page.goto('/dashboard');
    await page.waitForLoadState('networkidle');

    // The deterministic panels are unaffected: they never depended on the AI.
    await expect(page.getByRole('region', { name: /Zones & Gates/i })).toBeVisible();
    await expect(page.getByText(/Overall:/)).toBeVisible({ timeout: 20_000 });

    // And the AI panel shows an error state, not a blank div or a dead spinner.
    const briefing = page.getByRole('region', { name: /AI Situational Briefing/i });
    await expect(briefing).toBeVisible();
    await expect(briefing.getByText(/Retry|Overall status is/)).toBeVisible({ timeout: 20_000 });
  });

  test('the incident form still triages with the AI endpoint failing', async ({ page }) => {
    await page.route('**/api/ai/triage', (route) => route.fulfill({ status: 503, body: '{}' }));

    await page.goto('/incidents');
    await page.waitForLoadState('networkidle');

    await page
      .getByLabel(/Report an incident in any language/)
      .fill('person unconscious at gate B');
    await page.getByRole('button', { name: /Log incident/ }).click();

    // The safety-critical path runs entirely server-side through the engine.
    const log = page.getByRole('region', { name: /Incident Log/i });
    await expect(log.getByText('SEV-1').first()).toBeVisible({ timeout: 20_000 });
  });
});
