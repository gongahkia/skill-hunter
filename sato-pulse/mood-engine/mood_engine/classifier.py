from __future__ import annotations

import logging
from collections import deque
from dataclasses import dataclass
from enum import Enum

logger = logging.getLogger("mood_engine.classifier")


class MoodState(str, Enum):
    FOCUS = "FOCUS"
    STRESSED = "STRESSED"
    RELAXED = "RELAXED"
    TIRED = "TIRED"
    ENERGIZED = "ENERGIZED"


@dataclass
class MoodThresholds:
    """Configurable thresholds for mood classification."""

    focus_neutral_min: float = 0.35
    focus_happy_min: float = 0.10
    stressed_negative_min: float = 0.40
    relaxed_happy_min: float = 0.30
    relaxed_neutral_min: float = 0.20
    tired_sad_min: float = 0.25
    tired_neutral_min: float = 0.20
    energized_surprise_min: float = 0.15
    energized_happy_min: float = 0.25


@dataclass
class ClassificationResult:
    mood: MoodState | None
    confidence: float
    mood_changed: bool
    previous_mood: MoodState | None


class MoodClassifier:
    """Classify smoothed emotions into mood states with debouncing."""

    def __init__(
        self,
        thresholds: MoodThresholds | None = None,
        debounce_windows: int = 3,
    ) -> None:
        self._thresholds = thresholds or MoodThresholds()
        self._debounce_windows = debounce_windows
        self._current_mood: MoodState | None = None
        self._candidate_mood: MoodState | None = None
        self._candidate_count: int = 0
        self._history: deque[MoodState] = deque(maxlen=100)

    def classify(
        self,
        scores: dict[str, float],
        confidence_threshold: float = 0.0,
    ) -> ClassificationResult:
        """Classify smoothed emotion scores into a mood state.

        Args:
            scores: Weighted average emotion probabilities (7 emotions).
            confidence_threshold: Minimum confidence required before a
                candidate mood can update accepted state.

        Returns:
            ClassificationResult with mood and transition info.
        """
        raw_mood = self._compute_mood(scores)
        confidence = self._compute_confidence(scores, raw_mood)

        previous = self._current_mood
        mood_changed = False

        if confidence < confidence_threshold:
            return ClassificationResult(
                mood=self._current_mood,
                confidence=confidence,
                mood_changed=False,
                previous_mood=previous,
            )

        if self._current_mood is None:
            self._current_mood = raw_mood
            mood_changed = True
        elif raw_mood != self._current_mood:
            if raw_mood == self._candidate_mood:
                self._candidate_count += 1
            else:
                self._candidate_mood = raw_mood
                self._candidate_count = 1

            if self._candidate_count >= self._debounce_windows:
                self._current_mood = raw_mood
                self._candidate_mood = None
                self._candidate_count = 0
                mood_changed = True
        else:
            self._candidate_mood = None
            self._candidate_count = 0

        if mood_changed:
            self._history.append(self._current_mood)

        return ClassificationResult(
            mood=self._current_mood,
            confidence=confidence,
            mood_changed=mood_changed,
            previous_mood=previous,
        )

    def _compute_mood(self, scores: dict[str, float]) -> MoodState:
        t = self._thresholds
        angry = scores.get("angry", 0)
        disgust = scores.get("disgust", 0)
        fear = scores.get("fear", 0)
        happy = scores.get("happy", 0)
        sad = scores.get("sad", 0)
        surprise = scores.get("surprise", 0)
        neutral = scores.get("neutral", 0)

        negative = angry + fear + disgust
        if negative >= t.stressed_negative_min:
            return MoodState.STRESSED

        if surprise >= t.energized_surprise_min and happy >= t.energized_happy_min:
            return MoodState.ENERGIZED

        if sad >= t.tired_sad_min and neutral >= t.tired_neutral_min:
            return MoodState.TIRED

        if neutral >= t.focus_neutral_min and happy >= t.focus_happy_min and neutral >= happy:
            return MoodState.FOCUS

        if happy >= t.relaxed_happy_min and neutral >= t.relaxed_neutral_min:
            return MoodState.RELAXED

        if neutral >= t.focus_neutral_min and happy >= t.focus_happy_min:
            return MoodState.FOCUS

        return MoodState.FOCUS

    def _compute_confidence(self, scores: dict[str, float], mood: MoodState) -> float:
        if mood == MoodState.STRESSED:
            return min(1.0, scores.get("angry", 0) + scores.get("fear", 0) + scores.get("disgust", 0))
        elif mood == MoodState.ENERGIZED:
            return min(1.0, scores.get("surprise", 0) + scores.get("happy", 0))
        elif mood == MoodState.TIRED:
            return min(1.0, scores.get("sad", 0) + scores.get("neutral", 0))
        elif mood == MoodState.RELAXED:
            return min(1.0, scores.get("happy", 0) + scores.get("neutral", 0))
        else:
            return min(1.0, scores.get("neutral", 0) + scores.get("happy", 0))

    @property
    def current_mood(self) -> MoodState | None:
        return self._current_mood

    @property
    def history(self) -> list[MoodState]:
        return list(self._history)

    def reset(self) -> None:
        self._current_mood = None
        self._candidate_mood = None
        self._candidate_count = 0
