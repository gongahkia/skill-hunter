package tui

import (
	tea "github.com/charmbracelet/bubbletea"
	"sato-pulse/internal/ipc"
	"sato-pulse/internal/mpv"
)

type EmotionMsg struct {
	Result ipc.EmotionResult
}

type NowPlayingMsg struct {
	State mpv.NowPlaying
}

type MoodChangeMsg struct {
	Mood       string
	Confidence float64
	Previous   string
	Source     string
}

type StatusMsg struct {
	Text string
}

type TickMsg struct{}

type HealthMsg struct {
	Camera    string
	Mpv       string
	YTMusic   string
	Python    string
	Playback  string
	Backend   string
	AuthFile  string
	LastError string
}

type ControlActionType string

const (
	ActionTogglePause    ControlActionType = "toggle_pause"
	ActionNextTrack      ControlActionType = "next_track"
	ActionPreviousTrack  ControlActionType = "previous_track"
	ActionAdjustVolume   ControlActionType = "adjust_volume"
	ActionSetDND         ControlActionType = "set_dnd"
	ActionManualMood     ControlActionType = "manual_mood"
	ActionBlacklistTrack ControlActionType = "blacklist_track"
)

type ControlAction struct {
	Type    ControlActionType
	Mood    string
	Enabled bool
	Delta   int
}

func waitForEmotion(ch <-chan ipc.EmotionResult) tea.Cmd {
	return func() tea.Msg {
		result := <-ch
		return EmotionMsg{Result: result}
	}
}

func waitForNowPlaying(ch <-chan mpv.NowPlaying) tea.Cmd {
	return func() tea.Msg {
		state := <-ch
		return NowPlayingMsg{State: state}
	}
}

func waitForMoodChange(ch <-chan MoodChangeMsg) tea.Cmd {
	return func() tea.Msg {
		return <-ch
	}
}

func waitForStatus(ch <-chan StatusMsg) tea.Cmd {
	return func() tea.Msg {
		return <-ch
	}
}

func waitForHealth(ch <-chan HealthMsg) tea.Cmd {
	return func() tea.Msg {
		return <-ch
	}
}
