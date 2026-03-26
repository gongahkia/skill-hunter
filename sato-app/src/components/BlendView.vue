<template>
  <section class="blend-shell">
    <article class="panel panel--room">
      <div class="panel-header">
        <div class="panel-title-group">
          <span class="panel-icon">
            <svg viewBox="0 0 24 24">
              <path d="M4 6h16M4 12h16M4 18h10" fill="none" stroke="currentColor" stroke-linecap="round" stroke-width="1.8" />
            </svg>
          </span>
          <div>
            <p class="eyebrow">Step 1</p>
            <h2>Create or Join a Room</h2>
          </div>
        </div>
        <span class="panel-caption">Room links auto-join now, and the member list stays fresh with lightweight polling.</span>
      </div>

      <div v-if="!roomToken" class="room-actions">
        <button class="primary-button" type="button" :disabled="creatingRoom" @click="createRoom">
          {{ creatingRoom ? 'Creating Room…' : 'Create Room' }}
        </button>

        <div class="join-shell">
          <label class="field-label" for="room-token">Join an existing room</label>
          <div class="lookup-row">
            <input
              id="room-token"
              v-model.trim="joinTokenInput"
              class="text-input"
              type="text"
              placeholder="Paste a room token"
            />
            <button class="ghost-button" type="button" :disabled="joiningRoom || !joinTokenInput" @click="joinRoom(joinTokenInput)">
              {{ joiningRoom ? 'Joining…' : 'Join Room' }}
            </button>
          </div>
        </div>
      </div>

      <template v-else>
        <div class="room-card">
          <div>
            <p class="field-label field-label--compact">Room token</p>
            <strong>{{ roomToken }}</strong>
          </div>
          <button class="ghost-button" type="button" :disabled="leavingRoom" @click="leaveRoom">
            {{ leavingRoom ? 'Leaving…' : 'Leave Room' }}
          </button>
        </div>

        <div v-if="room" class="invite-card">
          <div>
            <p class="field-label field-label--compact">Invite URL</p>
            <code class="inline-code">{{ room.invite_url }}</code>
          </div>
          <button class="inline-button" type="button" @click="copyInviteUrl">
            {{ copyStatus || 'Copy Link' }}
          </button>
        </div>

        <div v-if="roomNeedsJoin" class="feedback-card feedback-card--warning">
          <p class="field-label field-label--compact">Room access</p>
          <p>This room exists. Sato will try to auto-join on load, but you can still retry manually here.</p>
          <button class="primary-button" type="button" :disabled="joiningRoom" @click="joinRoom(roomToken)">
            {{ joiningRoom ? 'Joining…' : 'Join This Room' }}
          </button>
        </div>

        <div v-else-if="room" class="room-state">
          <div class="room-summary">
            <div class="budget-chip">
              <span>Role</span>
              <strong>{{ room.role === 'host' ? 'Host' : 'Member' }}</strong>
            </div>
            <div class="budget-chip">
              <span>Room members</span>
              <strong>{{ room.members.length }}</strong>
            </div>
            <div class="budget-chip">
              <span>Expires</span>
              <strong>{{ formatDate(room.expires_at) }}</strong>
            </div>
            <div class="budget-chip">
              <span>Updated</span>
              <strong>{{ formatDate(room.updated_at) }}</strong>
            </div>
          </div>

          <div class="source-editor">
            <div class="source-editor__top">
              <div>
                <p class="field-label field-label--compact">Your contribution</p>
                <p class="helper-copy helper-copy--subtle">
                  Source counts and playlists load lazily and stay cached for the rest of your session unless you refresh them.
                </p>
              </div>
              <button class="ghost-button" type="button" :disabled="loadingCatalog" @click="loadSourceCatalog({ force: true })">
                {{ loadingCatalog ? 'Refreshing…' : 'Refresh Sources' }}
              </button>
            </div>

            <div v-if="loadingCatalog && !sourceCatalog" class="feedback-card feedback-card--neutral">
              Loading your Spotify source counts and playlists…
            </div>

            <template v-if="sourceCatalog">
              <div class="source-grid">
                <label class="source-option">
                  <input v-model="contributionForm.useTopTracks" type="checkbox" @change="markContributionDirty" />
                  <span>
                    <strong>Top Tracks</strong>
                    <small>{{ sourceCatalog.top_tracks.count }} available, capped at {{ sourceCatalog.top_tracks.cap }}</small>
                  </span>
                </label>

                <label class="source-option">
                  <input v-model="contributionForm.useSavedTracks" type="checkbox" @change="markContributionDirty" />
                  <span>
                    <strong>Saved Tracks</strong>
                    <small>{{ sourceCatalog.saved_tracks.count }} available, capped at {{ sourceCatalog.saved_tracks.cap }}</small>
                  </span>
                </label>

                <label class="source-option">
                  <input v-model="contributionForm.useRecentTracks" type="checkbox" @change="markContributionDirty" />
                  <span>
                    <strong>Recently Played</strong>
                    <small>{{ sourceCatalog.recent_tracks.count }} available, capped at {{ sourceCatalog.recent_tracks.cap }}</small>
                  </span>
                </label>
              </div>

              <div class="mood-picker" v-if="moodProfiles">
                <label class="source-option">
                  <input v-model="contributionForm.useMoodTracks" type="checkbox" @change="markContributionDirty" />
                  <span>
                    <strong>Mood-Based Tracks</strong>
                    <small>Spotify recommendations tuned to your current mood</small>
                  </span>
                </label>
                <div v-if="contributionForm.useMoodTracks" class="mood-selector">
                  <button
                    v-for="(profile, key) in moodProfiles"
                    :key="key"
                    type="button"
                    class="mood-chip"
                    :class="{ 'mood-chip--active': contributionForm.moodState === key }"
                    :style="contributionForm.moodState === key ? { background: profile.color, color: '#fff' } : { borderColor: profile.color, color: profile.color }"
                    @click="contributionForm.moodState = key; markContributionDirty()"
                  >
                    {{ profile.label }}
                  </button>
                </div>
              </div>

              <div class="playlist-picker">
                <div class="playlist-picker__top">
                  <span class="field-label field-label--compact">Owned or collaborative playlists</span>
                  <small class="helper-copy">
                    Select up to {{ sourceCatalog.playlist_limits.max_selected }} playlists.
                  </small>
                </div>

                <label
                  v-for="playlist in sourceCatalog.playlists"
                  :key="playlist.id"
                  class="playlist-option"
                >
                  <input
                    v-model="contributionForm.playlistIds"
                    type="checkbox"
                    :value="playlist.id"
                    :disabled="playlistDisabled(playlist.id)"
                    @change="markContributionDirty"
                  />
                  <span>{{ playlist.name }}</span>
                  <small>{{ playlist.track_count }} tracks</small>
                </label>

                <p v-if="!sourceCatalog.playlists.length" class="helper-copy helper-copy--subtle">
                  No owned or collaborative playlists are available in this account.
                </p>
              </div>
            </template>

            <div class="action-row">
              <button class="primary-button" type="button" :disabled="savingContribution || !canSaveContribution" @click="saveContribution">
                {{ savingContribution ? 'Saving Contribution…' : 'Save Contribution' }}
              </button>
              <p class="helper-copy">
                {{ contributionSummary }}
              </p>
            </div>
          </div>
        </div>
      </template>

      <div v-if="error" class="feedback-card feedback-card--error">
        {{ error }}
      </div>
    </article>

    <article v-if="room" class="panel panel--members">
      <div class="panel-header">
        <div class="panel-title-group">
          <span class="panel-icon panel-icon--green">
            <svg viewBox="0 0 24 24">
              <path d="M7 17 17 7M8 8h8v8" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" />
            </svg>
          </span>
          <div>
            <p class="eyebrow">Step 2</p>
            <h2>Members and Weights</h2>
          </div>
        </div>
        <span class="panel-caption">Weights stay auto-normalized to 100%, and hosts can use equalize or host-lead presets instead of hand-balancing raw numbers.</span>
      </div>

      <label class="field-label" for="playlist-name">Playlist name</label>
      <input
        id="playlist-name"
        v-model="playlistNameDraft"
        class="text-input"
        maxlength="80"
        type="text"
        placeholder="Sato Blend"
        :disabled="!isHost"
        @input="settingsDirty = true"
      />
      <div v-if="isHost" class="action-row action-row--dense">
        <button class="ghost-button" type="button" :disabled="savingSettings" @click="saveSettings">
          {{ savingSettings ? 'Saving…' : 'Save Playlist Name' }}
        </button>
      </div>

      <div class="member-list">
        <article
          v-for="member in room.members"
          :key="member.id"
          class="member-card"
        >
          <div class="member-card__top">
            <div>
              <strong>{{ member.display_name }}</strong>
              <p class="member-meta">{{ member.id }}</p>
            </div>
            <span class="score-pill">
              {{ member.has_contribution ? `${member.track_count} tracks` : 'Waiting' }}
            </span>
          </div>

          <div class="member-summary">
            <p>{{ memberSummary(member) }}</p>
            <p class="member-meta">Updated {{ formatDate(member.updated_at) }}</p>
          </div>

          <div class="member-weight">
            <div class="member-weight__header">
              <span class="field-label field-label--compact">Weight</span>
              <strong>{{ weightDraft(member.id).toFixed(2) }}%</strong>
            </div>
            <div class="weight-control">
              <input
                class="weight-slider"
                type="range"
                min="0"
                max="100"
                step="0.5"
                :value="weightDraft(member.id)"
                :disabled="!isHost || !member.has_contribution"
                @input="updateWeight(member.id, $event)"
              />
              <input
                class="text-input weight-input"
                type="number"
                min="0"
                max="100"
                step="0.5"
                :value="weightDraft(member.id)"
                :disabled="!isHost || !member.has_contribution"
                @input="updateWeight(member.id, $event)"
              />
            </div>
          </div>
        </article>
      </div>

      <div class="budget-summary">
        <div class="budget-chip">
          <span>Contributors</span>
          <strong>{{ contributingMembers.length }}</strong>
        </div>
        <div class="budget-chip" :class="{ 'budget-chip--warning': weightsTotal !== 100 }">
          <span>Total</span>
          <strong>{{ weightsTotal.toFixed(2) }}%</strong>
        </div>
        <div class="budget-chip">
          <span>Positive Weights</span>
          <strong>{{ positiveWeightMembers }}</strong>
        </div>
        <div v-if="isHost" class="budget-summary__actions">
          <button class="inline-button" type="button" @click="balanceWeights">
            Equalize
          </button>
          <button v-if="canBoostHost" class="inline-button" type="button" @click="boostHostWeights">
            Boost Host
          </button>
        </div>
      </div>

      <div v-if="isHost" class="action-row action-row--dense">
        <button class="primary-button" type="button" :disabled="savingWeights || !canSaveWeights" @click="saveWeights">
          {{ savingWeights ? 'Saving Weights…' : 'Save Weights' }}
        </button>
        <p class="helper-copy">
          {{ weightValidationMessage }}
        </p>
      </div>
    </article>

    <article v-if="room" class="panel panel--preview">
      <div class="panel-header">
        <div class="panel-title-group">
          <span class="panel-icon panel-icon--purple">
            <svg viewBox="0 0 24 24">
              <path d="M4 7h16M4 12h16M4 17h16" fill="none" stroke="currentColor" stroke-linecap="round" stroke-width="1.8" />
            </svg>
          </span>
          <div>
            <p class="eyebrow">Step 3</p>
            <h2>Preview, Create, and Wrapped</h2>
          </div>
        </div>
        <span class="panel-caption">Preview and create use the same weighted scorer, plus a generated cover and overlap analysis.</span>
      </div>

      <div class="action-row action-row--dense">
        <button
          class="primary-button"
          type="button"
          :disabled="!canPreviewRoom || previewingRoom"
          @click="previewRoom"
        >
          {{ previewingRoom ? 'Building Preview…' : 'Preview Blend' }}
        </button>
        <button
          class="ghost-button"
          type="button"
          :disabled="!canCreateBlend || creatingBlend"
          @click="createBlend"
        >
          {{ creatingBlend ? 'Creating Playlist…' : 'Create Playlist' }}
        </button>
        <button
          v-if="room.has_wrapped"
          class="inline-button"
          type="button"
          :disabled="loadingWrapped"
          @click="loadWrapped"
        >
          {{ loadingWrapped ? 'Opening Wrapped…' : 'Open Wrapped' }}
        </button>
      </div>

      <p class="helper-copy">{{ previewReadinessMessage }}</p>

      <div v-if="preview" class="preview-shell">
        <div class="preview-hero">
          <img
            v-if="preview.cover_art"
            :src="preview.cover_art"
            alt="Generated blend cover art"
            class="preview-cover"
          />
          <div class="preview-insights">
            <div class="preview-summary">
              <div class="budget-chip">
                <span>Unique ranked tracks</span>
                <strong>{{ preview.summary.total_tracks }}</strong>
              </div>
              <div class="budget-chip">
                <span>Previewed tracks</span>
                <strong>{{ preview.tracks.length }}</strong>
              </div>
              <div class="budget-chip">
                <span>Contributors</span>
                <strong>{{ preview.summary.total_contributors }}</strong>
              </div>
            </div>

            <div v-if="preview.summary.overlap_stats" class="overlap-card">
              <p class="eyebrow">Overlap</p>
              <h3>Why this blend feels cohesive</h3>
              <p>{{ preview.summary.overlap_stats.shared_tracks }} tracks were shared picks.</p>
              <p>{{ preview.summary.overlap_stats.unique_tracks }} tracks are single-member standouts.</p>
              <p>{{ preview.summary.overlap_stats.average_contributors_per_track.toFixed(2) }} contributors appeared on each preview track on average.</p>
              <p v-if="preview.summary.overlap_stats.strongest_pair">
                Strongest overlap: {{ preview.summary.overlap_stats.strongest_pair.label }}
                with {{ preview.summary.overlap_stats.strongest_pair.shared_tracks }} shared tracks.
              </p>
            </div>
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
              <p class="track-reason">{{ track.why_it_ranked }}</p>
              <small class="helper-copy track-breakdown">{{ track.score_breakdown }}</small>
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
        <div class="playlist-success">
          <img
            v-if="createdPlaylist.cover_art"
            :src="createdPlaylist.cover_art"
            alt="Generated playlist cover art"
            class="playlist-success__cover"
          />
          <div>
            <h3>Your room blend is live</h3>
            <p><strong>{{ createdPlaylist.name }}</strong> now exists in Spotify.</p>
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
        </div>
      </div>

      <div v-if="wrapped" class="wrapped-shell">
        <div class="wrapped-header">
          <div>
            <p class="eyebrow">Step 4</p>
            <h3>Blend Wrapped</h3>
          </div>
          <div class="wrapped-actions">
            <button class="inline-button" type="button" @click="shareWrapped">
              {{ shareStatus || 'Share Recap' }}
            </button>
            <button class="inline-button" type="button" @click="downloadWrapped">
              {{ exportStatus || 'Export JSON' }}
            </button>
            <button class="inline-button" type="button" @click="downloadCoverArt">
              Download Cover
            </button>
          </div>
          <div class="wrapped-controls">
            <button class="inline-button" type="button" :disabled="wrappedIndex === 0" @click="previousWrappedCard">
              Prev
            </button>
            <span>{{ wrappedIndex + 1 }} / {{ wrapped.cards.length }}</span>
            <button class="inline-button" type="button" :disabled="wrappedIndex >= wrapped.cards.length - 1" @click="nextWrappedCard">
              Next
            </button>
          </div>
        </div>

        <article class="wrapped-card">
          <template v-if="currentWrappedCard?.type === 'cover'">
            <p class="eyebrow">Cover</p>
            <img
              v-if="currentWrappedCard.cover_art"
              :src="currentWrappedCard.cover_art"
              alt="Generated wrapped cover art"
              class="wrapped-cover"
            />
            <h4>{{ currentWrappedCard.playlist_name }}</h4>
            <p>Room {{ currentWrappedCard.room_token }}</p>
            <p>{{ currentWrappedCard.contributor_count }} contributors</p>
            <p>Generated {{ formatDate(currentWrappedCard.generated_at) }}</p>
          </template>

          <template v-else-if="currentWrappedCard?.type === 'summary'">
            <p class="eyebrow">Mix Summary</p>
            <h4>{{ wrapped.playlist_name }}</h4>
            <p>{{ currentWrappedCard.total_ranked_tracks }} unique ranked tracks fed the final mix.</p>
            <p>{{ currentWrappedCard.tracks_added }} tracks were added to Spotify.</p>
            <p>{{ currentWrappedCard.overlap_stats?.shared_tracks ?? wrapped.overlap_stats?.shared_tracks ?? 0 }} of those ranked tracks were shared picks.</p>
            <div class="wrapped-chip-row">
              <span
                v-for="weight in currentWrappedCard.weights"
                :key="weight.id"
                class="contributor-pill"
              >
                {{ weight.name }} · {{ weight.weight.toFixed(2) }}%
              </span>
            </div>
          </template>

          <template v-else-if="currentWrappedCard?.type === 'overlap'">
            <p class="eyebrow">Overlap</p>
            <h4>Shared taste vs wild cards</h4>
            <p>{{ currentWrappedCard.shared_tracks }} shared picks made the final ranking.</p>
            <p>{{ currentWrappedCard.unique_tracks }} tracks were one-person curveballs.</p>
            <p>{{ currentWrappedCard.average_contributors_per_track.toFixed(2) }} contributors appeared on each top track on average.</p>
            <p v-if="currentWrappedCard.strongest_pair">
              Strongest overlap: {{ currentWrappedCard.strongest_pair.label }}
              with {{ currentWrappedCard.strongest_pair.shared_tracks }} shared tracks.
            </p>
          </template>

          <template v-else-if="currentWrappedCard?.type === 'contributors'">
            <p class="eyebrow">Contributors</p>
            <h4>Who shaped the blend</h4>
            <div class="wrapped-list">
              <div
                v-for="member in currentWrappedCard.members"
                :key="member.id"
                class="wrapped-list__row"
              >
                <strong>{{ member.name }}</strong>
                <span>{{ member.weight.toFixed(2) }}%</span>
                <small>{{ member.surviving_tracks }} surviving tracks</small>
              </div>
            </div>
          </template>

          <template v-else-if="currentWrappedCard?.type === 'top_tracks'">
            <p class="eyebrow">Top Tracks</p>
            <h4>Top five in final order</h4>
            <div class="wrapped-list">
              <div
                v-for="track in currentWrappedCard.tracks"
                :key="track.id"
                class="wrapped-list__row wrapped-list__row--stacked"
              >
                <strong>{{ track.name }}</strong>
                <span>{{ track.artists.join(', ') || 'Unknown artist' }}</span>
                <small>{{ track.score.toFixed(2) }} · {{ track.why_it_ranked }}</small>
              </div>
            </div>
          </template>

          <template v-else-if="currentWrappedCard?.type === 'blend_character'">
            <p class="eyebrow">Blend Character</p>
            <h4>The room chemistry</h4>
            <p>{{ currentWrappedCard.shared_favorites }} tracks were shared favorites.</p>
            <p>Most influential: {{ currentWrappedCard.most_influential_member.name }} ({{ currentWrappedCard.most_influential_member.value }})</p>
            <p>Most unique: {{ currentWrappedCard.most_unique_member.name }} ({{ currentWrappedCard.most_unique_member.value }})</p>
          </template>
        </article>
      </div>
    </article>
  </section>
</template>

<script>
import { apiRequest, fetchMoodProfiles } from '../lib/api'
import { logClientEvent } from '../lib/debug'
import {
  buildWeightsPayload,
  distributeMemberWeights,
  emphasizeMemberWeights,
  normalizeMemberWeights,
  totalAssignedWeight,
} from '../lib/blend'

const ROOM_POLL_INTERVAL_MS = 8000

function dataUrlToBlob(dataUrl) {
  const [metadata, encoded] = dataUrl.split(',', 2)
  const mimeType = metadata.match(/data:(.*?);base64/)?.[1] || 'application/octet-stream'
  const binary = window.atob(encoded)
  const bytes = new Uint8Array(binary.length)
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index)
  }
  return new Blob([bytes], { type: mimeType })
}

export default {
  props: {
    user: {
      type: Object,
      required: true,
    },
  },
  data() {
    return {
      roomToken: '',
      joinTokenInput: '',
      room: null,
      roomNeedsJoin: false,
      sourceCatalog: null,
      sourceCatalogPromise: null,
      contributionForm: {
        useTopTracks: false,
        useSavedTracks: false,
        useRecentTracks: false,
        useMoodTracks: false,
        moodState: null,
        playlistIds: [],
      },
      moodProfiles: null,
      playlistNameDraft: '',
      weightDrafts: {},
      creatingRoom: false,
      joiningRoom: false,
      leavingRoom: false,
      loadingCatalog: false,
      savingContribution: false,
      savingWeights: false,
      savingSettings: false,
      previewingRoom: false,
      creatingBlend: false,
      loadingWrapped: false,
      roomPollTimer: null,
      roomPollInFlight: false,
      contributionDirty: false,
      weightsDirty: false,
      settingsDirty: false,
      preview: null,
      createdPlaylist: null,
      wrapped: null,
      wrappedIndex: 0,
      copyStatus: '',
      shareStatus: '',
      exportStatus: '',
      error: '',
    }
  },
  computed: {
    isHost() {
      return this.room?.role === 'host'
    },
    contributingMembers() {
      return (this.room?.members || []).filter((member) => member.has_contribution)
    },
    hostMember() {
      return (this.room?.members || []).find((member) => member.id === this.room?.host_id) || null
    },
    canBoostHost() {
      return this.isHost && this.contributingMembers.length >= 2 && Boolean(this.hostMember?.has_contribution)
    },
    canSaveContribution() {
      return (
        this.contributionForm.useTopTracks
        || this.contributionForm.useSavedTracks
        || this.contributionForm.useRecentTracks
        || this.contributionForm.playlistIds.length > 0
      )
    },
    weightPayloadMembers() {
      return (this.room?.members || []).map((member) => ({
        ...member,
        hasContribution: member.has_contribution,
        weight: Number(this.weightDraft(member.id)),
      }))
    },
    weightsTotal() {
      return totalAssignedWeight(this.weightPayloadMembers)
    },
    positiveWeightMembers() {
      return this.weightPayloadMembers.filter((member) => member.hasContribution && Number(member.weight) > 0).length
    },
    canSaveWeights() {
      return (
        this.isHost
        && this.contributingMembers.length >= 2
        && this.weightsTotal === 100
        && this.positiveWeightMembers >= 2
      )
    },
    hasUnsavedChanges() {
      return this.contributionDirty || this.weightsDirty || this.settingsDirty
    },
    canPreviewRoom() {
      return this.canSaveWeights && !this.previewingRoom && !this.savingWeights && !this.hasUnsavedChanges
    },
    canCreateBlend() {
      return this.canPreviewRoom && Boolean(this.preview) && !this.creatingBlend
    },
    contributionSummary() {
      const contribution = this.room?.contribution
      if (!contribution?.track_count) {
        return 'No contribution snapshot saved yet.'
      }

      return `${contribution.track_count} usable tracks saved from your selected Spotify sources.`
    },
    weightValidationMessage() {
      if (!this.isHost) {
        return 'Only the host can assign room weights.'
      }
      if (this.contributingMembers.length < 2) {
        return 'Wait for at least two members to save a contribution before weighting the room.'
      }
      if (this.positiveWeightMembers < 2) {
        return 'Keep at least two contributors above 0%.'
      }
      if (this.weightsTotal !== 100) {
        return `Weights are off by ${Math.abs(100 - this.weightsTotal).toFixed(2)}%.`
      }
      if (this.weightsDirty) {
        return 'Weights are auto-normalized. Save them before previewing.'
      }
      return 'Weights are synced with the room.'
    },
    previewReadinessMessage() {
      if (!this.isHost) {
        return 'Waiting for the host to preview and create the room blend.'
      }
      if (this.hasUnsavedChanges) {
        return 'Save your latest contribution, weight draft, or playlist name before previewing.'
      }
      return 'Hosts can preview once at least two members have saved contributions and at least two members still have a positive weight.'
    },
    currentWrappedCard() {
      return this.wrapped?.cards?.[this.wrappedIndex] || null
    },
  },
  methods: {
    readRoomTokenFromUrl() {
      return new URL(window.location.href).searchParams.get('room') || ''
    },
    replaceRoomToken(token) {
      const nextUrl = new URL(window.location.href)
      if (token) {
        nextUrl.searchParams.set('room', token)
      } else {
        nextUrl.searchParams.delete('room')
      }
      window.history.replaceState({}, document.title, `${nextUrl.pathname}${nextUrl.search}`)
      this.roomToken = token
      logClientEvent('room.token.updated', {
        roomToken: token,
      })
    },
    setStatus(key, value) {
      this[key] = value
      window.setTimeout(() => {
        if (this[key] === value) {
          this[key] = ''
        }
      }, 1600)
    },
    stopRoomPolling() {
      if (this.roomPollTimer) {
        window.clearInterval(this.roomPollTimer)
        this.roomPollTimer = null
      }
    },
    startRoomPolling() {
      this.stopRoomPolling()
      if (!this.roomToken) {
        return
      }
      this.roomPollTimer = window.setInterval(() => {
        this.pollRoom()
      }, ROOM_POLL_INTERVAL_MS)
    },
    syncContributionForm(room, options = {}) {
      if (options.preserveContribution) {
        return
      }
      const contribution = room?.contribution || {}
      this.contributionForm = {
        useTopTracks: Boolean(contribution.use_top_tracks),
        useSavedTracks: Boolean(contribution.use_saved_tracks),
        useRecentTracks: Boolean(contribution.use_recent_tracks),
        useMoodTracks: Boolean(contribution.use_mood_tracks),
        moodState: contribution.mood_state || null,
        playlistIds: [...(contribution.playlist_ids || [])],
      }
      this.contributionDirty = false
    },
    syncPlaylistName(room, options = {}) {
      if (options.preserveSettings) {
        return
      }
      this.playlistNameDraft = room?.playlist_name || 'Sato Blend'
      this.settingsDirty = false
    },
    syncWeightDrafts(room, options = {}) {
      if (options.preserveWeights) {
        return
      }
      this.weightDrafts = Object.fromEntries(
        (room?.members || []).map((member) => [member.id, Number(member.weight || 0)]),
      )
      this.weightsDirty = false
    },
    syncRoom(room, options = {}) {
      const previousUpdatedAt = this.room?.updated_at
      this.room = room
      this.roomNeedsJoin = false
      this.syncContributionForm(room, options)
      this.syncPlaylistName(room, options)
      this.syncWeightDrafts(room, options)
      this.createdPlaylist = room.created_playlist || this.createdPlaylist
      if (!room.has_wrapped) {
        this.wrapped = null
        this.wrappedIndex = 0
      }
      logClientEvent('room.synced', {
        roomToken: room?.token,
        role: room?.role,
        memberCount: room?.members?.length || 0,
        hasWrapped: Boolean(room?.has_wrapped),
        changed: previousUpdatedAt !== room?.updated_at,
      })
    },
    formatDate(value) {
      if (!value) {
        return 'Not yet'
      }
      return new Intl.DateTimeFormat(undefined, {
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
      }).format(new Date(value))
    },
    weightDraft(memberId) {
      return this.weightDrafts[memberId] ?? 0
    },
    buildEditableMembers() {
      return (this.room?.members || []).map((member) => ({
        ...member,
        hasContribution: member.has_contribution,
        weight: Number(this.weightDraft(member.id)),
      }))
    },
    applyWeightMembers(nextMembers, eventType) {
      this.weightDrafts = Object.fromEntries(
        nextMembers.map((member) => [member.id, Number(member.weight || 0)]),
      )
      this.weightsDirty = true
      this.preview = null
      logClientEvent(eventType, {
        roomToken: this.roomToken,
        members: nextMembers.map((member) => ({
          id: member.id,
          weight: member.weight,
        })),
      })
    },
    markContributionDirty() {
      this.contributionDirty = true
      this.preview = null
    },
    updateWeight(memberId, event) {
      const nextMembers = normalizeMemberWeights(
        this.buildEditableMembers(),
        memberId,
        event.target.value,
      )
      this.applyWeightMembers(nextMembers, 'room.weights.draft_updated')
    },
    memberSummary(member) {
      if (!member.has_contribution) {
        return 'No saved source snapshot yet.'
      }
      const summary = member.source_summary || {}
      return [
        summary.top_tracks_count ? `${summary.top_tracks_count} top` : '',
        summary.saved_tracks_count ? `${summary.saved_tracks_count} saved` : '',
        summary.recent_tracks_count ? `${summary.recent_tracks_count} recent` : '',
        summary.playlist_count ? `${summary.playlist_count} playlists` : '',
      ].filter(Boolean).join(' · ')
    },
    playlistDisabled(playlistId) {
      return (
        !this.contributionForm.playlistIds.includes(playlistId)
        && this.contributionForm.playlistIds.length >= (this.sourceCatalog?.playlist_limits?.max_selected || 0)
      )
    },
    async createRoom() {
      this.error = ''
      this.creatingRoom = true
      try {
        const room = await apiRequest('/api/rooms', { method: 'POST' })
        this.replaceRoomToken(room.token)
        this.joinTokenInput = room.token
        this.syncRoom(room)
        this.preview = null
        logClientEvent('room.created', {
          roomToken: room.token,
        })
        this.startRoomPolling()
        this.loadSourceCatalog()
      } catch (error) {
        this.error = error.message
        logClientEvent('room.create_failed', {
          message: error.message,
          status: error.status,
        })
      } finally {
        this.creatingRoom = false
      }
    },
    async loadRoom(options = {}) {
      if (!this.roomToken) {
        return null
      }

      this.error = options.silent ? this.error : ''
      try {
        const room = await apiRequest(`/api/rooms/${this.roomToken}`)
        this.syncRoom(room, {
          preserveContribution: options.preserveDirty && this.contributionDirty,
          preserveWeights: options.preserveDirty && this.weightsDirty,
          preserveSettings: options.preserveDirty && this.settingsDirty,
        })
        if (!options.fromPoll) {
          this.startRoomPolling()
        }
        if (!options.fromPoll || !this.sourceCatalog) {
          this.loadSourceCatalog()
        }
        if (room.has_wrapped && !this.wrapped) {
          await this.loadWrapped({ silent: true })
        }
        return room
      } catch (error) {
        if (error.payload?.error?.code === 'room_access_denied') {
          if (options.allowAutoJoin !== false) {
            const joinedRoom = await this.joinRoom(this.roomToken, { auto: true })
            if (joinedRoom) {
              return joinedRoom
            }
          }
          this.room = null
          this.roomNeedsJoin = true
          logClientEvent('room.join_required', {
            roomToken: this.roomToken,
          })
          return null
        }
        if (error.payload?.error?.code === 'room_not_found') {
          this.clearRoomState()
        }
        if (!options.silent) {
          this.error = error.message
        }
        logClientEvent('room.load_failed', {
          roomToken: this.roomToken,
          message: error.message,
          status: error.status,
        })
        return null
      }
    },
    async pollRoom() {
      if (!this.roomToken || this.roomPollInFlight || this.joiningRoom || this.leavingRoom) {
        return
      }

      this.roomPollInFlight = true
      try {
        const room = await this.loadRoom({ silent: true, preserveDirty: true, fromPoll: true })
        if (room?.has_wrapped && !this.wrapped) {
          await this.loadWrapped({ silent: true })
        }
      } finally {
        this.roomPollInFlight = false
      }
    },
    clearRoomState() {
      this.stopRoomPolling()
      this.room = null
      this.joinTokenInput = ''
      this.preview = null
      this.createdPlaylist = null
      this.wrapped = null
      this.roomNeedsJoin = false
      this.contributionDirty = false
      this.weightsDirty = false
      this.settingsDirty = false
      this.copyStatus = ''
      this.shareStatus = ''
      this.exportStatus = ''
      this.error = ''
      this.replaceRoomToken('')
      logClientEvent('room.cleared')
    },
    async joinRoom(token, options = {}) {
      const nextToken = String(token || '').trim()
      if (!nextToken) {
        return null
      }

      this.error = options.auto ? this.error : ''
      this.joiningRoom = true
      try {
        const room = await apiRequest(`/api/rooms/${nextToken}/join`, { method: 'POST' })
        this.replaceRoomToken(room.token)
        this.joinTokenInput = room.token
        this.syncRoom(room)
        this.startRoomPolling()
        this.loadSourceCatalog()
        logClientEvent(options.auto ? 'room.auto_joined' : 'room.joined', {
          roomToken: room.token,
        })
        return room
      } catch (error) {
        this.error = error.message
        logClientEvent(options.auto ? 'room.auto_join_failed' : 'room.join_failed', {
          roomToken: nextToken,
          message: error.message,
          status: error.status,
        })
        return null
      } finally {
        this.joiningRoom = false
      }
    },
    async leaveRoom() {
      if (!this.roomToken) {
        return
      }

      this.error = ''
      this.leavingRoom = true
      try {
        await apiRequest(`/api/rooms/${this.roomToken}/leave`, { method: 'POST' })
        this.clearRoomState()
        logClientEvent('room.left')
      } catch (error) {
        this.error = error.message
        logClientEvent('room.leave_failed', {
          roomToken: this.roomToken,
          message: error.message,
          status: error.status,
        })
      } finally {
        this.leavingRoom = false
      }
    },
    async loadSourceCatalog({ force = false } = {}) {
      if (this.sourceCatalog && !force) {
        return this.sourceCatalog
      }
      if (this.sourceCatalogPromise && !force) {
        return this.sourceCatalogPromise
      }

      this.loadingCatalog = true
      const request = apiRequest(`/api/me/source-catalog${force ? '?refresh=1' : ''}`)
      this.sourceCatalogPromise = request
      try {
        this.sourceCatalog = await request
        logClientEvent('room.sources.loaded', {
          playlistCount: this.sourceCatalog?.playlists?.length || 0,
          cached: !force,
        })
        return this.sourceCatalog
      } catch (error) {
        this.error = error.message
        logClientEvent('room.sources.load_failed', {
          message: error.message,
          status: error.status,
        })
        return null
      } finally {
        if (this.sourceCatalogPromise === request) {
          this.sourceCatalogPromise = null
        }
        this.loadingCatalog = false
      }
    },
    async saveContribution() {
      if (!this.roomToken) {
        return
      }

      this.error = ''
      this.savingContribution = true
      try {
        const response = await apiRequest(`/api/rooms/${this.roomToken}/contribution`, {
          method: 'PUT',
          body: JSON.stringify({
            use_top_tracks: this.contributionForm.useTopTracks,
            use_saved_tracks: this.contributionForm.useSavedTracks,
            use_recent_tracks: this.contributionForm.useRecentTracks,
            use_mood_tracks: this.contributionForm.useMoodTracks,
            mood_state: this.contributionForm.moodState,
            playlist_ids: this.contributionForm.playlistIds,
          }),
        })
        this.syncRoom(response.room)
        this.preview = null
        this.contributionDirty = false
        logClientEvent('room.contribution.saved', {
          roomToken: this.roomToken,
          trackCount: response.contribution?.track_count || 0,
        })
      } catch (error) {
        this.error = error.message
        logClientEvent('room.contribution.save_failed', {
          roomToken: this.roomToken,
          message: error.message,
          status: error.status,
        })
      } finally {
        this.savingContribution = false
      }
    },
    balanceWeights() {
      this.applyWeightMembers(distributeMemberWeights(this.buildEditableMembers()), 'room.weights.balanced')
    },
    boostHostWeights() {
      if (!this.hostMember) {
        return
      }
      this.applyWeightMembers(
        emphasizeMemberWeights(this.buildEditableMembers(), this.hostMember.id, 60),
        'room.weights.host_boosted',
      )
    },
    async saveWeights() {
      if (!this.roomToken) {
        return
      }

      this.error = ''
      this.savingWeights = true
      try {
        const room = await apiRequest(`/api/rooms/${this.roomToken}/weights`, {
          method: 'PATCH',
          body: JSON.stringify(buildWeightsPayload(this.weightPayloadMembers)),
        })
        this.syncRoom(room)
        this.preview = null
        this.weightsDirty = false
        logClientEvent('room.weights.saved', {
          roomToken: this.roomToken,
        })
      } catch (error) {
        this.error = error.message
        logClientEvent('room.weights.save_failed', {
          roomToken: this.roomToken,
          message: error.message,
          status: error.status,
        })
      } finally {
        this.savingWeights = false
      }
    },
    async saveSettings() {
      if (!this.roomToken) {
        return
      }

      this.error = ''
      this.savingSettings = true
      try {
        const room = await apiRequest(`/api/rooms/${this.roomToken}/settings`, {
          method: 'PATCH',
          body: JSON.stringify({
            playlist_name: this.playlistNameDraft,
          }),
        })
        this.syncRoom(room)
        this.settingsDirty = false
        logClientEvent('room.settings.saved', {
          roomToken: this.roomToken,
          playlistName: this.playlistNameDraft,
        })
      } catch (error) {
        this.error = error.message
        logClientEvent('room.settings.save_failed', {
          roomToken: this.roomToken,
          message: error.message,
          status: error.status,
        })
      } finally {
        this.savingSettings = false
      }
    },
    async previewRoom() {
      if (!this.roomToken) {
        return
      }

      this.error = ''
      this.previewingRoom = true
      try {
        this.preview = await apiRequest(`/api/rooms/${this.roomToken}/preview`, {
          method: 'POST',
        })
        logClientEvent('room.preview.loaded', {
          roomToken: this.roomToken,
          trackCount: this.preview?.tracks?.length || 0,
        })
      } catch (error) {
        this.error = error.message
        logClientEvent('room.preview.load_failed', {
          roomToken: this.roomToken,
          message: error.message,
          status: error.status,
        })
      } finally {
        this.previewingRoom = false
      }
    },
    async createBlend() {
      if (!this.roomToken) {
        return
      }

      this.error = ''
      this.creatingBlend = true
      try {
        const payload = await apiRequest(`/api/rooms/${this.roomToken}/create`, {
          method: 'POST',
        })
        this.createdPlaylist = payload.playlist
        this.wrapped = payload.wrapped
        this.wrappedIndex = 0
        if (this.room) {
          this.room = {
            ...this.room,
            created_playlist: payload.playlist,
            has_wrapped: true,
          }
        }
        logClientEvent('room.playlist.created', {
          roomToken: this.roomToken,
          playlistId: payload.playlist?.id,
        })
      } catch (error) {
        this.error = error.message
        logClientEvent('room.playlist.create_failed', {
          roomToken: this.roomToken,
          message: error.message,
          status: error.status,
        })
      } finally {
        this.creatingBlend = false
      }
    },
    async loadWrapped(options = {}) {
      if (!this.roomToken) {
        return null
      }

      if (!options.silent) {
        this.loadingWrapped = true
      }
      try {
        this.wrapped = await apiRequest(`/api/rooms/${this.roomToken}/wrapped`)
        this.wrappedIndex = 0
        logClientEvent('room.wrapped.loaded', {
          roomToken: this.roomToken,
          cards: this.wrapped?.cards?.length || 0,
        })
        return this.wrapped
      } catch (error) {
        if (!options.silent) {
          this.error = error.message
        }
        logClientEvent('room.wrapped.load_failed', {
          roomToken: this.roomToken,
          message: error.message,
          status: error.status,
        })
        return null
      } finally {
        this.loadingWrapped = false
      }
    },
    previousWrappedCard() {
      this.wrappedIndex = Math.max(0, this.wrappedIndex - 1)
    },
    nextWrappedCard() {
      this.wrappedIndex = Math.min(this.wrapped.cards.length - 1, this.wrappedIndex + 1)
    },
    async copyInviteUrl() {
      if (!this.room?.invite_url || !navigator?.clipboard) {
        this.copyStatus = 'Copy Unavailable'
        logClientEvent('room.invite.copy_unavailable', {
          roomToken: this.roomToken,
        })
        return
      }

      await navigator.clipboard.writeText(this.room.invite_url)
      this.setStatus('copyStatus', 'Copied')
      logClientEvent('room.invite.copied', {
        roomToken: this.roomToken,
      })
    },
    wrappedShareText() {
      return this.wrapped?.share_text
        || `${this.wrapped?.playlist_name || 'Sato Blend'} by ${this.room?.members?.length || 0} room members`
    },
    async shareWrapped() {
      if (!this.wrapped) {
        return
      }

      const sharePayload = {
        title: this.wrapped.playlist_name,
        text: this.wrappedShareText(),
        url: this.createdPlaylist?.external_urls?.spotify || window.location.href,
      }

      try {
        if (navigator.share) {
          await navigator.share(sharePayload)
          this.setStatus('shareStatus', 'Shared')
        } else if (navigator.clipboard) {
          await navigator.clipboard.writeText(`${sharePayload.text}\n${sharePayload.url}`)
          this.setStatus('shareStatus', 'Copied')
        } else {
          this.setStatus('shareStatus', 'Share Unavailable')
        }
        logClientEvent('room.wrapped.shared', {
          roomToken: this.roomToken,
        })
      } catch (error) {
        this.error = error?.message || 'Could not share this recap.'
      }
    },
    downloadWrapped() {
      if (!this.wrapped) {
        return
      }

      const blob = new Blob([JSON.stringify(this.wrapped, null, 2)], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const anchor = document.createElement('a')
      anchor.href = url
      anchor.download = `sato-wrapped-${this.roomToken}.json`
      anchor.click()
      URL.revokeObjectURL(url)
      this.setStatus('exportStatus', 'Exported')
      logClientEvent('room.wrapped.exported', {
        roomToken: this.roomToken,
      })
    },
    downloadCoverArt() {
      const coverArt = this.wrapped?.cover_art || this.preview?.cover_art || this.createdPlaylist?.cover_art
      if (!coverArt) {
        return
      }

      const blob = dataUrlToBlob(coverArt)
      const url = URL.createObjectURL(blob)
      const anchor = document.createElement('a')
      anchor.href = url
      anchor.download = `sato-cover-${this.roomToken}.svg`
      anchor.click()
      URL.revokeObjectURL(url)
      logClientEvent('room.cover.downloaded', {
        roomToken: this.roomToken,
      })
    },
  },
  mounted() {
    logClientEvent('room.view.mounted')
    fetchMoodProfiles().then(data => { this.moodProfiles = data?.moods || null }).catch(() => {})
    const token = this.readRoomTokenFromUrl()
    if (token) {
      this.roomToken = token
      this.joinTokenInput = token
      this.loadRoom()
    }
  },
  beforeUnmount() {
    this.stopRoomPolling()
  },
}
</script>

<style scoped>
.blend-shell {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 1rem;
}

.panel {
  border-radius: 1rem;
  padding: 1.15rem;
  background: linear-gradient(180deg, rgba(255, 255, 255, 0.03), rgba(0, 0, 0, 0.08));
  border: 1px solid rgba(255, 255, 255, 0.05);
  min-width: 0;
}

.panel-header,
.panel-title-group,
.room-actions,
.join-shell,
.room-state,
.source-editor,
.preview-shell,
.wrapped-shell {
  display: grid;
  gap: 0.9rem;
}

.panel-header {
  gap: 0.65rem;
}

.panel-title-group {
  display: flex;
  align-items: center;
  gap: 0.9rem;
}

.panel-icon {
  width: 2.6rem;
  height: 2.6rem;
  border-radius: 0.9rem;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex: none;
  color: #ffffff;
  background: rgba(255, 255, 255, 0.08);
}

.panel-icon svg {
  width: 1.25rem;
  height: 1.25rem;
}

.panel-icon--green {
  background: rgba(30, 215, 96, 0.22);
}

.panel-icon--purple {
  background: rgba(91, 65, 214, 0.22);
}

.eyebrow {
  margin: 0 0 0.2rem;
  color: var(--spotify-muted);
  font-size: 0.76rem;
  letter-spacing: 0.14em;
  text-transform: uppercase;
}

.panel h2,
.panel h3,
.wrapped-card h4 {
  margin: 0;
}

.panel-caption,
.helper-copy,
.member-meta {
  color: var(--spotify-muted);
}

.field-label {
  display: block;
  margin-top: 0;
  color: #ffffff;
  font-size: 0.92rem;
  font-weight: 700;
}

.field-label--compact {
  margin-top: 0;
}

.text-input {
  width: 100%;
  padding: 0.95rem 1rem;
  border-radius: 0.9rem;
  border: 1px solid rgba(255, 255, 255, 0.08);
  background: #242424;
  color: #ffffff;
  font: inherit;
}

.text-input::placeholder {
  color: #8a8a8a;
}

.lookup-row {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 0.75rem;
  align-items: start;
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
.ghost-button:disabled,
.inline-button:disabled {
  opacity: 0.55;
  cursor: not-allowed;
}

.room-card,
.invite-card,
.room-summary,
.source-grid,
.budget-summary,
.preview-summary,
.wrapped-controls,
.wrapped-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 0.75rem;
  align-items: center;
  justify-content: space-between;
}

.room-card,
.invite-card {
  padding: 1rem;
  border-radius: 0.95rem;
  background: #181818;
}

.inline-code {
  display: inline-block;
  margin-top: 0.3rem;
  padding: 0.35rem 0.55rem;
  border-radius: 0.6rem;
  background: rgba(0, 0, 0, 0.34);
}

.source-editor,
.member-list,
.track-list,
.wrapped-list {
  display: grid;
  gap: 0.85rem;
}

.source-editor__top,
.playlist-picker__top,
.wrapped-header {
  display: flex;
  flex-wrap: wrap;
  justify-content: space-between;
  gap: 1rem;
  align-items: center;
}

.source-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
}

.source-option,
.playlist-option,
.member-card,
.wrapped-card {
  padding: 0.95rem 1rem;
  border-radius: 0.95rem;
  background: #181818;
}

.source-option,
.playlist-option {
  display: flex;
  gap: 0.7rem;
  align-items: flex-start;
}

.source-option span,
.playlist-option span {
  display: grid;
  gap: 0.08rem;
}

.member-card {
  display: grid;
  gap: 0.75rem;
}

.member-weight {
  display: grid;
  gap: 0.55rem;
}

.member-weight__header {
  display: flex;
  justify-content: space-between;
  gap: 0.75rem;
  align-items: center;
}

.weight-control {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 7rem;
  gap: 0.75rem;
  align-items: center;
}

.weight-slider {
  width: 100%;
  accent-color: var(--spotify-accent);
}

.member-card__top,
.track-copy__top,
.wrapped-list__row {
  display: flex;
  justify-content: space-between;
  gap: 0.75rem;
}

.member-summary p,
.member-meta,
.track-copy p,
.wrapped-card p {
  margin: 0;
}

.weight-input {
  max-width: 7rem;
  text-align: right;
}

.budget-chip,
.score-pill,
.contributor-pill {
  border-radius: 999px;
  padding: 0.45rem 0.75rem;
  background: rgba(255, 255, 255, 0.08);
}

.budget-chip {
  display: grid;
  gap: 0.08rem;
  min-width: 8rem;
}

.budget-chip span {
  color: var(--spotify-muted);
  font-size: 0.76rem;
}

.budget-chip--warning {
  background: rgba(255, 184, 28, 0.16);
}

.action-row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.9rem;
}

.action-row--dense {
  margin-top: 0.4rem;
}

.budget-summary__actions {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
}

.preview-hero {
  display: grid;
  grid-template-columns: 220px minmax(0, 1fr);
  gap: 1rem;
  align-items: start;
}

.preview-cover,
.wrapped-cover,
.playlist-success__cover {
  width: 100%;
  max-width: 220px;
  border-radius: 1rem;
  box-shadow: var(--shadow-strong);
}

.preview-insights {
  display: grid;
  gap: 1rem;
}

.overlap-card {
  padding: 1rem;
  border-radius: 1rem;
  background: linear-gradient(180deg, rgba(91, 65, 214, 0.16), rgba(255, 255, 255, 0.03));
  border: 1px solid rgba(255, 255, 255, 0.06);
  display: grid;
  gap: 0.45rem;
}

.track-list {
  max-height: 34rem;
  overflow: auto;
}

.track-card {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr);
  gap: 0.85rem;
  padding: 0.95rem;
  border-radius: 1rem;
  background: #181818;
}

.track-image,
.track-image--fallback {
  width: 3.7rem;
  height: 3.7rem;
  border-radius: 0.95rem;
  object-fit: cover;
}

.track-image--fallback {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  color: var(--spotify-accent);
}

.track-copy {
  min-width: 0;
  display: grid;
  gap: 0.55rem;
}

.track-reason {
  color: #f5f5f5;
}

.track-breakdown {
  display: block;
}

.contributor-row,
.wrapped-chip-row {
  display: flex;
  flex-wrap: wrap;
  gap: 0.45rem;
}

.feedback-card {
  margin-top: 1rem;
  border-radius: 0.95rem;
  padding: 1rem 1.05rem;
}

.feedback-card--neutral {
  background: rgba(255, 255, 255, 0.05);
  color: #f3f3f3;
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

.playlist-link {
  display: inline-block;
  margin-top: 0.8rem;
}

.playlist-success {
  display: flex;
  gap: 1rem;
  align-items: center;
}

.wrapped-card {
  min-height: 17rem;
  display: grid;
  gap: 0.75rem;
}

.wrapped-list__row {
  align-items: baseline;
}

.wrapped-list__row--stacked {
  display: grid;
  gap: 0.2rem;
}

@media (max-width: 1100px) {
  .blend-shell {
    grid-template-columns: minmax(0, 1fr);
  }

  .preview-hero {
    grid-template-columns: minmax(0, 1fr);
  }
}

@media (max-width: 720px) {
  .weight-control {
    grid-template-columns: minmax(0, 1fr);
  }

  .playlist-success {
    flex-direction: column;
    align-items: stretch;
  }

  .preview-cover,
  .wrapped-cover,
  .playlist-success__cover {
    max-width: 100%;
  }
}
.mood-picker {
  margin-top: 0.5rem;
}
.mood-selector {
  display: flex;
  gap: 0.4rem;
  flex-wrap: wrap;
  margin-top: 0.4rem;
}
.mood-chip {
  padding: 0.25rem 0.75rem;
  border-radius: 999px;
  border: 1.5px solid;
  background: transparent;
  cursor: pointer;
  font-size: 0.85rem;
  font-weight: 600;
  transition: background 0.15s, color 0.15s;
}
.mood-chip--active {
  border-color: transparent;
}
</style>
