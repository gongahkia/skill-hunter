package main

import (
	"errors"
	"os"
	"path/filepath"
	"testing"
	"time"

	"mood-music/internal/config"
	"mood-music/internal/ipc"
	"mood-music/internal/tui"
)

type stubCaptureRequester struct {
	calls int
	err   error
}

func (s *stubCaptureRequester) request() error {
	s.calls++
	return s.err
}

func TestDeriveStartupStateDashboardWhenHealthy(t *testing.T) {
	state, health := deriveStartupState(nil, nil, nil, &ipc.HealthResult{
		Status: "ok",
		Camera: ipc.CameraInfo{
			Available:  true,
			Resolution: [2]int{640, 480},
			FPS:        30,
			Backend:    "AVFoundation",
		},
		YTMusic: ipc.YTMusicInfo{Authenticated: true},
	})

	if state != tui.StateDashboard {
		t.Fatalf("expected dashboard state, got %v", state)
	}
	if health.Camera == "" || health.Camera[:2] != "OK" {
		t.Fatalf("expected healthy camera status, got %q", health.Camera)
	}
	if health.Mpv != "OK" || health.Python != "OK" || health.YTMusic != "OK" {
		t.Fatalf("expected all statuses OK, got %+v", health)
	}
}

func TestDeriveStartupStateSetupWhenCameraUnavailable(t *testing.T) {
	state, health := deriveStartupState(nil, nil, nil, &ipc.HealthResult{
		Status: "ok",
		Camera: ipc.CameraInfo{
			Available: false,
			Error:     "camera 0: device not found",
			Backend:   "AVFoundation",
		},
		YTMusic: ipc.YTMusicInfo{Authenticated: true},
	})

	if state != tui.StateSetupFlow {
		t.Fatalf("expected setup flow state, got %v", state)
	}
	if health.Camera == "OK" {
		t.Fatalf("expected camera failure status, got %q", health.Camera)
	}
}

func TestDeriveStartupStateSetupWhenIPCUnhealthy(t *testing.T) {
	state, health := deriveStartupState(nil, nil, errors.New("health timeout"), nil)
	if state != tui.StateSetupFlow {
		t.Fatalf("expected setup flow state, got %v", state)
	}
	if health.Python == "OK" {
		t.Fatalf("expected unhealthy python status, got %q", health.Python)
	}
}

func TestStartCaptureLoopTriggersImmediatelyAndRepeats(t *testing.T) {
	requester := &stubCaptureRequester{}
	stopCh := make(chan struct{})
	done := make(chan struct{})

	go func() {
		startCaptureLoop(requester.request, 10*time.Millisecond, stopCh, nil)
		close(done)
	}()

	time.Sleep(35 * time.Millisecond)
	close(stopCh)

	select {
	case <-done:
	case <-time.After(100 * time.Millisecond):
		t.Fatal("capture loop did not stop")
	}

	if requester.calls < 3 {
		t.Fatalf("expected repeated capture calls, got %d", requester.calls)
	}
}

func TestFormatPlaybackStatus(t *testing.T) {
	if got := formatPlaybackStatus(true, false, nil); got != "OK (dry-run requested)" {
		t.Fatalf("expected dry-run playback status, got %q", got)
	}
	if got := formatPlaybackStatus(false, true, nil); got != "OK (ready)" {
		t.Fatalf("expected ready playback status, got %q", got)
	}
	err := errors.New("mpv start failed")
	if got := formatPlaybackStatus(false, false, err); got != "ERROR: mpv start failed" {
		t.Fatalf("expected playback error status, got %q", got)
	}
}

func TestDeriveLastRuntimeErrorPrefersLiveFailures(t *testing.T) {
	mpvErr := errors.New("mpv down")
	if got := deriveLastRuntimeError(false, mpvErr, nil, nil, nil); got != "mpv down" {
		t.Fatalf("expected mpv failure to surface, got %q", got)
	}

	health := &ipc.HealthResult{
		Camera:  ipc.CameraInfo{Available: false, Error: "camera unavailable"},
		YTMusic: ipc.YTMusicInfo{Authenticated: false},
	}
	if got := deriveLastRuntimeError(true, nil, nil, nil, health); got != "camera unavailable" {
		t.Fatalf("expected camera failure to surface during dry-run, got %q", got)
	}
}

func TestEnrichHealthStatusPreservesRuntimeBackendAndAddsFileStatus(t *testing.T) {
	dir := t.TempDir()
	authPath := filepath.Join(dir, "headers_auth.json")
	if err := os.WriteFile(authPath, []byte("{}"), 0o644); err != nil {
		t.Fatalf("write auth file: %v", err)
	}

	cfg := config.DefaultConfig()
	cfg.YTMusic.AuthFilePath = authPath
	cfg.Emotion.ModelBackend = "deepface_mobilenet"

	health := enrichHealthStatus(
		cfg,
		tui.HealthMsg{Backend: "deepface_opencv"},
		"OK (ready)",
		"",
	)

	if health.Backend != "deepface_opencv" {
		t.Fatalf("expected runtime backend to be preserved, got %q", health.Backend)
	}
	if health.AuthFile == "" || health.AuthFile[:2] != "OK" {
		t.Fatalf("expected auth file status to be healthy, got %q", health.AuthFile)
	}
	if health.LastError != "none" {
		t.Fatalf("expected default runtime error to be none, got %q", health.LastError)
	}
}

func TestValidateEmotionBackend(t *testing.T) {
	if err := validateEmotionBackend("deepface_mobilenet"); err != nil {
		t.Fatalf("expected supported backend to validate: %v", err)
	}
	if err := validateEmotionBackend("cloud_aws"); err == nil {
		t.Fatal("expected removed cloud backend to be rejected")
	}
}
