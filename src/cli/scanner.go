package main

import (
	"bufio"
	"io/fs"
	"os"
	"path/filepath"
	"strings"
)

type TagEntry struct {
	Text string `json:"text"`
	File string `json:"file"`
	Line int    `json:"line"`
}

var BuiltinPrefixes = []string{"TODO", "FIXME", "TEMP", "REF", "REV"}

func Scan(dir string, exclude map[string]bool, custom []string) (map[string][]TagEntry, error) {
	prefixes := append([]string{}, BuiltinPrefixes...)
	prefixes = append(prefixes, custom...)
	results := make(map[string][]TagEntry)
	err := filepath.WalkDir(dir, func(path string, d fs.DirEntry, err error) error {
		if err != nil {
			return nil // skip inaccessible
		}
		if d.IsDir() {
			if exclude[d.Name()] {
				return filepath.SkipDir
			}
			return nil
		}
		if isBinary(path) {
			return nil
		}
		return scanFile(path, prefixes, results)
	})
	return results, err
}

func isBinary(path string) bool {
	f, err := os.Open(path)
	if err != nil {
		return true
	}
	defer f.Close()
	buf := make([]byte, 512)
	n, err := f.Read(buf)
	if err != nil || n == 0 {
		return true
	}
	for _, b := range buf[:n] {
		if b == 0 {
			return true
		}
	}
	return false
}

func scanFile(path string, prefixes []string, results map[string][]TagEntry) error {
	f, err := os.Open(path)
	if err != nil {
		return nil
	}
	defer f.Close()
	scanner := bufio.NewScanner(f)
	lineNum := 0
	for scanner.Scan() {
		lineNum++
		line := scanner.Text()
		trimmed := strings.TrimSpace(line)
		upper := strings.ToUpper(trimmed)
		for _, p := range prefixes {
			if strings.HasPrefix(upper, p) {
				rest := upper[len(p):]
				if rest == "" || rest[0] == ':' || rest[0] == ' ' || rest[0] == '(' { // valid delimiter
					results[p] = append(results[p], TagEntry{
						Text: trimmed,
						File: path,
						Line: lineNum,
					})
					break // one match per line
				}
			}
		}
	}
	return nil
}
