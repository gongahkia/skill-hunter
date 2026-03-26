package bridge

import (
	"fmt"
	"log/slog"
	"math/rand"
	"sync"
	"time"

	"mood-music/internal/analytics"
	"mood-music/internal/ipc"
	"mood-music/internal/mpv"
	"mood-music/internal/queue"
)

const (
	MoodSourceAuto   = "auto"
	MoodSourceManual = "manual"
)

type MoodMusicBridge struct {
	ipcMgr      *ipc.Manager
	mpvClient   *mpv.MpvClient
	provider    PlaybackProvider
	queueMgr    *queue.Manager
	blacklist   *queue.Blacklist
	analytics   *analytics.Aggregator
	moodQueries map[string][]string
	debounceDur time.Duration
	dryRun      bool

	mu                 sync.Mutex
	currentMood        string
	currentMoodEventID string
	lastSwitch         time.Time
	dndMode            bool
}

func New(
	ipcMgr *ipc.Manager,
	mpvClient *mpv.MpvClient,
	provider PlaybackProvider,
	queueMgr *queue.Manager,
	aggregator *analytics.Aggregator,
	moodQueries map[string][]string,
	debounceSec int,
	dryRun bool,
) *MoodMusicBridge {
	b := &MoodMusicBridge{
		ipcMgr:      ipcMgr,
		mpvClient:   mpvClient,
		provider:    provider,
		queueMgr:    queueMgr,
		blacklist:   queue.NewBlacklist(),
		analytics:   aggregator,
		moodQueries: moodQueries,
		debounceDur: time.Duration(debounceSec) * time.Second,
		dryRun:      dryRun,
	}

	queueMgr.OnNeedRefill(func() {
		b.mu.Lock()
		mood := b.currentMood
		b.mu.Unlock()
		if mood != "" {
			b.fetchAndAppend(mood)
		}
	})

	return b
}

func (b *MoodMusicBridge) OnMoodChange(mood string, confidence float64, source string) (bool, error) {
	b.mu.Lock()
	currentMood := b.currentMood

	if mood == currentMood {
		b.mu.Unlock()
		return false, nil
	}

	if source == MoodSourceAuto && b.dndMode {
		slog.Info("bridge: auto mood change suppressed by dnd", "mood", mood)
		b.mu.Unlock()
		return false, nil
	}

	if source == MoodSourceAuto && !b.lastSwitch.IsZero() && time.Since(b.lastSwitch) < b.debounceDur {
		slog.Info("bridge: mood change debounced",
			"from", currentMood, "to", mood,
			"wait", b.debounceDur-time.Since(b.lastSwitch))
		b.mu.Unlock()
		return false, nil
	}
	b.lastSwitch = time.Now()
	b.mu.Unlock()

	eventID, err := b.switchMusic(mood, confidence)
	if err != nil {
		return false, err
	}

	b.mu.Lock()
	b.currentMood = mood
	b.currentMoodEventID = eventID
	b.mu.Unlock()

	slog.Info("bridge: mood changed",
		"from", currentMood,
		"to", mood,
		"confidence", confidence,
		"source", source,
	)
	return true, nil
}

func (b *MoodMusicBridge) switchMusic(mood string, confidence float64) (string, error) {
	queries, ok := b.moodQueries[mood]
	if !ok || len(queries) == 0 {
		return "", fmt.Errorf("bridge: no queries for mood %s", mood)
	}

	query := queries[rand.Intn(len(queries))]

	if b.dryRun {
		slog.Info("bridge: dry-run would search", "mood", mood, "query", query)
		return "", nil
	}
	if b.provider == nil {
		return "", fmt.Errorf("bridge: playback provider unavailable")
	}

	tracks, err := b.provider.Search(query, 10)
	if err != nil {
		return "", fmt.Errorf("bridge: search failed for %q: %w", query, err)
	}

	if len(tracks) == 0 {
		return "", fmt.Errorf("bridge: no tracks found for %q", query)
	}
	filtered := b.annotateTracks(b.filterTracks(tracks), query)
	if len(filtered) == 0 {
		return "", fmt.Errorf("bridge: all tracks filtered by blacklist for %q", query)
	}
	track := filtered[0]

	if err := b.playTrack(track); err != nil {
		return "", err
	}

	eventID := ""
	if b.analytics != nil {
		eventID, err = b.analytics.RecordMood(mood, confidence)
		if err != nil {
			slog.Warn("bridge: record mood failed", "err", err, "mood", mood)
			eventID = ""
		}
		b.recordTrack(mood, eventID, track)
	}

	if b.queueMgr != nil {
		b.queueMgr.Clear()
		b.queueMgr.LoadTracks(filtered)
	}

	return eventID, nil
}

func (b *MoodMusicBridge) fetchAndAppend(mood string) {
	queries, ok := b.moodQueries[mood]
	if !ok || len(queries) == 0 {
		return
	}

	query := queries[rand.Intn(len(queries))]
	if b.provider == nil || b.queueMgr == nil {
		return
	}
	tracks, err := b.provider.Search(query, 10)
	if err != nil {
		slog.Error("bridge: refill search failed", "err", err)
		return
	}

	filtered := b.annotateTracks(b.filterTracks(tracks), query)
	if len(filtered) > 0 {
		b.queueMgr.AppendTracks(filtered)
		slog.Info("bridge: queue refilled", "count", len(filtered))
	}
}

func (b *MoodMusicBridge) OnTrackEnded() {
	if b.queueMgr == nil {
		slog.Warn("bridge: queue unavailable")
		return
	}
	track, err := b.queueMgr.Next()
	if err != nil {
		slog.Warn("bridge: no next track", "err", err)
		return
	}

	if b.dryRun {
		slog.Info("bridge: dry-run would play next", "title", track.Title)
		return
	}

	if err := b.playTrack(track); err != nil {
		return
	}
	mood, eventID := b.currentMoodState()
	b.recordTrack(mood, eventID, track)
}

func (b *MoodMusicBridge) OnPreviousTrack() {
	if b.queueMgr == nil {
		slog.Warn("bridge: queue unavailable")
		return
	}
	track, err := b.queueMgr.Previous()
	if err != nil {
		slog.Warn("bridge: no previous track", "err", err)
		return
	}

	if b.dryRun {
		slog.Info("bridge: dry-run would play previous", "title", track.Title)
		return
	}

	if err := b.playTrack(track); err != nil {
		return
	}
	mood, eventID := b.currentMoodState()
	b.recordTrack(mood, eventID, track)
}

func (b *MoodMusicBridge) SetDND(enabled bool) {
	b.mu.Lock()
	defer b.mu.Unlock()
	b.dndMode = enabled
}

func (b *MoodMusicBridge) BlacklistCurrent() error {
	if b.queueMgr == nil {
		return queue.ErrQueueEmpty
	}
	track, err := b.queueMgr.Current()
	if err != nil {
		return err
	}
	if track.VideoID == "" {
		return nil
	}
	if err := b.blacklist.Add(track.VideoID); err != nil {
		return err
	}
	b.OnTrackEnded()
	return nil
}

func (b *MoodMusicBridge) CurrentMood() string {
	b.mu.Lock()
	defer b.mu.Unlock()
	return b.currentMood
}

func (b *MoodMusicBridge) currentMoodState() (string, string) {
	b.mu.Lock()
	defer b.mu.Unlock()
	return b.currentMood, b.currentMoodEventID
}

func (b *MoodMusicBridge) filterTracks(tracks []ipc.Track) []ipc.Track {
	if b.blacklist == nil {
		return append([]ipc.Track{}, tracks...)
	}
	filtered := make([]ipc.Track, 0, len(tracks))
	for _, track := range tracks {
		if track.VideoID != "" && b.blacklist.Contains(track.VideoID) {
			continue
		}
		filtered = append(filtered, track)
	}
	return filtered
}

func (b *MoodMusicBridge) annotateTracks(tracks []ipc.Track, query string) []ipc.Track {
	annotated := make([]ipc.Track, 0, len(tracks))
	for _, track := range tracks {
		track.SearchQuery = query
		annotated = append(annotated, track)
	}
	return annotated
}

func (b *MoodMusicBridge) playTrack(track ipc.Track) error {
	if b.provider == nil {
		return mpv.ErrNotConnected
	}
	if err := b.provider.Play(track); err != nil {
		slog.Error("bridge: play failed", "err", err, "title", track.Title)
		return err
	}
	slog.Info("bridge: now playing", "title", track.Title, "artist", track.Artist)
	return nil
}

func (b *MoodMusicBridge) Provider() PlaybackProvider {
	return b.provider
}

func (b *MoodMusicBridge) recordTrack(mood string, moodEventID string, track ipc.Track) {
	if b.analytics == nil {
		return
	}
	if err := b.analytics.RecordTrack(
		moodEventID,
		mood,
		track.SearchQuery,
		track.VideoID,
		track.Title,
		track.Artist,
	); err != nil {
		slog.Warn("bridge: record track failed", "err", err, "title", track.Title)
	}
}
