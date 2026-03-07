import { apiRequest } from './api'

describe('apiRequest', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('uses relative paths and includes credentials', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      status: 200,
      text: () => Promise.resolve(JSON.stringify({ id: 'me' })),
    })

    const payload = await apiRequest('/api/me')

    expect(payload).toEqual({ id: 'me' })
    expect(fetchSpy).toHaveBeenCalledWith(
      '/api/me',
      expect.objectContaining({
        credentials: 'include',
      }),
    )
  })
})
