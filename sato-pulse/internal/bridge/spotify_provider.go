package bridge

import (
	"encoding/json"
	"fmt"
	"log/slog"

	"github.com/google/uuid"

	"sato-pulse/internal/ipc"
)

type SpotifyProvider struct {
	ipcMgr *ipc.Manager
}

func NewSpotifyProvider(ipcMgr *ipc.Manager) *SpotifyProvider {
	return &SpotifyProvider{ipcMgr: ipcMgr}
}

func (p *SpotifyProvider) Search(query string, limit int) ([]ipc.Track, error) {
	if p.ipcMgr == nil {
		return nil, fmt.Errorf("spotify: ipc unavailable")
	}
	id := uuid.New().String()
	req := ipc.SpotifySearchRequest{
		Message: ipc.NewMessage(ipc.TypeSpotifySearchRequest, id),
		Query:   query,
		Limit:   limit,
	}
	raw, err := p.ipcMgr.SendRequest(req, id)
	if err != nil {
		return nil, fmt.Errorf("spotify: search failed: %w", err)
	}
	var result ipc.SpotifySearchResult
	if err := json.Unmarshal(raw, &result); err != nil {
		return nil, fmt.Errorf("spotify: decode search result: %w", err)
	}
	tracks := make([]ipc.Track, 0, len(result.Tracks))
	for _, st := range result.Tracks {
		tracks = append(tracks, ipc.Track{
			VideoID:     st.ID,
			Title:       st.Name,
			Artist:      st.Artist,
			Album:       st.Album,
			PlaybackURL: st.URI,
			ThumbnailURL: st.ImageURL,
			DurationSeconds: st.Duration / 1000,
		})
	}
	return tracks, nil
}

func (p *SpotifyProvider) Play(track ipc.Track) error {
	if p.ipcMgr == nil {
		return fmt.Errorf("spotify: ipc unavailable")
	}
	id := uuid.New().String()
	req := ipc.SpotifyPlayRequest{
		Message:  ipc.NewMessage(ipc.TypeSpotifyPlayRequest, id),
		TrackURI: track.PlaybackURL,
	}
	raw, err := p.ipcMgr.SendRequest(req, id)
	if err != nil {
		return fmt.Errorf("spotify: play failed: %w", err)
	}
	var result ipc.SpotifyPlayResult
	if err := json.Unmarshal(raw, &result); err != nil {
		return fmt.Errorf("spotify: decode play result: %w", err)
	}
	slog.Info("spotify: now playing", "title", track.Title, "artist", track.Artist)
	return nil
}

func (p *SpotifyProvider) Pause() error {
	return p.sendControl(ipc.TypeSpotifyPauseRequest)
}

func (p *SpotifyProvider) Resume() error {
	return p.sendControl(ipc.TypeSpotifyResumeRequest)
}

func (p *SpotifyProvider) sendControl(msgType string) error {
	if p.ipcMgr == nil {
		return fmt.Errorf("spotify: ipc unavailable")
	}
	id := uuid.New().String()
	req := ipc.Message{Version: ipc.ProtocolVersion, Type: msgType, ID: id}
	raw, err := p.ipcMgr.SendRequest(req, id)
	if err != nil {
		return fmt.Errorf("spotify: control failed: %w", err)
	}
	var result ipc.SpotifyControlResult
	if err := json.Unmarshal(raw, &result); err != nil {
		return fmt.Errorf("spotify: decode control result: %w", err)
	}
	return nil
}

func (p *SpotifyProvider) NowPlaying() (NowPlaying, error) {
	if p.ipcMgr == nil {
		return NowPlaying{}, fmt.Errorf("spotify: ipc unavailable")
	}
	id := uuid.New().String()
	req := ipc.Message{Version: ipc.ProtocolVersion, Type: ipc.TypeSpotifyStateRequest, ID: id}
	raw, err := p.ipcMgr.SendRequest(req, id)
	if err != nil {
		return NowPlaying{}, fmt.Errorf("spotify: state failed: %w", err)
	}
	var result ipc.SpotifyStateResult
	if err := json.Unmarshal(raw, &result); err != nil {
		return NowPlaying{}, fmt.Errorf("spotify: decode state: %w", err)
	}
	return NowPlaying{
		Title:    result.Title,
		Artist:   result.Artist,
		Position: result.Position / 1000,
		Duration: result.Duration / 1000,
		Paused:   result.Paused,
	}, nil
}

func (p *SpotifyProvider) Name() string { return "Spotify" }
