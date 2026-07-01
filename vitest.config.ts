import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: [
      'packages/*/src/**/*.test.ts',
      'apps/*/src/**/*.test.ts',
    ],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov'],
      include: [
        'packages/ai/src/**/*.ts',
        'packages/db/src/**/*.ts',
        'packages/shared/src/**/*.ts',
      ],
      exclude: [
        '**/*.test.ts',
        '**/*.d.ts',
        'packages/db/src/etl/**',
        'packages/db/src/crawl/**',
        'packages/db/src/migrations/**',
        'packages/db/src/embeddings/**',
      ],
    },
  },
});
