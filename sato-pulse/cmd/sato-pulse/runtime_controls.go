package main

import (
	"sato-pulse/internal/bridge"
	"sato-pulse/internal/mpv"
	"sato-pulse/internal/tui"
)

type controlBridge interface {
	OnMoodChange(mood string, confidence float64, source string) (bool, error)
	OnTrackEnded()
	OnPreviousTrack()
	SetDND(enabled bool)
	BlacklistCurrent() error
}

type controlPlayer interface {
	TogglePause() error
	GetVolume() (int, error)
	SetVolume(pct int) error
}

func applyControlAction(
	action tui.ControlAction,
	moodBridge controlBridge,
	player controlPlayer,
) (*tui.MoodChangeMsg, error) {
	switch action.Type {
	case tui.ActionTogglePause:
		return nil, player.TogglePause()
	case tui.ActionNextTrack:
		moodBridge.OnTrackEnded()
		return nil, nil
	case tui.ActionPreviousTrack:
		moodBridge.OnPreviousTrack()
		return nil, nil
	case tui.ActionAdjustVolume:
		volume, err := player.GetVolume()
		if err != nil {
			return nil, err
		}
		return nil, player.SetVolume(clamp(volume+action.Delta, 0, 100))
	case tui.ActionSetDND:
		moodBridge.SetDND(action.Enabled)
		return nil, nil
	case tui.ActionManualMood:
		changed, err := moodBridge.OnMoodChange(action.Mood, 1.0, bridge.MoodSourceManual)
		if err != nil {
			return nil, err
		}
		if !changed {
			return nil, nil
		}
		return &tui.MoodChangeMsg{
			Mood:       action.Mood,
			Confidence: 1.0,
			Source:     bridge.MoodSourceManual,
		}, nil
	case tui.ActionBlacklistTrack:
		return nil, moodBridge.BlacklistCurrent()
	default:
		return nil, nil
	}
}

func forwardNowPlayingUpdates(
	updates <-chan mpv.NowPlaying,
	forwarded chan<- mpv.NowPlaying,
	stop <-chan struct{},
	onIdle func(),
) {
	lastIdle := false

	for {
		select {
		case <-stop:
			return
		case update := <-updates:
			if update.Idle && !lastIdle && onIdle != nil {
				onIdle()
			}
			lastIdle = update.Idle
			if forwarded != nil {
				select {
				case forwarded <- update:
				default:
				}
			}
		}
	}
}

func clamp(value, minValue, maxValue int) int {
	if value < minValue {
		return minValue
	}
	if value > maxValue {
		return maxValue
	}
	return value
}
