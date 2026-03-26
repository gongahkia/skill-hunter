package tui

import (
	"testing"

	"sato-pulse/internal/config"
	"sato-pulse/internal/ipc"
)

func TestEmotionMsgUpdatesDetectedMoodWithoutCommittingActiveMood(t *testing.T) {
	model := NewModelWithState(
		config.DefaultConfig(),
		nil,
		nil,
		nil,
		nil,
		nil,
		nil,
		StateDashboard,
		HealthMsg{},
	)

	updated, _ := model.Update(EmotionMsg{
		Result: ipc.EmotionResult{
			FaceDetected:   true,
			Emotions:       map[string]float64{"happy": 0.8},
			Mood:           stringPtr("RELAXED"),
			MoodConfidence: 0.82,
		},
	})
	got := updated.(Model)

	if got.detectedMood != "RELAXED" || got.detectedMoodConfidence != 0.82 {
		t.Fatalf("expected detected mood to update, got mood=%q confidence=%f", got.detectedMood, got.detectedMoodConfidence)
	}
	if got.activeMood != "" {
		t.Fatalf("expected active mood to remain unset, got %q", got.activeMood)
	}
	if len(got.moodHistory) != 0 {
		t.Fatalf("expected no active mood history entries, got %d", len(got.moodHistory))
	}
}

func TestMoodChangeMsgCommitsActiveMoodAndHistory(t *testing.T) {
	model := NewModelWithState(
		config.DefaultConfig(),
		nil,
		nil,
		nil,
		nil,
		nil,
		nil,
		StateDashboard,
		HealthMsg{},
	)

	updated, _ := model.Update(MoodChangeMsg{
		Mood:       "FOCUS",
		Confidence: 0.91,
		Source:     "manual",
	})
	got := updated.(Model)

	if got.activeMood != "FOCUS" || got.activeMoodConfidence != 0.91 {
		t.Fatalf("expected active mood to update, got mood=%q confidence=%f", got.activeMood, got.activeMoodConfidence)
	}
	if got.activeMoodSource != "manual" {
		t.Fatalf("expected active mood source to update, got %q", got.activeMoodSource)
	}
	if len(got.moodHistory) != 1 || got.moodHistory[0].Mood != "FOCUS" {
		t.Fatalf("expected active mood history entry, got %+v", got.moodHistory)
	}
}

func TestHealthMsgUpdatesRuntimeStatusFields(t *testing.T) {
	model := NewModelWithState(
		config.DefaultConfig(),
		nil,
		nil,
		nil,
		nil,
		nil,
		nil,
		StateDashboard,
		HealthMsg{},
	)

	updated, _ := model.Update(HealthMsg{
		Camera:    "OK (640x480 30fps AVFoundation)",
		Mpv:       "OK",
		YTMusic:   "OK",
		Python:    "OK",
		Playback:  "OK (ready)",
		Backend:   "deepface_opencv",
		AuthFile:  "OK (/tmp/auth.json)",
		LastError: "none",
	})
	got := updated.(Model)

	if got.statusPlayback != "OK (ready)" {
		t.Fatalf("expected playback status update, got %q", got.statusPlayback)
	}
	if got.statusBackend != "deepface_opencv" {
		t.Fatalf("expected backend status update, got %q", got.statusBackend)
	}
	if got.statusAuthFile != "OK (/tmp/auth.json)" {
		t.Fatalf("expected auth status update, got %q", got.statusAuthFile)
	}
	if got.lastRuntimeError != "none" {
		t.Fatalf("expected runtime error update, got %q", got.lastRuntimeError)
	}
}

func stringPtr(v string) *string {
	return &v
}
