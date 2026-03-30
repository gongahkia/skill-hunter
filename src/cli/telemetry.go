package main

import (
	"encoding/json"
	"os"
	"path/filepath"
	"time"
)

type TelemetryEvent struct {
	Timestamp    string `json:"timestamp"`
	FilesScanned int    `json:"filesScanned"`
	FilesSkipped int    `json:"filesSkipped"`
	Matches      int    `json:"matches"`
	Warnings     int    `json:"warnings"`
	CustomTags   int    `json:"customTags"`
	DurationMs   int64  `json:"durationMs"`
}

type TelemetryStore struct {
	Events []TelemetryEvent `json:"events"`
}

func telemetryPath() string {
	home, err := os.UserHomeDir()
	if err != nil {
		return ""
	}
	return filepath.Join(home, ".owl", "telemetry.json")
}

func RecordTelemetry(report *ScanReport, customCount int, duration time.Duration) error {
	path := telemetryPath()
	if path == "" {
		return nil
	}
	dir := filepath.Dir(path)
	if err := os.MkdirAll(dir, 0o755); err != nil {
		return err
	}
	store := TelemetryStore{}
	if data, err := os.ReadFile(path); err == nil {
		json.Unmarshal(data, &store) // ignore parse errors, start fresh
	}
	store.Events = append(store.Events, TelemetryEvent{
		Timestamp:    time.Now().UTC().Format(time.RFC3339),
		FilesScanned: report.Stats.FilesScanned,
		FilesSkipped: report.Stats.FilesSkipped,
		Matches:      report.Stats.Matches,
		Warnings:     len(report.Stats.Warnings),
		CustomTags:   customCount,
		DurationMs:   duration.Milliseconds(),
	})
	const maxEvents = 500 // cap local storage
	if len(store.Events) > maxEvents {
		store.Events = store.Events[len(store.Events)-maxEvents:]
	}
	data, err := json.MarshalIndent(store, "", "  ")
	if err != nil {
		return err
	}
	return os.WriteFile(path, data, 0o644)
}
