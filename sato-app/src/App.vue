<template>
  <div class="app-shell">
    <div class="ambient ambient-left"></div>
    <div class="ambient ambient-right"></div>

    <main class="page-frame">
      <section class="hero-card">
        <p class="eyebrow">Spotify Blend Studio</p>
        <h1>Sato</h1>
        <p class="hero-copy">
          Build a weighted playlist from your taste and your friends' public Spotify
          catalogs, preview the ranking, then publish the blend when it looks right.
        </p>
        <div class="hero-stats">
          <span class="stat-pill">Public-demo safe routing</span>
          <span class="stat-pill">Preview before create</span>
          <span class="stat-pill">Real weight budgeting</span>
        </div>
      </section>

      <section class="status-card">
        <div class="status-card__top">
          <div>
            <p class="eyebrow">Session</p>
            <h2>{{ user ? 'Spotify Connected' : 'Spotify Required' }}</h2>
          </div>
          <button
            v-if="user"
            class="ghost-button"
            type="button"
            @click="logout"
          >
            Log Out
          </button>
        </div>

        <p v-if="loadingSession" class="status-message">
          Checking your existing Spotify session.
        </p>

        <template v-else-if="user">
          <div class="profile-summary">
            <img
              v-if="user.images && user.images.length"
              :src="user.images[0].url"
              :alt="`${user.display_name} profile image`"
              class="profile-image"
            />
            <div class="profile-copy">
              <h3>{{ user.display_name }}</h3>
              <p>{{ user.email }}</p>
              <p>{{ user.country }} · {{ user.product || 'Spotify' }}</p>
              <p>{{ user.followers?.total || 0 }} followers</p>
            </div>
          </div>
        </template>

        <template v-else>
          <p class="status-message">
            Sign in with Spotify before resolving friends or creating playlists.
          </p>
          <button class="primary-button" type="button" @click="login">
            Continue with Spotify
          </button>
        </template>

        <p v-if="authMessage" class="notice-banner" :class="noticeTone">
          {{ authMessage }}
        </p>
      </section>

      <BlendView
        v-if="user"
        :user="user"
      />
    </main>
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
.app-shell {
  position: relative;
  min-height: 100vh;
  overflow: hidden;
}

.ambient {
  position: fixed;
  inset: auto;
  border-radius: 999px;
  filter: blur(32px);
  opacity: 0.45;
  pointer-events: none;
}

.ambient-left {
  top: -8rem;
  left: -5rem;
  width: 18rem;
  height: 18rem;
  background: rgba(255, 183, 77, 0.35);
}

.ambient-right {
  right: -4rem;
  bottom: 3rem;
  width: 20rem;
  height: 20rem;
  background: rgba(46, 125, 103, 0.25);
}

.page-frame {
  position: relative;
  z-index: 1;
  width: min(1100px, 100%);
  margin: 0 auto;
  padding: 3rem 1.25rem 4rem;
  display: grid;
  gap: 1.5rem;
}

.hero-card,
.status-card {
  border: 1px solid rgba(16, 29, 25, 0.1);
  border-radius: 1.75rem;
  padding: 1.75rem;
  background: rgba(255, 250, 243, 0.9);
  box-shadow: 0 18px 60px rgba(31, 27, 22, 0.08);
  backdrop-filter: blur(18px);
}

.eyebrow {
  margin: 0 0 0.35rem;
  text-transform: uppercase;
  letter-spacing: 0.14em;
  font-size: 0.78rem;
  color: var(--color-muted);
}

.hero-card h1 {
  margin: 0;
  font-size: clamp(3rem, 7vw, 5.25rem);
  line-height: 0.95;
  letter-spacing: -0.04em;
}

.hero-copy {
  max-width: 38rem;
  margin: 1rem 0 0;
  font-size: 1.02rem;
  color: var(--color-muted);
}

.hero-stats {
  display: flex;
  flex-wrap: wrap;
  gap: 0.75rem;
  margin-top: 1.25rem;
}

.stat-pill {
  padding: 0.55rem 0.85rem;
  border-radius: 999px;
  background: rgba(16, 29, 25, 0.06);
  font-size: 0.92rem;
}

.status-card__top {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 1rem;
}

.status-card h2 {
  margin: 0;
  font-size: 1.6rem;
}

.status-message {
  margin: 1rem 0 0;
  color: var(--color-muted);
}

.profile-summary {
  display: flex;
  align-items: center;
  gap: 1rem;
  margin-top: 1.25rem;
}

.profile-image {
  width: 84px;
  height: 84px;
  border-radius: 24px;
  object-fit: cover;
  box-shadow: 0 12px 30px rgba(31, 27, 22, 0.15);
}

.profile-copy h3 {
  margin: 0;
  font-size: 1.2rem;
}

.profile-copy p {
  margin: 0.3rem 0 0;
  color: var(--color-muted);
}

.primary-button,
.ghost-button {
  border: none;
  border-radius: 999px;
  padding: 0.9rem 1.2rem;
  font: inherit;
  font-weight: 700;
  cursor: pointer;
  transition: transform 160ms ease, box-shadow 160ms ease, background 160ms ease;
}

.primary-button {
  background: linear-gradient(135deg, var(--color-accent), #2d6d59);
  color: white;
  box-shadow: 0 12px 24px rgba(45, 109, 89, 0.28);
  margin-top: 1rem;
}

.ghost-button {
  background: rgba(16, 29, 25, 0.06);
  color: var(--color-text);
}

.primary-button:hover,
.ghost-button:hover {
  transform: translateY(-1px);
}

.notice-banner {
  margin-top: 1rem;
  border-radius: 1rem;
  padding: 0.85rem 1rem;
  font-size: 0.94rem;
}

.notice-banner--neutral {
  background: rgba(16, 29, 25, 0.06);
}

.notice-banner--success {
  background: rgba(52, 168, 83, 0.14);
  color: #1f5130;
}

.notice-banner--error {
  background: rgba(208, 62, 47, 0.14);
  color: #8d2a21;
}

@media (max-width: 720px) {
  .page-frame {
    padding-top: 1.5rem;
  }

  .hero-card,
  .status-card {
    padding: 1.25rem;
    border-radius: 1.25rem;
  }

  .status-card__top,
  .profile-summary {
    flex-direction: column;
    align-items: flex-start;
  }

  .primary-button,
  .ghost-button {
    width: 100%;
    justify-content: center;
  }
}
</style>
