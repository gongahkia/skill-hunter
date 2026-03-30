package main

import "testing"

func TestParseMetaFull(t *testing.T) {
	meta, rest := ParseMeta("(@alice, 2024-06-15, p1): fix login")
	if meta.Owner != "alice" {
		t.Fatalf("owner: want alice, got %s", meta.Owner)
	}
	if meta.Date != "2024-06-15" {
		t.Fatalf("date: want 2024-06-15, got %s", meta.Date)
	}
	if meta.Priority != "p1" {
		t.Fatalf("priority: want p1, got %s", meta.Priority)
	}
	if rest != "fix login" {
		t.Fatalf("rest: want 'fix login', got '%s'", rest)
	}
}

func TestParseMetaPartial(t *testing.T) {
	meta, rest := ParseMeta("(@bob): review this")
	if meta.Owner != "bob" {
		t.Fatalf("owner: want bob, got %s", meta.Owner)
	}
	if meta.Date != "" || meta.Priority != "" {
		t.Fatalf("unexpected date/priority")
	}
	if rest != "review this" {
		t.Fatalf("rest: want 'review this', got '%s'", rest)
	}
}

func TestParseMetaNone(t *testing.T) {
	meta, rest := ParseMeta("plain tag text")
	if meta.Owner != "" || meta.Date != "" || meta.Priority != "" {
		t.Fatalf("expected empty meta")
	}
	if rest != "plain tag text" {
		t.Fatalf("rest: want 'plain tag text', got '%s'", rest)
	}
}

func TestParseMetaDateOnly(t *testing.T) {
	meta, rest := ParseMeta("(2025-01-01) deadline task")
	if meta.Date != "2025-01-01" {
		t.Fatalf("date: want 2025-01-01, got %s", meta.Date)
	}
	if rest != "deadline task" {
		t.Fatalf("rest mismatch: got '%s'", rest)
	}
}

func TestScanParsesMetadata(t *testing.T) {
	root := t.TempDir()
	mustWriteFile(t, root+"/meta.txt", "// TODO(@alice, p2): fix this\n")
	report, err := Scan(root, map[string]bool{}, nil, nil)
	if err != nil {
		t.Fatalf("scan: %v", err)
	}
	todos := report.Results["TODO"]
	if len(todos) != 1 {
		t.Fatalf("expected 1 TODO, got %d", len(todos))
	}
	if todos[0].Meta == nil {
		t.Fatalf("expected metadata")
	}
	if todos[0].Meta.Owner != "alice" {
		t.Fatalf("owner: want alice, got %s", todos[0].Meta.Owner)
	}
}

func TestScanNoMetaBackwardCompat(t *testing.T) {
	root := t.TempDir()
	mustWriteFile(t, root+"/plain.txt", "// TODO ship feature\n")
	report, err := Scan(root, map[string]bool{}, nil, nil)
	if err != nil {
		t.Fatalf("scan: %v", err)
	}
	todos := report.Results["TODO"]
	if len(todos) != 1 {
		t.Fatalf("expected 1 TODO, got %d", len(todos))
	}
	if todos[0].Meta != nil {
		t.Fatalf("expected nil meta for plain tag")
	}
}
