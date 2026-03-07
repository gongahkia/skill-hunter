<template>
  <div class="spotify-app">
    <header class="topbar">
      <div class="window-controls" aria-hidden="true">
        <span class="window-dot window-dot--red"></span>
        <span class="window-dot window-dot--yellow"></span>
        <span class="window-dot window-dot--green"></span>
      </div>

      <div class="nav-cluster">
        <button class="nav-button" type="button" aria-label="Back">
          <svg viewBox="0 0 24 24" class="icon">
            <path d="M15.5 5.5 9 12l6.5 6.5" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" />
          </svg>
        </button>
        <button class="nav-button nav-button--muted" type="button" aria-label="Forward">
          <svg viewBox="0 0 24 24" class="icon">
            <path d="M8.5 5.5 15 12l-6.5 6.5" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" />
          </svg>
        </button>
      </div>

      <div class="search-cluster">
        <button class="home-button" type="button" aria-label="Home">
          <svg viewBox="0 0 24 24" class="icon">
            <path d="M4 10.5 12 4l8 6.5V20a1 1 0 0 1-1 1h-4.5v-6h-5v6H5a1 1 0 0 1-1-1z" fill="currentColor" />
          </svg>
        </button>
        <div class="search-pill">
          <svg viewBox="0 0 24 24" class="icon icon--muted">
            <circle cx="11" cy="11" r="6.5" fill="none" stroke="currentColor" stroke-width="2" />
            <path d="m16 16 4.5 4.5" fill="none" stroke="currentColor" stroke-linecap="round" stroke-width="2" />
          </svg>
          <span>{{ user ? 'What do you want to blend?' : 'Connect Spotify to start blending' }}</span>
          <span class="search-divider"></span>
          <svg viewBox="0 0 24 24" class="icon icon--muted">
            <path d="M5 5h14v4H5zM7 9v10h10V9" fill="none" stroke="currentColor" stroke-width="2" />
            <path d="M10 13h4" fill="none" stroke="currentColor" stroke-linecap="round" stroke-width="2" />
          </svg>
        </div>
      </div>

      <div class="topbar-actions">
        <button class="utility-button" type="button" aria-label="Notifications">
          <svg viewBox="0 0 24 24" class="icon">
            <path d="M12 4a4 4 0 0 0-4 4v2.5c0 1.8-.6 3.5-1.7 4.9L5 17h14l-1.3-1.6A7.7 7.7 0 0 1 16 10.5V8a4 4 0 0 0-4-4Z" fill="none" stroke="currentColor" stroke-width="1.8" />
            <path d="M10 19a2 2 0 0 0 4 0" fill="none" stroke="currentColor" stroke-linecap="round" stroke-width="1.8" />
          </svg>
        </button>
        <button class="utility-button" type="button" aria-label="Friend activity">
          <svg viewBox="0 0 24 24" class="icon">
            <path d="M9 10a3 3 0 1 0-3-3 3 3 0 0 0 3 3Zm7 1a2.5 2.5 0 1 0-2.5-2.5A2.5 2.5 0 0 0 16 11Z" fill="none" stroke="currentColor" stroke-width="1.8" />
            <path d="M4.5 18.5a4.5 4.5 0 0 1 9 0M13 18.5a3 3 0 0 1 6 0" fill="none" stroke="currentColor" stroke-linecap="round" stroke-width="1.8" />
          </svg>
        </button>
        <div class="profile-pill" :class="{ 'profile-pill--empty': !user }">
          <img
            v-if="userImage"
            :src="userImage"
            :alt="`${displayName} profile image`"
            class="profile-pill__image"
          />
          <span v-else class="profile-pill__fallback">
            {{ displayName.charAt(0).toUpperCase() }}
          </span>
          <div class="profile-pill__copy">
            <strong>{{ displayName }}</strong>
            <span>{{ user ? 'Spotify connected' : 'Guest mode' }}</span>
          </div>
        </div>
      </div>
    </header>

    <div class="workspace">
      <aside class="sidebar-column">
        <section class="surface library-surface">
          <div class="surface-header">
            <div class="surface-title">
              <svg viewBox="0 0 24 24" class="icon icon--muted">
                <path d="M4 5h2v14H4zM9 5h2v14H9zM14 5h6v2h-6zM14 11h6v2h-6zM14 17h6v2h-6z" fill="currentColor" />
              </svg>
              <span>Your Library</span>
            </div>
            <button class="mini-round-button" type="button" aria-label="Create">
              <svg viewBox="0 0 24 24" class="icon">
                <path d="M12 5v14M5 12h14" fill="none" stroke="currentColor" stroke-linecap="round" stroke-width="2" />
              </svg>
            </button>
          </div>

          <div class="chip-row">
            <span class="filter-chip filter-chip--active">Playlists</span>
            <span class="filter-chip">Friends</span>
            <span class="filter-chip">Preview</span>
          </div>

          <div class="library-grid">
            <article class="library-tile library-tile--liked">
              <svg viewBox="0 0 24 24" class="library-tile__icon">
                <path d="M12 20.5 4.8 13.8A4.8 4.8 0 0 1 12 7.4a4.8 4.8 0 0 1 7.2 6.4Z" fill="currentColor" />
              </svg>
              <div>
                <strong>Liked Songs</strong>
                <span>Weight your own taste first</span>
              </div>
            </article>

            <article class="library-tile library-tile--blend">
              <div class="library-orb"></div>
              <div>
                <strong>Weighted Blend</strong>
                <span>Preview before you publish</span>
              </div>
            </article>

            <article class="library-tile library-tile--profile">
              <img
                v-if="userImage"
                :src="userImage"
                :alt="`${displayName} avatar`"
                class="library-tile__image"
              />
              <div v-else class="library-tile__image library-tile__image--fallback">
                {{ displayName.charAt(0).toUpperCase() }}
              </div>
              <div>
                <strong>{{ displayName }}</strong>
                <span>{{ user ? 'Signed in and ready' : 'Waiting for Spotify login' }}</span>
              </div>
            </article>

            <article class="library-tile library-tile--green">
              <svg viewBox="0 0 24 24" class="library-tile__icon">
                <path d="M7 4h10a2 2 0 0 1 2 2v14l-7-4-7 4V6a2 2 0 0 1 2-2Z" fill="currentColor" />
              </svg>
              <div>
                <strong>Queue Safe</strong>
                <span>Exact 100% budget, no guesswork</span>
              </div>
            </article>
          </div>

          <div class="library-note">
            <strong>{{ user ? 'Your blend desk is ready.' : 'Spotify required to continue.' }}</strong>
            <p>Paste friend profiles, tune percentages, preview the queue, then publish the playlist.</p>
          </div>
        </section>
      </aside>

      <main class="main-column">
        <section class="surface hero-surface">
          <div class="chip-row">
            <span class="filter-chip filter-chip--active">All</span>
            <span class="filter-chip">Blend</span>
            <span class="filter-chip">Friends</span>
            <span class="filter-chip">Preview</span>
          </div>

          <div class="hero-layout">
            <div class="hero-copy">
              <p class="hero-tag">Made for {{ displayName }}</p>
              <h1>Fine-tune a blend with Spotify’s visual language.</h1>
              <p class="hero-description">
                Sato now runs inside a dark, queue-first shell inspired by Spotify desktop:
                library chrome, search-led navigation, and playlist previews that feel native.
              </p>
              <div class="hero-badges">
                <span class="hero-badge">Same-origin auth</span>
                <span class="hero-badge">Preview-first ranking</span>
                <span class="hero-badge">Real friend weighting</span>
              </div>
            </div>

            <div class="hero-feature">
              <div class="hero-feature__art"></div>
              <p class="hero-feature__label">Queue Style</p>
              <strong>Dark chrome. Green actions. Library rails.</strong>
              <span>Everything still runs through the same resolve, preview, and publish contract.</span>
            </div>
          </div>

          <p v-if="authMessage" class="notice-banner" :class="noticeTone">
            {{ authMessage }}
          </p>
        </section>

        <section class="surface content-surface">
          <template v-if="user">
            <BlendView :user="user" />
          </template>

          <template v-else>
            <div class="login-showcase">
              <article class="login-card">
                <div class="login-card__icon">
                  <svg viewBox="0 0 24 24" class="icon">
                    <circle cx="12" cy="12" r="10" fill="currentColor" />
                    <path d="M8.2 10.4c2.9-1.1 6.7-.9 9 .6M8.8 13.3c2.1-.7 4.9-.5 6.6.5M9.6 16c1.4-.4 3.1-.3 4.3.3" fill="none" stroke="#121212" stroke-linecap="round" stroke-width="1.6" />
                  </svg>
                </div>
                <div>
                  <p class="hero-tag">Spotify Login</p>
                  <h2>Connect your account to start building blends.</h2>
                  <p class="hero-description">
                    Sign in once, then Sato can resolve public friend profiles, preview the ranking,
                    and publish the final playlist directly to Spotify.
                  </p>
                </div>
                <button class="spotify-button" type="button" @click="login">
                  Continue with Spotify
                </button>
              </article>

              <div class="showcase-grid">
                <article class="showcase-panel">
                  <span class="showcase-index">01</span>
                  <strong>Resolve Friends</strong>
                  <p>Paste public Spotify profile URLs and keep partial matches even when some links fail.</p>
                </article>
                <article class="showcase-panel">
                  <span class="showcase-index">02</span>
                  <strong>Dial Percentages</strong>
                  <p>Keep your own listening profile in the mix and distribute the remaining share precisely.</p>
                </article>
                <article class="showcase-panel">
                  <span class="showcase-index">03</span>
                  <strong>Preview the Queue</strong>
                  <p>Inspect ranked tracks and contributor weights before writing anything to Spotify.</p>
                </article>
              </div>
            </div>
          </template>
        </section>
      </main>

      <aside class="queue-column">
        <section class="surface queue-surface">
          <div class="queue-tabs">
            <button class="queue-tab queue-tab--active" type="button">Queue</button>
            <button class="queue-tab" type="button">Recently played</button>
          </div>

          <div class="queue-block">
            <h2>Now playing</h2>
            <div class="now-playing-card">
              <div class="now-playing-art">
                <img
                  v-if="userImage"
                  :src="userImage"
                  :alt="`${displayName} avatar`"
                />
                <svg v-else viewBox="0 0 24 24" class="icon">
                  <circle cx="12" cy="12" r="10" fill="currentColor" />
                  <path d="M8.2 10.4c2.9-1.1 6.7-.9 9 .6M8.8 13.3c2.1-.7 4.9-.5 6.6.5M9.6 16c1.4-.4 3.1-.3 4.3.3" fill="none" stroke="#121212" stroke-linecap="round" stroke-width="1.6" />
                </svg>
              </div>
              <div class="now-playing-copy">
                <strong>{{ user ? `${displayName}'s Blend Desk` : 'Sato Guest Session' }}</strong>
                <span>{{ user ? 'Weighted playlist creation' : 'Connect Spotify to begin' }}</span>
              </div>
            </div>
          </div>

          <div class="queue-cta">
            <p>
              {{ user ? 'Your session is live. When you are done, use the queue to resolve friends and create a playlist.' : 'Sato needs Spotify access before it can read your listening graph or publish playlists.' }}
            </p>
            <button
              v-if="!user"
              class="spotify-button"
              type="button"
              @click="login"
            >
              Sign in with Spotify
            </button>
            <button
              v-else
              class="logout-button"
              type="button"
              @click="logout"
            >
              Log Out
            </button>
          </div>

          <div class="queue-block">
            <h2>Next up</h2>
            <div class="step-list">
              <article
                v-for="step in queueSteps"
                :key="step.title"
                class="step-item"
                :class="`step-item--${step.state}`"
              >
                <span class="step-index">{{ step.index }}</span>
                <div class="step-copy">
                  <strong>{{ step.title }}</strong>
                  <p>{{ step.meta }}</p>
                </div>
              </article>
            </div>
          </div>
        </section>
      </aside>
    </div>

    <footer class="player-bar">
      <div class="player-now">
        <div class="player-art">
          <img
            v-if="userImage"
            :src="userImage"
            :alt="`${displayName} avatar`"
          />
          <svg v-else viewBox="0 0 24 24" class="icon">
            <circle cx="12" cy="12" r="10" fill="currentColor" />
            <path d="M8.2 10.4c2.9-1.1 6.7-.9 9 .6M8.8 13.3c2.1-.7 4.9-.5 6.6.5M9.6 16c1.4-.4 3.1-.3 4.3.3" fill="none" stroke="#121212" stroke-linecap="round" stroke-width="1.6" />
          </svg>
        </div>
        <div class="player-track-copy">
          <strong>{{ playerTitle }}</strong>
          <span>{{ playerSubtitle }}</span>
        </div>
        <button class="player-icon-button" type="button" aria-label="Add to library">
          <svg viewBox="0 0 24 24" class="icon">
            <path d="M12 5v14M5 12h14" fill="none" stroke="currentColor" stroke-linecap="round" stroke-width="2" />
          </svg>
        </button>
      </div>

      <div class="player-center">
        <div class="player-controls">
          <button class="player-icon-button player-icon-button--ghost" type="button" aria-label="Shuffle">
            <svg viewBox="0 0 24 24" class="icon">
              <path d="M4 7h3l10 10h3M17 7h3v3M17 17l3-3" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" />
            </svg>
          </button>
          <button class="player-icon-button player-icon-button--ghost" type="button" aria-label="Previous">
            <svg viewBox="0 0 24 24" class="icon">
              <path d="M6 6v12M18 7l-8 5 8 5z" fill="currentColor" />
            </svg>
          </button>
          <button class="player-play-button" type="button" aria-label="Play">
            <svg viewBox="0 0 24 24" class="icon">
              <path d="m9 7 8 5-8 5z" fill="currentColor" />
            </svg>
          </button>
          <button class="player-icon-button player-icon-button--ghost" type="button" aria-label="Next">
            <svg viewBox="0 0 24 24" class="icon">
              <path d="M18 6v12M6 7l8 5-8 5z" fill="currentColor" />
            </svg>
          </button>
          <button class="player-icon-button player-icon-button--ghost" type="button" aria-label="Queue">
            <svg viewBox="0 0 24 24" class="icon">
              <path d="M5 7h10M5 12h14M5 17h10" fill="none" stroke="currentColor" stroke-linecap="round" stroke-width="1.8" />
            </svg>
          </button>
        </div>

        <div class="progress-row">
          <span>0:42</span>
          <div class="progress-bar">
            <div class="progress-bar__fill" :style="{ width: progressWidth }"></div>
          </div>
          <span>2:31</span>
        </div>
      </div>

      <div class="player-tools">
        <button class="player-icon-button player-icon-button--ghost" type="button" aria-label="Connect device">
          <svg viewBox="0 0 24 24" class="icon">
            <path d="M6 5h12a1 1 0 0 1 1 1v9H5V6a1 1 0 0 1 1-1Zm-2 13h16" fill="none" stroke="currentColor" stroke-linecap="round" stroke-width="1.8" />
          </svg>
        </button>
        <button class="player-icon-button player-icon-button--ghost" type="button" aria-label="Volume">
          <svg viewBox="0 0 24 24" class="icon">
            <path d="M4 14h4l5 4V6L8 10H4zM17 9a4 4 0 0 1 0 6M19.5 6.5a7.5 7.5 0 0 1 0 11" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" />
          </svg>
        </button>
        <div class="volume-bar">
          <div class="volume-bar__fill"></div>
        </div>
      </div>
    </footer>
  </div>
</template>

<script>
import BlendView from './components/BlendView.vue'
import { apiRequest } from './lib/api'

const AUTH_ERRORS = {
  invalid_state: 'Spotify returned to Sato with an invalid login state. Start the login flow again.',
  missing_code: 'Spotify did not return an authorization code.',
  access_denied: 'Spotify login was cancelled before Sato received permission.',
  spotify_config_missing: 'Spotify credentials are missing on the server. Add SPOTIFY_CLIENT_ID and SPOTIFY_CLIENT_SECRET to your .env before signing in.',
}

export default {
  components: {
    BlendView,
  },
  data() {
    return {
      user: null,
      loadingSession: true,
      authMessage: '',
      noticeTone: 'notice-banner--neutral',
    }
  },
  computed: {
    displayName() {
      return this.user?.display_name || 'You'
    },
    userImage() {
      return this.user?.images?.[0]?.url || ''
    },
    queueSteps() {
      return [
        {
          index: '01',
          title: 'Connect Spotify',
          meta: this.user ? 'Signed in and ready' : 'Required to continue',
          state: this.user ? 'ready' : 'current',
        },
        {
          index: '02',
          title: 'Resolve Friends',
          meta: this.user ? 'Paste public profile URLs' : 'Waiting for session',
          state: this.user ? 'current' : 'pending',
        },
        {
          index: '03',
          title: 'Tune Percentages',
          meta: 'Keep the full mix at 100%',
          state: this.user ? 'pending' : 'pending',
        },
        {
          index: '04',
          title: 'Preview and Publish',
          meta: 'Review ranked tracks before saving',
          state: this.user ? 'pending' : 'pending',
        },
      ]
    },
    playerTitle() {
      return this.user ? `${this.displayName}'s Blend Desk` : 'Sato Blend Desk'
    },
    playerSubtitle() {
      return this.user
        ? 'Weighted queue · preview before publish'
        : 'Connect Spotify to unlock playlist creation'
    },
    progressWidth() {
      return this.user ? '58%' : '18%'
    },
  },
  methods: {
    login() {
      window.location.assign('/api/auth/login')
    },
    async logout() {
      try {
        await apiRequest('/api/auth/logout', {
          method: 'POST',
        })
        this.user = null
        this.authMessage = 'Your Spotify session has been cleared.'
        this.noticeTone = 'notice-banner--neutral'
      } catch (error) {
        this.authMessage = error.message
        this.noticeTone = 'notice-banner--error'
      }
    },
    async loadSession() {
      this.loadingSession = true
      try {
        const user = await apiRequest('/api/me')
        this.user = user
        if (!this.authMessage) {
          this.authMessage = 'Spotify is connected. Resolve friends to start building a blend.'
          this.noticeTone = 'notice-banner--success'
        }
      } catch (error) {
        this.user = null
        if (error.status !== 401) {
          this.authMessage = error.message
          this.noticeTone = 'notice-banner--error'
        }
      } finally {
        this.loadingSession = false
      }
    },
    hydrateAuthMessageFromQuery() {
      const currentUrl = new URL(window.location.href)
      const loginState = currentUrl.searchParams.get('login')
      const reason = currentUrl.searchParams.get('reason')

      if (loginState === 'success') {
        this.authMessage = 'Spotify login completed. Your session is ready.'
        this.noticeTone = 'notice-banner--success'
      }

      if (loginState === 'error') {
        this.authMessage = AUTH_ERRORS[reason] || 'Spotify login did not complete successfully.'
        this.noticeTone = 'notice-banner--error'
      }

      if (loginState) {
        currentUrl.searchParams.delete('login')
        currentUrl.searchParams.delete('reason')
        window.history.replaceState({}, document.title, currentUrl.pathname || '/')
      }
    },
  },
  mounted() {
    this.hydrateAuthMessageFromQuery()
    this.loadSession()
  },
}
</script>

<style scoped>
.spotify-app {
  min-height: 100vh;
  display: grid;
  grid-template-rows: auto 1fr auto;
  gap: 0.5rem;
  padding: 0.5rem;
}

.icon {
  width: 1.15rem;
  height: 1.15rem;
  flex: none;
}

.icon--muted {
  color: var(--spotify-muted);
}

.topbar {
  display: grid;
  grid-template-columns: auto auto minmax(0, 1fr) auto;
  align-items: center;
  gap: 1rem;
  padding: 0.75rem 1rem 0.4rem;
}

.window-controls,
.nav-cluster,
.search-cluster,
.topbar-actions {
  display: flex;
  align-items: center;
  gap: 0.65rem;
}

.window-controls {
  gap: 0.45rem;
}

.window-dot {
  width: 0.78rem;
  height: 0.78rem;
  border-radius: 999px;
}

.window-dot--red {
  background: #ff5f57;
}

.window-dot--yellow {
  background: #febc2e;
}

.window-dot--green {
  background: #28c840;
}

.nav-button,
.utility-button,
.mini-round-button,
.home-button,
.player-icon-button {
  border: none;
  background: rgba(255, 255, 255, 0.08);
  color: var(--spotify-text);
  cursor: pointer;
  border-radius: 999px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

.nav-button,
.utility-button,
.mini-round-button,
.home-button {
  width: 2.25rem;
  height: 2.25rem;
}

.nav-button--muted {
  color: rgba(255, 255, 255, 0.45);
}

.search-cluster {
  min-width: 0;
}

.home-button {
  background: #ffffff;
  color: #121212;
}

.search-pill {
  min-width: 0;
  flex: 1;
  display: flex;
  align-items: center;
  gap: 0.85rem;
  border-radius: 999px;
  padding: 0.9rem 1.1rem;
  background: #242424;
  color: var(--spotify-muted);
}

.search-pill span {
  flex: 1;
  min-width: 0;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.search-divider {
  width: 1px;
  height: 1.4rem;
  background: rgba(255, 255, 255, 0.14);
}

.profile-pill {
  display: inline-flex;
  align-items: center;
  gap: 0.65rem;
  padding: 0.25rem 0.35rem 0.25rem 0.25rem;
  border-radius: 999px;
  background: rgba(0, 0, 0, 0.62);
}

.profile-pill--empty {
  color: var(--spotify-muted);
}

.profile-pill__image,
.profile-pill__fallback {
  width: 2rem;
  height: 2rem;
  border-radius: 999px;
  object-fit: cover;
}

.profile-pill__fallback {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: #333;
  color: white;
  font-weight: 700;
}

.profile-pill__copy {
  display: grid;
  gap: 0.05rem;
}

.profile-pill__copy strong {
  font-size: 0.92rem;
}

.profile-pill__copy span {
  color: var(--spotify-muted);
  font-size: 0.76rem;
}

.workspace {
  min-height: 0;
  display: grid;
  grid-template-columns: 300px minmax(0, 1fr) 320px;
  gap: 0.5rem;
}

.surface {
  border-radius: 1rem;
  background: var(--spotify-panel);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.02);
}

.library-surface,
.queue-surface {
  padding: 1rem;
  height: 100%;
}

.content-surface,
.hero-surface {
  padding: 1rem 1.35rem;
}

.main-column {
  min-width: 0;
  display: grid;
  gap: 0.5rem;
  grid-template-rows: auto minmax(0, 1fr);
}

.hero-surface {
  background:
    linear-gradient(180deg, rgba(30, 215, 96, 0.18), rgba(18, 18, 18, 0.92) 55%),
    var(--spotify-panel);
}

.surface-header,
.surface-title,
.chip-row,
.hero-badges,
.queue-tabs {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.surface-header {
  justify-content: space-between;
}

.surface-title {
  color: #ffffff;
  font-weight: 700;
}

.chip-row {
  flex-wrap: wrap;
}

.filter-chip,
.hero-badge {
  padding: 0.55rem 0.9rem;
  border-radius: 999px;
  background: #2a2a2a;
  color: #ffffff;
  font-size: 0.9rem;
}

.filter-chip--active {
  background: #ffffff;
  color: #121212;
}

.hero-layout {
  display: grid;
  grid-template-columns: minmax(0, 1.6fr) minmax(260px, 0.8fr);
  gap: 1rem;
  margin-top: 1rem;
}

.hero-copy h1 {
  margin: 0.35rem 0 0;
  font-size: clamp(2.6rem, 5vw, 4.5rem);
  line-height: 0.92;
  letter-spacing: -0.04em;
}

.hero-tag {
  margin: 0;
  text-transform: uppercase;
  letter-spacing: 0.14em;
  font-size: 0.76rem;
  color: rgba(255, 255, 255, 0.72);
}

.hero-description {
  margin: 1rem 0 0;
  max-width: 42rem;
  color: var(--spotify-muted);
  font-size: 1rem;
}

.hero-badges {
  flex-wrap: wrap;
  margin-top: 1.2rem;
}

.hero-badge {
  background: rgba(255, 255, 255, 0.08);
  color: #ffffff;
}

.hero-feature {
  align-self: end;
  display: grid;
  gap: 0.55rem;
  padding: 1rem;
  border-radius: 1rem;
  background: rgba(0, 0, 0, 0.28);
}

.hero-feature__art {
  aspect-ratio: 1 / 1;
  border-radius: 1rem;
  background:
    radial-gradient(circle at 30% 30%, rgba(30, 215, 96, 0.92), transparent 25%),
    radial-gradient(circle at 65% 40%, rgba(29, 185, 84, 0.38), transparent 24%),
    linear-gradient(160deg, #2f2f2f, #0e0e0e 70%);
  box-shadow: var(--shadow-strong);
}

.hero-feature__label {
  margin: 0;
  color: var(--spotify-muted);
  font-size: 0.78rem;
  text-transform: uppercase;
  letter-spacing: 0.14em;
}

.hero-feature strong {
  font-size: 1.15rem;
}

.hero-feature span {
  color: var(--spotify-muted);
  font-size: 0.94rem;
}

.notice-banner {
  margin-top: 1rem;
  padding: 0.9rem 1rem;
  border-radius: 0.85rem;
  font-size: 0.94rem;
}

.notice-banner--neutral {
  background: rgba(255, 255, 255, 0.06);
  color: #ffffff;
}

.notice-banner--success {
  background: rgba(30, 215, 96, 0.18);
  color: #dcffe8;
}

.notice-banner--error {
  background: rgba(243, 91, 91, 0.18);
  color: #ffd9d9;
}

.library-grid {
  display: grid;
  gap: 0.75rem;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  margin-top: 1rem;
}

.library-tile {
  min-height: 8.5rem;
  border-radius: 0.9rem;
  padding: 0.9rem;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  color: white;
  overflow: hidden;
}

.library-tile strong,
.library-note strong,
.queue-block h2,
.login-card h2,
.showcase-panel strong {
  font-size: 1rem;
}

.library-tile span,
.library-note p,
.now-playing-copy span,
.step-copy p,
.showcase-panel p {
  color: rgba(255, 255, 255, 0.75);
  font-size: 0.9rem;
}

.library-tile--liked {
  background: linear-gradient(135deg, #450af5, #b49bc8);
}

.library-tile--blend {
  background: linear-gradient(135deg, #2d46b9, #509bf5);
}

.library-tile--profile {
  background: linear-gradient(160deg, #2f2f2f, #181818);
}

.library-tile--green {
  background: linear-gradient(135deg, #006450, #1ed760);
}

.library-orb {
  width: 2.7rem;
  height: 2.7rem;
  border-radius: 999px;
  background:
    radial-gradient(circle at 35% 35%, #1ed760, transparent 28%),
    linear-gradient(135deg, rgba(255, 255, 255, 0.12), rgba(0, 0, 0, 0.2));
}

.library-tile__image,
.library-tile__icon {
  width: 2.8rem;
  height: 2.8rem;
  border-radius: 0.8rem;
}

.library-tile__image {
  object-fit: cover;
}

.library-tile__image--fallback {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: #333;
  color: #fff;
  font-weight: 700;
}

.library-note {
  margin-top: 1rem;
  padding: 1rem;
  border-radius: 1rem;
  background: #1d1d1d;
}

.library-note p {
  margin: 0.4rem 0 0;
}

.queue-tabs {
  gap: 1rem;
  margin-bottom: 1rem;
}

.queue-tab {
  border: none;
  background: transparent;
  color: var(--spotify-muted);
  font: inherit;
  font-weight: 700;
  padding: 0;
  cursor: pointer;
}

.queue-tab--active {
  color: #ffffff;
  position: relative;
}

.queue-tab--active::after {
  content: "";
  position: absolute;
  left: 0;
  bottom: -0.7rem;
  width: 100%;
  height: 0.18rem;
  border-radius: 999px;
  background: var(--spotify-accent);
}

.queue-block {
  margin-top: 1.35rem;
}

.queue-block h2 {
  margin: 0 0 0.9rem;
}

.now-playing-card {
  display: flex;
  gap: 0.85rem;
  align-items: center;
}

.now-playing-art {
  width: 4rem;
  height: 4rem;
  border-radius: 0.75rem;
  background: linear-gradient(135deg, #2a2a2a, #111);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  color: var(--spotify-accent);
}

.now-playing-art img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.now-playing-copy {
  display: grid;
  gap: 0.2rem;
}

.now-playing-copy strong {
  color: #1ed760;
}

.queue-cta {
  margin-top: 1.4rem;
  border-radius: 1rem;
  padding: 1rem;
  background: linear-gradient(135deg, #2b2b2b, #1d1d1d);
}

.queue-cta p {
  margin: 0 0 1rem;
  color: #d5d5d5;
}

.spotify-button,
.logout-button {
  border: none;
  border-radius: 999px;
  padding: 0.9rem 1.3rem;
  font: inherit;
  font-weight: 700;
  cursor: pointer;
}

.spotify-button {
  background: var(--spotify-accent);
  color: #121212;
}

.logout-button {
  background: #2a2a2a;
  color: #ffffff;
}

.step-list {
  display: grid;
  gap: 0.85rem;
}

.step-item {
  display: grid;
  grid-template-columns: auto 1fr;
  gap: 0.8rem;
  align-items: start;
}

.step-index {
  width: 2rem;
  height: 2rem;
  border-radius: 999px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: #2a2a2a;
  color: var(--spotify-muted);
  font-size: 0.78rem;
  font-weight: 700;
}

.step-item--ready .step-index {
  background: rgba(30, 215, 96, 0.16);
  color: #d8ffe5;
}

.step-item--current .step-index {
  background: #ffffff;
  color: #121212;
}

.step-item--pending .step-index {
  background: #2a2a2a;
  color: var(--spotify-muted);
}

.step-copy strong {
  display: block;
}

.step-copy p {
  margin: 0.25rem 0 0;
}

.login-showcase {
  display: grid;
  gap: 1rem;
}

.login-card {
  display: grid;
  grid-template-columns: auto 1fr auto;
  gap: 1rem;
  padding: 1.15rem;
  border-radius: 1rem;
  background: linear-gradient(135deg, rgba(30, 215, 96, 0.16), rgba(255, 255, 255, 0.04));
}

.login-card__icon {
  width: 4rem;
  height: 4rem;
  border-radius: 1rem;
  background: #1ed760;
  color: #121212;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

.login-card__icon .icon {
  width: 2rem;
  height: 2rem;
}

.showcase-grid {
  display: grid;
  gap: 0.9rem;
  grid-template-columns: repeat(3, minmax(0, 1fr));
}

.showcase-panel {
  border-radius: 1rem;
  padding: 1rem;
  background: #1a1a1a;
}

.showcase-index {
  display: inline-flex;
  margin-bottom: 0.9rem;
  color: var(--spotify-accent);
  font-size: 0.8rem;
  font-weight: 700;
  letter-spacing: 0.14em;
}

.showcase-panel p {
  margin: 0.5rem 0 0;
}

.player-bar {
  display: grid;
  grid-template-columns: minmax(220px, 320px) minmax(0, 1fr) minmax(180px, 260px);
  align-items: center;
  gap: 1rem;
  padding: 0.9rem 1rem 1rem;
  border-top: 1px solid rgba(255, 255, 255, 0.08);
  background: rgba(0, 0, 0, 0.86);
  backdrop-filter: blur(12px);
}

.player-now,
.player-center,
.player-tools,
.player-controls,
.progress-row {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.player-now {
  min-width: 0;
}

.player-art {
  width: 3.5rem;
  height: 3.5rem;
  border-radius: 0.65rem;
  background: linear-gradient(135deg, #2a2a2a, #111);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  color: var(--spotify-accent);
  flex: none;
}

.player-art img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.player-track-copy {
  min-width: 0;
  display: grid;
  gap: 0.12rem;
}

.player-track-copy strong,
.player-track-copy span {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.player-track-copy span,
.progress-row span {
  color: var(--spotify-muted);
  font-size: 0.82rem;
}

.player-center {
  flex-direction: column;
  justify-content: center;
}

.player-icon-button {
  width: 2rem;
  height: 2rem;
}

.player-icon-button--ghost {
  background: transparent;
  color: var(--spotify-muted);
}

.player-play-button {
  width: 2.2rem;
  height: 2.2rem;
  border: none;
  border-radius: 999px;
  background: #ffffff;
  color: #121212;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
}

.progress-row {
  width: min(32rem, 100%);
}

.progress-bar,
.volume-bar {
  position: relative;
  height: 0.25rem;
  border-radius: 999px;
  background: #4d4d4d;
  overflow: hidden;
}

.progress-bar {
  flex: 1;
}

.progress-bar__fill,
.volume-bar__fill {
  height: 100%;
  border-radius: inherit;
  background: #ffffff;
}

.volume-bar {
  width: 6rem;
}

.volume-bar__fill {
  width: 55%;
}

@media (max-width: 1280px) {
  .workspace {
    grid-template-columns: 280px minmax(0, 1fr);
  }

  .queue-column {
    grid-column: 1 / -1;
  }
}

@media (max-width: 980px) {
  .spotify-app {
    padding: 0.35rem;
  }

  .topbar {
    grid-template-columns: 1fr;
  }

  .window-controls,
  .nav-cluster {
    display: none;
  }

  .workspace {
    grid-template-columns: 1fr;
  }

  .hero-layout,
  .showcase-grid,
  .player-bar,
  .login-card {
    grid-template-columns: 1fr;
  }

  .topbar-actions {
    justify-content: space-between;
  }

  .search-cluster {
    width: 100%;
  }

  .player-bar {
    gap: 0.9rem;
  }
}

@media (max-width: 720px) {
  .library-grid {
    grid-template-columns: 1fr;
  }

  .content-surface,
  .hero-surface,
  .library-surface,
  .queue-surface {
    padding: 0.9rem;
  }

  .hero-copy h1 {
    font-size: 2.4rem;
  }

  .profile-pill__copy span {
    display: none;
  }
}
</style>
