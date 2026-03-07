function roundToTwo(value) {
  return Number(Number(value).toFixed(2))
}

export function createFriendState(friend) {
  return {
    ...friend,
    selected: true,
    weight: 0,
    selectedPlaylistIds: (friend.playlists || []).map((playlist) => playlist.id),
  }
}

export function distributeFriendWeights(friends, selfWeight) {
  const selectedFriends = friends.filter((friend) => friend.selected)
  const remainingWeight = Math.max(0, Math.round((100 - Number(selfWeight)) * 100))

  if (!selectedFriends.length) {
    return friends.map((friend) => ({
      ...friend,
      weight: 0,
    }))
  }

  const baseWeight = Math.floor(remainingWeight / selectedFriends.length)
  let extraWeight = remainingWeight - (baseWeight * selectedFriends.length)

  return friends.map((friend) => {
    if (!friend.selected) {
      return {
        ...friend,
        weight: 0,
      }
    }

    const nextWeight = baseWeight + (extraWeight > 0 ? 1 : 0)
    if (extraWeight > 0) {
      extraWeight -= 1
    }

    return {
      ...friend,
      weight: roundToTwo(nextWeight / 100),
      selectedPlaylistIds: friend.selectedPlaylistIds?.length
        ? friend.selectedPlaylistIds
        : (friend.playlists || []).map((playlist) => playlist.id),
    }
  })
}

export function totalBlendWeight(selfWeight, friends) {
  const friendWeight = friends
    .filter((friend) => friend.selected)
    .reduce((total, friend) => total + Number(friend.weight || 0), 0)
  return roundToTwo(Number(selfWeight || 0) + friendWeight)
}

export function buildBlendPayload(selfWeight, friends, name = '') {
  const payload = {
    self_weight: roundToTwo(selfWeight),
    friends: friends
      .filter((friend) => friend.selected)
      .map((friend) => ({
        id: friend.id,
        weight: roundToTwo(friend.weight),
        playlist_ids: friend.selectedPlaylistIds?.length
          ? [...friend.selectedPlaylistIds]
          : (friend.playlists || []).map((playlist) => playlist.id),
      })),
  }

  const trimmedName = name.trim()
  if (trimmedName) {
    payload.name = trimmedName
  }

  return payload
}
