// stores/spotify.js
import { defineStore } from 'pinia'

export const useSpotifyStore = defineStore('spotify', {
  state: () => ({
    authToken: null,
    currentUser: null
  }),
  actions: {
    async authenticate() {
      // Implement Spotify OAuth flow
    },
    async refreshToken() {
      // Token refresh logic
    }
  }
})
