// main.js
import { createApp } from 'vue'
import App from './App.vue'
import router from './router'
import BlendCreator from '@/components/BlendCreator.vue'  // Adjust path

const app = createApp(App)
app.component('BlendCreator', BlendCreator)  // Global registration
app.use(router)
app.mount('#app')