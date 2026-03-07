<template>
  <div class="spotify-app">
    <header class="topbar">
      <div class="brand-cluster">
        <div class="brand-mark" aria-hidden="true">
          <svg viewBox="0 0 24 24" class="brand-mark__icon">
            <circle cx="12" cy="12" r="11" fill="currentColor" />
            <path d="M7.5 10c3.3-1.3 7.2-1 9.8.7M8.2 13c2.4-.8 5.3-.6 7.2.5M9 16c1.5-.5 3.3-.4 4.6.3" fill="none" stroke="#121212" stroke-linecap="round" stroke-width="1.7" />
          </svg>
        </div>
        <div>
          <p class="eyebrow">Spotify Blend Studio</p>
          <h1>Sato</h1>
        </div>
      </div>

      <div class="topbar-actions">
        <p v-if="loadingSession" class="topbar-status">Checking your Spotify session.</p>

        <template v-else-if="user">
          <div class="profile-pill">
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
              <span>{{ user.email }}</span>
            </div>
          </div>
          <button class="logout-button" type="button" @click="logout">
            Log Out
          </button>
        </template>

        <button
          v-else
          class="spotify-button"
          type="button"
          @click="login"
        >
          Continue with Spotify
        </button>
      </div>
    </header>

    <div class="workspace">
      <aside class="sidebar-column">
        <section class="surface session-surface">
          <p class="eyebrow">Session</p>
          <h2>{{ user ? 'Spotify Connected' : 'Spotify Required' }}</h2>
          <p class="section-copy">
            {{
              user
                ? 'Your account is live. Resolve public friend profiles, tune the percentages, preview the ranking, then create the playlist.'
                : 'Connect your Spotify account before Sato can read public friend profiles or publish playlists.'
            }}
          </p>

          <div v-if="user" class="session-card">
            <img
              v-if="userImage"
              :src="userImage"
              :alt="`${displayName} profile image`"
              class="session-card__image"
            />
            <div v-else class="session-card__fallback">
              {{ displayName.charAt(0).toUpperCase() }}
            </div>
            <div class="session-card__copy">
              <strong>{{ displayName }}</strong>
              <span>{{ user.country }} · {{ user.product || 'Spotify' }}</span>
              <span>{{ user.followers?.total || 0 }} followers</span>
            </div>
          </div>

          <button
            v-if="!user && !loadingSession"
            class="spotify-button"
            type="button"
            @click="login"
          >
            Sign in with Spotify
          </button>

          <p v-if="authMessage" class="notice-banner" :class="noticeTone">
            {{ authMessage }}
          </p>
        </section>

        <section class="surface guide-surface">
          <p class="eyebrow">Workflow</p>
          <h2>Only real controls remain</h2>
          <ol class="workflow-list">
            <li>Connect Spotify and load your session.</li>
            <li>Paste public friend profile URLs and resolve what is available.</li>
            <li>Set your own share, choose friend playlists, and keep the total at 100%.</li>
            <li>Preview the ranked tracks before you create the final playlist.</li>
          </ol>
          <p class="section-copy">
            The visual language still leans on Spotify’s dark chrome and green accents, but the layout no longer includes fake queue, player, or navigation controls.
          </p>
        </section>
      </aside>

      <main class="main-column">
        <section class="surface hero-surface">
          <p class="eyebrow">Made For {{ displayName }}</p>
          <h2>Build a weighted blend that feels native to Spotify.</h2>
          <p class="hero-description">
            Same dark theme, same green action language, but the interface now focuses only on the parts of Sato that actually work: login, resolve, weight, preview, and create.
          </p>
        </section>

        <section class="surface content-surface">
          <template v-if="user">
            <BlendView :user="user" />
          </template>

          <template v-else>
            <div class="login-showcase">
              <article class="login-card">
                <div class="login-card__icon" aria-hidden="true">
                  <svg viewBox="0 0 24 24" class="brand-mark__icon">
                    <circle cx="12" cy="12" r="11" fill="currentColor" />
                    <path d="M7.5 10c3.3-1.3 7.2-1 9.8.7M8.2 13c2.4-.8 5.3-.6 7.2.5M9 16c1.5-.5 3.3-.4 4.6.3" fill="none" stroke="#121212" stroke-linecap="round" stroke-width="1.7" />
                  </svg>
                </div>
                <div>
                  <p class="eyebrow">Spotify Login</p>
                  <h2>Connect your account to start building blends.</h2>
                  <p class="hero-description">
                    Once you sign in, the builder below becomes active and every control you see is live.
                  </p>
                </div>
                <button class="spotify-button" type="button" @click="login">
                  Continue with Spotify
                </button>
              </article>
            </div>
          </template>
        </section>
      </main>
    </div>
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
  grid-template-rows: auto 1fr;
  gap: 0.5rem;
  padding: 0.75rem;
}

.topbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  padding: 0.6rem 0.35rem 0.2rem;
}

.brand-cluster,
.topbar-actions,
.profile-pill {
  display: flex;
  align-items: center;
  gap: 0.85rem;
}

.brand-mark {
  width: 2.8rem;
  height: 2.8rem;
  border-radius: 999px;
  color: var(--spotify-accent);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex: none;
}

.brand-mark__icon {
  width: 100%;
  height: 100%;
}

.eyebrow {
  margin: 0 0 0.2rem;
  color: var(--spotify-muted);
  font-size: 0.76rem;
  letter-spacing: 0.14em;
  text-transform: uppercase;
}

.topbar h1,
.hero-surface h2,
.session-surface h2,
.guide-surface h2,
.login-card h2 {
  margin: 0;
}

.topbar h1 {
  font-size: 2rem;
  letter-spacing: -0.03em;
}

.topbar-status {
  margin: 0;
  color: var(--spotify-muted);
  font-size: 0.92rem;
}

.profile-pill {
  padding: 0.3rem 0.45rem 0.3rem 0.3rem;
  border-radius: 999px;
  background: rgba(0, 0, 0, 0.48);
}

.profile-pill__image,
.profile-pill__fallback {
  width: 2.25rem;
  height: 2.25rem;
  border-radius: 999px;
  object-fit: cover;
}

.profile-pill__fallback {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: #2a2a2a;
  color: #ffffff;
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
  font-size: 0.78rem;
}

.workspace {
  min-height: 0;
  display: grid;
  grid-template-columns: 320px minmax(0, 1fr);
  gap: 0.5rem;
}

.sidebar-column,
.main-column {
  min-width: 0;
  display: grid;
  gap: 0.5rem;
}

.surface {
  border-radius: 1rem;
  background: var(--spotify-panel);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.02);
}

.session-surface,
.guide-surface,
.content-surface,
.hero-surface {
  padding: 1.1rem 1.25rem;
}

.hero-surface {
  background:
    linear-gradient(180deg, rgba(30, 215, 96, 0.18), rgba(18, 18, 18, 0.96) 68%),
    var(--spotify-panel);
}

.section-copy,
.hero-description {
  margin: 0.9rem 0 0;
  color: var(--spotify-muted);
  line-height: 1.6;
}

.session-card {
  display: flex;
  align-items: center;
  gap: 0.9rem;
  margin-top: 1rem;
  padding: 0.95rem;
  border-radius: 1rem;
  background: #181818;
}

.session-card__image,
.session-card__fallback {
  width: 4.2rem;
  height: 4.2rem;
  border-radius: 0.9rem;
  object-fit: cover;
  flex: none;
}

.session-card__fallback {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: #2a2a2a;
  color: #ffffff;
  font-weight: 700;
  font-size: 1.4rem;
}

.session-card__copy {
  display: grid;
  gap: 0.18rem;
}

.session-card__copy strong {
  font-size: 1rem;
}

.session-card__copy span {
  color: var(--spotify-muted);
  font-size: 0.9rem;
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
  margin-top: 1rem;
  background: var(--spotify-accent);
  color: #121212;
}

.logout-button {
  background: #2a2a2a;
  color: #ffffff;
}

.notice-banner {
  margin-top: 1rem;
  padding: 0.9rem 1rem;
  border-radius: 0.9rem;
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

.workflow-list {
  margin: 1rem 0 0;
  padding-left: 1.15rem;
  color: #ffffff;
}

.workflow-list li + li {
  margin-top: 0.8rem;
}

.login-showcase {
  display: grid;
}

.login-card {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto;
  gap: 1rem;
  padding: 1.1rem;
  border-radius: 1rem;
  background: linear-gradient(135deg, rgba(30, 215, 96, 0.14), rgba(255, 255, 255, 0.03));
}

.login-card__icon {
  width: 4rem;
  height: 4rem;
  color: var(--spotify-accent);
  flex: none;
}

@media (max-width: 980px) {
  .workspace {
    grid-template-columns: 1fr;
  }

  .topbar {
    flex-direction: column;
    align-items: flex-start;
  }

  .topbar-actions {
    width: 100%;
    justify-content: space-between;
  }

  .login-card {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 720px) {
  .spotify-app {
    padding: 0.45rem;
  }

  .session-surface,
  .guide-surface,
  .content-surface,
  .hero-surface {
    padding: 1rem;
  }

  .topbar-actions,
  .profile-pill,
  .session-card {
    flex-direction: column;
    align-items: flex-start;
  }

  .topbar-actions {
    width: 100%;
  }
}
</style>
