package main

import (
	"fmt"
	"os"
	"strings"
	"time"

	"mood-music/internal/config"
	"mood-music/internal/ipc"
	"mood-music/internal/tui"
)

func deriveStartupState(
	mpvErr error,
	ipcStartErr error,
	healthErr error,
	health *ipc.HealthResult,
) (tui.AppState, tui.HealthMsg) {
	healthMsg := tui.HealthMsg{
		Mpv:     statusFromError(mpvErr),
		Python:  "ERROR: subprocess unavailable",
		Camera:  "ERROR: unavailable",
		YTMusic: "ERROR: unavailable",
	}

	if ipcStartErr != nil {
		healthMsg.Python = fmt.Sprintf("ERROR: %v", ipcStartErr)
		return tui.StateSetupFlow, healthMsg
	}

	if healthErr != nil {
		healthMsg.Python = fmt.Sprintf("ERROR: %v", healthErr)
		return tui.StateSetupFlow, healthMsg
	}

	healthMsg.Python = "OK"
	if health != nil {
		healthMsg.Camera = formatCameraStatus(health.Camera)
		if health.YTMusic.Authenticated {
			healthMsg.YTMusic = "OK"
		} else {
			healthMsg.YTMusic = "ERROR: auth required"
		}
		healthMsg.Backend = health.EmotionBackend
	}

	allHealthy := mpvErr == nil &&
		ipcStartErr == nil &&
		healthErr == nil &&
		health != nil &&
		strings.EqualFold(health.Status, "ok") &&
		health.Camera.Available &&
		health.YTMusic.Authenticated
	if allHealthy {
		return tui.StateDashboard, healthMsg
	}

	return tui.StateSetupFlow, healthMsg
}

func statusFromError(err error) string {
	if err == nil {
		return "OK"
	}
	return fmt.Sprintf("ERROR: %v", err)
}

func formatPlaybackStatus(dryRunRequested bool, ready bool, err error) string {
	switch {
	case dryRunRequested:
		return "OK (dry-run requested)"
	case err != nil:
		return fmt.Sprintf("ERROR: %v", err)
	case ready:
		return "OK (ready)"
	default:
		return "ERROR: unavailable"
	}
}

func deriveLastRuntimeError(
	dryRunRequested bool,
	mpvErr error,
	ipcStartErr error,
	healthErr error,
	health *ipc.HealthResult,
) string {
	switch {
	case healthErr != nil:
		return healthErr.Error()
	case ipcStartErr != nil:
		return ipcStartErr.Error()
	case !dryRunRequested && mpvErr != nil:
		return mpvErr.Error()
	}

	if health != nil {
		if !health.Camera.Available {
			if health.Camera.Error != "" {
				return health.Camera.Error
			}
			return "webcam unavailable"
		}
		if !health.YTMusic.Authenticated {
			return "YouTube Music auth required"
		}
	}

	return "none"
}

func enrichHealthStatus(
	cfg config.Config,
	health tui.HealthMsg,
	playbackStatus string,
	lastError string,
) tui.HealthMsg {
	health.Playback = playbackStatus
	if health.Backend == "" {
		health.Backend = cfg.Emotion.ModelBackend
	}
	health.AuthFile = formatFileStatus(cfg.YTMusic.AuthFilePath)
	if lastError == "" {
		lastError = "none"
	}
	health.LastError = lastError
	return health
}

func formatIPCError(msg ipc.ErrorMsg) string {
	switch msg.ErrorType {
	case "capture_error":
		return fmt.Sprintf("capture failed: %s", msg.ErrorMessage)
	case "detection_error":
		return fmt.Sprintf("emotion detection failed: %s", msg.ErrorMessage)
	case "auth_error":
		return fmt.Sprintf("YouTube Music auth failed: %s", msg.ErrorMessage)
	case "search_error":
		return fmt.Sprintf("search failed: %s", msg.ErrorMessage)
	default:
		return fmt.Sprintf("%s: %s", msg.ErrorType, msg.ErrorMessage)
	}
}

func formatFileStatus(path string) string {
	if _, err := os.Stat(path); err != nil {
		if os.IsNotExist(err) {
			return fmt.Sprintf("ERROR: not found (%s)", path)
		}
		return fmt.Sprintf("ERROR: %v", err)
	}
	return fmt.Sprintf("OK (%s)", path)
}

func formatCameraStatus(info ipc.CameraInfo) string {
	if !info.Available {
		if info.Error != "" {
			return fmt.Sprintf("ERROR: %s", info.Error)
		}
		if info.Backend != "" {
			return fmt.Sprintf("ERROR: unavailable (%s)", info.Backend)
		}
		return "ERROR: unavailable"
	}

	details := make([]string, 0, 3)
	if info.Resolution[0] > 0 && info.Resolution[1] > 0 {
		details = append(details, fmt.Sprintf("%dx%d", info.Resolution[0], info.Resolution[1]))
	}
	if info.FPS > 0 {
		details = append(details, fmt.Sprintf("%dfps", info.FPS))
	}
	if info.Backend != "" {
		details = append(details, info.Backend)
	}
	if len(details) == 0 {
		return "OK"
	}
	return fmt.Sprintf("OK (%s)", strings.Join(details, " "))
}

func runtimeConfigFromApp(cfg config.Config) ipc.RuntimeConfig {
	return ipc.RuntimeConfig{
		CameraIndex:         cfg.Capture.CameraIndex,
		Resolution:          cfg.Capture.Resolution,
		ModelBackend:        cfg.Emotion.ModelBackend,
		SmoothingWindow:     cfg.Emotion.SmoothingWindow,
		ConfidenceThreshold: cfg.Emotion.ConfidenceThreshold,
	}
}

func startCaptureLoop(
	request func() error,
	interval time.Duration,
	stop <-chan struct{},
	onError func(error),
) {
	if interval <= 0 {
		interval = 10 * time.Second
	}

	trigger := func() {
		if err := request(); err != nil && onError != nil {
			onError(err)
		}
	}

	trigger()

	ticker := time.NewTicker(interval)
	defer ticker.Stop()

	for {
		select {
		case <-stop:
			return
		case <-ticker.C:
			trigger()
		}
	}
}
