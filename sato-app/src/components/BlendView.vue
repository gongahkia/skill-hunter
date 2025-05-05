<template>
  <div>
    <h2>Create a Blend</h2>
    <div>
      <textarea 
        v-model="profileUrls" 
        placeholder="Paste Spotify profile URLs (one per line)"
        rows="5"
        cols="50"
      ></textarea>
      <br>
      <br>
      <button @click="processFriends">Load Friends</button>
    </div>
    <div v-if="friends.length">
      <div v-for="friend in friends" :key="friend.id">
        <label>
          <input 
            type="checkbox" 
            v-model="selectedFriends"
            :value="friend.id"
          >
          {{ friend.name }}
        </label>
        <span v-if="friend.image">
          <img :src="friend.image" alt="Profile" style="width:32px; vertical-align:middle;" />
        </span>
        <span>
          Followers: {{ friend.followers }},
          Public Playlists: {{ friend.playlist_count }}
        </span>
        <input 
          type="range" 
          min="0" 
          max="100" 
          v-model="weights[friend.id]"
          style="vertical-align:middle;"
        />
        <span>{{ weights[friend.id] }}%</span>
      </div>
      <button @click="generateBlend">Create Blend</button>
    </div>
    <div v-if="blendUrl">
      <h3>Your Blend is Ready!</h3>
      <a :href="blendUrl" target="_blank">Open in Spotify</a>
    </div>
    <div v-if="error" style="color:red;">
      {{ error }}
    </div>
  </div>
</template>
<script>
export default {
  data() {
    return {
      profileUrls: '',
      friends: [],
      selectedFriends: [],
      weights: {},
      selfWeight: 50,
      blendUrl: null,
      error: null
    }
  },
  methods: {
    async processFriends() {
      const urls = this.profileUrls.split('\n').filter(url => url.trim())
      if (!urls.length) {
        this.error = "Please enter at least one Spotify profile URL"
        return
      }
      try {
        const response = await fetch('http://127.0.0.1:5000/process-friends', {
          method: 'POST',
          credentials: 'include',
          headers: {'Content-Type': 'application/json'},
          body: JSON.stringify({ urls })
        })
        if (!response.ok) {
          const errorText = await response.text()
          throw new Error(`Server error: ${response.status} ${errorText}`)
        }
        const contentType = response.headers.get('content-type')
        if (!contentType?.includes('application/json')) {
          const text = await response.text()
          throw new Error(`Invalid response format: ${text}`)
        }
        const data = await response.json()
        if (data.error) {
          throw new Error(data.error)
        }
        this.friends = data
        this.friends.forEach(f => this.weights[f.id] = 50)
        this.error = null
      } catch (err) {
        console.error('Friend processing failed:', err)
        this.error = `Failed to load friends: ${err.message}`
        this.friends = []
      }
    },
    async generateBlend() {
      try {
        if (!this.selectedFriends.length) {
          throw new Error("Please select at least one friend")
        }
        const payload = {
          weights: {},
          self_weight: this.selfWeight / 100
        }
        this.selectedFriends.forEach(friendId => {
          const weight = this.weights[friendId]
          if (isNaN(weight) || weight < 0 || weight > 100) {
            throw new Error(`Invalid weight for ${friendId}`)
          }
          payload.weights[friendId] = weight / 100
        })
        const response = await fetch('http://127.0.0.1:5000/generate-blend', {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        })
        if (!response.ok) {
          let errorData
          try {
            errorData = await response.json()
          } catch {
            errorData = { error: await response.text() }
          }
          throw new Error(
            `Server error ${response.status}: ${errorData.error || 'Unknown error'}`
          )
        }
        const data = await response.json()
        if (!data?.external_urls?.spotify) {
          throw new Error("Invalid response format from server")
        }
        this.blendUrl = data.external_urls.spotify
        this.error = null
      } catch (err) {
        console.error('Blend creation failed:', err)
        this.error = err.message
        this.blendUrl = null
        this.$nextTick(() => {
          const errorEl = document.querySelector('.error-message')
          if (errorEl) errorEl.scrollIntoView({ behavior: 'smooth' })
        })
      }
    }
  }
}
</script>