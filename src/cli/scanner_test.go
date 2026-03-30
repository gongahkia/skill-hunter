package main

import (
	"os"
	"path/filepath"
	"testing"
)

func mustWriteFile(t *testing.T, path string, content string) {
	t.Helper()
	if err := os.WriteFile(path, []byte(content), 0o644); err != nil {
		t.Fatalf("write file %s: %v", path, err)
	}
}

func TestScanMatchesCommentPrefixedTags(t *testing.T) {
	root := t.TempDir()
	source := filepath.Join(root, "notes.txt")
	mustWriteFile(t, source, "// TODO: ship this\n# FIXME broken\n")

	report, err := Scan(root, map[string]bool{}, nil, nil)
	if err != nil {
		t.Fatalf("scan failed: %v", err)
	}

	if len(report.Results["TODO"]) != 1 {
		t.Fatalf("expected 1 TODO match, got %d", len(report.Results["TODO"]))
	}
	if len(report.Results["FIXME"]) != 1 {
		t.Fatalf("expected 1 FIXME match, got %d", len(report.Results["FIXME"]))
	}
	if report.Stats.Matches != 2 {
		t.Fatalf("expected 2 total matches, got %d", report.Stats.Matches)
	}
}

func TestScanSkipsBinaryFiles(t *testing.T) {
	root := t.TempDir()
	textFile := filepath.Join(root, "plain.txt")
	binaryFile := filepath.Join(root, "blob.bin")
	mustWriteFile(t, textFile, "TODO draft\n")
	mustWriteFile(t, binaryFile, "\x00\x01\x02")

	report, err := Scan(root, map[string]bool{}, nil, nil)
	if err != nil {
		t.Fatalf("scan failed: %v", err)
	}

	if len(report.Results["TODO"]) != 1 {
		t.Fatalf("expected TODO in text file, got %d", len(report.Results["TODO"]))
	}
	if report.Stats.FilesSkipped < 1 {
		t.Fatalf("expected at least one skipped file, got %d", report.Stats.FilesSkipped)
	}
}

func TestScanSupportsCustomPrefixes(t *testing.T) {
	root := t.TempDir()
	source := filepath.Join(root, "project.md")
	mustWriteFile(t, source, "-- HACK revisit onboarding copy\n")

	report, err := Scan(root, map[string]bool{}, []string{"HACK"}, nil)
	if err != nil {
		t.Fatalf("scan failed: %v", err)
	}

	if len(report.Results["HACK"]) != 1 {
		t.Fatalf("expected 1 HACK match, got %d", len(report.Results["HACK"]))
	}
}
