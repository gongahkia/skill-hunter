package main

import (
	"encoding/json"
	"testing"
)

func TestNewExportHasSchemaVersion(t *testing.T) {
	tags := map[string][]TagEntry{"TODO": {{Text: "test", File: "a.go", Line: 1}}}
	export := NewExport("cli", tags)
	if export.Schema != SchemaVersion {
		t.Fatalf("expected schema %d, got %d", SchemaVersion, export.Schema)
	}
	if export.Platform != "cli" {
		t.Fatalf("expected platform cli, got %s", export.Platform)
	}
	if len(export.Tags["TODO"]) != 1 {
		t.Fatalf("expected 1 TODO tag, got %d", len(export.Tags["TODO"]))
	}
}

func TestMigratePreSchemaExport(t *testing.T) {
	raw := map[string]interface{}{
		"TODO": []interface{}{
			map[string]interface{}{"text": "fix bug", "file": "main.go", "line": 10.0},
		},
	}
	export, err := MigrateExport(raw)
	if err != nil {
		t.Fatalf("migration failed: %v", err)
	}
	if export.Schema != SchemaVersion {
		t.Fatalf("expected schema %d after migration, got %d", SchemaVersion, export.Schema)
	}
	if len(export.Tags["TODO"]) != 1 {
		t.Fatalf("expected 1 TODO, got %d", len(export.Tags["TODO"]))
	}
}

func TestExportRoundtripsJSON(t *testing.T) {
	tags := map[string][]TagEntry{"FIXME": {{Text: "urgent", File: "b.go", Line: 5}}}
	export := NewExport("cli", tags)
	data, err := json.Marshal(export)
	if err != nil {
		t.Fatalf("marshal: %v", err)
	}
	var decoded OwlExport
	if err := json.Unmarshal(data, &decoded); err != nil {
		t.Fatalf("unmarshal: %v", err)
	}
	if decoded.Schema != SchemaVersion {
		t.Fatalf("roundtrip schema mismatch")
	}
	if decoded.Tags["FIXME"][0].Text != "urgent" {
		t.Fatalf("roundtrip text mismatch")
	}
}
