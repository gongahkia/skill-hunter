<template>
  <div>
    <header>
      <h1 style="margin:0; text-align:center;">Sato</h1>
    </header>
    <span><br></span>
    <div v-if="!user">
      <button @click="login">Login with Spotify</button>
    </div>
    <div v-if="user">
      <div class="profile-summary">
        <img 
          v-if="user.images && user.images.length"
          :src="user.images[0].url" 
          alt="Profile"
          class="profile-image"
        />
        <div>
          <h2>{{ user.display_name }}</h2>
          <p>{{ user.email }}</p>
          <p>{{ user.country }} • {{ user.product }}</p>
          <p>Followers: {{ user.followers.total }}</p>
        </div>
      </div>
      <BlendView />
      <button @click="logout" class="logout-btn">Log Out</button>
    </div>
    <div v-if="error" class="error">
      {{ error }}
    </div>
    <footer style="margin-top:2em; font-size:0.95em;">
      Made with <span style="color:#e25555;">♥</span> by 
      <a href="https://gabrielongzm.com" target="_blank" rel="noopener">Gabriel Ong</a>.
      Source code <a href="https://github.com/gongahkia/sato" target="_blank" rel="noopener">here</a>.
    </footer>
  </div>
</template>
<script>
import BlendView from './components/BlendView.vue'
export default {
  components: {
    BlendView
  },
  data() {
    return {
      user: null,
      error: null
    }
  },
  methods: {
    login() {
      window.location.href = "http://127.0.0.1:5000/login"
    },
    async logout() {
      try {
        await fetch("http://127.0.0.1:5000/logout", {
          method: "POST",
          credentials: "include"
        })
        this.user = null
        window.location.search = ""
      } catch (err) {
        this.error = "Logout failed"
      }
    },
    async fetchUserData() {
      try {
        const response = await fetch("http://127.0.0.1:5000/me", {
          credentials: "include"
        })
        if (!response.ok) throw new Error("Failed to fetch user data")
        const data = await response.json()
        if (data.error) throw new Error(data.error)
        this.user = data
        window.history.replaceState({}, document.title, "/")
      } catch (err) {
        this.error = err.message
      }
    }
  },
  mounted() {
    if (window.location.search.includes("login=success")) {
      this.fetchUserData()
    }
  }
}
</script>
<style>
.profile-summary {
  gap: 1rem;
  align-items: ce;
  margin-bottom: 2rem;
}
.profile-image {
  width: 100px;
  height: 100px;
  border-radius: 50%;
}
.logout-btn {
  margin-top: 2rem;
  padding: 0.5rem 1rem;
  background: #ff4444;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
}
.error {
  color: red;
  margin-top: 1rem;
}
</style>