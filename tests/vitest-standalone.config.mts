import { defineConfig } from 'vitest/config';
import { resolve } from 'path';

export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    setupFiles: ['./tests/setup-standalone.ts'],
    include: [
      'tests/standalone/**/*.test.ts',
      'tests/integration/**/*.test.ts'
    ],
    exclude: [
      'node_modules',
      'dist'
    ]
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, './src')
    }
  }
});
