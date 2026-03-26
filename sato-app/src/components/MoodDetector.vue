<template>
  <div class="mood-detector">
    <div class="mood-detector__header">
      <span class="field-label field-label--compact">Webcam mood detection</span>
      <button v-if="!isActive" class="ghost-button" type="button" @click="startDetection">
        Start Camera
      </button>
      <button v-else class="ghost-button" type="button" @click="stopDetection">
        Stop Camera
      </button>
    </div>
    <p v-if="error" class="helper-copy helper-copy--error">{{ error }}</p>
    <div v-if="isActive" class="mood-detector__preview">
      <video ref="videoEl" class="mood-detector__video" muted playsinline />
      <div v-if="detectedMood" class="mood-detector__result">
        <strong>{{ detectedMood }}</strong>
        <small>{{ (confidence * 100).toFixed(0) }}% confidence</small>
      </div>
    </div>
    <div v-if="detectedMood && !isActive" class="mood-detector__last">
      Last detected: <strong>{{ detectedMood }}</strong>
    </div>
    <button
      v-if="detectedMood"
      class="inline-button"
      type="button"
      @click="$emit('mood-selected', detectedMood)"
    >
      Use {{ detectedMood }} as mood source
    </button>
    <p class="helper-copy helper-copy--subtle">All detection runs locally in your browser. No video is sent to the server.</p>
  </div>
</template>

<script>
import { useMoodDetection } from '../lib/mood-detection'

export default {
  emits: ['mood-selected'],
  setup() {
    const { detectedMood, confidence, isActive, error, start, stop } = useMoodDetection()
    return { detectedMood, confidence, isActive, error, startMood: start, stopMood: stop }
  },
  methods: {
    startDetection() {
      this.startMood(this.$refs.videoEl)
    },
    stopDetection() {
      this.stopMood()
    },
  },
}
</script>

<style scoped>
.mood-detector {
  margin-top: 0.5rem;
  padding: 0.5rem;
  border: 1px solid rgba(255,255,255,0.08);
  border-radius: 8px;
}
.mood-detector__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 0.4rem;
}
.mood-detector__preview {
  position: relative;
  display: inline-block;
}
.mood-detector__video {
  width: 200px;
  border-radius: 6px;
  transform: scaleX(-1);
}
.mood-detector__result {
  position: absolute;
  bottom: 4px;
  left: 4px;
  background: rgba(0,0,0,0.7);
  color: #fff;
  padding: 2px 8px;
  border-radius: 4px;
  font-size: 0.8rem;
  display: flex;
  gap: 0.4rem;
  align-items: baseline;
}
.mood-detector__last {
  font-size: 0.85rem;
  margin: 0.3rem 0;
}
</style>
