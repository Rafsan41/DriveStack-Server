import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // These are fast, dependency-free unit tests over the pure business logic;
    // no database or HTTP server is spun up.
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    globals: false,
    clearMocks: true,
  },
});
