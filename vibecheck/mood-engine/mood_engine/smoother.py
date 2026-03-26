import logging
from collections import deque
from dataclasses import dataclass

from mood_engine.detection import EMOTION_KEYS, EmotionResult

logger = logging.getLogger("mood_engine.smoother")


@dataclass
class SmoothedResult:
    scores: dict[str, float]
    dominant_emotion: str
    confidence: float


class EmotionSmoother:
    """Sliding window smoother for emotion scores.

    Maintains a circular buffer of N emotion results and computes
    weighted moving average where recent frames are weighted higher.
    """

    def __init__(self, window_size: int = 5) -> None:
        self._window_size = window_size
        self._buffer: deque[dict[str, float]] = deque(maxlen=window_size)
        self._weights = self._compute_weights(window_size)

    @staticmethod
    def _compute_weights(n: int) -> list[float]:
        raw = [2**i for i in range(n)]
        total = sum(raw)
        return [w / total for w in raw]

    def add(self, result: EmotionResult) -> SmoothedResult:
        """Add an emotion result and return the smoothed scores."""
        self._buffer.append(result.all_scores)
        return self._compute()

    def _compute(self) -> SmoothedResult:
        n = len(self._buffer)
        if n == 0:
            scores = {k: 0.0 for k in EMOTION_KEYS}
            return SmoothedResult(scores=scores, dominant_emotion="neutral", confidence=0.0)

        weights = self._weights[-n:]
        weight_sum = sum(weights)
        normalized_weights = [w / weight_sum for w in weights]

        smoothed: dict[str, float] = {k: 0.0 for k in EMOTION_KEYS}
        for i, entry in enumerate(self._buffer):
            w = normalized_weights[i]
            for k in EMOTION_KEYS:
                smoothed[k] += entry.get(k, 0.0) * w

        total = sum(smoothed.values())
        if total > 0:
            smoothed = {k: v / total for k, v in smoothed.items()}

        dominant = max(smoothed, key=lambda k: smoothed[k])
        return SmoothedResult(
            scores=smoothed,
            dominant_emotion=dominant,
            confidence=smoothed[dominant],
        )

    def reset(self) -> None:
        self._buffer.clear()
