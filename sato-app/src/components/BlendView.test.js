import { flushPromises, mount } from '@vue/test-utils'

import BlendView from './BlendView.vue'
import { apiRequest } from '../lib/api'

vi.mock('../lib/api', () => ({
  apiRequest: vi.fn(),
}))

function makeRoom(overrides = {}) {
  return {
    token: 'room-123',
    invite_url: 'http://localhost:5173/?room=room-123',
    role: 'host',
    host_id: 'host',
    playlist_name: "Host User's Sato Blend",
    expires_at: '2026-03-15T00:00:00Z',
    created_playlist: null,
    has_wrapped: false,
    members: [
      {
        id: 'host',
        display_name: 'Host User',
        image: null,
        weight: 0,
        has_contribution: false,
        track_count: 0,
        source_summary: {},
        updated_at: '2026-03-08T00:00:00Z',
      },
    ],
    contribution: {
      use_top_tracks: false,
      use_saved_tracks: false,
      use_recent_tracks: false,
      playlist_ids: [],
      source_summary: {},
      track_count: 0,
      updated_at: null,
    },
    ...overrides,
  }
}

function makeSourceCatalog() {
  return {
    top_tracks: { available: true, count: 2, cap: 50 },
    saved_tracks: { available: true, count: 3, cap: 500 },
    recent_tracks: { available: true, count: 1, cap: 50 },
    playlists: [
      { id: 'host-owned', name: 'Host Owned', track_count: 12 },
      { id: 'collab-owned', name: 'Collab Owned', track_count: 8 },
    ],
    playlist_limits: { max_selected: 5, per_playlist_track_cap: 500 },
  }
}

function makePreview() {
  return {
    tracks: [
      {
        id: 'shared-track',
        name: 'Shared Track',
        artists: ['Shared Artist'],
        image: null,
        score: 100,
        contributors: [
          { source_id: 'host', source_name: 'Host User', weight: 60 },
          { source_id: 'guest', source_name: 'Guest User', weight: 40 },
        ],
      },
    ],
    summary: {
      total_tracks: 6,
      total_contributors: 2,
      contributors: [
        { id: 'host', name: 'Host User', weight: 60, track_count: 3 },
        { id: 'guest', name: 'Guest User', weight: 40, track_count: 3 },
      ],
    },
  }
}

function makeWrapped() {
  return {
    playlist_id: 'playlist-123',
    playlist_name: 'Room Blend',
    generated_at: '2026-03-08T12:00:00Z',
    cards: [
      {
        type: 'cover',
        playlist_name: 'Room Blend',
        room_token: 'room-123',
        contributor_count: 2,
        generated_at: '2026-03-08T12:00:00Z',
      },
      {
        type: 'summary',
        total_ranked_tracks: 6,
        tracks_added: 6,
        total_contributors: 2,
        weights: [
          { id: 'host', name: 'Host User', weight: 60 },
          { id: 'guest', name: 'Guest User', weight: 40 },
        ],
      },
      {
        type: 'contributors',
        members: [
          { id: 'host', name: 'Host User', weight: 60, surviving_tracks: 4 },
          { id: 'guest', name: 'Guest User', weight: 40, surviving_tracks: 2 },
        ],
      },
      {
        type: 'top_tracks',
        tracks: [
          { id: 'shared-track', name: 'Shared Track', artists: ['Shared Artist'], score: 100, contributors: [] },
        ],
      },
      {
        type: 'blend_character',
        shared_favorites: 1,
        most_influential_member: { id: 'host', name: 'Host User', value: 4 },
        most_unique_member: { id: 'guest', name: 'Guest User', value: 2 },
      },
    ],
  }
}

async function clickButton(wrapper, label) {
  const button = wrapper.findAll('button').find((candidate) => candidate.text() === label)
  expect(button, `Expected to find button "${label}"`).toBeTruthy()
  await button.trigger('click')
}

describe('BlendView', () => {
  beforeEach(() => {
    apiRequest.mockReset()
    window.history.replaceState({}, '', '/')
  })

  it('creates a room and loads the current user source catalog', async () => {
    apiRequest
      .mockResolvedValueOnce({
        ...makeRoom(),
      })
      .mockResolvedValueOnce(makeSourceCatalog())

    const wrapper = mount(BlendView, {
      props: {
        user: {
          id: 'host',
          display_name: 'Host User',
        },
      },
    })

    await clickButton(wrapper, 'Create Room')
    await flushPromises()

    expect(apiRequest).toHaveBeenNthCalledWith(
      1,
      '/api/rooms',
      { method: 'POST' },
    )
    expect(apiRequest).toHaveBeenNthCalledWith(2, '/api/me/source-catalog')
    expect(wrapper.text()).toContain('room-123')
    expect(wrapper.text()).toContain('Your contribution')
    expect(new URL(window.location.href).searchParams.get('room')).toBe('room-123')
  })

  it('auto-joins a room token when the current room exists but the user is not a member yet', async () => {
    window.history.replaceState({}, '', '/?room=room-join')
    const accessDenied = Object.assign(new Error('Join this room before accessing it.'), {
      payload: {
        error: {
          code: 'room_access_denied',
        },
      },
    })

    apiRequest
      .mockRejectedValueOnce(accessDenied)
      .mockResolvedValueOnce(makeRoom({
        token: 'room-join',
        invite_url: 'http://localhost:5173/?room=room-join',
        role: 'member',
        members: [
          {
            id: 'host',
            display_name: 'Host User',
            image: null,
            weight: 100,
            has_contribution: true,
            track_count: 3,
            source_summary: { top_tracks_count: 3 },
            updated_at: '2026-03-08T10:00:00Z',
          },
          {
            id: 'guest',
            display_name: 'Guest User',
            image: null,
            weight: 0,
            has_contribution: false,
            track_count: 0,
            source_summary: {},
            updated_at: '2026-03-08T10:05:00Z',
          },
        ],
        contribution: {
          use_top_tracks: false,
          use_saved_tracks: false,
          use_recent_tracks: false,
          playlist_ids: [],
          source_summary: {},
          track_count: 0,
          updated_at: null,
        },
      }))
      .mockResolvedValueOnce(makeSourceCatalog())

    const wrapper = mount(BlendView, {
      props: {
        user: {
          id: 'guest',
          display_name: 'Guest User',
        },
      },
    })
    await flushPromises()

    expect(apiRequest).toHaveBeenNthCalledWith(1, '/api/rooms/room-join')
    expect(apiRequest).toHaveBeenNthCalledWith(2, '/api/rooms/room-join/join', { method: 'POST' })
    expect(apiRequest).toHaveBeenNthCalledWith(3, '/api/me/source-catalog')
    expect(wrapper.text()).toContain('Your contribution')
  })

  it('saves the current member contribution from supported Spotify sources', async () => {
    window.history.replaceState({}, '', '/?room=room-123')
    const updatedRoom = makeRoom({
      members: [
        {
          id: 'host',
          display_name: 'Host User',
          image: null,
          weight: 100,
          has_contribution: true,
          track_count: 3,
          source_summary: {
            top_tracks_count: 2,
            saved_tracks_count: 0,
            recent_tracks_count: 0,
            playlist_count: 1,
            playlist_track_count: 1,
          },
          updated_at: '2026-03-08T10:10:00Z',
        },
      ],
      contribution: {
        use_top_tracks: true,
        use_saved_tracks: false,
        use_recent_tracks: false,
        playlist_ids: ['host-owned'],
        source_summary: {
          top_tracks_count: 2,
          saved_tracks_count: 0,
          recent_tracks_count: 0,
          playlist_count: 1,
          playlist_track_count: 1,
        },
        track_count: 3,
        updated_at: '2026-03-08T10:10:00Z',
      },
    })

    apiRequest
      .mockResolvedValueOnce(makeRoom())
      .mockResolvedValueOnce(makeSourceCatalog())
      .mockResolvedValueOnce({
        room: updatedRoom,
        contribution: updatedRoom.contribution,
      })

    const wrapper = mount(BlendView, {
      props: {
        user: {
          id: 'host',
          display_name: 'Host User',
        },
      },
    })
    await flushPromises()

    const sourceInputs = wrapper.findAll('.source-option input')
    await sourceInputs[0].setValue(true)
    await wrapper.find('.playlist-option input').setValue(true)
    await clickButton(wrapper, 'Save Contribution')
    await flushPromises()

    expect(apiRequest).toHaveBeenNthCalledWith(
      3,
      '/api/rooms/room-123/contribution',
      {
        method: 'PUT',
        body: JSON.stringify({
          use_top_tracks: true,
          use_saved_tracks: false,
          use_recent_tracks: false,
          playlist_ids: ['host-owned'],
        }),
      },
    )
    expect(wrapper.text()).toContain('3 usable tracks saved')
  })

  it('lets the host save weights, preview the room blend, and create wrapped output', async () => {
    window.history.replaceState({}, '', '/?room=room-123')
    const room = makeRoom({
      members: [
        {
          id: 'host',
          display_name: 'Host User',
          image: null,
          weight: 50,
          has_contribution: true,
          track_count: 3,
          source_summary: { top_tracks_count: 2, playlist_count: 1 },
          updated_at: '2026-03-08T10:10:00Z',
        },
        {
          id: 'guest',
          display_name: 'Guest User',
          image: null,
          weight: 50,
          has_contribution: true,
          track_count: 3,
          source_summary: { saved_tracks_count: 3 },
          updated_at: '2026-03-08T10:11:00Z',
        },
      ],
      contribution: {
        use_top_tracks: true,
        use_saved_tracks: false,
        use_recent_tracks: false,
        playlist_ids: ['host-owned'],
        source_summary: { top_tracks_count: 2, playlist_count: 1 },
        track_count: 3,
        updated_at: '2026-03-08T10:10:00Z',
      },
    })
    const updatedRoom = makeRoom({
      ...room,
      members: [
        {
          ...room.members[0],
          weight: 60,
        },
        {
          ...room.members[1],
          weight: 40,
        },
      ],
    })
    const preview = makePreview()
    const wrapped = makeWrapped()

    apiRequest
      .mockResolvedValueOnce(room)
      .mockResolvedValueOnce(makeSourceCatalog())
      .mockResolvedValueOnce(updatedRoom)
      .mockResolvedValueOnce(preview)
      .mockResolvedValueOnce({
        playlist: {
          id: 'playlist-123',
          name: 'Room Blend',
          external_urls: {
            spotify: 'https://open.spotify.com/playlist/playlist-123',
          },
        },
        summary: preview.summary,
        wrapped,
      })

    const wrapper = mount(BlendView, {
      props: {
        user: {
          id: 'host',
          display_name: 'Host User',
        },
      },
    })
    await flushPromises()

    const weightInputs = wrapper.findAll('.weight-input')
    await weightInputs[0].setValue('60')
    await weightInputs[1].setValue('40')
    await clickButton(wrapper, 'Save Weights')
    await flushPromises()
    await clickButton(wrapper, 'Preview Blend')
    await flushPromises()
    await clickButton(wrapper, 'Create Playlist')
    await flushPromises()

    expect(apiRequest).toHaveBeenNthCalledWith(
      3,
      '/api/rooms/room-123/weights',
      {
        method: 'PATCH',
        body: JSON.stringify({
          members: [
            { id: 'host', weight: 60 },
            { id: 'guest', weight: 40 },
          ],
        }),
      },
    )
    expect(apiRequest).toHaveBeenNthCalledWith(4, '/api/rooms/room-123/preview', { method: 'POST' })
    expect(apiRequest).toHaveBeenNthCalledWith(5, '/api/rooms/room-123/create', { method: 'POST' })
    expect(wrapper.text()).toContain('Your room blend is live')
    expect(wrapper.text()).toContain('Blend Wrapped')
    await clickButton(wrapper, 'Next')
    await clickButton(wrapper, 'Next')
    await clickButton(wrapper, 'Next')
    await clickButton(wrapper, 'Next')
    expect(wrapper.text()).toContain('Most influential: Host User (4)')
  })
})
