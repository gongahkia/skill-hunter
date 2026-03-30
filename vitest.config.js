import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['test/**/*.test.js'],
    exclude: ['.tmp/**', 'dist/**', 'node_modules/**']
  }
});
