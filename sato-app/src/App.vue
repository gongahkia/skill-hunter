<template>
  <div>
    <div v-if="!user">
      <button @click="login">Login with Spotify</button>
    </div>
    <div v-if="user">
      <div>
        <img 
          v-if="user.images && user.images.length"
          :src="user.images[0].url" 
          alt="Profile"
        />
        <div>
          <h2>{{ user.display_name }}</h2>
          <p>{{ user.email }}</p>
          <p>{{ user.country }} • {{ user.product }}</p>
        </div>
      </div>
      <div>
        <div>
          <span>{{ user.followers.total }}</span>
          <span> Followers</span>
        </div>
      </div>
      <br>
      <button @click="logout">Log Out</button>
    </div>
    <div v-if="error">
      {{ error }}
    </div>
  </div>
</template>

<script>
export default {
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