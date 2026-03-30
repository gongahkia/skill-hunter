package main

import (
	"bufio"
	"io"
	"io/fs"
	"os"
	"path/filepath"
	"strings"
)

type TagEntry struct {
	Text string   `json:"text"`
	File string   `json:"file"`
	Line int      `json:"line"`
	Meta *TagMeta `json:"meta,omitempty"`
}

type ScanWarning struct {
	Path   string `json:"path"`
	Reason string `json:"reason"`
}

type ScanStats struct {
	FilesScanned int           `json:"filesScanned"`
	FilesSkipped int           `json:"filesSkipped"`
	Matches      int           `json:"matches"`
	Warnings     []ScanWarning `json:"warnings"`
}

type ScanReport struct {
	Results map[string][]TagEntry `json:"results"`
	Stats   ScanStats             `json:"stats"`
}

var BuiltinPrefixes = []string{"TODO", "FIXME", "TEMP", "REF", "REV"}
var commentLeaders = []string{"//", "#", "--", ";", "*", "/*", "<!--"}

func (report *ScanReport) addWarning(path string, err error, logger *Logger) {
	warning := ScanWarning{
		Path:   path,
		Reason: err.Error(),
	}
	report.Stats.Warnings = append(report.Stats.Warnings, warning)
	if logger != nil {
		logger.Warnf("%s: %s", path, warning.Reason)
	}
}

func Scan(dir string, exclude map[string]bool, custom []string, logger *Logger) (*ScanReport, error) {
	prefixes := append([]string{}, BuiltinPrefixes...)
	prefixes = append(prefixes, custom...)
	report := &ScanReport{
		Results: make(map[string][]TagEntry),
	}
	err := filepath.WalkDir(dir, func(path string, d fs.DirEntry, err error) error {
		if err != nil {
			report.addWarning(path, err, logger)
			return nil
		}

		if d.IsDir() {
			if exclude[d.Name()] {
				if logger != nil {
					logger.Debugf("skipping excluded directory: %s", path)
				}
				return filepath.SkipDir
			}
			return nil
		}

		isBin, binErr := isBinary(path)
		if binErr != nil {
			report.addWarning(path, binErr, logger)
			report.Stats.FilesSkipped++
			return nil
		}
		if isBin {
			report.Stats.FilesSkipped++
			if logger != nil {
				logger.Debugf("skipping binary file: %s", path)
			}
			return nil
		}

		report.Stats.FilesScanned++
		if scanErr := scanFile(path, prefixes, report); scanErr != nil {
			report.addWarning(path, scanErr, logger)
		}
		return nil
	})
	return report, err
}

func isBinary(path string) (bool, error) {
	f, err := os.Open(path)
	if err != nil {
		return false, err
	}
	defer f.Close()

	buf := make([]byte, 512)
	n, err := f.Read(buf)
	if err != nil && err != io.EOF {
		return false, err
	}
	if n == 0 {
		return false, nil
	}

	for _, b := range buf[:n] {
		if b == 0 {
			return true, nil
		}
	}
	return false, nil
}

func normalizeForMatch(line string) string {
	trimmed := strings.TrimSpace(line)
	for {
		changed := false
		for _, leader := range commentLeaders {
			if strings.HasPrefix(trimmed, leader) {
				trimmed = strings.TrimSpace(strings.TrimPrefix(trimmed, leader))
				changed = true
				break
			}
		}
		if !changed {
			break
		}
	}
	return trimmed
}

func hasPrefixMatch(line string, prefix string) bool {
	upper := strings.ToUpper(line)
	if !strings.HasPrefix(upper, prefix) {
		return false
	}
	rest := upper[len(prefix):]
	return rest == "" ||
		strings.HasPrefix(rest, ":") ||
		strings.HasPrefix(rest, " ") ||
		strings.HasPrefix(rest, "(") ||
		strings.HasPrefix(rest, "-")
}

func scanFile(path string, prefixes []string, report *ScanReport) error {
	f, err := os.Open(path)
	if err != nil {
		return err
	}
	defer f.Close()

	scanner := bufio.NewScanner(f)
	lineNum := 0
	for scanner.Scan() {
		lineNum++
		rawLine := scanner.Text()
		normalized := normalizeForMatch(rawLine)
		if normalized == "" {
			continue
		}

		for _, p := range prefixes {
			if hasPrefixMatch(normalized, p) {
				afterPrefix := normalized[len(p):]
				afterPrefix = strings.TrimLeft(afterPrefix, ":- ")
				meta, _ := ParseMeta(afterPrefix)
				entry := TagEntry{
					Text: strings.TrimSpace(rawLine),
					File: path,
					Line: lineNum,
				}
				if meta.Owner != "" || meta.Date != "" || meta.Priority != "" {
					entry.Meta = &meta
				}
				report.Results[p] = append(report.Results[p], entry)
				report.Stats.Matches++
				break
			}
		}
	}
	if err := scanner.Err(); err != nil {
		return err
	}
	return nil
}
