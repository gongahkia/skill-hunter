import { e2eLoginRedirect, expect, seedSession, test } from './fixtures'

const APP_URL = 'http://127.0.0.1:41731'

test('saves Spotify credentials in the browser and records debug events', async ({ page }) => {
  await page.goto('/')

  await expect(page.getByRole('button', { name: 'Continue with Spotify' })).toBeDisabled()

  await page.getByLabel('Client ID').fill('e2e-client-id')
  await page.getByLabel('Client Secret').fill('e2e-client-secret')
  await page.getByRole('button', { name: 'Save Credentials' }).click()

  await expect(page.getByText('Spotify app credentials saved for this browser session.')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Continue with Spotify' })).toBeEnabled()

  const response = await page.context().request.get('/api/debug/events')
  const events = await response.json()

  expect(events.some((event) => event.kind === 'auth.spotify_config.updated')).toBeTruthy()
  expect(events.some((event) => event.kind === 'request.completed' && event.client_request_id)).toBeTruthy()
})

test('shows a clear error when Spotify app credentials are invalid', async ({ page }) => {
  await page.goto('/')

  await page.getByLabel('Client ID').fill('bad-client-id')
  await page.getByLabel('Client Secret').fill('bad-client-secret')
  await page.getByRole('button', { name: 'Save Credentials' }).click()

  await expect(page.getByText(/Spotify rejected these credentials/i)).toBeVisible()
  await expect(page.getByRole('button', { name: 'Continue with Spotify' })).toBeDisabled()

  const response = await page.context().request.get('/api/debug/events')
  const events = await response.json()

  expect(
    events.some(
      (event) => event.kind === 'request.completed'
        && event.path === '/api/auth/spotify-config'
        && event.status === 400,
    ),
  ).toBeTruthy()
})

test('host and guest can build a room blend and reopen Wrapped', async ({ page, browser }) => {
  await seedSession(page.context(), 'host')
  await page.goto('/')

  await expect(page.getByRole('button', { name: 'Create Room' })).toBeVisible()
  await page.getByRole('button', { name: 'Create Room' }).click()
  await expect(page.getByText('Room token')).toBeVisible()

  const inviteUrl = await page.locator('.inline-code').textContent()
  const roomToken = new URL(inviteUrl).searchParams.get('room')
  expect(roomToken).toBeTruthy()

  await page.getByLabel('Top Tracks').check()
  await page.locator('.playlist-option').filter({ hasText: 'Host Owned' }).getByRole('checkbox').check()
  await page.getByRole('button', { name: 'Save Contribution' }).click()
  await expect(page.getByText(/usable tracks saved/i)).toBeVisible()

  const guestContext = await browser.newContext()
  const guestPage = await guestContext.newPage()

  await e2eLoginRedirect(guestPage, 'guest', roomToken)
  await expect(guestPage.getByText('Spotify login completed. Your session is ready.')).toBeVisible()
  await expect(guestPage.getByRole('button', { name: 'Join This Room' })).toBeVisible()
  await guestPage.getByRole('button', { name: 'Join This Room' }).click()

  await guestPage.getByLabel('Saved Tracks').check()
  await guestPage.getByRole('button', { name: 'Save Contribution' }).click()
  await expect(guestPage.getByText(/usable tracks saved/i)).toBeVisible()

  await page.reload()
  await expect(page.getByText('Guest User')).toBeVisible()

  const weightInputs = page.locator('.weight-input')
  await weightInputs.nth(0).fill('60')
  await weightInputs.nth(1).fill('40')
  await page.getByRole('button', { name: 'Save Weights' }).click()

  await page.getByRole('button', { name: 'Preview Blend' }).click()
  await expect(page.getByText('Shared Track')).toBeVisible()

  await page.getByRole('button', { name: 'Create Playlist' }).click()
  await expect(page.getByText('Your room blend is live')).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Blend Wrapped' })).toBeVisible()

  for (let index = 0; index < 4; index += 1) {
    await page.getByRole('button', { name: 'Next' }).click()
  }
  await expect(page.getByText(/Most influential: Host User/i)).toBeVisible()

  await guestPage.goto(`${APP_URL}/?room=${roomToken}`)
  await expect(guestPage.getByRole('button', { name: 'Open Wrapped' })).toBeVisible()
  await guestPage.getByRole('button', { name: 'Open Wrapped' }).click()
  await expect(guestPage.getByRole('heading', { name: 'Blend Wrapped' })).toBeVisible()

  const debugResponse = await page.context().request.get('/api/debug/events')
  const debugEvents = await debugResponse.json()
  expect(debugEvents.some((event) => event.kind === 'room.playlist.created')).toBeTruthy()
  expect(debugEvents.some((event) => event.kind === 'room.wrapped.viewed')).toBeTruthy()

  await guestContext.close()
})
