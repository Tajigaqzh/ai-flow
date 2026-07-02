import { defineConfig, devices } from '@playwright/test';
import { getWebEnv } from './scripts/web-env.cjs';

const webEnv = getWebEnv();

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'html',
  use: {
    baseURL: webEnv.baseURL,
    trace: 'on-first-retry',
  },
  webServer: {
    command: `pnpm dev:web -- --port ${webEnv.port}`,
    url: webEnv.baseURL,
    reuseExistingServer: !process.env.CI,
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});
