package bridge

import (
	"fmt"

	"sato-pulse/internal/ipc"
	"sato-pulse/internal/mpv"
)

type YTMusicProvider struct {
	ipcMgr    *ipc.Manager
	mpvClient *mpv.MpvClient
}

func NewYTMusicProvider(ipcMgr *ipc.Manager, mpvClient *mpv.MpvClient) *YTMusicProvider {
	return &YTMusicProvider{ipcMgr: ipcMgr, mpvClient: mpvClient}
}

func (p *YTMusicProvider) Search(query string, limit int) ([]ipc.Track, error) {
	if p.ipcMgr == nil {
		return nil, fmt.Errorf("ytmusic: ipc unavailable")
	}
	result, err := p.ipcMgr.SendSearchRequest(query, limit)
	if err != nil {
		return nil, err
	}
	return result.Tracks, nil
}

func (p *YTMusicProvider) Play(track ipc.Track) error {
	if p.mpvClient == nil {
		return mpv.ErrNotConnected
	}
	return p.mpvClient.Play(track.PlaybackURL)
}

func (p *YTMusicProvider) Pause() error {
	if p.mpvClient == nil {
		return mpv.ErrNotConnected
	}
	return p.mpvClient.Pause()
}

func (p *YTMusicProvider) Resume() error {
	if p.mpvClient == nil {
		return mpv.ErrNotConnected
	}
	return p.mpvClient.Resume()
}

func (p *YTMusicProvider) NowPlaying() (NowPlaying, error) {
	if p.mpvClient == nil {
		return NowPlaying{}, mpv.ErrNotConnected
	}
	title, _ := p.mpvClient.GetTitle()
	pos, _ := p.mpvClient.GetPosition()
	dur, _ := p.mpvClient.GetDuration()
	return NowPlaying{
		Title:    title,
		Position: pos,
		Duration: dur,
	}, nil
}

func (p *YTMusicProvider) Name() string { return "YouTube Music" }
