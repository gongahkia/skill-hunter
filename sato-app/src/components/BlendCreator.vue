<template>
  <div class="blend-creator">

    <div v-if="!isAuthenticated" class="auth-prompt">
      <button @click="initiateAuth">Login with Spotify</button>
      <p v-if="error" class="error">{{ error }}</p>
    </div>

    <div v-else>
      <div class="profile-inputs">
        <div v-for="(user, index) in users" :key="index" class="input-group">
          <input
            v-model="users[index].url"
            placeholder="Spotify Profile URL"
          >
          <input
            type="number"
            v-model.number="users[index].weight"
            min="0"
            max="100"
            class="weight-input"
          >
        </div>
        <button @click="addUser">+ Add User</button>
      </div>

      <div class="controls">
        <label>Time Range:
          <select v-model="timeRange">
            <option value="short_term">4 Weeks</option>
            <option value="medium_term">6 Months</option>
            <option value="long_term">All Time</option>
          </select>
        </label>
        <button @click="generateBlend">Create Blend</button>
      </div>

      <div v-if="blend" class="results">
        <div v-for="(track, index) in blend" :key="index" class="track-item">
          <div class="track-info">
            <span>{{ track.name }}</span>
            <span class="artist">{{ track.artists[0] }}</span>
          </div>
          <div class="contributors">
            <div
              v-for="([user, percent], i) in Object.entries(track.contributors)"
              :key="i"
              class="contributor"
              :style="{ width: `${percent}%` }"
            >
              {{ Math.round(percent) }}% {{ user }}
            </div>
          </div>
        </div>
      </div>
      <p v-if="error" class="error">{{ error }}</p>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import axios from 'axios'
import { generateCodeVerifier, generateCodeChallenge } from '@/utils/auth'

const users = ref([{ url: '', weight: 50 }, { url: '', weight: 50 }])
const timeRange = ref('medium_term')
const blend = ref(null)
const isAuthenticated = ref(false)
const error = ref('')

const addUser = () => {
  users.value.push({ url: '', weight: 0 })
}

const initiateAuth = async () => {
  try {
    const codeVerifier = generateCodeVerifier(128)
    const codeChallenge = await generateCodeChallenge(codeVerifier)

    localStorage.setItem('code_verifier', codeVerifier)

    const params = new URLSearchParams({
      client_id: import.meta.env.VITE_SPOTIFY_CLIENT_ID,
      response_type: 'code',
      redirect_uri: 'http://127.0.0.1:5000/callback',
      code_challenge_method: 'S256',
      code_challenge: codeChallenge,
      scope: 'user-top-read playlist-modify-private',
      show_dialog: true
    })

    window.location.href = `https://accounts.spotify.com/authorize?${params}`
  } catch (err) {
    error.value = 'Failed to initiate Spotify authentication.'
    console.error(err)
  }
}

const handleCallback = async () => {
  const urlParams = new URLSearchParams(window.location.search)
  const code = urlParams.get('code')
  const codeVerifier = localStorage.getItem('code_verifier')

  try {
    if (code && codeVerifier) {
      // Exchange code for access token
      const response = await axios.post('http://127.0.0.1:5000/callback', {
        code,
        code_verifier: codeVerifier
      })
      localStorage.setItem('access_token', response.data.access_token)
      isAuthenticated.value = true
      error.value = ''
      // Clean up code from URL
      window.history.replaceState({}, document.title, window.location.pathname)
    } else if (localStorage.getItem('access_token')) {
      // Optionally verify token validity
      try {
        await axios.get('https://api.spotify.com/v1/me', {
          headers: {
            Authorization: `Bearer ${localStorage.getItem('access_token')}`
          }
        })
        isAuthenticated.value = true
        error.value = ''
      } catch (tokenErr) {
        // Invalid token
        localStorage.removeItem('access_token')
        isAuthenticated.value = false
        error.value = 'Spotify session expired. Please log in again.'
      }
    }
  } catch (err) {
    error.value = 'Authentication failed. Please try again.'
    localStorage.removeItem('access_token')
    isAuthenticated.value = false
    console.error(err)
  }
}

const generateBlend = async () => {
  try {
    const accessToken = localStorage.getItem('access_token')
    if (!accessToken) {
      error.value = 'Please login with Spotify first.'
      return
    }
    const response = await axios.post('http://127.0.0.1:5000/api/blend', {
      users: users.value.map(u => u.url),
      auth_token: accessToken,
      time_range: timeRange.value
    })
    blend.value = response.data
    error.value = ''
  } catch (err) {
    error.value = 'Blend creation failed. Please check your input and try again.'
    console.error(err)
  }
}

onMounted(handleCallback)
onMounted(() => {
  window.addEventListener('message', async (event) => {
    if (event.origin !== 'http://127.0.0.1:5000') return  // Verify backend origin
    if (event.data.type === 'spotify-auth') {
      const code = event.data.code
      const codeVerifier = localStorage.getItem('code_verifier')
      
      try {
        const response = await axios.post('http://127.0.0.1:5000/callback', {
          code,
          code_verifier: codeVerifier
        })
        localStorage.setItem('access_token', response.data.access_token)
        isAuthenticated.value = true
      } catch (error) {
        console.error('Authentication failed:', error)
      }
    }
  })
})

</script>
onMounted(() => {
  window.addEventListener('message', async (event) => {
    if (event.origin !== 'http://127.0.0.1:5000') return  // Verify backend origin
    if (event.data.type === 'spotify-auth') {
      const code = event.data.code
      const codeVerifier = localStorage.getItem('code_verifier')
      
      try {
        const response = await axios.post('http://127.0.0.1:5000/callback', {
          code,
          code_verifier: codeVerifier
        })
        localStorage.setItem('access_token', response.data.access_token)
        isAuthenticated.value = true
      } catch (error) {
        console.error('Authentication failed:', error)
      }
    }
  })
})


<style scoped>
onMounted(() => {
  window.addEventListener('message', async (event) => {
    if (event.origin !== 'http://127.0.0.1:5000') return  // Verify backend origin
    if (event.data.type === 'spotify-auth') {
      const code = event.data.code
      const codeVerifier = localStorage.getItem('code_verifier')
      
      try {
        const response = await axios.post('http://127.0.0.1:5000/callback', {
          code,
          code_verifier: codeVerifier
        })
        localStorage.setItem('access_token', response.data.access_token)
        isAuthenticated.value = true
      } catch (error) {
        console.error('Authentication failed:', error)
      }
    }
  })
})

.blend-creator {
  onMounted(() => {
  window.addEventListener('message', async (event) => {
    if (event.origin !== 'http://127.0.0.1:5000') return  // Verify backend origin
    if (event.data.type === 'spotify-auth') {
      const code = event.data.code
      const codeVerifier = localStorage.getItem('code_verifier')
      
      try {
        const response = await axios.post('http://127.0.0.1:5000/callback', {
          code,
          code_verifier: codeVerifier
        })
        localStorage.setItem('access_token', response.data.access_token)
        isAuthenticated.value = true
      } catch (error) {
        console.error('Authentication failed:', error)
      }
    }
  })
})

  max-width: 600px;
  onMounted(() => {
  window.addEventListener('message', async (event) => {
    if (event.origin !== 'http://127.0.0.1:5000') return  // Verify backend origin
    if (event.data.type === 'spotify-auth') {
      const code = event.data.code
      const codeVerifier = localStorage.getItem('code_verifier')
      
      try {
        const response = await axios.post('http://127.0.0.1:5000/callback', {
          code,
          code_verifier: codeVerifier
        })
        localStorage.setItem('access_token', response.data.access_token)
        isAuthenticated.value = true
      } catch (error) {
        console.error('Authentication failed:', error)
      }
    }
  })
})

  margin: 2rem auto;
  onMounted(() => {
  window.addEventListener('message', async (event) => {
    if (event.origin !== 'http://127.0.0.1:5000') return  // Verify backend origin
    if (event.data.type === 'spotify-auth') {
      const code = event.data.code
      const codeVerifier = localStorage.getItem('code_verifier')
      
      try {
        const response = await axios.post('http://127.0.0.1:5000/callback', {
          code,
          code_verifier: codeVerifier
        })
        localStorage.setItem('access_token', response.data.access_token)
        isAuthenticated.value = true
      } catch (error) {
        console.error('Authentication failed:', error)
      }
    }
  })
})

  padding: 2rem;
  onMounted(() => {
  window.addEventListener('message', async (event) => {
    if (event.origin !== 'http://127.0.0.1:5000') return  // Verify backend origin
    if (event.data.type === 'spotify-auth') {
      const code = event.data.code
      const codeVerifier = localStorage.getItem('code_verifier')
      
      try {
        const response = await axios.post('http://127.0.0.1:5000/callback', {
          code,
          code_verifier: codeVerifier
        })
        localStorage.setItem('access_token', response.data.access_token)
        isAuthenticated.value = true
      } catch (error) {
        console.error('Authentication failed:', error)
      }
    }
  })
})

  background: #232323;
  onMounted(() => {
  window.addEventListener('message', async (event) => {
    if (event.origin !== 'http://127.0.0.1:5000') return  // Verify backend origin
    if (event.data.type === 'spotify-auth') {
      const code = event.data.code
      const codeVerifier = localStorage.getItem('code_verifier')
      
      try {
        const response = await axios.post('http://127.0.0.1:5000/callback', {
          code,
          code_verifier: codeVerifier
        })
        localStorage.setItem('access_token', response.data.access_token)
        isAuthenticated.value = true
      } catch (error) {
        console.error('Authentication failed:', error)
      }
    }
  })
})

  border-radius: 12px;
  onMounted(() => {
  window.addEventListener('message', async (event) => {
    if (event.origin !== 'http://127.0.0.1:5000') return  // Verify backend origin
    if (event.data.type === 'spotify-auth') {
      const code = event.data.code
      const codeVerifier = localStorage.getItem('code_verifier')
      
      try {
        const response = await axios.post('http://127.0.0.1:5000/callback', {
          code,
          code_verifier: codeVerifier
        })
        localStorage.setItem('access_token', response.data.access_token)
        isAuthenticated.value = true
      } catch (error) {
        console.error('Authentication failed:', error)
      }
    }
  })
})

  color: #fff;
  onMounted(() => {
  window.addEventListener('message', async (event) => {
    if (event.origin !== 'http://127.0.0.1:5000') return  // Verify backend origin
    if (event.data.type === 'spotify-auth') {
      const code = event.data.code
      const codeVerifier = localStorage.getItem('code_verifier')
      
      try {
        const response = await axios.post('http://127.0.0.1:5000/callback', {
          code,
          code_verifier: codeVerifier
        })
        localStorage.setItem('access_token', response.data.access_token)
        isAuthenticated.value = true
      } catch (error) {
        console.error('Authentication failed:', error)
      }
    }
  })
})

}
onMounted(() => {
  window.addEventListener('message', async (event) => {
    if (event.origin !== 'http://127.0.0.1:5000') return  // Verify backend origin
    if (event.data.type === 'spotify-auth') {
      const code = event.data.code
      const codeVerifier = localStorage.getItem('code_verifier')
      
      try {
        const response = await axios.post('http://127.0.0.1:5000/callback', {
          code,
          code_verifier: codeVerifier
        })
        localStorage.setItem('access_token', response.data.access_token)
        isAuthenticated.value = true
      } catch (error) {
        console.error('Authentication failed:', error)
      }
    }
  })
})

.input-group {
  onMounted(() => {
  window.addEventListener('message', async (event) => {
    if (event.origin !== 'http://127.0.0.1:5000') return  // Verify backend origin
    if (event.data.type === 'spotify-auth') {
      const code = event.data.code
      const codeVerifier = localStorage.getItem('code_verifier')
      
      try {
        const response = await axios.post('http://127.0.0.1:5000/callback', {
          code,
          code_verifier: codeVerifier
        })
        localStorage.setItem('access_token', response.data.access_token)
        isAuthenticated.value = true
      } catch (error) {
        console.error('Authentication failed:', error)
      }
    }
  })
})

  display: flex;
  onMounted(() => {
  window.addEventListener('message', async (event) => {
    if (event.origin !== 'http://127.0.0.1:5000') return  // Verify backend origin
    if (event.data.type === 'spotify-auth') {
      const code = event.data.code
      const codeVerifier = localStorage.getItem('code_verifier')
      
      try {
        const response = await axios.post('http://127.0.0.1:5000/callback', {
          code,
          code_verifier: codeVerifier
        })
        localStorage.setItem('access_token', response.data.access_token)
        isAuthenticated.value = true
      } catch (error) {
        console.error('Authentication failed:', error)
      }
    }
  })
})

  gap: 1rem;
  onMounted(() => {
  window.addEventListener('message', async (event) => {
    if (event.origin !== 'http://127.0.0.1:5000') return  // Verify backend origin
    if (event.data.type === 'spotify-auth') {
      const code = event.data.code
      const codeVerifier = localStorage.getItem('code_verifier')
      
      try {
        const response = await axios.post('http://127.0.0.1:5000/callback', {
          code,
          code_verifier: codeVerifier
        })
        localStorage.setItem('access_token', response.data.access_token)
        isAuthenticated.value = true
      } catch (error) {
        console.error('Authentication failed:', error)
      }
    }
  })
})

  margin-bottom: 1rem;
  onMounted(() => {
  window.addEventListener('message', async (event) => {
    if (event.origin !== 'http://127.0.0.1:5000') return  // Verify backend origin
    if (event.data.type === 'spotify-auth') {
      const code = event.data.code
      const codeVerifier = localStorage.getItem('code_verifier')
      
      try {
        const response = await axios.post('http://127.0.0.1:5000/callback', {
          code,
          code_verifier: codeVerifier
        })
        localStorage.setItem('access_token', response.data.access_token)
        isAuthenticated.value = true
      } catch (error) {
        console.error('Authentication failed:', error)
      }
    }
  })
})

}
onMounted(() => {
  window.addEventListener('message', async (event) => {
    if (event.origin !== 'http://127.0.0.1:5000') return  // Verify backend origin
    if (event.data.type === 'spotify-auth') {
      const code = event.data.code
      const codeVerifier = localStorage.getItem('code_verifier')
      
      try {
        const response = await axios.post('http://127.0.0.1:5000/callback', {
          code,
          code_verifier: codeVerifier
        })
        localStorage.setItem('access_token', response.data.access_token)
        isAuthenticated.value = true
      } catch (error) {
        console.error('Authentication failed:', error)
      }
    }
  })
})

.weight-input {
  onMounted(() => {
  window.addEventListener('message', async (event) => {
    if (event.origin !== 'http://127.0.0.1:5000') return  // Verify backend origin
    if (event.data.type === 'spotify-auth') {
      const code = event.data.code
      const codeVerifier = localStorage.getItem('code_verifier')
      
      try {
        const response = await axios.post('http://127.0.0.1:5000/callback', {
          code,
          code_verifier: codeVerifier
        })
        localStorage.setItem('access_token', response.data.access_token)
        isAuthenticated.value = true
      } catch (error) {
        console.error('Authentication failed:', error)
      }
    }
  })
})

  width: 80px;
  onMounted(() => {
  window.addEventListener('message', async (event) => {
    if (event.origin !== 'http://127.0.0.1:5000') return  // Verify backend origin
    if (event.data.type === 'spotify-auth') {
      const code = event.data.code
      const codeVerifier = localStorage.getItem('code_verifier')
      
      try {
        const response = await axios.post('http://127.0.0.1:5000/callback', {
          code,
          code_verifier: codeVerifier
        })
        localStorage.setItem('access_token', response.data.access_token)
        isAuthenticated.value = true
      } catch (error) {
        console.error('Authentication failed:', error)
      }
    }
  })
})

}
onMounted(() => {
  window.addEventListener('message', async (event) => {
    if (event.origin !== 'http://127.0.0.1:5000') return  // Verify backend origin
    if (event.data.type === 'spotify-auth') {
      const code = event.data.code
      const codeVerifier = localStorage.getItem('code_verifier')
      
      try {
        const response = await axios.post('http://127.0.0.1:5000/callback', {
          code,
          code_verifier: codeVerifier
        })
        localStorage.setItem('access_token', response.data.access_token)
        isAuthenticated.value = true
      } catch (error) {
        console.error('Authentication failed:', error)
      }
    }
  })
})

.controls {
  onMounted(() => {
  window.addEventListener('message', async (event) => {
    if (event.origin !== 'http://127.0.0.1:5000') return  // Verify backend origin
    if (event.data.type === 'spotify-auth') {
      const code = event.data.code
      const codeVerifier = localStorage.getItem('code_verifier')
      
      try {
        const response = await axios.post('http://127.0.0.1:5000/callback', {
          code,
          code_verifier: codeVerifier
        })
        localStorage.setItem('access_token', response.data.access_token)
        isAuthenticated.value = true
      } catch (error) {
        console.error('Authentication failed:', error)
      }
    }
  })
})

  margin: 1.5rem 0;
  onMounted(() => {
  window.addEventListener('message', async (event) => {
    if (event.origin !== 'http://127.0.0.1:5000') return  // Verify backend origin
    if (event.data.type === 'spotify-auth') {
      const code = event.data.code
      const codeVerifier = localStorage.getItem('code_verifier')
      
      try {
        const response = await axios.post('http://127.0.0.1:5000/callback', {
          code,
          code_verifier: codeVerifier
        })
        localStorage.setItem('access_token', response.data.access_token)
        isAuthenticated.value = true
      } catch (error) {
        console.error('Authentication failed:', error)
      }
    }
  })
})

}
onMounted(() => {
  window.addEventListener('message', async (event) => {
    if (event.origin !== 'http://127.0.0.1:5000') return  // Verify backend origin
    if (event.data.type === 'spotify-auth') {
      const code = event.data.code
      const codeVerifier = localStorage.getItem('code_verifier')
      
      try {
        const response = await axios.post('http://127.0.0.1:5000/callback', {
          code,
          code_verifier: codeVerifier
        })
        localStorage.setItem('access_token', response.data.access_token)
        isAuthenticated.value = true
      } catch (error) {
        console.error('Authentication failed:', error)
      }
    }
  })
})

.track-item {
  onMounted(() => {
  window.addEventListener('message', async (event) => {
    if (event.origin !== 'http://127.0.0.1:5000') return  // Verify backend origin
    if (event.data.type === 'spotify-auth') {
      const code = event.data.code
      const codeVerifier = localStorage.getItem('code_verifier')
      
      try {
        const response = await axios.post('http://127.0.0.1:5000/callback', {
          code,
          code_verifier: codeVerifier
        })
        localStorage.setItem('access_token', response.data.access_token)
        isAuthenticated.value = true
      } catch (error) {
        console.error('Authentication failed:', error)
      }
    }
  })
})

  background: #181818;
  onMounted(() => {
  window.addEventListener('message', async (event) => {
    if (event.origin !== 'http://127.0.0.1:5000') return  // Verify backend origin
    if (event.data.type === 'spotify-auth') {
      const code = event.data.code
      const codeVerifier = localStorage.getItem('code_verifier')
      
      try {
        const response = await axios.post('http://127.0.0.1:5000/callback', {
          code,
          code_verifier: codeVerifier
        })
        localStorage.setItem('access_token', response.data.access_token)
        isAuthenticated.value = true
      } catch (error) {
        console.error('Authentication failed:', error)
      }
    }
  })
})

  margin-bottom: 1rem;
  onMounted(() => {
  window.addEventListener('message', async (event) => {
    if (event.origin !== 'http://127.0.0.1:5000') return  // Verify backend origin
    if (event.data.type === 'spotify-auth') {
      const code = event.data.code
      const codeVerifier = localStorage.getItem('code_verifier')
      
      try {
        const response = await axios.post('http://127.0.0.1:5000/callback', {
          code,
          code_verifier: codeVerifier
        })
        localStorage.setItem('access_token', response.data.access_token)
        isAuthenticated.value = true
      } catch (error) {
        console.error('Authentication failed:', error)
      }
    }
  })
})

  padding: 1rem;
  onMounted(() => {
  window.addEventListener('message', async (event) => {
    if (event.origin !== 'http://127.0.0.1:5000') return  // Verify backend origin
    if (event.data.type === 'spotify-auth') {
      const code = event.data.code
      const codeVerifier = localStorage.getItem('code_verifier')
      
      try {
        const response = await axios.post('http://127.0.0.1:5000/callback', {
          code,
          code_verifier: codeVerifier
        })
        localStorage.setItem('access_token', response.data.access_token)
        isAuthenticated.value = true
      } catch (error) {
        console.error('Authentication failed:', error)
      }
    }
  })
})

  border-radius: 8px;
  onMounted(() => {
  window.addEventListener('message', async (event) => {
    if (event.origin !== 'http://127.0.0.1:5000') return  // Verify backend origin
    if (event.data.type === 'spotify-auth') {
      const code = event.data.code
      const codeVerifier = localStorage.getItem('code_verifier')
      
      try {
        const response = await axios.post('http://127.0.0.1:5000/callback', {
          code,
          code_verifier: codeVerifier
        })
        localStorage.setItem('access_token', response.data.access_token)
        isAuthenticated.value = true
      } catch (error) {
        console.error('Authentication failed:', error)
      }
    }
  })
})

}
onMounted(() => {
  window.addEventListener('message', async (event) => {
    if (event.origin !== 'http://127.0.0.1:5000') return  // Verify backend origin
    if (event.data.type === 'spotify-auth') {
      const code = event.data.code
      const codeVerifier = localStorage.getItem('code_verifier')
      
      try {
        const response = await axios.post('http://127.0.0.1:5000/callback', {
          code,
          code_verifier: codeVerifier
        })
        localStorage.setItem('access_token', response.data.access_token)
        isAuthenticated.value = true
      } catch (error) {
        console.error('Authentication failed:', error)
      }
    }
  })
})

.track-info {
  onMounted(() => {
  window.addEventListener('message', async (event) => {
    if (event.origin !== 'http://127.0.0.1:5000') return  // Verify backend origin
    if (event.data.type === 'spotify-auth') {
      const code = event.data.code
      const codeVerifier = localStorage.getItem('code_verifier')
      
      try {
        const response = await axios.post('http://127.0.0.1:5000/callback', {
          code,
          code_verifier: codeVerifier
        })
        localStorage.setItem('access_token', response.data.access_token)
        isAuthenticated.value = true
      } catch (error) {
        console.error('Authentication failed:', error)
      }
    }
  })
})

  font-weight: bold;
  onMounted(() => {
  window.addEventListener('message', async (event) => {
    if (event.origin !== 'http://127.0.0.1:5000') return  // Verify backend origin
    if (event.data.type === 'spotify-auth') {
      const code = event.data.code
      const codeVerifier = localStorage.getItem('code_verifier')
      
      try {
        const response = await axios.post('http://127.0.0.1:5000/callback', {
          code,
          code_verifier: codeVerifier
        })
        localStorage.setItem('access_token', response.data.access_token)
        isAuthenticated.value = true
      } catch (error) {
        console.error('Authentication failed:', error)
      }
    }
  })
})

}
onMounted(() => {
  window.addEventListener('message', async (event) => {
    if (event.origin !== 'http://127.0.0.1:5000') return  // Verify backend origin
    if (event.data.type === 'spotify-auth') {
      const code = event.data.code
      const codeVerifier = localStorage.getItem('code_verifier')
      
      try {
        const response = await axios.post('http://127.0.0.1:5000/callback', {
          code,
          code_verifier: codeVerifier
        })
        localStorage.setItem('access_token', response.data.access_token)
        isAuthenticated.value = true
      } catch (error) {
        console.error('Authentication failed:', error)
      }
    }
  })
})

.artist {
  onMounted(() => {
  window.addEventListener('message', async (event) => {
    if (event.origin !== 'http://127.0.0.1:5000') return  // Verify backend origin
    if (event.data.type === 'spotify-auth') {
      const code = event.data.code
      const codeVerifier = localStorage.getItem('code_verifier')
      
      try {
        const response = await axios.post('http://127.0.0.1:5000/callback', {
          code,
          code_verifier: codeVerifier
        })
        localStorage.setItem('access_token', response.data.access_token)
        isAuthenticated.value = true
      } catch (error) {
        console.error('Authentication failed:', error)
      }
    }
  })
})

  color: #1db954;
  onMounted(() => {
  window.addEventListener('message', async (event) => {
    if (event.origin !== 'http://127.0.0.1:5000') return  // Verify backend origin
    if (event.data.type === 'spotify-auth') {
      const code = event.data.code
      const codeVerifier = localStorage.getItem('code_verifier')
      
      try {
        const response = await axios.post('http://127.0.0.1:5000/callback', {
          code,
          code_verifier: codeVerifier
        })
        localStorage.setItem('access_token', response.data.access_token)
        isAuthenticated.value = true
      } catch (error) {
        console.error('Authentication failed:', error)
      }
    }
  })
})

  margin-left: 1rem;
  onMounted(() => {
  window.addEventListener('message', async (event) => {
    if (event.origin !== 'http://127.0.0.1:5000') return  // Verify backend origin
    if (event.data.type === 'spotify-auth') {
      const code = event.data.code
      const codeVerifier = localStorage.getItem('code_verifier')
      
      try {
        const response = await axios.post('http://127.0.0.1:5000/callback', {
          code,
          code_verifier: codeVerifier
        })
        localStorage.setItem('access_token', response.data.access_token)
        isAuthenticated.value = true
      } catch (error) {
        console.error('Authentication failed:', error)
      }
    }
  })
})

}
onMounted(() => {
  window.addEventListener('message', async (event) => {
    if (event.origin !== 'http://127.0.0.1:5000') return  // Verify backend origin
    if (event.data.type === 'spotify-auth') {
      const code = event.data.code
      const codeVerifier = localStorage.getItem('code_verifier')
      
      try {
        const response = await axios.post('http://127.0.0.1:5000/callback', {
          code,
          code_verifier: codeVerifier
        })
        localStorage.setItem('access_token', response.data.access_token)
        isAuthenticated.value = true
      } catch (error) {
        console.error('Authentication failed:', error)
      }
    }
  })
})

.contributors {
  onMounted(() => {
  window.addEventListener('message', async (event) => {
    if (event.origin !== 'http://127.0.0.1:5000') return  // Verify backend origin
    if (event.data.type === 'spotify-auth') {
      const code = event.data.code
      const codeVerifier = localStorage.getItem('code_verifier')
      
      try {
        const response = await axios.post('http://127.0.0.1:5000/callback', {
          code,
          code_verifier: codeVerifier
        })
        localStorage.setItem('access_token', response.data.access_token)
        isAuthenticated.value = true
      } catch (error) {
        console.error('Authentication failed:', error)
      }
    }
  })
})

  margin-top: 0.5rem;
  onMounted(() => {
  window.addEventListener('message', async (event) => {
    if (event.origin !== 'http://127.0.0.1:5000') return  // Verify backend origin
    if (event.data.type === 'spotify-auth') {
      const code = event.data.code
      const codeVerifier = localStorage.getItem('code_verifier')
      
      try {
        const response = await axios.post('http://127.0.0.1:5000/callback', {
          code,
          code_verifier: codeVerifier
        })
        localStorage.setItem('access_token', response.data.access_token)
        isAuthenticated.value = true
      } catch (error) {
        console.error('Authentication failed:', error)
      }
    }
  })
})

  display: flex;
  onMounted(() => {
  window.addEventListener('message', async (event) => {
    if (event.origin !== 'http://127.0.0.1:5000') return  // Verify backend origin
    if (event.data.type === 'spotify-auth') {
      const code = event.data.code
      const codeVerifier = localStorage.getItem('code_verifier')
      
      try {
        const response = await axios.post('http://127.0.0.1:5000/callback', {
          code,
          code_verifier: codeVerifier
        })
        localStorage.setItem('access_token', response.data.access_token)
        isAuthenticated.value = true
      } catch (error) {
        console.error('Authentication failed:', error)
      }
    }
  })
})

  gap: 0.5rem;
  onMounted(() => {
  window.addEventListener('message', async (event) => {
    if (event.origin !== 'http://127.0.0.1:5000') return  // Verify backend origin
    if (event.data.type === 'spotify-auth') {
      const code = event.data.code
      const codeVerifier = localStorage.getItem('code_verifier')
      
      try {
        const response = await axios.post('http://127.0.0.1:5000/callback', {
          code,
          code_verifier: codeVerifier
        })
        localStorage.setItem('access_token', response.data.access_token)
        isAuthenticated.value = true
      } catch (error) {
        console.error('Authentication failed:', error)
      }
    }
  })
})

}
onMounted(() => {
  window.addEventListener('message', async (event) => {
    if (event.origin !== 'http://127.0.0.1:5000') return  // Verify backend origin
    if (event.data.type === 'spotify-auth') {
      const code = event.data.code
      const codeVerifier = localStorage.getItem('code_verifier')
      
      try {
        const response = await axios.post('http://127.0.0.1:5000/callback', {
          code,
          code_verifier: codeVerifier
        })
        localStorage.setItem('access_token', response.data.access_token)
        isAuthenticated.value = true
      } catch (error) {
        console.error('Authentication failed:', error)
      }
    }
  })
})

.contributor {
  onMounted(() => {
  window.addEventListener('message', async (event) => {
    if (event.origin !== 'http://127.0.0.1:5000') return  // Verify backend origin
    if (event.data.type === 'spotify-auth') {
      const code = event.data.code
      const codeVerifier = localStorage.getItem('code_verifier')
      
      try {
        const response = await axios.post('http://127.0.0.1:5000/callback', {
          code,
          code_verifier: codeVerifier
        })
        localStorage.setItem('access_token', response.data.access_token)
        isAuthenticated.value = true
      } catch (error) {
        console.error('Authentication failed:', error)
      }
    }
  })
})

  background: #1db954;
  onMounted(() => {
  window.addEventListener('message', async (event) => {
    if (event.origin !== 'http://127.0.0.1:5000') return  // Verify backend origin
    if (event.data.type === 'spotify-auth') {
      const code = event.data.code
      const codeVerifier = localStorage.getItem('code_verifier')
      
      try {
        const response = await axios.post('http://127.0.0.1:5000/callback', {
          code,
          code_verifier: codeVerifier
        })
        localStorage.setItem('access_token', response.data.access_token)
        isAuthenticated.value = true
      } catch (error) {
        console.error('Authentication failed:', error)
      }
    }
  })
})

  color: #181818;
  onMounted(() => {
  window.addEventListener('message', async (event) => {
    if (event.origin !== 'http://127.0.0.1:5000') return  // Verify backend origin
    if (event.data.type === 'spotify-auth') {
      const code = event.data.code
      const codeVerifier = localStorage.getItem('code_verifier')
      
      try {
        const response = await axios.post('http://127.0.0.1:5000/callback', {
          code,
          code_verifier: codeVerifier
        })
        localStorage.setItem('access_token', response.data.access_token)
        isAuthenticated.value = true
      } catch (error) {
        console.error('Authentication failed:', error)
      }
    }
  })
})

  border-radius: 4px;
  onMounted(() => {
  window.addEventListener('message', async (event) => {
    if (event.origin !== 'http://127.0.0.1:5000') return  // Verify backend origin
    if (event.data.type === 'spotify-auth') {
      const code = event.data.code
      const codeVerifier = localStorage.getItem('code_verifier')
      
      try {
        const response = await axios.post('http://127.0.0.1:5000/callback', {
          code,
          code_verifier: codeVerifier
        })
        localStorage.setItem('access_token', response.data.access_token)
        isAuthenticated.value = true
      } catch (error) {
        console.error('Authentication failed:', error)
      }
    }
  })
})

  padding: 0.2rem 0.5rem;
  onMounted(() => {
  window.addEventListener('message', async (event) => {
    if (event.origin !== 'http://127.0.0.1:5000') return  // Verify backend origin
    if (event.data.type === 'spotify-auth') {
      const code = event.data.code
      const codeVerifier = localStorage.getItem('code_verifier')
      
      try {
        const response = await axios.post('http://127.0.0.1:5000/callback', {
          code,
          code_verifier: codeVerifier
        })
        localStorage.setItem('access_token', response.data.access_token)
        isAuthenticated.value = true
      } catch (error) {
        console.error('Authentication failed:', error)
      }
    }
  })
})

  font-size: 0.9em;
}
.auth-prompt {
  text-align: center;
  margin-top: 2rem;
}
.error {
  color: #ff5c5c;
  margin-top: 1rem;
}
</style>