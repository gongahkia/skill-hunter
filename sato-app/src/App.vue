<template>
  <div>
    <button v-if="!user" @click="loginWithSpotify">Login with Spotify</button>
    <div v-if="user">
      <p>Welcome, {{ user.display_name }}</p>
      <img v-if="user.images && user.images.length" :src="user.images[0].url" alt="Profile" style="width:100px; border-radius:50%;" />
      <p>Email: {{ user.email }}</p>
    </div>
    <div v-if="error" style="color:red;">{{ error }}</div>
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
    loginWithSpotify() {
      window.location.href = "http://localhost:5000/login";  // Use localhost
    }
  },
  mounted() {
    // Check for ?login=success in the URL
    if (window.location.search.includes('login=success')) {
      fetch("http://localhost:5000/me", { credentials: "include" })  // Use localhost
        .then(res => res.json())
        .then(data => {
          if (data.error) {
            this.error = data.error;
          } else {
            this.user = data;
          }
        })
        .catch(() => {
          this.error = "Failed to fetch user info from backend.";
        });
    }
  }
}
</script>