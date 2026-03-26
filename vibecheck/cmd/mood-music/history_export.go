package main

import (
	"database/sql"
	"fmt"
)

type exportRow struct {
	Mood        string  `json:"mood"`
	Confidence  float64 `json:"confidence"`
	Timestamp   string  `json:"timestamp"`
	VideoID     string  `json:"video_id,omitempty"`
	Title       string  `json:"title,omitempty"`
	Artist      string  `json:"artist,omitempty"`
	SearchQuery string  `json:"search_query,omitempty"`
}

type recentTrackRow struct {
	Mood        string
	Title       string
	Artist      string
	SearchQuery string
	Timestamp   string
}

func loadExportRows(db *sql.DB, fromDate string, toDate string) ([]exportRow, error) {
	query := `
		SELECT h.mood, h.confidence, h.timestamp,
		       COALESCE(m.video_id, ''), COALESCE(m.title, ''),
		       COALESCE(m.artist, ''), COALESCE(m.search_query, '')
		FROM mood_history h
		LEFT JOIN mood_music_log m ON m.mood_event_id = h.event_id
		  OR (
			m.mood_event_id IS NULL
			AND h.event_id LIKE 'legacy-mood-%'
			AND m.mood = h.mood
			AND m.timestamp BETWEEN h.timestamp AND datetime(h.timestamp, '+30 seconds')
		  )
		WHERE 1=1`
	var queryArgs []any

	if fromDate != "" {
		query += " AND h.timestamp >= ?"
		queryArgs = append(queryArgs, fromDate)
	}
	if toDate != "" {
		query += " AND h.timestamp <= datetime(?, '+1 day')"
		queryArgs = append(queryArgs, toDate)
	}
	query += " ORDER BY h.timestamp DESC"

	rows, err := db.Query(query, queryArgs...)
	if err != nil {
		return nil, fmt.Errorf("query database: %w", err)
	}
	defer rows.Close()

	var results []exportRow
	for rows.Next() {
		var row exportRow
		if err := rows.Scan(
			&row.Mood,
			&row.Confidence,
			&row.Timestamp,
			&row.VideoID,
			&row.Title,
			&row.Artist,
			&row.SearchQuery,
		); err != nil {
			return nil, fmt.Errorf("scan row: %w", err)
		}
		results = append(results, row)
	}

	return results, nil
}

func loadRecentTracks(db *sql.DB, limit int) ([]recentTrackRow, error) {
	rows, err := db.Query(`
		SELECT mood, title, artist, search_query, timestamp
		FROM mood_music_log
		ORDER BY timestamp DESC
		LIMIT ?
	`, limit)
	if err != nil {
		return nil, fmt.Errorf("query tracks: %w", err)
	}
	defer rows.Close()

	var tracks []recentTrackRow
	for rows.Next() {
		var row recentTrackRow
		if err := rows.Scan(&row.Mood, &row.Title, &row.Artist, &row.SearchQuery, &row.Timestamp); err != nil {
			return nil, fmt.Errorf("scan track row: %w", err)
		}
		tracks = append(tracks, row)
	}

	return tracks, nil
}
