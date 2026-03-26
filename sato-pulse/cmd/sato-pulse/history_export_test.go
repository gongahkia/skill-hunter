package main

import (
	"database/sql"
	"path/filepath"
	"testing"

	_ "github.com/mattn/go-sqlite3"
)

func setupHistoryDB(t *testing.T) *sql.DB {
	t.Helper()

	db, err := sql.Open("sqlite3", filepath.Join(t.TempDir(), "history.db"))
	if err != nil {
		t.Fatalf("open db: %v", err)
	}

	_, err = db.Exec(`
		CREATE TABLE mood_history (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			event_id TEXT,
			mood TEXT NOT NULL,
			confidence REAL NOT NULL,
			timestamp DATETIME NOT NULL
		);
		CREATE TABLE sato_pulse_log (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			mood_event_id TEXT,
			mood TEXT NOT NULL,
			search_query TEXT,
			video_id TEXT,
			title TEXT,
			artist TEXT,
			timestamp DATETIME NOT NULL
		);
	`)
	if err != nil {
		t.Fatalf("create schema: %v", err)
	}

	_, err = db.Exec(`
		INSERT INTO mood_history (event_id, mood, confidence, timestamp)
		VALUES
			('focus-event-1', 'FOCUS', 0.91, '2026-03-22 10:00:00'),
			('focus-event-2', 'FOCUS', 0.87, '2026-03-22 10:10:00');
		INSERT INTO sato_pulse_log (mood_event_id, mood, search_query, video_id, title, artist, timestamp)
		VALUES ('focus-event-2', 'FOCUS', 'lo-fi beats study', 'abc123', 'Deep Focus', 'Lofi Artist', '2026-03-22 10:10:05');
	`)
	if err != nil {
		t.Fatalf("seed data: %v", err)
	}

	return db
}

func TestLoadExportRowsIncludesSearchQuery(t *testing.T) {
	db := setupHistoryDB(t)
	defer db.Close()

	rows, err := loadExportRows(db, "", "")
	if err != nil {
		t.Fatalf("load export rows: %v", err)
	}
	if len(rows) != 2 {
		t.Fatalf("expected 2 rows, got %d", len(rows))
	}
	if rows[0].SearchQuery != "lo-fi beats study" {
		t.Fatalf("expected search query, got %q", rows[0].SearchQuery)
	}
	if rows[1].SearchQuery != "" {
		t.Fatalf("expected no track linked to the earlier mood event, got %q", rows[1].SearchQuery)
	}
}

func TestLoadRecentTracksIncludesSearchQuery(t *testing.T) {
	db := setupHistoryDB(t)
	defer db.Close()

	tracks, err := loadRecentTracks(db, 10)
	if err != nil {
		t.Fatalf("load recent tracks: %v", err)
	}
	if len(tracks) != 1 {
		t.Fatalf("expected 1 track, got %d", len(tracks))
	}
	if tracks[0].SearchQuery != "lo-fi beats study" {
		t.Fatalf("expected persisted query, got %q", tracks[0].SearchQuery)
	}
}
