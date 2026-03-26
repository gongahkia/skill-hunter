from __future__ import annotations

import logging
from abc import ABC, abstractmethod
from typing import TYPE_CHECKING, Any

from mood_engine.detection import EmotionResult, analyze_emotion, EMOTION_KEYS
from mood_engine.exceptions import DetectionError

logger = logging.getLogger("mood_engine.backends")

if TYPE_CHECKING:
    import numpy as np


class EmotionBackend(ABC):
    """Unified interface for emotion detection backends."""

    @abstractmethod
    def detect(self, frame: Any) -> EmotionResult:
        """Analyze emotion from a frame.

        Args:
            frame: BGR image as numpy array.

        Returns:
            EmotionResult with emotion probabilities.
        """


class DeepFaceMobileNetBackend(EmotionBackend):
    def detect(self, frame: Any) -> EmotionResult:
        return analyze_emotion(frame)


class DeepFaceOpenCVBackend(EmotionBackend):
    def detect(self, frame: Any) -> EmotionResult:
        try:
            from deepface import DeepFace

            results = DeepFace.analyze(
                frame,
                actions=["emotion"],
                enforce_detection=False,
                detector_backend="opencv",
                silent=True,
            )
            result = results[0] if isinstance(results, list) else results

            emotion_scores = result.get("emotion", {})
            total = sum(emotion_scores.values())
            if total > 0:
                normalized = {k.lower(): v / total for k, v in emotion_scores.items()}
            else:
                normalized = {k: 0.0 for k in EMOTION_KEYS}

            scores = {k: normalized.get(k, 0.0) for k in EMOTION_KEYS}
            dominant = max(scores, key=lambda k: scores[k])

            return EmotionResult(
                emotion_label=dominant,
                confidence=scores[dominant],
                all_scores=scores,
            )
        except Exception as e:
            raise DetectionError(f"opencv backend failed: {e}") from e


_BACKENDS: dict[str, type[EmotionBackend]] = {
    "deepface_mobilenet": DeepFaceMobileNetBackend,
    "deepface_opencv": DeepFaceOpenCVBackend,
}


def create_backend(name: str) -> EmotionBackend:
    """Factory: create emotion backend by name.

    Args:
        name: Backend identifier string.

    Returns:
        An EmotionBackend instance.

    Raises:
        ValueError: If backend name is unknown.
    """
    cls = _BACKENDS.get(name)
    if cls is None:
        raise ValueError(f"unknown emotion backend: {name!r}, available: {list(_BACKENDS)}")
    return cls()
