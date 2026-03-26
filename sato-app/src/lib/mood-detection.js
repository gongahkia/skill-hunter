import { ref, onUnmounted } from 'vue'
import { MoodClassifier } from './mood-classifier'

const DETECTION_INTERVAL_MS = 3000
const SMOOTHING_WINDOW = 5
const WEIGHTS = [1, 2, 4, 8, 16]

function weightedAverage(history) {
  const len = history.length
  if (!len) return null
  const w = WEIGHTS.slice(-len)
  const wSum = w.reduce((a, b) => a + b, 0)
  const keys = Object.keys(history[0])
  const result = {}
  for (const k of keys) {
    result[k] = history.reduce((acc, frame, i) => acc + (frame[k] || 0) * w[i], 0) / wSum
  }
  return result
}

export function useMoodDetection() {
  const detectedMood = ref(null)
  const confidence = ref(0)
  const isActive = ref(false)
  const error = ref(null)
  let video = null
  let canvas = null
  let timer = null
  let faceapi = null
  let emotionHistory = []
  const classifier = new MoodClassifier(3)

  async function loadFaceApi() {
    if (faceapi) return faceapi
    faceapi = await import('face-api.js')
    const MODEL_URL = '/models' // face-api.js model weights served from public/models
    await Promise.all([
      faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL),
      faceapi.nets.faceExpressionNet.loadFromUri(MODEL_URL),
    ])
    return faceapi
  }

  async function start(videoEl) {
    error.value = null
    try {
      const api = await loadFaceApi()
      const stream = await navigator.mediaDevices.getUserMedia({ video: { width: 320, height: 240 } })
      video = videoEl || document.createElement('video')
      video.srcObject = stream
      video.setAttribute('playsinline', '')
      await video.play()
      canvas = document.createElement('canvas')
      isActive.value = true
      timer = setInterval(() => detect(api), DETECTION_INTERVAL_MS)
    } catch (e) {
      error.value = e.message || 'Webcam access denied'
      isActive.value = false
    }
  }

  async function detect(api) {
    if (!video || video.readyState < 2) return
    const result = await api.detectSingleFace(video, new api.TinyFaceDetectorOptions()).withFaceExpressions()
    if (!result) return
    const expressions = result.expressions // { angry, disgusted, fearful, happy, sad, surprised, neutral }
    const scores = {
      angry: expressions.angry || 0,
      disgust: expressions.disgusted || 0,
      fear: expressions.fearful || 0,
      happy: expressions.happy || 0,
      sad: expressions.sad || 0,
      surprise: expressions.surprised || 0,
      neutral: expressions.neutral || 0,
    }
    emotionHistory.push(scores)
    if (emotionHistory.length > SMOOTHING_WINDOW) emotionHistory.shift()
    const smoothed = weightedAverage(emotionHistory)
    if (!smoothed) return
    const result2 = classifier.classify(smoothed)
    detectedMood.value = result2.mood
    confidence.value = result2.confidence
  }

  function stop() {
    if (timer) { clearInterval(timer); timer = null }
    if (video?.srcObject) {
      video.srcObject.getTracks().forEach(t => t.stop())
      video.srcObject = null
    }
    isActive.value = false
    emotionHistory = []
    classifier.reset()
  }

  onUnmounted(stop)

  return { detectedMood, confidence, isActive, error, start, stop }
}
