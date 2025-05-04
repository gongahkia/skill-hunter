<template>
  <div id="app">
    <header>
      <h1>Sato</h1>
      <nav>
        <router-link to="/">Blend Creator</router-link>
        <router-link to="/tournament">Tournament</router-link>
      </nav>
    </header>
    <main>
      <router-view />
    </main>
    <footer>
      <small>
        Made with <span aria-label="love" role="img">❤️</span> by
        <a href="https://gabrielongzm.com" target="_blank" rel="noopener">Gabriel Ong</a>.
        Source code <a href="https://github.com/gongahkia/sato" target="_blank" rel="noopener">here</a>.<br>
        Sato &copy; {{ new Date().getFullYear() }}
      </small>
    </footer>
  </div>
</template>

<script setup>
// No script logic needed for this simple layout
</script>

<style scoped>
#app {
  font-family: 'Segoe UI', Arial, sans-serif;
  background: #1e1e1e;
  color: #fff;
  min-height: 100vh;
  display: flex;
  flex-direction: column;
}
header {
  background: #181818;
  padding: 1rem 2rem;
}
nav {
  display: flex;
  gap: 2rem;
}
nav a {
  color: #1db954;
  text-decoration: none;
  font-weight: bold;
  transition: color 0.2s;
}
nav a.router-link-exact-active {
  color: #fff;
  border-bottom: 2px solid #1db954;
}
main {
  flex: 1;
  padding: 2rem;
  max-width: 900px;
  margin: 0 auto;
}
footer {
  background: #181818;
  color: #aaa;
  text-align: center;
  padding: 1rem 0;
}
footer a {
  color: #1db954;
  text-decoration: underline;
  font-weight: 500;
  transition: color 0.2s;
}
footer a:hover {
  color: #fff;
}
</style>