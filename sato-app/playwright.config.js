import { defineConfig, devices } from '@playwright/test'

const backendPort = Number(process.env.SATO_E2E_BACKEND_PORT || 5001)
const appPort = Number(process.env.SATO_E2E_FRONTEND_PORT || 41731)
const backendUrl = process.env.SATO_E2E_BACKEND_URL || `http://127.0.0.1:${backendPort}`
const appUrl = process.env.SATO_E2E_APP_URL || `http://127.0.0.1:${appPort}`
const backendPython = process.env.SATO_E2E_BACKEND_PYTHON || '.venv/bin/python'

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
      command: `cd ../backend && SATO_E2E=1 SATO_DEBUG_LOGGING=1 CLIENT_APP_URL=${appUrl} SPOTIFY_REDIRECT_URI=${backendUrl}/api/auth/callback ${backendPython} -c "from app import app; app.run(host='127.0.0.1', port=${backendPort}, debug=False, use_reloader=False)"`,
      url: `${backendUrl}/api/debug/events`,
      reuseExistingServer: false,
      timeout: 30_000,
    },
    {
      command: `VITE_API_PROXY_TARGET=${backendUrl} npm run dev -- --host 127.0.0.1 --port ${appPort}`,
      url: appUrl,
      reuseExistingServer: false,
      timeout: 30_000,
    },
  ],
})
