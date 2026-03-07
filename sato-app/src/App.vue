<template>
  <div class="spotify-app">
    <header class="topbar">
      <div class="brand-cluster">
        <div class="brand-mark" aria-hidden="true">
          <img :src="satoLogo" alt="" class="brand-mark__image" />
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
          :disabled="loadingSpotifyConfig || !canLogin"
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

          <form
            v-if="!loadingSpotifyConfig && !user && spotifyConfig.source !== 'server'"
            class="config-form"
            @submit.prevent="saveSpotifyConfig"
          >
            <div>
              <p class="config-form__title">Spotify App Credentials</p>
              <p class="config-form__copy">
                Enter the Client ID and Client Secret from your Spotify Developer app. Sato keeps them in this browser session instead of requiring a `.env` file.
              </p>
            </div>

            <label class="config-field">
              <span>Client ID</span>
              <input
                v-model.trim="spotifyConfig.clientId"
                class="config-input"
                type="text"
                autocomplete="off"
                spellcheck="false"
                placeholder="Spotify Client ID"
              />
            </label>

            <label class="config-field">
              <span>Client Secret</span>
              <input
                v-model.trim="spotifyConfig.clientSecret"
                class="config-input"
                type="password"
                autocomplete="off"
                spellcheck="false"
                placeholder="Spotify Client Secret"
              />
            </label>

            <div class="config-actions">
              <button
                class="secondary-button"
                type="submit"
                :disabled="savingSpotifyConfig || !canSaveSpotifyConfig"
              >
                {{ savingSpotifyConfig ? 'Saving Credentials...' : spotifyConfig.configured ? 'Update Credentials' : 'Save Credentials' }}
              </button>
              <p v-if="spotifyConfig.configured" class="config-status">
                Saved for this browser session.
              </p>
            </div>
          </form>

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
            :disabled="loadingSpotifyConfig || !canLogin"
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
                  <img :src="satoLogo" alt="" class="brand-mark__image" />
                </div>
                <div>
                  <p class="eyebrow">Spotify Login</p>
                  <h2>Connect your account to start building blends.</h2>
                  <p class="hero-description">
                    Once you sign in, the builder below becomes active and every control you see is live.
                  </p>
                  <p v-if="!loadingSpotifyConfig && !canLogin" class="login-card__hint">
                    Add your Spotify Client ID and Client Secret in the Session panel first.
                  </p>
                </div>
                <button
                  class="spotify-button"
                  type="button"
                  :disabled="loadingSpotifyConfig || !canLogin"
                  @click="login"
                >
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
import satoLogo from './assets/sato.png'
import { apiRequest } from './lib/api'

const AUTH_ERRORS = {
  invalid_state: 'Spotify returned to Sato with an invalid login state. Start the login flow again.',
  missing_code: 'Spotify did not return an authorization code.',
  access_denied: 'Spotify login was cancelled before Sato received permission.',
  spotify_config_missing: 'Spotify credentials are not configured yet. Add your Client ID and Client Secret in the app before signing in.',
}

export default {
  components: {
    BlendView,
  },
  data() {
    return {
      satoLogo,
      user: null,
      spotifyConfig: {
        clientId: '',
        clientSecret: '',
        configured: false,
        source: null,
      },
      loadingSession: true,
      loadingSpotifyConfig: true,
      savingSpotifyConfig: false,
      authMessage: '',
      noticeTone: 'notice-banner--neutral',
    }
  },
  computed: {
    canLogin() {
      return this.spotifyConfig.configured
    },
    canSaveSpotifyConfig() {
      return Boolean(
        this.spotifyConfig.clientId.trim() && this.spotifyConfig.clientSecret.trim(),
      )
    },
    displayName() {
      return this.user?.display_name || 'You'
    },
    userImage() {
      return this.user?.images?.[0]?.url || ''
    },
  },
  methods: {
    login() {
      if (!this.canLogin) {
        this.authMessage = AUTH_ERRORS.spotify_config_missing
        this.noticeTone = 'notice-banner--error'
        return
      }
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
        await this.loadSpotifyConfig()
      } catch (error) {
        this.authMessage = error.message
        this.noticeTone = 'notice-banner--error'
      }
    },
    async loadSpotifyConfig() {
      this.loadingSpotifyConfig = true
      try {
        const config = await apiRequest('/api/auth/spotify-config')
        this.spotifyConfig.configured = Boolean(config.configured)
        this.spotifyConfig.source = config.source || null
        if (!this.spotifyConfig.clientId) {
          this.spotifyConfig.clientId = config.client_id || ''
        }
      } catch (error) {
        this.authMessage = error.message
        this.noticeTone = 'notice-banner--error'
      } finally {
        this.loadingSpotifyConfig = false
      }
    },
    async saveSpotifyConfig() {
      if (!this.canSaveSpotifyConfig) {
        this.authMessage = 'Provide both Spotify Client ID and Client Secret before saving.'
        this.noticeTone = 'notice-banner--error'
        return
      }

      this.savingSpotifyConfig = true
      try {
        const config = await apiRequest('/api/auth/spotify-config', {
          method: 'POST',
          body: JSON.stringify({
            client_id: this.spotifyConfig.clientId.trim(),
            client_secret: this.spotifyConfig.clientSecret.trim(),
          }),
        })

        this.spotifyConfig.configured = Boolean(config.configured)
        this.spotifyConfig.source = config.source || null
        this.spotifyConfig.clientId = config.client_id || this.spotifyConfig.clientId
        this.user = null
        this.authMessage = 'Spotify app credentials saved for this browser session.'
        this.noticeTone = 'notice-banner--success'
      } catch (error) {
        this.authMessage = error.message
        this.noticeTone = 'notice-banner--error'
      } finally {
        this.savingSpotifyConfig = false
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
    this.loadSpotifyConfig()
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
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex: none;
  overflow: hidden;
  background: var(--spotify-accent);
}

.brand-mark__image {
  width: 72%;
  height: 72%;
  object-fit: contain;
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
.secondary-button,
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

.secondary-button,
.logout-button {
  background: #2a2a2a;
  color: #ffffff;
}

.spotify-button:disabled,
.secondary-button:disabled,
.logout-button:disabled {
  cursor: not-allowed;
  opacity: 0.48;
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

.config-form {
  display: grid;
  gap: 0.8rem;
  margin-top: 1rem;
  padding: 0.95rem;
  border-radius: 1rem;
  background: rgba(255, 255, 255, 0.04);
}

.config-form__title,
.config-form__copy,
.config-status,
.login-card__hint {
  margin: 0;
}

.config-form__title {
  font-size: 0.95rem;
  font-weight: 700;
}

.config-form__copy,
.config-status,
.login-card__hint {
  color: var(--spotify-muted);
  font-size: 0.86rem;
  line-height: 1.5;
}

.config-field {
  display: grid;
  gap: 0.35rem;
}

.config-field span {
  font-size: 0.82rem;
  font-weight: 700;
}

.config-input {
  width: 100%;
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 0.85rem;
  padding: 0.85rem 0.95rem;
  background: #0f0f0f;
  color: #ffffff;
}

.config-input:focus {
  outline: 2px solid rgba(30, 215, 96, 0.3);
  outline-offset: 1px;
  border-color: transparent;
}

.config-actions {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  flex-wrap: wrap;
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
  border-radius: 999px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex: none;
  overflow: hidden;
  background: var(--spotify-accent);
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
