package main

import (
	"sync/atomic"
	"testing"
	"time"

	"sato-pulse/internal/ipc"
	"sato-pulse/internal/queue"
)

func TestQueueManagerIntegration(t *testing.T) {
	qm := queue.NewManager(3)

	tracks := []ipc.Track{
		{VideoID: "v1", Title: "Track 1", Artist: "A1", PlaybackURL: "https://music.youtube.com/watch?v=v1"},
		{VideoID: "v2", Title: "Track 2", Artist: "A2", PlaybackURL: "https://music.youtube.com/watch?v=v2"},
		{VideoID: "v3", Title: "Track 3", Artist: "A3", PlaybackURL: "https://music.youtube.com/watch?v=v3"},
		{VideoID: "v4", Title: "Track 4", Artist: "A4", PlaybackURL: "https://music.youtube.com/watch?v=v4"},
		{VideoID: "v5", Title: "Track 5", Artist: "A5", PlaybackURL: "https://music.youtube.com/watch?v=v5"},
	}

	qm.LoadTracks(tracks)

	current, err := qm.Current()
	if err != nil {
		t.Fatalf("Current() failed: %v", err)
	}
	if current.VideoID != "v1" {
		t.Fatalf("expected v1, got %s", current.VideoID)
	}

	next, err := qm.Next()
	if err != nil {
		t.Fatalf("Next() failed: %v", err)
	}
	if next.VideoID != "v2" {
		t.Fatalf("expected v2, got %s", next.VideoID)
	}

	upcoming := qm.Upcoming()
	if len(upcoming) != 3 {
		t.Fatalf("expected 3 upcoming, got %d", len(upcoming))
	}

	prev, err := qm.Previous()
	if err != nil {
		t.Fatalf("Previous() failed: %v", err)
	}
	if prev.VideoID != "v1" {
		t.Fatalf("expected v1, got %s", prev.VideoID)
	}
}

func TestQueueMoodTransition(t *testing.T) {
	qm := queue.NewManager(3)

	focusTracks := []ipc.Track{
		{VideoID: "f1", Title: "Focus 1", PlaybackURL: "url1"},
		{VideoID: "f2", Title: "Focus 2", PlaybackURL: "url2"},
	}
	qm.LoadTracks(focusTracks)

	current, _ := qm.Current()
	if current.VideoID != "f1" {
		t.Fatalf("expected f1, got %s", current.VideoID)
	}

	relaxedTracks := []ipc.Track{
		{VideoID: "r1", Title: "Relaxed 1", PlaybackURL: "url3"},
		{VideoID: "r2", Title: "Relaxed 2", PlaybackURL: "url4"},
	}
	qm.Clear()
	qm.LoadTracks(relaxedTracks)

	current, _ = qm.Current()
	if current.VideoID != "r1" {
		t.Fatalf("expected r1 after mood change, got %s", current.VideoID)
	}
}

func TestQueueRefillCallback(t *testing.T) {
	var refillCalled atomic.Bool
	refillDone := make(chan struct{}, 1)
	qm := queue.NewManager(3)
	qm.OnNeedRefill(func() {
		refillCalled.Store(true)
		select {
		case refillDone <- struct{}{}:
		default:
		}
	})

	tracks := []ipc.Track{
		{VideoID: "v1", PlaybackURL: "url1"},
		{VideoID: "v2", PlaybackURL: "url2"},
		{VideoID: "v3", PlaybackURL: "url3"},
		{VideoID: "v4", PlaybackURL: "url4"},
	}
	qm.LoadTracks(tracks)

	qm.Next()
	qm.Next()

	select {
	case <-refillDone:
	case <-time.After(100 * time.Millisecond):
		t.Fatal("expected refill callback to fire")
	}

	if !refillCalled.Load() {
		t.Fatal("expected refill callback to set completion flag")
	}
}

func TestIPCProtocolEncodeDecode(t *testing.T) {
	msg := ipc.NewMessage(ipc.TypeCaptureRequest, "test-id-123")
	req := ipc.CaptureRequest{Message: msg}

	data, err := ipc.Encode(req)
	if err != nil {
		t.Fatalf("Encode failed: %v", err)
	}

	decoded, err := ipc.Decode(data)
	if err != nil {
		t.Fatalf("Decode failed: %v", err)
	}

	if decoded.Type != ipc.TypeCaptureRequest {
		t.Fatalf("expected type %s, got %s", ipc.TypeCaptureRequest, decoded.Type)
	}
	if decoded.ID != "test-id-123" {
		t.Fatalf("expected id test-id-123, got %s", decoded.ID)
	}
	if decoded.Version != ipc.ProtocolVersion {
		t.Fatalf("expected version %d, got %d", ipc.ProtocolVersion, decoded.Version)
	}
}
