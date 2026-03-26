export const MOODS = ['FOCUS', 'STRESSED', 'RELAXED', 'TIRED', 'ENERGIZED']

const THRESHOLDS = {
  focusNeutralMin: 0.35,
  focusHappyMin: 0.10,
  stressedNegativeMin: 0.40,
  relaxedHappyMin: 0.30,
  relaxedNeutralMin: 0.20,
  tiredSadMin: 0.25,
  tiredNeutralMin: 0.20,
  energizedSurpriseMin: 0.15,
  energizedHappyMin: 0.25,
}

function computeMood(scores) {
  const angry = scores.angry || 0
  const disgust = scores.disgust || 0
  const fear = scores.fear || 0
  const happy = scores.happy || 0
  const sad = scores.sad || 0
  const surprise = scores.surprise || 0
  const neutral = scores.neutral || 0
  const negative = angry + fear + disgust
  if (negative >= THRESHOLDS.stressedNegativeMin) return 'STRESSED'
  if (surprise >= THRESHOLDS.energizedSurpriseMin && happy >= THRESHOLDS.energizedHappyMin) return 'ENERGIZED'
  if (sad >= THRESHOLDS.tiredSadMin && neutral >= THRESHOLDS.tiredNeutralMin) return 'TIRED'
  if (neutral >= THRESHOLDS.focusNeutralMin && happy >= THRESHOLDS.focusHappyMin && neutral >= happy) return 'FOCUS'
  if (happy >= THRESHOLDS.relaxedHappyMin && neutral >= THRESHOLDS.relaxedNeutralMin) return 'RELAXED'
  if (neutral >= THRESHOLDS.focusNeutralMin && happy >= THRESHOLDS.focusHappyMin) return 'FOCUS'
  return 'FOCUS'
}

function computeConfidence(scores, mood) {
  if (mood === 'STRESSED') return Math.min(1, (scores.angry || 0) + (scores.fear || 0) + (scores.disgust || 0))
  if (mood === 'ENERGIZED') return Math.min(1, (scores.surprise || 0) + (scores.happy || 0))
  if (mood === 'TIRED') return Math.min(1, (scores.sad || 0) + (scores.neutral || 0))
  if (mood === 'RELAXED') return Math.min(1, (scores.happy || 0) + (scores.neutral || 0))
  return Math.min(1, (scores.neutral || 0) + (scores.happy || 0))
}

export class MoodClassifier {
  constructor(debounceWindows = 3) {
    this._debounceWindows = debounceWindows
    this._currentMood = null
    this._candidateMood = null
    this._candidateCount = 0
  }
  classify(scores) {
    const rawMood = computeMood(scores)
    const confidence = computeConfidence(scores, rawMood)
    const previous = this._currentMood
    let moodChanged = false
    if (this._currentMood === null) {
      this._currentMood = rawMood
      moodChanged = true
    } else if (rawMood !== this._currentMood) {
      if (rawMood === this._candidateMood) {
        this._candidateCount += 1
      } else {
        this._candidateMood = rawMood
        this._candidateCount = 1
      }
      if (this._candidateCount >= this._debounceWindows) {
        this._currentMood = rawMood
        this._candidateMood = null
        this._candidateCount = 0
        moodChanged = true
      }
    } else {
      this._candidateMood = null
      this._candidateCount = 0
    }
    return { mood: this._currentMood, confidence, moodChanged, previousMood: previous }
  }
  get currentMood() { return this._currentMood }
  reset() {
    this._currentMood = null
    this._candidateMood = null
    this._candidateCount = 0
  }
}
