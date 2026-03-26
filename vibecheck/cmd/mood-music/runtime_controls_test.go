package main

import (
	"sync/atomic"
	"testing"
	"time"

	"mood-music/internal/bridge"
	"mood-music/internal/mpv"
	"mood-music/internal/tui"
)

type stubBridge struct {
	mood      string
	source    string
	changed   bool
	dnd       bool
	nextCalls int
	prevCalls int
	blacklist int
	err       error
}

func (s *stubBridge) OnMoodChange(mood string, confidence float64, source string) (bool, error) {
	s.mood = mood
	s.source = source
	return s.changed, s.err
}

func (s *stubBridge) OnTrackEnded() {
	s.nextCalls++
}

func (s *stubBridge) OnPreviousTrack() {
	s.prevCalls++
}

func (s *stubBridge) SetDND(enabled bool) {
	s.dnd = enabled
}

func (s *stubBridge) BlacklistCurrent() error {
	s.blacklist++
	return nil
}

type stubPlayer struct {
	toggled int
	volume  int
}

func (s *stubPlayer) TogglePause() error {
	s.toggled++
	return nil
}

func (s *stubPlayer) GetVolume() (int, error) {
	return s.volume, nil
}

func (s *stubPlayer) SetVolume(pct int) error {
	s.volume = pct
	return nil
}

func TestApplyControlActionManualMoodUsesManualSource(t *testing.T) {
	bridgeStub := &stubBridge{changed: true}
	playerStub := &stubPlayer{volume: 50}

	msg, err := applyControlAction(tui.ControlAction{
		Type: tui.ActionManualMood,
		Mood: "FOCUS",
	}, bridgeStub, playerStub)
	if err != nil {
		t.Fatalf("manual mood failed: %v", err)
	}

	if bridgeStub.mood != "FOCUS" || bridgeStub.source != bridge.MoodSourceManual {
		t.Fatalf("expected manual mood routing, got mood=%q source=%q", bridgeStub.mood, bridgeStub.source)
	}
	if msg == nil || msg.Mood != "FOCUS" || msg.Source != bridge.MoodSourceManual {
		t.Fatalf("expected runtime acknowledgement, got %+v", msg)
	}
}

func TestApplyControlActionManualMoodSkipsAckOnFailure(t *testing.T) {
	bridgeStub := &stubBridge{changed: true, err: mpv.ErrNotConnected}
	playerStub := &stubPlayer{volume: 50}

	msg, err := applyControlAction(tui.ControlAction{
		Type: tui.ActionManualMood,
		Mood: "FOCUS",
	}, bridgeStub, playerStub)
	if err == nil {
		t.Fatal("expected manual mood failure")
	}
	if msg != nil {
		t.Fatalf("expected no acknowledgement on failure, got %+v", msg)
	}
}

func TestApplyControlActionManualMoodSkipsAckWhenBridgeSuppressesChange(t *testing.T) {
	bridgeStub := &stubBridge{}
	playerStub := &stubPlayer{volume: 50}

	msg, err := applyControlAction(tui.ControlAction{
		Type: tui.ActionManualMood,
		Mood: "FOCUS",
	}, bridgeStub, playerStub)
	if err != nil {
		t.Fatalf("manual mood should be suppressible without error: %v", err)
	}
	if msg != nil {
		t.Fatalf("expected no acknowledgement when bridge reports no change, got %+v", msg)
	}
}

func TestApplyControlActionUpdatesDNDAndVolume(t *testing.T) {
	bridgeStub := &stubBridge{}
	playerStub := &stubPlayer{volume: 95}

	if _, err := applyControlAction(tui.ControlAction{
		Type:    tui.ActionSetDND,
		Enabled: true,
	}, bridgeStub, playerStub); err != nil {
		t.Fatalf("set dnd failed: %v", err)
	}
	if !bridgeStub.dnd {
		t.Fatal("expected DND enabled")
	}

	if _, err := applyControlAction(tui.ControlAction{
		Type:  tui.ActionAdjustVolume,
		Delta: 10,
	}, bridgeStub, playerStub); err != nil {
		t.Fatalf("adjust volume failed: %v", err)
	}
	if playerStub.volume != 100 {
		t.Fatalf("expected clamped volume, got %d", playerStub.volume)
	}
}

func TestForwardNowPlayingUpdatesTriggersSingleIdleTransition(t *testing.T) {
	updates := make(chan mpv.NowPlaying, 4)
	forwarded := make(chan mpv.NowPlaying, 4)
	stopCh := make(chan struct{})
	var idleCalls atomic.Int32

	go forwardNowPlayingUpdates(updates, forwarded, stopCh, func() {
		idleCalls.Add(1)
	})

	updates <- mpv.NowPlaying{Idle: false}
	updates <- mpv.NowPlaying{Idle: true}
	updates <- mpv.NowPlaying{Idle: true}

	time.Sleep(20 * time.Millisecond)
	close(stopCh)

	if got := idleCalls.Load(); got != 1 {
		t.Fatalf("expected one idle transition, got %d", got)
	}
	if len(forwarded) != 3 {
		t.Fatalf("expected forwarded updates, got %d", len(forwarded))
	}
}
