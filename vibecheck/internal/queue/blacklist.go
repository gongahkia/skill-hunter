package queue

import (
	"encoding/json"
	"os"
	"path/filepath"
	"sync"
)

type Blacklist struct {
	mu       sync.Mutex
	videoIDs map[string]bool
	path     string
}

func NewBlacklist() *Blacklist {
	homeDir, _ := os.UserHomeDir()
	path := filepath.Join(homeDir, ".config", "mood-music", "blacklist.json")

	bl := &Blacklist{
		videoIDs: make(map[string]bool),
		path:     path,
	}
	bl.load()
	return bl
}

func (bl *Blacklist) Add(videoID string) error {
	bl.mu.Lock()
	defer bl.mu.Unlock()

	bl.videoIDs[videoID] = true
	return bl.save()
}

func (bl *Blacklist) Contains(videoID string) bool {
	bl.mu.Lock()
	defer bl.mu.Unlock()
	return bl.videoIDs[videoID]
}

func (bl *Blacklist) load() {
	data, err := os.ReadFile(bl.path)
	if err != nil {
		return
	}

	var ids []string
	if err := json.Unmarshal(data, &ids); err != nil {
		return
	}

	for _, id := range ids {
		bl.videoIDs[id] = true
	}
}

func (bl *Blacklist) save() error {
	ids := make([]string, 0, len(bl.videoIDs))
	for id := range bl.videoIDs {
		ids = append(ids, id)
	}

	data, err := json.MarshalIndent(ids, "", "  ")
	if err != nil {
		return err
	}

	dir := filepath.Dir(bl.path)
	os.MkdirAll(dir, 0o755)

	return os.WriteFile(bl.path, data, 0o644)
}
