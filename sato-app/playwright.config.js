import { defineConfig, devices } from '@playwright/test'

const appUrl = 'http://127.0.0.1:41731'
const backendUrl = 'http://127.0.0.1:5001'

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  timeout: 30_000,
  expect: {
    timeout: 5_000,
  },
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: appUrl,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
      },
    },
  ],
  webServer: [
    {
      command: `cd ../backend && SATO_E2E=1 SATO_DEBUG_LOGGING=1 CLIENT_APP_URL=${appUrl} SPOTIFY_REDIRECT_URI=${backendUrl}/api/auth/callback .venv/bin/python -c "from app import app; app.run(host='127.0.0.1', port=5001, debug=False, use_reloader=False)"`,
      url: `${backendUrl}/api/debug/events`,
      reuseExistingServer: false,
      timeout: 30_000,
    },
    {
      command: `VITE_API_PROXY_TARGET=${backendUrl} npm run dev -- --host 127.0.0.1 --port 41731`,
      url: appUrl,
      reuseExistingServer: false,
      timeout: 30_000,
    },
  ],
})
