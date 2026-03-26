from __future__ import annotations

import logging
from dataclasses import dataclass, field
from typing import TYPE_CHECKING, Any

from mood_engine.exceptions import DetectionError

logger = logging.getLogger("mood_engine.detection")

EMOTION_KEYS = ["angry", "disgust", "fear", "happy", "sad", "surprise", "neutral"]

if TYPE_CHECKING:
    import numpy as np


@dataclass
class EmotionResult:
    emotion_label: str
    confidence: float
    all_scores: dict[str, float] = field(default_factory=dict)
    face_detected: bool = True
    face_region: tuple[int, int, int, int] | None = None


def detect_face(frame: np.ndarray) -> tuple[np.ndarray | None, tuple[int, int, int, int] | None]:
    """Detect the largest face in a frame using OpenCV Haar cascades.

    Returns:
        Tuple of (cropped face image, (x, y, w, h)) or (None, None) if no face.
    """
    import cv2

    gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)

    cascade_path = cv2.data.haarcascades + "haarcascade_frontalface_default.xml"
    face_cascade = cv2.CascadeClassifier(cascade_path)

    faces = face_cascade.detectMultiScale(gray, scaleFactor=1.1, minNeighbors=5, minSize=(48, 48))

    if len(faces) == 0:
        return None, None

    if len(faces) > 1:
        idx = max(range(len(faces)), key=lambda i: faces[i][2] * faces[i][3])
        x, y, w, h = faces[idx]
        logger.debug("multiple faces detected (%d), using largest", len(faces))
    else:
        x, y, w, h = faces[0]

    face_img = frame[y : y + h, x : x + w]
    return face_img, (int(x), int(y), int(w), int(h))


def analyze_emotion(frame: np.ndarray) -> EmotionResult:
    """Run emotion detection on a frame using DeepFace.

    Args:
        frame: BGR image (full frame or cropped face).

    Returns:
        EmotionResult with emotion probabilities.

    Raises:
        DetectionError: If analysis fails.
    """
    try:
        import cv2
        from deepface import DeepFace

        results = DeepFace.analyze(
            frame,
            actions=["emotion"],
            enforce_detection=False,
            silent=True,
        )

        if isinstance(results, list):
            result = results[0]
        else:
            result = results

        emotion_scores = result.get("emotion", {})

        total = sum(emotion_scores.values())
        if total > 0:
            normalized = {k.lower(): v / total for k, v in emotion_scores.items()}
        else:
            normalized = {k: 0.0 for k in EMOTION_KEYS}

        scores = {k: normalized.get(k, 0.0) for k in EMOTION_KEYS}

        dominant = max(scores, key=lambda k: scores[k])

        region = result.get("region", {})
        face_region = None
        if region:
            face_region = (
                region.get("x", 0),
                region.get("y", 0),
                region.get("w", 0),
                region.get("h", 0),
            )

        return EmotionResult(
            emotion_label=dominant,
            confidence=scores[dominant],
            all_scores=scores,
            face_detected=True,
            face_region=face_region,
        )

    except Exception as e:
        raise DetectionError(f"emotion analysis failed: {e}") from e


def detect_and_analyze(frame: np.ndarray, backend: Any | None = None) -> EmotionResult:
    """Combined face detection + emotion analysis pipeline.

    Args:
        frame: Full BGR webcam frame.

    Returns:
        EmotionResult. If no face detected, face_detected=False.
    """
    face_img, region = detect_face(frame)

    if face_img is None:
        return EmotionResult(
            emotion_label="none",
            confidence=0.0,
            all_scores={k: 0.0 for k in EMOTION_KEYS},
            face_detected=False,
            face_region=None,
        )

    if backend is None:
        result = analyze_emotion(face_img)
    else:
        result = backend.detect(face_img)
    result.face_region = region
    return result
