package main

import (
	"encoding/json"
	"os"
	"path/filepath"
	"testing"
	"time"
)

func TestRecordTelemetry(t *testing.T) {
	tmpDir := t.TempDir()
	origHome := os.Getenv("HOME")
	os.Setenv("HOME", tmpDir)
	defer os.Setenv("HOME", origHome)
	report := &ScanReport{
		Results: map[string][]TagEntry{"TODO": {{Text: "test", File: "a.go", Line: 1}}},
		Stats:   ScanStats{FilesScanned: 10, FilesSkipped: 2, Matches: 1},
	}
	err := RecordTelemetry(report, 0, 50*time.Millisecond)
	if err != nil {
		t.Fatalf("record: %v", err)
	}
	path := filepath.Join(tmpDir, ".owl", "telemetry.json")
	data, err := os.ReadFile(path)
	if err != nil {
		t.Fatalf("read: %v", err)
	}
	var store TelemetryStore
	if err := json.Unmarshal(data, &store); err != nil {
		t.Fatalf("parse: %v", err)
	}
	if len(store.Events) != 1 {
		t.Fatalf("expected 1 event, got %d", len(store.Events))
	}
	if store.Events[0].FilesScanned != 10 {
		t.Fatalf("filesScanned: want 10, got %d", store.Events[0].FilesScanned)
	}
}

func TestTelemetryCapAt500(t *testing.T) {
	tmpDir := t.TempDir()
	origHome := os.Getenv("HOME")
	os.Setenv("HOME", tmpDir)
	defer os.Setenv("HOME", origHome)
	report := &ScanReport{
		Results: map[string][]TagEntry{},
		Stats:   ScanStats{FilesScanned: 1},
	}
	for i := 0; i < 510; i++ {
		RecordTelemetry(report, 0, time.Millisecond)
	}
	path := filepath.Join(tmpDir, ".owl", "telemetry.json")
	data, _ := os.ReadFile(path)
	var store TelemetryStore
	json.Unmarshal(data, &store)
	if len(store.Events) > 500 {
		t.Fatalf("expected capped at 500, got %d", len(store.Events))
	}
}
