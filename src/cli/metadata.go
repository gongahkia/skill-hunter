package main

import (
	"regexp"
	"strings"
)

type TagMeta struct {
	Owner    string `json:"owner,omitempty"`
	Date     string `json:"date,omitempty"`
	Priority string `json:"priority,omitempty"`
}

var metaParenRe = regexp.MustCompile(`^\(([^)]*)\)\s*:?\s*`)
var ownerRe = regexp.MustCompile(`^@[\w.-]+$`)
var dateRe = regexp.MustCompile(`^\d{4}-\d{2}-\d{2}$`)
var prioRe = regexp.MustCompile(`^[pP]\d+$`)

func ParseMeta(afterPrefix string) (TagMeta, string) {
	trimmed := strings.TrimSpace(afterPrefix)
	m := metaParenRe.FindStringSubmatch(trimmed)
	if m == nil {
		return TagMeta{}, trimmed
	}
	meta := TagMeta{}
	parts := strings.Split(m[1], ",")
	for _, part := range parts {
		tok := strings.TrimSpace(part)
		switch {
		case ownerRe.MatchString(tok):
			meta.Owner = tok[1:] // strip @
		case dateRe.MatchString(tok):
			meta.Date = tok
		case prioRe.MatchString(tok):
			meta.Priority = tok
		}
	}
	rest := strings.TrimSpace(trimmed[len(m[0]):])
	return meta, rest
}
