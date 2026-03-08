import { flushPromises, mount } from '@vue/test-utils'

import App from './App.vue'
import { apiRequest } from './lib/api'

vi.mock('./lib/api', () => ({
  apiRequest: vi.fn(),
}))

vi.mock('./components/BlendView.vue', () => ({
  default: {
    name: 'BlendView',
    template: '<div />',
  },
}))

describe('App', () => {
  beforeEach(() => {
    apiRequest.mockReset()
  })

  it('lets the user save Spotify credentials in the web app before login', async () => {
    apiRequest
      .mockResolvedValueOnce({
        configured: false,
        client_id: '',
        redirect_uri: 'http://127.0.0.1:5000/api/auth/callback',
        source: null,
      })
      .mockRejectedValueOnce({
        status: 401,
      })
      .mockResolvedValueOnce({
        configured: true,
        client_id: 'browser-client-id',
        redirect_uri: 'http://127.0.0.1:5000/api/auth/callback',
        source: 'session',
      })

    const wrapper = mount(App)
    await flushPromises()

    const signInButton = wrapper.findAll('button').find((button) => button.text() === 'Sign in with Spotify')
    expect(signInButton.attributes('disabled')).toBeDefined()

    const inputs = wrapper.findAll('.config-input')
    await inputs[0].setValue('browser-client-id')
    await inputs[1].setValue('browser-client-secret')
    await wrapper.get('.config-form').trigger('submit')
    await flushPromises()

    expect(apiRequest).toHaveBeenNthCalledWith(
      3,
      '/api/auth/spotify-config',
      {
        method: 'POST',
        body: JSON.stringify({
          client_id: 'browser-client-id',
          client_secret: 'browser-client-secret',
        }),
      },
    )
    expect(wrapper.text()).toContain('Spotify app credentials saved for this browser session.')

    const updatedSignInButton = wrapper.findAll('button').find((button) => button.text() === 'Sign in with Spotify')
    expect(updatedSignInButton.attributes('disabled')).toBeUndefined()
  })

  it('explains Spotify server_error failures with the exact redirect URI to register', async () => {
    window.history.replaceState({}, '', '/?login=error&reason=server_error')
    apiRequest
      .mockResolvedValueOnce({
        configured: true,
        client_id: 'browser-client-id',
        redirect_uri: 'http://127.0.0.1:5001/api/auth/callback',
        source: 'session',
      })
      .mockRejectedValueOnce({
        status: 401,
      })

    const wrapper = mount(App)
    await flushPromises()

    expect(wrapper.text()).toContain('Spotify returned server_error during login.')
    expect(wrapper.text()).toContain('http://127.0.0.1:5001/api/auth/callback')
    expect(new URL(window.location.href).searchParams.get('login')).toBeNull()
    expect(new URL(window.location.href).searchParams.get('reason')).toBeNull()
  })
})
