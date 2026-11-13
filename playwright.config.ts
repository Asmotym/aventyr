import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: './tests/browser',
  timeout: 30000,
  use: {
    baseURL: 'http://127.0.0.1:5179',
    headless: true,
    launchOptions: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH } : {},
  },
  webServer: { command: 'npm run dev -- --host 127.0.0.1 --port 5179', url: 'http://127.0.0.1:5179', reuseExistingServer: !process.env.CI },
});
