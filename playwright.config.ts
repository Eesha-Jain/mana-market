import { defineConfig, devices } from '@playwright/test';

const localBaseURL = 'http://127.0.0.1:4173';
const devBaseURL = 'http://127.0.0.1:5173';
const productionBaseURL =
  process.env.PLAYWRIGHT_BASE_URL?.trim() || 'https://mana-market-peach.vercel.app';

/** Which preview server to start: local (test build), dev (vite), or none (live URL only). */
const serverMode = process.env.PW_SERVER ?? 'local';

const webServerByMode = {
  local: {
    command: 'npm run build:test && npm run preview -- --host 127.0.0.1 --port 4173',
    url: localBaseURL,
    reuseExistingServer: false,
    timeout: 120_000,
  },
  dev: {
    command: 'npm run dev -- --host 127.0.0.1 --port 5173',
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
