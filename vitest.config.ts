import { fileURLToPath } from 'node:url';

import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./tests/setup.ts'],
    include: ['tests/**/*.test.ts', 'tests/**/*.test.tsx'],
    coverage: {
      // Istanbul rather than v8: the v8 provider synthesises a phantom `get`
      // accessor at line 1 of every ES module (the namespace getter) and counts
      // it as an uncovered function, which silently caps a small module's
      // function coverage below 100% no matter how it is tested. Istanbul
      // instruments the source itself and reports what is actually there.
      provider: 'istanbul',
      reporter: ['text', 'lcov', 'json-summary'],
      include: ['src/**/*.ts', 'src/**/*.tsx'],
      // Excluded because a unit test of them would assert nothing a reader
      // could not see, while an E2E test of them asserts something real.
      // Everything with logic in it stays in.
      exclude: [
        'src/**/*.d.ts',
        // Page shells: ~15 lines of composition each, no branching. Covered by
        // the Playwright suite, which actually renders them in a browser.
        'src/app/**/page.tsx',
        'src/app/**/layout.tsx',
        'src/app/globals.css',
        // SDK wiring with no logic of ours. Exercising these needs a real
        // Firebase project, so they are verified by deploying, not by mocking
        // the SDK and asserting the mock was called.
        'src/lib/server/firebaseAdmin.ts',
        'src/lib/server/firestoreRepository.ts',
        'src/lib/ui/firebaseClient.ts',
        'src/components/AuthProvider.tsx',
        // Type-only re-exports; nothing executes.
        'src/lib/schemas/**',
        'src/lib/ui/dto.ts',
      ],
      thresholds: {
        // Overall floor for the whole app.
        lines: 80,
        functions: 80,
        branches: 75,
        statements: 80,
        // The deterministic core decides safety numbers, so it is held to a
        // much higher bar than the UI layer around it.
        'src/lib/engine/**': {
          lines: 95,
          functions: 95,
          branches: 90,
          statements: 95,
        },
        'src/lib/sim/**': {
          lines: 95,
          functions: 95,
          branches: 90,
          statements: 95,
        },
      },
    },
  },
});
