import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  testMatch: '**/*.spec.js',
  globalSetup: './e2e/global-setup.js',
  globalTeardown: './e2e/global-teardown.js',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'html',
  use: {
    baseURL: 'http://localhost:5173',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  webServer: {
    command: 'pnpm run dev -- --host',
    url: 'http://localhost:5173',
    reuseExistingServer: !process.env.CI,
    timeout: 30000,
  },
  projects: [
    {
      name: 'readonly-tests',
      testMatch: /^(?!.*admin-dev-mode\.spec\.js$).*/,
      use: { browserName: 'chromium' },
    },
    {
      name: 'data-mutation-tests',
      testMatch: '**/admin-dev-mode.spec.js',
      use: { browserName: 'chromium' },
      dependencies: ['readonly-tests'],
    },
  ],
});
