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
        source: null,
      })
      .mockRejectedValueOnce({
        status: 401,
      })
      .mockResolvedValueOnce({
        configured: true,
        client_id: 'browser-client-id',
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
})
