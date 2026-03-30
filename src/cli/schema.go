package main

import "time"

const SchemaVersion = 1

type OwlExport struct {
	Schema   int                   `json:"schema"`
	Version  string                `json:"version"`
	Platform string                `json:"platform"`
	Created  string                `json:"created"`
	Tags     map[string][]TagEntry `json:"tags"`
}

func NewExport(platform string, tags map[string][]TagEntry) *OwlExport {
	return &OwlExport{
		Schema:   SchemaVersion,
		Version:  "1.0.0",
		Platform: platform,
		Created:  time.Now().UTC().Format(time.RFC3339),
		Tags:     tags,
	}
}

func MigrateExport(raw map[string]interface{}) (*OwlExport, error) {
	schema, ok := raw["schema"]
	if !ok { // pre-schema export: wrap bare tags map
		tags := make(map[string][]TagEntry)
		for k, v := range raw {
			if arr, ok := v.([]interface{}); ok {
				for _, item := range arr {
					if m, ok := item.(map[string]interface{}); ok {
						entry := TagEntry{}
						if t, ok := m["text"].(string); ok {
							entry.Text = t
						}
						if f, ok := m["file"].(string); ok {
							entry.File = f
						}
						if l, ok := m["line"].(float64); ok {
							entry.Line = int(l)
						}
						tags[k] = append(tags[k], entry)
					}
				}
			}
		}
		return &OwlExport{Schema: SchemaVersion, Platform: "unknown", Tags: tags}, nil
	}
	_ = schema // v1 is current; future migrations go here
	return nil, nil
}
