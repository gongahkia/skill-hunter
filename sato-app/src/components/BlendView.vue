<template>
  <section class="blend-shell">
    <article class="panel panel--resolve">
      <div class="panel-header">
        <div class="panel-title-group">
          <span class="panel-icon">
            <svg viewBox="0 0 24 24">
              <path d="M4 6h16M4 12h16M4 18h10" fill="none" stroke="currentColor" stroke-linecap="round" stroke-width="1.8" />
            </svg>
          </span>
          <div>
            <p class="eyebrow">Step 1</p>
            <h2>Resolve Friends</h2>
          </div>
        </div>
        <span class="panel-caption">Paste one Spotify profile URL per line.</span>
      </div>

      <label class="field-label" for="profile-urls">Spotify profile URLs</label>
      <textarea
        id="profile-urls"
        v-model="profileUrls"
        class="text-area"
        rows="6"
        placeholder="https://open.spotify.com/user/example"
      ></textarea>

      <div class="action-row">
        <button class="primary-button" type="button" :disabled="resolvingFriends" @click="resolveFriends">
          {{ resolvingFriends ? 'Resolving…' : 'Load Friends' }}
        </button>
        <p class="helper-copy">
          Sato keeps valid friends even when some URLs are invalid or unavailable.
        </p>
      </div>

      <div v-if="partialIssues.length" class="feedback-card feedback-card--warning">
        <h3>Partial Issues</h3>
        <ul>
          <li v-for="issue in partialIssues" :key="issue">{{ issue }}</li>
        </ul>
      </div>

      <p v-if="friends.length && !partialIssues.length" class="helper-copy helper-copy--success">
        {{ friends.length }} friend{{ friends.length === 1 ? '' : 's' }} resolved.
      </p>
    </article>

    <article v-if="friends.length" class="panel panel--weights">
      <div class="panel-header">
        <div class="panel-title-group">
          <span class="panel-icon panel-icon--green">
            <svg viewBox="0 0 24 24">
              <path d="M7 17 17 7M8 8h8v8" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" />
            </svg>
          </span>
          <div>
            <p class="eyebrow">Step 2</p>
            <h2>Budget the Blend</h2>
          </div>
        </div>
        <span class="panel-caption">Selected friend weights plus your weight must equal 100.</span>
      </div>

      <div class="weight-card">
        <div class="weight-card__top">
          <div>
            <p class="field-label field-label--compact">Your contribution</p>
            <p class="weight-value">{{ selfWeight.toFixed(2) }}%</p>
          </div>
          <span class="weight-pill">Owner share</span>
        </div>
        <input
          :value="selfWeight"
          class="weight-slider"
          min="0"
          max="100"
          step="0.01"
          type="range"
          @input="updateSelfWeight"
        />
      </div>

      <div class="budget-summary">
        <div class="budget-chip">
          <span>Total</span>
          <strong>{{ totalWeight.toFixed(2) }}%</strong>
        </div>
        <div class="budget-chip" :class="{ 'budget-chip--warning': remainingWeight !== 0 }">
          <span>Remaining</span>
          <strong>{{ remainingWeight.toFixed(2) }}%</strong>
        </div>
        <div class="budget-chip">
          <span>Selected Friends</span>
          <strong>{{ selectedFriends.length }}</strong>
        </div>
        <button class="ghost-button" type="button" @click="balanceWeights">
          Balance Weights
        </button>
      </div>

      <div class="friend-grid">
        <article
          v-for="friend in friends"
          :key="friend.id"
          class="friend-card"
          :class="{ 'friend-card--inactive': !friend.selected }"
        >
          <div class="friend-card__top">
            <label class="friend-toggle">
              <input
                v-model="friend.selected"
                type="checkbox"
                @change="toggleFriend(friend.id)"
              />
              <span>{{ friend.name }}</span>
            </label>
            <span class="friend-meta">{{ friend.followers }} followers</span>
          </div>

          <div class="friend-card__summary">
            <img
              v-if="friend.image"
              :src="friend.image"
              :alt="`${friend.name} profile image`"
              class="friend-image"
            />
            <div v-else class="friend-fallback">
              {{ friend.name.charAt(0).toUpperCase() }}
            </div>
            <div>
              <p>{{ friend.playlist_count }} public playlists available</p>
              <p class="friend-id">{{ friend.id }}</p>
            </div>
          </div>

          <template v-if="friend.selected">
            <div class="friend-weight">
              <div class="friend-weight__top">
                <span class="field-label field-label--compact">Friend weight</span>
                <strong>{{ Number(friend.weight).toFixed(2) }}%</strong>
              </div>
              <input
                v-model.number="friend.weight"
                class="weight-slider"
                min="0"
                max="100"
                step="0.01"
                type="range"
                @input="markPreviewDirty"
              />
            </div>

            <div class="playlist-picker">
              <div class="playlist-picker__top">
                <span class="field-label field-label--compact">Playlists used for this friend</span>
                <button
                  class="inline-button"
                  type="button"
                  @click="selectAllPlaylists(friend.id)"
                >
                  Select all
                </button>
              </div>

              <label
                v-for="playlist in friend.playlists"
                :key="playlist.id"
                class="playlist-option"
              >
                <input
                  v-model="friend.selectedPlaylistIds"
                  type="checkbox"
                  :value="playlist.id"
                  @change="markPreviewDirty"
                />
                <span>{{ playlist.name }}</span>
                <small>{{ playlist.track_count }} tracks</small>
              </label>
            </div>
          </template>
        </article>
      </div>
    </article>

    <article v-if="friends.length" class="panel panel--preview">
      <div class="panel-header">
        <div class="panel-title-group">
          <span class="panel-icon panel-icon--purple">
            <svg viewBox="0 0 24 24">
              <path d="M4 7h16M4 12h16M4 17h16" fill="none" stroke="currentColor" stroke-linecap="round" stroke-width="1.8" />
            </svg>
          </span>
          <div>
            <p class="eyebrow">Step 3</p>
            <h2>Preview and Create</h2>
          </div>
        </div>
        <span class="panel-caption">The preview and create endpoints use the same scorer.</span>
      </div>

      <label class="field-label" for="playlist-name">Playlist name</label>
      <input
        id="playlist-name"
        v-model="playlistName"
        class="text-input"
        maxlength="80"
        placeholder="Custom Blend"
        type="text"
      />

      <div v-if="validationMessage" class="feedback-card feedback-card--warning">
        {{ validationMessage }}
      </div>

      <div v-if="error" class="feedback-card feedback-card--error">
        {{ error }}
      </div>

      <div class="action-row action-row--dense">
        <button
          class="primary-button"
          type="button"
          :disabled="!canPreview || previewingBlend"
          @click="previewBlend"
        >
          {{ previewingBlend ? 'Building Preview…' : 'Preview Blend' }}
        </button>
        <button
          class="ghost-button"
          type="button"
          :disabled="!canPreview || creatingBlend"
          @click="createBlend"
        >
          {{ creatingBlend ? 'Creating Playlist…' : 'Create Playlist' }}
        </button>
      </div>

      <p class="helper-copy">
        {{
          previewDirty && preview
            ? 'The controls changed after the last preview. Preview again before creating if you want to verify the latest ranking.'
            : 'Preview shows the top ranked tracks and every source that contributed to them.'
        }}
      </p>

      <div v-if="preview" class="preview-shell">
        <div class="preview-summary">
          <div class="budget-chip">
            <span>Previewed tracks</span>
            <strong>{{ preview.summary.total_tracks }}</strong>
          </div>
          <div class="budget-chip">
            <span>Playlist limit</span>
            <strong>{{ preview.tracks.length }}</strong>
          </div>
          <div class="budget-chip">
            <span>Friends in blend</span>
            <strong>{{ preview.summary.selected_friends.length }}</strong>
          </div>
        </div>

        <div class="track-list">
          <article
            v-for="track in preview.tracks"
            :key="track.id"
            class="track-card"
          >
            <img
              v-if="track.image"
              :src="track.image"
              :alt="`${track.name} artwork`"
              class="track-image"
            />
            <div v-else class="track-image track-image--fallback">
              <svg viewBox="0 0 24 24">
                <circle cx="12" cy="12" r="10" fill="currentColor" />
                <path d="M8.2 10.4c2.9-1.1 6.7-.9 9 .6M8.8 13.3c2.1-.7 4.9-.5 6.6.5M9.6 16c1.4-.4 3.1-.3 4.3.3" fill="none" stroke="#121212" stroke-linecap="round" stroke-width="1.6" />
              </svg>
            </div>
            <div class="track-copy">
              <div class="track-copy__top">
                <div>
                  <h3>{{ track.name }}</h3>
                  <p>{{ track.artists.join(', ') || 'Unknown artist' }}</p>
                </div>
                <span class="score-pill">{{ track.score.toFixed(2) }}</span>
              </div>
              <div class="contributor-row">
                <span
                  v-for="contributor in track.contributors"
                  :key="`${track.id}-${contributor.source_id}`"
                  class="contributor-pill"
                >
                  {{ contributor.source_name }} · {{ contributor.weight.toFixed(2) }}%
                </span>
              </div>
            </div>
          </article>
        </div>
      </div>

      <div v-if="createdPlaylist" class="feedback-card feedback-card--success">
        <h3>Your blend is live</h3>
        <p>
          <strong>{{ createdPlaylist.name }}</strong> now exists in Spotify.
        </p>
        <a
          v-if="createdPlaylist.external_urls?.spotify"
          class="playlist-link"
          :href="createdPlaylist.external_urls.spotify"
          rel="noreferrer"
          target="_blank"
        >
          Open in Spotify
        </a>
      </div>
    </article>
  </section>
</template>

<script>
import { apiRequest } from '../lib/api'
import {
  buildBlendPayload,
  createFriendState,
  distributeFriendWeights,
  totalBlendWeight,
} from '../lib/blend'

export default {
  props: {
    user: {
      type: Object,
      required: true,
    },
  },
  data() {
    return {
      profileUrls: '',
      playlistName: '',
      selfWeight: 50,
      friends: [],
      preview: null,
      previewDirty: false,
      createdPlaylist: null,
      invalidUrls: [],
      unresolvedUsers: [],
      resolvingFriends: false,
      previewingBlend: false,
      creatingBlend: false,
      error: '',
    }
  },
  computed: {
    selectedFriends() {
      return this.friends.filter((friend) => friend.selected)
    },
    totalWeight() {
      return totalBlendWeight(this.selfWeight, this.friends)
    },
    remainingWeight() {
      return Number((100 - this.totalWeight).toFixed(2))
    },
    partialIssues() {
      return [
        ...this.invalidUrls.map((url) => `Invalid Spotify URL: ${url}`),
        ...this.unresolvedUsers.map((userId) => `Spotify user could not be resolved: ${userId}`),
      ]
    },
    validationMessage() {
      if (!this.selectedFriends.length) {
        return 'Select at least one friend before previewing a blend.'
      }

      const friendWithoutPlaylists = this.selectedFriends.find(
        (friend) => friend.selectedPlaylistIds.length === 0,
      )
      if (friendWithoutPlaylists) {
        return `${friendWithoutPlaylists.name} needs at least one playlist selected.`
      }

      if (this.remainingWeight !== 0) {
        return `The blend is off by ${Math.abs(this.remainingWeight).toFixed(2)}%. Rebalance or adjust the sliders until the total is exactly 100%.`
      }

      return ''
    },
    canPreview() {
      return !this.validationMessage && !this.resolvingFriends
    },
  },
  methods: {
    parseUrls() {
      return this.profileUrls
        .split('\n')
        .map((value) => value.trim())
        .filter(Boolean)
    },
    normalizeResolvedFriends(friends) {
      const nextFriends = friends.map((friend) => createFriendState(friend))
      return distributeFriendWeights(nextFriends, this.selfWeight)
    },
    markPreviewDirty() {
      this.previewDirty = true
      this.createdPlaylist = null
      this.error = ''
    },
    updateSelfWeight(event) {
      this.selfWeight = Number(event.target.value)
      this.friends = distributeFriendWeights(this.friends, this.selfWeight)
      this.markPreviewDirty()
    },
    toggleFriend(friendId) {
      this.friends = distributeFriendWeights(
        this.friends.map((friend) => {
          if (friend.id !== friendId) {
            return friend
          }

          return {
            ...friend,
            weight: friend.selected ? friend.weight : 0,
            selectedPlaylistIds: friend.selected
              ? (friend.selectedPlaylistIds.length ? friend.selectedPlaylistIds : friend.playlists.map((playlist) => playlist.id))
              : [],
          }
        }),
        this.selfWeight,
      )
      this.markPreviewDirty()
    },
    selectAllPlaylists(friendId) {
      this.friends = this.friends.map((friend) => {
        if (friend.id !== friendId) {
          return friend
        }

        return {
          ...friend,
          selectedPlaylistIds: friend.playlists.map((playlist) => playlist.id),
        }
      })
      this.markPreviewDirty()
    },
    balanceWeights() {
      this.friends = distributeFriendWeights(this.friends, this.selfWeight)
      this.markPreviewDirty()
    },
    previewPayload() {
      return buildBlendPayload(this.selfWeight, this.friends, this.playlistName)
    },
    async resolveFriends() {
      const urls = this.parseUrls()
      if (!urls.length) {
        this.error = 'Provide at least one Spotify profile URL.'
        return
      }

      this.error = ''
      this.preview = null
      this.createdPlaylist = null
      this.invalidUrls = []
      this.unresolvedUsers = []
      this.resolvingFriends = true

      try {
        const data = await apiRequest('/api/friends/resolve', {
          method: 'POST',
          body: JSON.stringify({ urls }),
        })
        this.friends = this.normalizeResolvedFriends(data.friends || [])
        this.invalidUrls = data.invalid_urls || []
        this.unresolvedUsers = data.unresolved_users || []
        this.previewDirty = true
      } catch (error) {
        this.error = error.message
        this.friends = []
      } finally {
        this.resolvingFriends = false
      }
    },
    async previewBlend() {
      if (!this.canPreview) {
        return
      }

      this.error = ''
      this.createdPlaylist = null
      this.previewingBlend = true

      try {
        const preview = await apiRequest('/api/blends/preview', {
          method: 'POST',
          body: JSON.stringify(this.previewPayload()),
        })
        this.preview = preview
        this.previewDirty = false
      } catch (error) {
        this.error = error.message
      } finally {
        this.previewingBlend = false
      }
    },
    async createBlend() {
      if (!this.canPreview) {
        return
      }

      this.error = ''
      this.creatingBlend = true

      try {
        const playlist = await apiRequest('/api/blends', {
          method: 'POST',
          body: JSON.stringify(this.previewPayload()),
        })
        this.createdPlaylist = playlist
        this.previewDirty = false
      } catch (error) {
        this.error = error.message
      } finally {
        this.creatingBlend = false
      }
    },
  },
}
</script>

<style scoped>
.blend-shell {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 1rem;
}

.panel {
  border-radius: 1rem;
  padding: 1.15rem;
  background: linear-gradient(180deg, rgba(255, 255, 255, 0.03), rgba(0, 0, 0, 0.08));
  border: 1px solid rgba(255, 255, 255, 0.05);
}

.panel--preview {
  grid-column: 1 / -1;
}

.panel-header,
.panel-title-group,
.friend-card__top,
.friend-card__summary,
.friend-weight__top,
.playlist-picker__top,
.track-copy__top,
.weight-card__top {
  display: flex;
  align-items: center;
  gap: 0.85rem;
}

.panel-header {
  justify-content: space-between;
  align-items: flex-start;
}

.panel-title-group {
  min-width: 0;
}

.panel-icon {
  width: 2.4rem;
  height: 2.4rem;
  border-radius: 0.8rem;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: rgba(255, 255, 255, 0.08);
  color: #ffffff;
  flex: none;
}

.panel-icon svg {
  width: 1.2rem;
  height: 1.2rem;
}

.panel-icon--green {
  background: rgba(30, 215, 96, 0.16);
  color: #d8ffe5;
}

.panel-icon--purple {
  background: rgba(125, 82, 255, 0.2);
  color: #ece6ff;
}

.eyebrow {
  margin: 0 0 0.22rem;
  color: var(--spotify-muted);
  font-size: 0.75rem;
  letter-spacing: 0.14em;
  text-transform: uppercase;
}

.panel-header h2,
.feedback-card h3,
.track-copy h3 {
  margin: 0;
}

.panel-caption,
.helper-copy,
.friend-id,
.friend-card__summary p,
.track-copy p,
.playlist-option small {
  color: var(--spotify-muted);
}

.field-label {
  display: block;
  margin-top: 1rem;
  color: #ffffff;
  font-size: 0.92rem;
  font-weight: 700;
}

.field-label--compact {
  margin-top: 0;
}

.text-area,
.text-input {
  width: 100%;
  margin-top: 0.6rem;
  padding: 0.95rem 1rem;
  border-radius: 0.9rem;
  border: 1px solid rgba(255, 255, 255, 0.08);
  background: #242424;
  color: #ffffff;
  font: inherit;
}

.text-area::placeholder,
.text-input::placeholder {
  color: #8a8a8a;
}

.text-area {
  resize: vertical;
  min-height: 9rem;
}

.action-row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.9rem;
  margin-top: 1rem;
}

.action-row--dense {
  margin-top: 1.25rem;
}

.primary-button,
.ghost-button,
.inline-button {
  border: none;
  cursor: pointer;
  font: inherit;
}

.primary-button,
.ghost-button {
  border-radius: 999px;
  padding: 0.85rem 1.2rem;
  font-weight: 700;
}

.primary-button {
  background: var(--spotify-accent);
  color: #121212;
}

.ghost-button,
.inline-button {
  background: #2a2a2a;
  color: #ffffff;
}

.inline-button {
  padding: 0.45rem 0.8rem;
  border-radius: 999px;
}

.primary-button:disabled,
.ghost-button:disabled {
  opacity: 0.55;
  cursor: not-allowed;
}

.feedback-card {
  margin-top: 1rem;
  border-radius: 0.95rem;
  padding: 1rem 1.05rem;
}

.feedback-card ul {
  margin: 0.6rem 0 0;
  padding-left: 1.1rem;
}

.feedback-card--warning {
  background: rgba(255, 184, 28, 0.16);
  color: #ffe3a6;
}

.feedback-card--error {
  background: rgba(235, 87, 87, 0.14);
  color: #ffd8d8;
}

.feedback-card--success {
  background: rgba(30, 215, 96, 0.16);
  color: #d8ffe5;
}

.helper-copy {
  margin: 0;
  font-size: 0.92rem;
}

.helper-copy--success {
  margin-top: 0.9rem;
  color: #d8ffe5;
}

.weight-card {
  margin-top: 1rem;
  padding: 1rem;
  border-radius: 1rem;
  background: #181818;
}

.weight-card__top {
  justify-content: space-between;
}

.weight-value {
  margin: 0.25rem 0 0;
  font-size: 2rem;
  font-weight: 700;
}

.weight-pill {
  padding: 0.45rem 0.8rem;
  border-radius: 999px;
  background: rgba(30, 215, 96, 0.14);
  color: #d8ffe5;
  font-size: 0.84rem;
}

.weight-slider {
  width: 100%;
  margin-top: 0.9rem;
  accent-color: var(--spotify-accent);
}

.budget-summary,
.preview-summary {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.75rem;
  margin-top: 1rem;
}

.budget-chip {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.75rem 0.9rem;
  border-radius: 999px;
  background: #202020;
  color: #ffffff;
}

.budget-chip--warning {
  background: rgba(235, 87, 87, 0.16);
}

.friend-grid,
.track-list {
  display: grid;
  gap: 0.9rem;
  margin-top: 1rem;
}

.friend-card,
.track-card {
  border-radius: 0.95rem;
  padding: 0.95rem;
  background: #181818;
  border: 1px solid rgba(255, 255, 255, 0.04);
}

.friend-card--inactive {
  opacity: 0.68;
}

.friend-card__top,
.track-copy__top,
.weight-card__top,
.playlist-picker__top,
.friend-weight__top {
  justify-content: space-between;
}

.friend-toggle {
  display: inline-flex;
  align-items: center;
  gap: 0.65rem;
  font-weight: 700;
}

.friend-toggle input,
.playlist-option input {
  accent-color: var(--spotify-accent);
}

.friend-meta {
  color: var(--spotify-muted);
  font-size: 0.88rem;
}

.friend-card__summary {
  margin-top: 0.75rem;
  align-items: center;
}

.friend-image,
.friend-fallback {
  width: 3.1rem;
  height: 3.1rem;
  border-radius: 0.8rem;
  flex: none;
}

.friend-image {
  object-fit: cover;
}

.friend-fallback {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: #2a2a2a;
  color: white;
  font-weight: 700;
}

.friend-weight,
.playlist-picker {
  margin-top: 1rem;
}

.playlist-picker {
  display: grid;
  gap: 0.55rem;
}

.playlist-option {
  display: grid;
  grid-template-columns: auto 1fr auto;
  gap: 0.65rem;
  align-items: center;
  padding: 0.72rem 0.8rem;
  border-radius: 0.85rem;
  background: #202020;
}

.preview-shell {
  margin-top: 1rem;
  display: grid;
  gap: 1rem;
}

.track-card {
  display: grid;
  grid-template-columns: 76px 1fr;
  gap: 0.9rem;
  align-items: start;
}

.track-image {
  width: 76px;
  height: 76px;
  border-radius: 0.9rem;
  object-fit: cover;
}

.track-image--fallback {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, #1ed760, #509bf5);
  color: #121212;
}

.track-image--fallback svg {
  width: 2rem;
  height: 2rem;
}

.score-pill,
.contributor-pill {
  display: inline-flex;
  align-items: center;
  border-radius: 999px;
}

.score-pill {
  padding: 0.5rem 0.8rem;
  background: rgba(30, 215, 96, 0.16);
  color: #d8ffe5;
  font-weight: 700;
}

.contributor-row {
  display: flex;
  flex-wrap: wrap;
  gap: 0.55rem;
  margin-top: 0.75rem;
}

.contributor-pill {
  padding: 0.45rem 0.75rem;
  background: #202020;
  color: #ffffff;
  font-size: 0.88rem;
}

.playlist-link {
  color: inherit;
  font-weight: 700;
}

@media (max-width: 980px) {
  .blend-shell {
    grid-template-columns: 1fr;
  }

  .panel--preview {
    grid-column: auto;
  }
}

@media (max-width: 720px) {
  .panel {
    padding: 1rem;
  }

  .panel-header,
  .panel-title-group,
  .friend-card__top,
  .friend-card__summary,
  .track-copy__top,
  .weight-card__top,
  .playlist-picker__top,
  .friend-weight__top {
    flex-direction: column;
    align-items: flex-start;
  }

  .action-row {
    flex-direction: column;
    align-items: stretch;
  }

  .track-card {
    grid-template-columns: 1fr;
  }

  .track-image,
  .track-image--fallback {
    width: 100%;
    height: auto;
    aspect-ratio: 1 / 1;
  }
}
</style>
