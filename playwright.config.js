import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  testMatch: '**/*.spec.js',
  globalSetup: './e2e/global-setup.js',
  globalTeardown: './e2e/global-teardown.js',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  // CI では安定性のためリトライ 2 回、ローカルはリトライなし
  retries: process.env.CI ? 2 : 0,
  // CI では並列実行を避けてワーカー 1、ローカルは CPU コア数に応じて並列化
  workers: process.env.CI ? 1 : undefined,
  // テスト全体のタイムアウト: 30 秒（デフォルト 30000ms を明示）
  timeout: 30000,
  reporter: 'html',
  use: {
    baseURL: 'http://localhost:5173',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    // expect アサーションのタイムアウト: 5 秒
    expect: {
      timeout: 5000,
    },
    // ナビゲーション（goto, reload など）のタイムアウト: 10 秒
    navigationTimeout: 10000,
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
      testMatch: /^(?!.*admin-dev-mode\.spec\.js$).*\.spec\.js$/,
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
