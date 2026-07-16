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
      exclude: [
        'src/**/*.d.ts',
        'src/app/**/layout.tsx',
        'src/app/globals.css',
        'src/lib/server/firebaseAdmin.ts',
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
