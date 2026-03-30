package main

import (
	"flag"
	"fmt"
	"os"
	"strings"
)

func main() {
	dir := flag.String("dir", ".", "directory to scan")
	fmtFlag := flag.String("fmt", "table", "output format: table, json, md")
	tags := flag.String("tags", "", "comma-separated additional custom tags")
	scheme := flag.String("scheme", "gruvbox", "colorscheme name")
	exclude := flag.String("exclude", ".git,node_modules,vendor,.DS_Store", "comma-separated dirs to skip")
	verbose := flag.Bool("verbose", false, "print debug logs and per-file warnings")
	logFile := flag.String("log-file", "", "optional log file path")
	strict := flag.Bool("strict", false, "exit with code 2 if scan warnings are found")
	flag.Parse()

	logger, err := NewLogger(*verbose, *logFile)
	if err != nil {
		fmt.Fprintf(os.Stderr, "error: %v\n", err)
		os.Exit(1)
	}

	excludeSet := make(map[string]bool)
	for _, e := range strings.Split(*exclude, ",") {
		if t := strings.TrimSpace(e); t != "" {
			excludeSet[t] = true
		}
	}
	var customTags []string
	if *tags != "" {
		for _, t := range strings.Split(*tags, ",") {
			if t = strings.TrimSpace(strings.ToUpper(t)); t != "" {
				customTags = append(customTags, t)
			}
		}
	}

	report, err := Scan(*dir, excludeSet, customTags, logger)
	if err != nil {
		logger.Errorf("scan failed: %v", err)
		fmt.Fprintf(os.Stderr, "error: %v\n", err)
		os.Exit(1)
	}

	if err := Format(report.Results, *fmtFlag, *scheme, customTags); err != nil {
		logger.Errorf("format failed: %v", err)
		fmt.Fprintf(os.Stderr, "error: %v\n", err)
		os.Exit(1)
	}

	fmt.Fprintf(
		os.Stderr,
		"scan summary: %d files scanned, %d files skipped, %d matches, %d warnings\n",
		report.Stats.FilesScanned,
		report.Stats.FilesSkipped,
		report.Stats.Matches,
		len(report.Stats.Warnings),
	)

	if *strict && len(report.Stats.Warnings) > 0 {
		logger.Warnf("strict mode enabled and warnings were emitted")
		os.Exit(2)
	}
}
