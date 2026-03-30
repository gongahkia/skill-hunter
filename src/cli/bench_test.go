package main

import (
	"fmt"
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"
)

func generateLargeFile(t *testing.T, dir string, lines int) string {
	t.Helper()
	path := filepath.Join(dir, "large.go")
	var sb strings.Builder
	for i := 0; i < lines; i++ {
		if i%100 == 0 {
			sb.WriteString(fmt.Sprintf("// TODO(@bench, p1): task %d\n", i))
		} else if i%250 == 0 {
			sb.WriteString(fmt.Sprintf("// FIXME: critical issue %d\n", i))
		} else {
			sb.WriteString(fmt.Sprintf("func handler%d() { return } // line %d\n", i, i))
		}
	}
	if err := os.WriteFile(path, []byte(sb.String()), 0o644); err != nil {
		t.Fatalf("write large file: %v", err)
	}
	return path
}

func generateManyFiles(t *testing.T, dir string, count int) {
	t.Helper()
	for i := 0; i < count; i++ {
		path := filepath.Join(dir, fmt.Sprintf("file_%d.go", i))
		content := fmt.Sprintf("// TODO task in file %d\npackage main\n", i)
		if err := os.WriteFile(path, []byte(content), 0o644); err != nil {
			t.Fatalf("write file %d: %v", i, err)
		}
	}
}

func BenchmarkScan10kLines(b *testing.B) {
	dir := b.TempDir()
	generateLargeFile(&testing.T{}, dir, 10000) // workaround: use minimal helper
	path := filepath.Join(dir, "large.go")
	if _, err := os.Stat(path); err != nil { // fallback if helper fails
		var sb strings.Builder
		for i := 0; i < 10000; i++ {
			if i%100 == 0 {
				sb.WriteString(fmt.Sprintf("// TODO: task %d\n", i))
			} else {
				sb.WriteString(fmt.Sprintf("func f%d() {}\n", i))
			}
		}
		os.WriteFile(path, []byte(sb.String()), 0o644)
	}
	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		Scan(dir, map[string]bool{}, nil, nil)
	}
}

func BenchmarkScan500Files(b *testing.B) {
	dir := b.TempDir()
	for i := 0; i < 500; i++ {
		content := fmt.Sprintf("// TODO task %d\npackage main\n", i)
		os.WriteFile(filepath.Join(dir, fmt.Sprintf("f%d.go", i)), []byte(content), 0o644)
	}
	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		Scan(dir, map[string]bool{}, nil, nil)
	}
}

func BenchmarkScanWithCustomTags(b *testing.B) {
	dir := b.TempDir()
	var sb strings.Builder
	for i := 0; i < 5000; i++ {
		if i%50 == 0 {
			sb.WriteString(fmt.Sprintf("// HACK workaround %d\n", i))
		} else {
			sb.WriteString(fmt.Sprintf("x := %d\n", i))
		}
	}
	os.WriteFile(filepath.Join(dir, "custom.go"), []byte(sb.String()), 0o644)
	custom := []string{"HACK", "PERF", "SECURITY"}
	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		Scan(dir, map[string]bool{}, custom, nil)
	}
}

func TestPerfBudget10kLines(t *testing.T) {
	dir := t.TempDir()
	var sb strings.Builder
	for i := 0; i < 10000; i++ {
		if i%100 == 0 {
			sb.WriteString(fmt.Sprintf("// TODO: task %d\n", i))
		} else {
			sb.WriteString(fmt.Sprintf("func f%d() {}\n", i))
		}
	}
	mustWriteFile(t, filepath.Join(dir, "large.go"), sb.String())
	start := time.Now()
	_, err := Scan(dir, map[string]bool{}, nil, nil)
	elapsed := time.Since(start)
	if err != nil {
		t.Fatalf("scan: %v", err)
	}
	budget := 2 * time.Second // 10k lines should scan in <2s
	if elapsed > budget {
		t.Fatalf("perf budget exceeded: %v > %v", elapsed, budget)
	}
}

func TestPerfBudget500Files(t *testing.T) {
	dir := t.TempDir()
	for i := 0; i < 500; i++ {
		content := fmt.Sprintf("// TODO task %d\npackage main\n", i)
		mustWriteFile(t, filepath.Join(dir, fmt.Sprintf("f%d.go", i)), content)
	}
	start := time.Now()
	report, err := Scan(dir, map[string]bool{}, nil, nil)
	elapsed := time.Since(start)
	if err != nil {
		t.Fatalf("scan: %v", err)
	}
	if report.Stats.FilesScanned != 500 {
		t.Fatalf("expected 500 files scanned, got %d", report.Stats.FilesScanned)
	}
	budget := 3 * time.Second // 500 files should scan in <3s
	if elapsed > budget {
		t.Fatalf("perf budget exceeded: %v > %v", elapsed, budget)
	}
}
