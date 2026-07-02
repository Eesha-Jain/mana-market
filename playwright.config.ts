import { defineConfig, devices } from '@playwright/test';

const localBaseURL = 'http://127.0.0.1:3000';
const devBaseURL = 'http://127.0.0.1:3000';
const productionBaseURL =
  process.env.PLAYWRIGHT_BASE_URL?.trim() || 'https://mana-market-eta.vercel.app';

/** Which preview server to start: local (test build), dev (next dev), or none (live URL only). */
const serverMode = process.env.PW_SERVER ?? 'local';

const webServerByMode = {
  local: {
    command: 'npm run build:test && npm run start -- -p 3000',
    url: localBaseURL,
    reuseExistingServer: false,
    timeout: 180_000,
  },
  dev: {
    command: 'npm run dev -- -p 3000',
    url: devBaseURL,
    reuseExistingServer: true,
    timeout: 120_000,
  },
  none: undefined,
} as const;

export default defineConfig({
  testDir: './tests',
  fullyParallel: true,
  retries: 0,
  timeout: 60_000,
  reporter: [['list'], ['html', { open: 'never', outputFolder: 'playwright-report' }]],
  use: {
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  ...(webServerByMode[serverMode as keyof typeof webServerByMode]
    ? { webServer: webServerByMode[serverMode as keyof typeof webServerByMode] }
    : {}),
  projects: [
    {
      name: 'local',
      testMatch: ['**/*.spec.ts', '!**/production.spec.ts'],
      use: {
        ...devices['Desktop Chrome'],
        baseURL: localBaseURL,
      },
    },
    {
      name: 'dev',
      testMatch: ['**/diagnostic.spec.ts', '**/smoke.spec.ts'],
      use: {
        ...devices['Desktop Chrome'],
        baseURL: devBaseURL,
      },
    },
    {
      name: 'production',
      testMatch: ['**/diagnostic.spec.ts', '**/production.spec.ts'],
      use: {
        ...devices['Desktop Chrome'],
        baseURL: productionBaseURL,
      },
    },
  ],
});
