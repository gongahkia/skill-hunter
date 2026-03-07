<template>
  <section class="blend-shell">
    <article class="panel">
      <div class="panel-header">
        <div>
          <p class="eyebrow">Step 1</p>
          <h2>Resolve Friends</h2>
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

      <p v-if="friends.length && !partialIssues.length" class="helper-copy">
        {{ friends.length }} friend{{ friends.length === 1 ? '' : 's' }} resolved.
      </p>
    </article>

    <article v-if="friends.length" class="panel">
      <div class="panel-header">
        <div>
          <p class="eyebrow">Step 2</p>
          <h2>Budget the Blend</h2>
        </div>
        <span class="panel-caption">Selected friend weights plus your weight must equal 100.</span>
      </div>

      <div class="weight-card">
        <div>
          <p class="field-label">Your contribution</p>
          <p class="weight-value">{{ selfWeight.toFixed(2) }}%</p>
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
            <div>
              <p>{{ friend.playlist_count }} public playlists available</p>
              <p class="friend-id">{{ friend.id }}</p>
            </div>
          </div>

          <template v-if="friend.selected">
            <div class="friend-weight">
              <div class="friend-weight__top">
                <span class="field-label">Friend weight</span>
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
                <span class="field-label">Playlists used for this friend</span>
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

    <article v-if="friends.length" class="panel">
      <div class="panel-header">
        <div>
          <p class="eyebrow">Step 3</p>
          <h2>Preview and Create</h2>
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
  gap: 1.5rem;
}

.panel {
  border-radius: 1.75rem;
  padding: 1.75rem;
  background: rgba(255, 250, 243, 0.92);
  border: 1px solid rgba(16, 29, 25, 0.1);
  box-shadow: 0 18px 60px rgba(31, 27, 22, 0.08);
}

.panel-header {
  display: flex;
  justify-content: space-between;
  gap: 1rem;
  align-items: baseline;
}

.panel-header h2,
.feedback-card h3,
.track-copy h3 {
  margin: 0;
}

.panel-caption,
.helper-copy,
.friend-id,
.track-copy p,
.playlist-option small {
  color: var(--color-muted);
}

.field-label {
  display: block;
  margin-top: 1rem;
  font-size: 0.92rem;
  font-weight: 700;
}

.text-area,
.text-input {
  width: 100%;
  margin-top: 0.6rem;
  padding: 0.95rem 1rem;
  border-radius: 1rem;
  border: 1px solid rgba(16, 29, 25, 0.12);
  background: rgba(255, 255, 255, 0.74);
  color: var(--color-text);
  font: inherit;
  box-sizing: border-box;
}

.text-area {
  resize: vertical;
  min-height: 9rem;
}

.action-row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 1rem;
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
  padding: 0.85rem 1.15rem;
  font-weight: 700;
}

.primary-button {
  background: linear-gradient(135deg, var(--color-accent), #2d6d59);
  color: white;
  box-shadow: 0 12px 24px rgba(45, 109, 89, 0.28);
}

.primary-button:disabled,
.ghost-button:disabled {
  opacity: 0.55;
  cursor: not-allowed;
  box-shadow: none;
}

.ghost-button,
.inline-button {
  background: rgba(16, 29, 25, 0.06);
  color: var(--color-text);
}

.inline-button {
  padding: 0.45rem 0.8rem;
  border-radius: 999px;
}

.feedback-card {
  margin-top: 1rem;
  border-radius: 1.25rem;
  padding: 1rem 1.1rem;
}

.feedback-card ul {
  margin: 0.7rem 0 0;
  padding-left: 1.1rem;
}

.feedback-card--warning {
  background: rgba(255, 193, 7, 0.16);
}

.feedback-card--error {
  background: rgba(208, 62, 47, 0.14);
  color: #8d2a21;
}

.feedback-card--success {
  background: rgba(52, 168, 83, 0.14);
  color: #1f5130;
}

.weight-card {
  display: grid;
  gap: 0.85rem;
  margin-top: 1rem;
  padding: 1rem;
  border-radius: 1.25rem;
  background: rgba(255, 255, 255, 0.74);
}

.weight-value {
  margin: 0.4rem 0 0;
  font-size: 2rem;
  font-weight: 700;
}

.weight-slider {
  width: 100%;
  accent-color: var(--color-accent);
}

.budget-summary,
.preview-summary {
  display: flex;
  flex-wrap: wrap;
  gap: 0.85rem;
  align-items: center;
  margin-top: 1rem;
}

.budget-chip {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.75rem 0.9rem;
  border-radius: 999px;
  background: rgba(16, 29, 25, 0.06);
}

.budget-chip--warning {
  background: rgba(208, 62, 47, 0.14);
}

.friend-grid {
  display: grid;
  gap: 1rem;
  margin-top: 1.25rem;
}

.friend-card {
  border-radius: 1.35rem;
  border: 1px solid rgba(16, 29, 25, 0.08);
  padding: 1rem;
  background: rgba(255, 255, 255, 0.72);
}

.friend-card--inactive {
  opacity: 0.7;
}

.friend-card__top,
.friend-card__summary,
.friend-weight__top,
.playlist-picker__top,
.track-copy__top {
  display: flex;
  justify-content: space-between;
  gap: 1rem;
  align-items: center;
}

.friend-toggle {
  display: inline-flex;
  align-items: center;
  gap: 0.65rem;
  font-weight: 700;
}

.friend-card__summary {
  justify-content: flex-start;
  margin-top: 0.75rem;
}

.friend-image,
.track-image {
  object-fit: cover;
}

.friend-image {
  width: 54px;
  height: 54px;
  border-radius: 18px;
}

.friend-weight,
.playlist-picker {
  margin-top: 1rem;
}

.playlist-picker {
  display: grid;
  gap: 0.6rem;
}

.playlist-option {
  display: grid;
  grid-template-columns: auto 1fr auto;
  gap: 0.6rem;
  align-items: center;
  padding: 0.7rem 0.8rem;
  border-radius: 0.9rem;
  background: rgba(16, 29, 25, 0.04);
}

.preview-shell {
  margin-top: 1.25rem;
  display: grid;
  gap: 1rem;
}

.track-list {
  display: grid;
  gap: 0.9rem;
}

.track-card {
  display: grid;
  grid-template-columns: 76px 1fr;
  gap: 0.9rem;
  padding: 0.95rem;
  border-radius: 1.25rem;
  background: rgba(255, 255, 255, 0.72);
  border: 1px solid rgba(16, 29, 25, 0.08);
}

.track-image {
  width: 76px;
  height: 76px;
  border-radius: 1rem;
}

.track-copy__top {
  align-items: flex-start;
}

.track-copy p {
  margin: 0.25rem 0 0;
}

.score-pill,
.contributor-pill {
  display: inline-flex;
  align-items: center;
  border-radius: 999px;
}

.score-pill {
  padding: 0.5rem 0.8rem;
  background: rgba(45, 109, 89, 0.12);
  font-weight: 700;
}

.contributor-row {
  display: flex;
  flex-wrap: wrap;
  gap: 0.55rem;
  margin-top: 0.8rem;
}

.contributor-pill {
  padding: 0.45rem 0.7rem;
  background: rgba(16, 29, 25, 0.06);
  font-size: 0.9rem;
}

.playlist-link {
  color: inherit;
  font-weight: 700;
}

@media (max-width: 720px) {
  .panel {
    padding: 1.25rem;
    border-radius: 1.25rem;
  }

  .panel-header,
  .friend-card__top,
  .friend-card__summary,
  .friend-weight__top,
  .playlist-picker__top,
  .track-copy__top {
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

  .track-image {
    width: 100%;
    height: auto;
    aspect-ratio: 1 / 1;
  }
}
</style>
