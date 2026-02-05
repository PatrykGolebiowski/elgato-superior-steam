import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // Use happy-dom for DOM environment (lightweight alternative to jsdom)
    environment: 'happy-dom',

    // Include test files
    include: ['test/**/*.{test,spec}.{js,ts}'],

    // Global test APIs (describe, it, expect, etc.) without imports
    globals: true,

    // Coverage configuration
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      include: ['src/**/*.ts'],
      exclude: [
        'src/**/*.d.ts',
        'src/**/*.test.ts',
        'src/**/*.spec.ts',
      ],
    },


    // Mock timers and functions
    mockReset: true,
    clearMocks: true,
    restoreMocks: true,
  },
});
