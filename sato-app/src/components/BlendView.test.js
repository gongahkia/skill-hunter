import { flushPromises, mount } from '@vue/test-utils'

import BlendView from './BlendView.vue'
import { apiRequest } from '../lib/api'

vi.mock('../lib/api', () => ({
  apiRequest: vi.fn(),
}))

describe('BlendView', () => {
  beforeEach(() => {
    apiRequest.mockReset()
  })

  it('builds the preview payload from selected playlists and balanced weights', async () => {
    apiRequest
      .mockResolvedValueOnce({
        friends: [
          {
            id: 'alpha',
            name: 'Alpha',
            image: null,
            followers: 12,
            playlist_count: 2,
            playlists: [
              { id: 'first', name: 'First', track_count: 10 },
              { id: 'second', name: 'Second', track_count: 8 },
            ],
          },
        ],
        invalid_urls: [],
        unresolved_users: [],
      })
      .mockResolvedValueOnce({
        tracks: [],
        summary: {
          total_tracks: 0,
          selected_friends: [],
        },
      })

    const wrapper = mount(BlendView, {
      props: {
        user: {
          id: 'me',
          display_name: 'Sato Tester',
        },
      },
    })

    await wrapper.get('textarea').setValue('https://open.spotify.com/user/alpha')
    await wrapper.findAll('button').find((button) => button.text() === 'Load Friends').trigger('click')
    await flushPromises()

    const sliders = wrapper.findAll('input[type="range"]')
    await sliders[0].setValue(40)

    const playlistInputs = wrapper.findAll('.playlist-option input')
    await playlistInputs[1].setValue(false)

    await wrapper.findAll('button').find((button) => button.text() === 'Preview Blend').trigger('click')
    await flushPromises()

    expect(apiRequest).toHaveBeenNthCalledWith(
      2,
      '/api/blends/preview',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({
          self_weight: 40,
          friends: [
            {
              id: 'alpha',
              weight: 60,
              playlist_ids: ['first'],
            },
          ],
        }),
      }),
    )
  })
})
