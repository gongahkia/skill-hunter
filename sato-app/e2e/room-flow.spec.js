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

test('blocks the host from leaving a populated room and cleans up when the room empties', async ({ page, browser }) => {
  await seedSession(page.context(), 'host')
  await page.goto('/')
  await page.getByRole('button', { name: 'Create Room' }).click()

  const inviteUrl = await page.locator('.inline-code').textContent()
  const roomToken = new URL(inviteUrl).searchParams.get('room')
  expect(roomToken).toBeTruthy()

  const guestContext = await browser.newContext()
  const guestPage = await guestContext.newPage()

  await e2eLoginRedirect(guestPage, 'guest', roomToken)
  await expect(guestPage.getByRole('button', { name: 'Leave Room' })).toBeVisible()

  await page.reload()
  await expect(page.locator('.member-card').filter({ hasText: 'Guest User' })).toBeVisible()

  await page.getByRole('button', { name: 'Leave Room' }).click()
  await expect(page.getByText(/host cannot leave while other members are still in the room/i)).toBeVisible()

  await guestPage.getByRole('button', { name: 'Leave Room' }).click()
  await expect(guestPage.getByRole('button', { name: 'Create Room' })).toBeVisible()

  await page.reload()
  await page.getByRole('button', { name: 'Leave Room' }).click()
  await expect(page.getByRole('button', { name: 'Create Room' })).toBeVisible()

  const response = await page.context().request.get('/api/debug/events')
  const events = await response.json()

  expect(events.some((event) => event.kind === 'room.left' && event.user_id === 'guest')).toBeTruthy()
  expect(events.some((event) => event.kind === 'room.deleted' && event.room_token === roomToken)).toBeTruthy()

  await guestContext.close()
})

test('keeps host-only weight and create controls locked for guests', async ({ page, browser }) => {
  await seedSession(page.context(), 'host')
  await page.goto('/')
  await page.getByRole('button', { name: 'Create Room' }).click()

  const inviteUrl = await page.locator('.inline-code').textContent()
  const roomToken = new URL(inviteUrl).searchParams.get('room')
  expect(roomToken).toBeTruthy()

  await page.getByLabel('Top Tracks').check()
  await page.getByRole('button', { name: 'Save Contribution' }).click()
  await expect(page.getByText(/usable tracks saved/i)).toBeVisible()

  const guestContext = await browser.newContext()
  const guestPage = await guestContext.newPage()

  await e2eLoginRedirect(guestPage, 'guest', roomToken)
  await guestPage.getByLabel('Saved Tracks').check()
  await guestPage.getByRole('button', { name: 'Save Contribution' }).click()

  await expect(guestPage.locator('.weight-input')).toHaveCount(2)
  await expect(guestPage.getByRole('button', { name: 'Preview Blend' })).toBeDisabled()
  await expect(guestPage.getByRole('button', { name: 'Create Playlist' })).toBeDisabled()
  await expect(guestPage.getByRole('button', { name: 'Save Weights' })).toHaveCount(0)
  await expect(guestPage.locator('.weight-input').nth(0)).toBeDisabled()
  await expect(guestPage.locator('.weight-input').nth(1)).toBeDisabled()

  const weightsResponse = await guestPage.context().request.patch(`/api/rooms/${roomToken}/weights`, {
    data: {
      members: [
        { id: 'host', weight: 50 },
        { id: 'guest', weight: 50 },
      ],
    },
  })
  expect(weightsResponse.status()).toBe(403)
  await expect((await weightsResponse.json()).error.message).toMatch(/Only the room host can perform that action/i)

  await guestContext.close()
})

test('recovers cleanly when a room token is missing or expired', async ({ page }) => {
  await seedSession(page.context(), 'host')
  await page.goto('/?room=missing-room')

  await expect(page.getByText(/That blend room was not found or has expired/i)).toBeVisible()
  await expect(page.getByRole('button', { name: 'Create Room' })).toBeVisible()
  await expect.poll(() => new URL(page.url()).searchParams.get('room')).toBeNull()

  const clientEvents = await page.evaluate(() => window.__SATO_DEBUG__?.getEvents?.() || [])
  expect(clientEvents.some((event) => event.type === 'room.cleared')).toBeTruthy()

  const response = await page.context().request.get('/api/debug/events')
  const events = await response.json()

  expect(
    events.some(
      (event) => event.kind === 'request.completed'
        && event.path === '/api/rooms/missing-room'
        && event.status === 404,
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
  await expect(guestPage.getByText('Your contribution', { exact: true })).toBeVisible()

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

  for (let index = 0; index < 5; index += 1) {
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
