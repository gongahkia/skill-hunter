"""Tests for the emotion detection pipeline: smoother and classifier."""

import pytest

from mood_engine.classifier import MoodClassifier, MoodState, MoodThresholds
from mood_engine.detection import EMOTION_KEYS, EmotionResult
from mood_engine.smoother import EmotionSmoother


class TestEmotionSmoother:
    def test_empty_smoother_returns_neutral(self):
        s = EmotionSmoother(window_size=5)
        result = s._compute()
        assert result.dominant_emotion == "neutral"
        assert result.confidence == 0.0

    def test_single_entry_returns_same(self):
        s = EmotionSmoother(window_size=5)
        scores = {k: 0.0 for k in EMOTION_KEYS}
        scores["happy"] = 0.8
        scores["neutral"] = 0.2
        er = EmotionResult(
            emotion_label="happy", confidence=0.8, all_scores=scores
        )
        result = s.add(er)
        assert result.dominant_emotion == "happy"
        assert result.scores["happy"] > 0.5

    def test_weighted_average_favors_recent(self):
        s = EmotionSmoother(window_size=3)
        old_scores = {k: 0.0 for k in EMOTION_KEYS}
        old_scores["sad"] = 1.0
        new_scores = {k: 0.0 for k in EMOTION_KEYS}
        new_scores["happy"] = 1.0

        s.add(EmotionResult("sad", 1.0, old_scores))
        s.add(EmotionResult("sad", 1.0, old_scores))
        result = s.add(EmotionResult("happy", 1.0, new_scores))
        assert result.scores["happy"] > result.scores["sad"]

    def test_window_size_limits_buffer(self):
        s = EmotionSmoother(window_size=3)
        scores = {k: 0.0 for k in EMOTION_KEYS}
        scores["neutral"] = 1.0
        er = EmotionResult("neutral", 1.0, scores)

        for _ in range(10):
            s.add(er)

        assert len(s._buffer) == 3

    def test_reset_clears_buffer(self):
        s = EmotionSmoother(window_size=5)
        scores = {k: 0.0 for k in EMOTION_KEYS}
        scores["neutral"] = 1.0
        s.add(EmotionResult("neutral", 1.0, scores))
        s.reset()
        assert len(s._buffer) == 0


class TestMoodClassifier:
    def test_focus_classification(self):
        c = MoodClassifier()
        scores = {k: 0.0 for k in EMOTION_KEYS}
        scores["neutral"] = 0.6
        scores["happy"] = 0.3
        scores["sad"] = 0.1
        result = c.classify(scores)
        assert result.mood == MoodState.FOCUS

    def test_stressed_classification(self):
        c = MoodClassifier()
        scores = {k: 0.0 for k in EMOTION_KEYS}
        scores["angry"] = 0.3
        scores["fear"] = 0.2
        scores["disgust"] = 0.1
        scores["neutral"] = 0.4
        result = c.classify(scores)
        assert result.mood == MoodState.STRESSED

    def test_relaxed_classification(self):
        c = MoodClassifier()
        scores = {k: 0.0 for k in EMOTION_KEYS}
        scores["happy"] = 0.5
        scores["neutral"] = 0.4
        scores["sad"] = 0.1
        result = c.classify(scores)
        assert result.mood == MoodState.RELAXED

    def test_tired_classification(self):
        c = MoodClassifier()
        scores = {k: 0.0 for k in EMOTION_KEYS}
        scores["sad"] = 0.4
        scores["neutral"] = 0.5
        scores["happy"] = 0.1
        result = c.classify(scores)
        assert result.mood == MoodState.TIRED

    def test_energized_classification(self):
        c = MoodClassifier()
        scores = {k: 0.0 for k in EMOTION_KEYS}
        scores["surprise"] = 0.3
        scores["happy"] = 0.5
        scores["neutral"] = 0.2
        result = c.classify(scores)
        assert result.mood == MoodState.ENERGIZED

    def test_debounce_prevents_rapid_change(self):
        c = MoodClassifier(debounce_windows=3)
        focus_scores = {k: 0.0 for k in EMOTION_KEYS}
        focus_scores["neutral"] = 0.6
        focus_scores["happy"] = 0.3
        focus_scores["sad"] = 0.1

        stressed_scores = {k: 0.0 for k in EMOTION_KEYS}
        stressed_scores["angry"] = 0.5
        stressed_scores["fear"] = 0.3
        stressed_scores["neutral"] = 0.2

        result = c.classify(focus_scores)
        assert result.mood == MoodState.FOCUS
        assert result.mood_changed is True

        result = c.classify(stressed_scores)
        assert result.mood == MoodState.FOCUS
        assert result.mood_changed is False

        result = c.classify(stressed_scores)
        assert result.mood == MoodState.FOCUS

        result = c.classify(stressed_scores)
        assert result.mood == MoodState.STRESSED
        assert result.mood_changed is True

    def test_no_change_resets_candidate(self):
        c = MoodClassifier(debounce_windows=3)
        focus_scores = {k: 0.0 for k in EMOTION_KEYS}
        focus_scores["neutral"] = 0.6
        focus_scores["happy"] = 0.3
        focus_scores["sad"] = 0.1

        stressed_scores = {k: 0.0 for k in EMOTION_KEYS}
        stressed_scores["angry"] = 0.5
        stressed_scores["fear"] = 0.3
        stressed_scores["neutral"] = 0.2

        c.classify(focus_scores)
        c.classify(stressed_scores)
        c.classify(focus_scores)  # back to focus, resets candidate

        result = c.classify(stressed_scores)
        assert result.mood == MoodState.FOCUS  # candidate reset, not enough consecutive

    def test_confidence_threshold_blocks_state_changes(self):
        c = MoodClassifier()
        low_confidence_scores = {k: 0.0 for k in EMOTION_KEYS}
        low_confidence_scores["angry"] = 0.3
        low_confidence_scores["fear"] = 0.2
        low_confidence_scores["neutral"] = 0.5

        result = c.classify(low_confidence_scores, confidence_threshold=0.8)

        assert result.mood is None
        assert result.mood_changed is False
        assert c.current_mood is None
