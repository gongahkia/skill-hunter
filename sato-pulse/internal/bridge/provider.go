package bridge

import "sato-pulse/internal/ipc"

type NowPlaying struct {
	Title    string
	Artist   string
	Position float64
	Duration float64
	Paused   bool
}

type PlaybackProvider interface {
	Search(query string, limit int) ([]ipc.Track, error)
	Play(track ipc.Track) error
	Pause() error
	Resume() error
	NowPlaying() (NowPlaying, error)
	Name() string
}
