package config

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"

	toml "github.com/pelletier/go-toml/v2"
)

type CaptureConfig struct {
	IntervalSeconds int    `toml:"interval_seconds"`
	CameraIndex     int    `toml:"camera_index"`
	Resolution      string `toml:"resolution"`
}

type EmotionConfig struct {
	ModelBackend        string  `toml:"model_backend"`
	ConfidenceThreshold float64 `toml:"confidence_threshold"`
	SmoothingWindow     int     `toml:"smoothing_window"`
}

type YTMusicConfig struct {
	AuthFilePath string `toml:"auth_file_path"`
}

type MpvConfig struct {
	SocketPath    string `toml:"socket_path"`
	YtdlFormat    string `toml:"ytdl_format"`
	VolumeDefault int    `toml:"volume_default"`
}

type MappingConfig struct {
	DebounceSec int `toml:"debounce_seconds"`
}

type SpotifyConfig struct {
	ClientID  string `toml:"client_id"`
	TokenPath string `toml:"token_path"`
}

type PlaybackConfig struct {
	Source string `toml:"source"` // "ytmusic" or "spotify"
}

type Config struct {
	Capture            CaptureConfig       `toml:"capture"`
	Emotion            EmotionConfig       `toml:"emotion"`
	YTMusic            YTMusicConfig       `toml:"ytmusic"`
	Mpv                MpvConfig           `toml:"mpv"`
	Mapping            MappingConfig       `toml:"mapping"`
	Playback           PlaybackConfig      `toml:"playback"`
	Spotify            SpotifyConfig       `toml:"spotify"`
	MoodQueries        map[string][]string `toml:"mood_queries"`
	SharedProfilesPath string              `toml:"shared_profiles_path"`
}

func DefaultConfig() Config {
	homeDir, _ := os.UserHomeDir()
	configDir := filepath.Join(homeDir, ".config", "mood-music")

	return Config{
		Capture: CaptureConfig{
			IntervalSeconds: 10,
			CameraIndex:     0,
			Resolution:      "medium",
		},
		Emotion: EmotionConfig{
			ModelBackend:        "deepface_mobilenet",
			ConfidenceThreshold: 0.6,
			SmoothingWindow:     5,
		},
		YTMusic: YTMusicConfig{
			AuthFilePath: filepath.Join(configDir, "headers_auth.json"),
		},
		Mpv: MpvConfig{
			SocketPath:    "/tmp/mood-music-mpv.sock",
			YtdlFormat:    "bestaudio",
			VolumeDefault: 80,
		},
		Mapping: MappingConfig{
			DebounceSec: 30,
		},
		Playback: PlaybackConfig{
			Source: "ytmusic",
		},
		MoodQueries: map[string][]string{
			"FOCUS":     {"lo-fi beats study", "ambient focus music", "deep concentration"},
			"STRESSED":  {"calm relaxing music", "peaceful piano", "nature sounds relaxation"},
			"RELAXED":   {"chill vibes playlist", "acoustic relaxing", "soft indie"},
			"TIRED":     {"upbeat morning energy", "wake up playlist", "energetic pop"},
			"ENERGIZED": {"workout motivation", "high energy electronic", "running playlist"},
		},
	}
}

func configPath(override string) string {
	if override != "" {
		return override
	}
	homeDir, _ := os.UserHomeDir()
	return filepath.Join(homeDir, ".config", "mood-music", "config.toml")
}

func ResolvedPath(override string) string {
	return configPath(override)
}

func Load(path string) (Config, error) {
	cfg := DefaultConfig()
	cfgPath := configPath(path)

	data, err := os.ReadFile(cfgPath)
	if err != nil {
		if os.IsNotExist(err) {
			return cfg, nil
		}
		return cfg, fmt.Errorf("config: read %s: %w", cfgPath, err)
	}

	if err := toml.Unmarshal(data, &cfg); err != nil {
		return cfg, fmt.Errorf("config: parse %s: %w", cfgPath, err)
	}

	mergeSharedProfiles(&cfg)
	return cfg, nil
}

type sharedMoodProfile struct {
	Queries []string `json:"queries"`
}
type sharedProfilesFile struct {
	Moods map[string]sharedMoodProfile `json:"moods"`
}

func mergeSharedProfiles(cfg *Config) {
	profilePath := cfg.SharedProfilesPath
	if profilePath == "" {
		candidates := []string{
			filepath.Join("..", "shared", "mood_profiles.json"),  // from vibecheck/
			filepath.Join("shared", "mood_profiles.json"),        // from repo root
		}
		for _, c := range candidates {
			if _, err := os.Stat(c); err == nil {
				profilePath = c
				break
			}
		}
	}
	if profilePath == "" {
		return
	}
	data, err := os.ReadFile(profilePath)
	if err != nil {
		return
	}
	var sp sharedProfilesFile
	if err := json.Unmarshal(data, &sp); err != nil {
		return
	}
	for mood, profile := range sp.Moods {
		if _, exists := cfg.MoodQueries[mood]; exists {
			continue // toml override takes precedence
		}
		if len(profile.Queries) > 0 {
			cfg.MoodQueries[mood] = profile.Queries
		}
	}
}

func Save(cfg Config, path string) error {
	cfgPath := configPath(path)

	dir := filepath.Dir(cfgPath)
	if err := os.MkdirAll(dir, 0o755); err != nil {
		return fmt.Errorf("config: mkdir %s: %w", dir, err)
	}

	data, err := toml.Marshal(cfg)
	if err != nil {
		return fmt.Errorf("config: marshal: %w", err)
	}

	if err := os.WriteFile(cfgPath, data, 0o644); err != nil {
		return fmt.Errorf("config: write %s: %w", cfgPath, err)
	}

	return nil
}
