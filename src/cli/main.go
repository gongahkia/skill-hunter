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
	flag.Parse()
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
	results, err := Scan(*dir, excludeSet, customTags)
	if err != nil {
		fmt.Fprintf(os.Stderr, "error: %v\n", err)
		os.Exit(1)
	}
	if err := Format(results, *fmtFlag, *scheme, customTags); err != nil {
		fmt.Fprintf(os.Stderr, "error: %v\n", err)
		os.Exit(1)
	}
}
