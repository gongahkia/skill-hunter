package main

import (
	"encoding/json"
	"fmt"
	"os"
	"sort"
)

func Format(results map[string][]TagEntry, mode, schemeName string, custom []string) error {
	switch mode {
	case "table":
		return fmtTable(results, schemeName, custom)
	case "json":
		return fmtJSON(results)
	case "md":
		return fmtMarkdown(results)
	default:
		return fmt.Errorf("unknown format: %s", mode)
	}
}

func sortedTags(results map[string][]TagEntry) []string {
	tags := make([]string, 0, len(results))
	for t := range results {
		tags = append(tags, t)
	}
	sort.Slice(tags, func(i, j int) bool {
		return GetPriority(tags[i]) < GetPriority(tags[j])
	})
	return tags
}

func fmtTable(results map[string][]TagEntry, schemeName string, custom []string) error {
	scheme := GetScheme(schemeName)
	tags := sortedTags(results)
	customIdx := 0
	for _, tag := range tags {
		entries := results[tag]
		color := ColorFor(scheme, tag, customIdx)
		if _, builtin := Priority[tag]; !builtin {
			customIdx++
		}
		fmt.Printf("%s%s%s (%d)\n", color, tag, Reset, len(entries))
		for _, e := range entries {
			fmt.Printf("  %s:%d  %s\n", e.File, e.Line, e.Text)
		}
		fmt.Println()
	}
	return nil
}

func fmtJSON(results map[string][]TagEntry) error {
	enc := json.NewEncoder(os.Stdout)
	enc.SetIndent("", "  ")
	return enc.Encode(results)
}

func fmtMarkdown(results map[string][]TagEntry) error {
	tags := sortedTags(results)
	for _, tag := range tags {
		fmt.Printf("## %s\n\n", tag)
		for _, e := range results[tag] {
			fmt.Printf("- %s (%s:%d)\n", e.Text, e.File, e.Line)
		}
		fmt.Println()
	}
	return nil
}
