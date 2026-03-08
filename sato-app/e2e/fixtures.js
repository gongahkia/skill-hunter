import { test as base, expect } from '@playwright/test'

const APP_URL = 'http://127.0.0.1:41731'

async function safeJson(response) {
  try {
    return await response.json()
  } catch {
    return null
  }
}

export const test = base.extend({
  page: async ({ page, request }, use, testInfo) => {
    await request.post('/api/debug/e2e/reset')

    const consoleLogs = []
    const pageErrors = []
    const failedRequests = []

    page.on('console', (message) => {
      consoleLogs.push({
        type: message.type(),
        text: message.text(),
      })
    })

    page.on('pageerror', (error) => {
      pageErrors.push({
        message: error.message,
        stack: error.stack,
      })
    })

    page.on('requestfailed', (requestEvent) => {
      failedRequests.push({
        url: requestEvent.url(),
        method: requestEvent.method(),
        failure: requestEvent.failure(),
      })
    })

    await use(page)

    const failed = testInfo.status !== testInfo.expectedStatus
    if (!failed) {
      return
    }

    const clientEvents = await page.evaluate(() => window.__SATO_DEBUG__?.getEvents?.() || []).catch(() => [])
    const serverEventsResponse = await page.context().request.get('/api/debug/events').catch(() => null)
    const serverEvents = serverEventsResponse?.ok() ? await safeJson(serverEventsResponse) : []

    await testInfo.attach('browser-debug.json', {
      body: Buffer.from(JSON.stringify({
        consoleLogs,
        pageErrors,
        failedRequests,
        clientEvents,
      }, null, 2)),
      contentType: 'application/json',
    })

    await testInfo.attach('server-debug.json', {
      body: Buffer.from(JSON.stringify(serverEvents, null, 2)),
      contentType: 'application/json',
    })
  },
})

export async function seedSession(context, userId, options = {}) {
  const response = await context.request.post('/api/debug/e2e/session', {
    data: {
      user_id: userId,
      configure_credentials: options.configureCredentials ?? true,
    },
  })
  expect(response.ok()).toBeTruthy()
  return response.json()
}

export async function e2eLoginRedirect(page, userId, roomToken = '') {
  const target = roomToken
    ? `${APP_URL}/api/debug/e2e/login?user_id=${encodeURIComponent(userId)}&room=${encodeURIComponent(roomToken)}`
    : `${APP_URL}/api/debug/e2e/login?user_id=${encodeURIComponent(userId)}`

  await page.goto(target)
}

export { expect }
