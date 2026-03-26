package analytics

import (
	"database/sql"
	"fmt"
	"os"
	"path/filepath"

	"github.com/google/uuid"
)

type Aggregator struct {
	dbPath string
	db     *sql.DB
}

func NewAggregator() (*Aggregator, error) {
	homeDir, _ := os.UserHomeDir()
	dbPath := filepath.Join(homeDir, ".local", "share", "sato-pulse", "history.db")

	if err := os.MkdirAll(filepath.Dir(dbPath), 0o755); err != nil {
		return nil, fmt.Errorf("analytics: mkdir: %w", err)
	}

	return &Aggregator{dbPath: dbPath}, nil
}

func (a *Aggregator) ensureDB() error {
	if a.db != nil {
		return nil
	}

	db, err := sql.Open("sqlite3", a.dbPath)
	if err != nil {
		return fmt.Errorf("analytics: open db: %w", err)
	}

	_, err = db.Exec(`
		CREATE TABLE IF NOT EXISTS mood_history (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			event_id TEXT,
			mood TEXT NOT NULL,
			confidence REAL NOT NULL,
			timestamp DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
		);
		CREATE TABLE IF NOT EXISTS sato_pulse_log (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			mood_event_id TEXT,
			mood TEXT NOT NULL,
			search_query TEXT,
			video_id TEXT,
			title TEXT,
			artist TEXT,
			timestamp DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
		);
		CREATE INDEX IF NOT EXISTS idx_mood_history_ts ON mood_history(timestamp);
		CREATE INDEX IF NOT EXISTS idx_sato_pulse_log_ts ON sato_pulse_log(timestamp);
	`)
	if err != nil {
		db.Close()
		return fmt.Errorf("analytics: create tables: %w", err)
	}

	if err := ensureSchema(db); err != nil {
		db.Close()
		return err
	}

	a.db = db
	return nil
}

func ensureSchema(db *sql.DB) error {
	if err := ensureColumn(
		db,
		"mood_history",
		"event_id",
		"ALTER TABLE mood_history ADD COLUMN event_id TEXT",
	); err != nil {
		return err
	}

	if err := ensureColumn(
		db,
		"sato_pulse_log",
		"mood_event_id",
		"ALTER TABLE sato_pulse_log ADD COLUMN mood_event_id TEXT",
	); err != nil {
		return err
	}

	_, err := db.Exec(`
		UPDATE mood_history
		SET event_id = 'legacy-mood-' || id
		WHERE event_id IS NULL OR event_id = '';
		CREATE UNIQUE INDEX IF NOT EXISTS idx_mood_history_event_id ON mood_history(event_id);
		CREATE INDEX IF NOT EXISTS idx_sato_pulse_log_event_id ON sato_pulse_log(mood_event_id);
	`)
	if err != nil {
		return fmt.Errorf("analytics: migrate schema: %w", err)
	}

	return nil
}

func ensureColumn(db *sql.DB, table string, column string, alterStmt string) error {
	rows, err := db.Query(fmt.Sprintf("PRAGMA table_info(%s)", table))
	if err != nil {
		return fmt.Errorf("analytics: table info %s: %w", table, err)
	}
	defer rows.Close()

	for rows.Next() {
		var cid int
		var name string
		var columnType string
		var notNull int
		var defaultValue sql.NullString
		var pk int
		if err := rows.Scan(&cid, &name, &columnType, &notNull, &defaultValue, &pk); err != nil {
			return fmt.Errorf("analytics: scan table info %s: %w", table, err)
		}
		if name == column {
			return nil
		}
	}

	if _, err := db.Exec(alterStmt); err != nil {
		return fmt.Errorf("analytics: add column %s.%s: %w", table, column, err)
	}

	return nil
}

func (a *Aggregator) RecordMood(mood string, confidence float64) (string, error) {
	if err := a.ensureDB(); err != nil {
		return "", err
	}
	eventID := uuid.NewString()
	_, err := a.db.Exec(
		"INSERT INTO mood_history (event_id, mood, confidence) VALUES (?, ?, ?)",
		eventID,
		mood,
		confidence,
	)
	if err != nil {
		return "", err
	}
	return eventID, nil
}

func (a *Aggregator) RecordTrack(moodEventID, mood, query, videoID, title, artist string) error {
	if err := a.ensureDB(); err != nil {
		return err
	}
	_, err := a.db.Exec(
		"INSERT INTO sato_pulse_log (mood_event_id, mood, search_query, video_id, title, artist) VALUES (?, ?, ?, ?, ?, ?)",
		moodEventID, mood, query, videoID, title, artist,
	)
	return err
}

func (a *Aggregator) Close() error {
	if a.db != nil {
		return a.db.Close()
	}
	return nil
}
