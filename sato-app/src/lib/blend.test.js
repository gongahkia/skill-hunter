import {
  buildBlendPayload,
  createFriendState,
  distributeFriendWeights,
  totalBlendWeight,
} from './blend'

describe('blend helpers', () => {
  it('balances selected friend weights to keep the total at 100', () => {
    const friends = distributeFriendWeights(
      [
        {
          id: 'alpha',
          selected: true,
          playlists: [{ id: 'alpha-playlist' }],
          selectedPlaylistIds: ['alpha-playlist'],
        },
        {
          id: 'beta',
          selected: true,
          playlists: [{ id: 'beta-playlist' }],
          selectedPlaylistIds: ['beta-playlist'],
        },
        {
          id: 'gamma',
          selected: false,
          playlists: [{ id: 'gamma-playlist' }],
          selectedPlaylistIds: [],
        },
      ],
      35,
    )

    expect(totalBlendWeight(35, friends)).toBe(100)
    expect(friends[2].weight).toBe(0)
  })

  it('builds the blend payload using selected playlists and trimmed names', () => {
    const payload = buildBlendPayload(
      40,
      [
        {
          id: 'alpha',
          selected: true,
          weight: 60,
          playlists: [{ id: 'alpha-public' }, { id: 'alpha-deepcuts' }],
          selectedPlaylistIds: ['alpha-public'],
        },
        {
          id: 'beta',
          selected: false,
          weight: 0,
          playlists: [{ id: 'beta-public' }],
          selectedPlaylistIds: [],
        },
      ],
      '  Night Shift  ',
    )

    expect(payload).toEqual({
      self_weight: 40,
      friends: [
        {
          id: 'alpha',
          weight: 60,
          playlist_ids: ['alpha-public'],
        },
      ],
      name: 'Night Shift',
    })
  })

  it('creates selectable friend state from resolved API data', () => {
    const friend = createFriendState({
      id: 'alpha',
      playlists: [{ id: 'first' }, { id: 'second' }],
    })

    expect(friend.selected).toBe(true)
    expect(friend.weight).toBe(0)
    expect(friend.selectedPlaylistIds).toEqual(['first', 'second'])
  })
})
