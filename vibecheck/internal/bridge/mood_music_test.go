package bridge

import (
	"testing"
)

func TestAutoMoodChangeRespectsDND(t *testing.T) {
	bridge := &MoodMusicBridge{
		dryRun: true,
		moodQueries: map[string][]string{
			"FOCUS":   {"focus playlist"},
			"RELAXED": {"relaxed playlist"},
		},
	}
	bridge.SetDND(true)

	changed, err := bridge.OnMoodChange("FOCUS", 0.9, MoodSourceAuto)
	if err != nil {
		t.Fatalf("expected auto mood suppression, got error: %v", err)
	}
	if changed {
		t.Fatal("expected auto mood change to be suppressed while DND is enabled")
	}
	if bridge.CurrentMood() != "" {
		t.Fatalf("expected auto mood to be suppressed during DND, got %q", bridge.CurrentMood())
	}

	changed, err = bridge.OnMoodChange("RELAXED", 1.0, MoodSourceManual)
	if err != nil {
		t.Fatalf("manual mood failed: %v", err)
	}
	if !changed {
		t.Fatal("expected manual mood to commit during DND")
	}
	if bridge.CurrentMood() != "RELAXED" {
		t.Fatalf("expected manual mood to bypass DND, got %q", bridge.CurrentMood())
	}
}

func TestMoodDoesNotCommitWhenSwitchFails(t *testing.T) {
	bridge := &MoodMusicBridge{
		dryRun: true,
		moodQueries: map[string][]string{
			"FOCUS":   {"focus playlist"},
			"RELAXED": {"relaxed playlist"},
		},
	}
	changed, err := bridge.OnMoodChange("RELAXED", 1.0, MoodSourceManual)
	if err != nil {
		t.Fatalf("expected initial dry-run switch to succeed: %v", err)
	}
	if !changed {
		t.Fatal("expected initial dry-run switch to commit")
	}

	bridge.dryRun = false

	changed, err = bridge.OnMoodChange("FOCUS", 0.9, MoodSourceManual)
	if err == nil {
		t.Fatal("expected switch failure")
	}
	if changed {
		t.Fatal("expected failed playback to report no committed change")
	}
	if bridge.CurrentMood() != "RELAXED" {
		t.Fatalf("expected failed switch to preserve existing mood, got %q", bridge.CurrentMood())
	}
}
