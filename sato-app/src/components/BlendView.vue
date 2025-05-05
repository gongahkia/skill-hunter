<template>
    <div>
      <h2>Create Blend</h2>
      
      <!-- Friend Input -->
      <div>
        <textarea 
          v-model="profileUrls" 
          placeholder="Paste Spotify profile URLs (one per line)"
          rows="5"
          cols="50"
        ></textarea>
        <button @click="processFriends">Load Friends</button>
      </div>
  
      <!-- Friend List -->
      <div v-if="friends.length">
        <div v-for="friend in friends" :key="friend.id" class="friend-card">
          <img :src="friend.image" v-if="friend.image" class="profile-img"/>
          <div>
            <h3>{{ friend.name }}</h3>
            <p>Followers: {{ friend.followers }}</p>
            <p>Public Playlists: {{ friend.playlist_count }}</p>
            <input 
              type="range" 
              min="0" 
              max="100" 
              v-model="weights[friend.id]"
            />
            {{ weights[friend.id] }}%
          </div>
        </div>
        
        <button @click="generateBlend">Create Blend</button>
      </div>
  
      <!-- Result -->
      <div v-if="blendUrl">
        <h3>Your Blend is Ready!</h3>
        <a :href="blendUrl" target="_blank">Open in Spotify</a>
      </div>
    </div>
  </template>
  
  <script>
  export default {
    data() {
      return {
        profileUrls: '',
        friends: [],
        weights: {},
        blendUrl: null
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
        credentials: 'include',  // Crucial for sending cookies
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({ urls })
      })

      // Check for HTTP errors
      if (!response.ok) {
        const errorText = await response.text()
        throw new Error(`Server error: ${response.status} ${errorText}`)
      }

      // Verify content type
      const contentType = response.headers.get('content-type')
      if (!contentType?.includes('application/json')) {
        const text = await response.text()
        throw new Error(`Invalid response format: ${text}`)
      }

      const data = await response.json()
      
      // Handle backend application errors
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
        // Convert weights to decimal percentages
        const weights = {}
        this.selectedFriends.forEach(friendId => {
          weights[friendId] = this.weights[friendId] / 100
        })

        const response = await fetch('http://127.0.0.1:5000/generate-blend', {
          method: 'POST',
          credentials: 'include',
          headers: {'Content-Type': 'application/json'},
          body: JSON.stringify({
            weights: weights,
            self_weight: this.selfWeight / 100
          })
        })

        if (!response.ok) {
          const errorText = await response.text()
          throw new Error(`Blend creation failed: ${response.status} ${errorText}`)
        }

        const data = await response.json()
        this.blendUrl = data.external_urls.spotify
        this.error = null

      } catch (err) {
        console.error('Blend creation error:', err)
        this.error = err.message
        this.blendUrl = null
      }
    }
}

  }
  </script>
  
  <style>
  .friend-card {
    display: flex;
    gap: 1rem;
    margin: 1rem 0;
    padding: 1rem;
    border: 1px solid #ccc;
  }
  
  .profile-img {
    width: 100px;
    height: 100px;
    border-radius: 50%;
  }
  </style>