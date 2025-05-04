import { createRouter, createWebHistory } from 'vue-router'
import BlendCreator from '../components/BlendCreator.vue'
import TournamentBracket from '../components/TournamentBracket.vue'

const routes = [
  { path: '/', component: BlendCreator },
  { path: '/tournament', component: TournamentBracket }
]

export default createRouter({
  history: createWebHistory(),
  routes
})