<template>
    <div class="tournament-ui">
      <TournamentBracket :rounds="bracketRounds" @match-selected="handleMatchClick">
        <template #player="{ player }">
          <div class="track-matchup">
            <span>{{ player.name }}</span>
            <small>{{ player.artist }}</small>
          </div>
        </template>
      </TournamentBracket>
    </div>
  </template>
  
  <script setup>
  import { ref } from 'vue'
  import { TournamentBracket } from 'vue-tournament-bracket'
  
  const props = defineProps(['initialBracket'])
  const bracketRounds = ref(processBracket(props.initialBracket))
  
  const processBracket = (raw) => {
    return raw.map(round => ({
      games: round.matches.map(match => ({
        player1: match.track1,
        player2: match.track2
      }))
    }))
  }
  
  const handleMatchClick = (match) => {
    // Implement voting logic
  }
  </script>
  