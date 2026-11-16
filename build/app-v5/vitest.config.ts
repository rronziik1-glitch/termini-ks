import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['tests/**/*.test.ts'],
    environment: 'node',
    fileParallelism: false,
    testTimeout: 30_000,
    env: {
      DATABASE_URL: 'file:./test.db',
      APP_URL: 'http://localhost:3000',
      APP_SECRET: 'test-secret',
      FG_STAGE_DELAY_MS: '0',
      ANTHROPIC_API_KEY: '',
      PAYSERA_PROJECT_ID: '',
      PAYSERA_SIGN_PASSWORD: '',
    },
  },
});
