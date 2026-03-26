package main

import (
	"database/sql"
	"encoding/json"
	"fmt"
	"log/slog"
	"os"
	"os/signal"
	"strconv"
	"sync"
	"syscall"
	"time"

	tea "github.com/charmbracelet/bubbletea"
	_ "github.com/mattn/go-sqlite3"
	"github.com/spf13/cobra"

	"sato-pulse/internal/analytics"
	"sato-pulse/internal/bridge"
	"sato-pulse/internal/config"
	"sato-pulse/internal/ipc"
	"sato-pulse/internal/mpv"
	"sato-pulse/internal/queue"
	"sato-pulse/internal/tui"
)

var (
	cfgFile          string
	logLevel         string
	samplingInterval int
	dryRun           bool
	background       bool
)

var supportedEmotionBackends = []string{
	"deepface_mobilenet",
	"deepface_opencv",
}

var rootCmd = &cobra.Command{
	Use:   "sato-pulse",
	Short: "Emotion-driven music player",
	Long:  "sato-pulse detects your mood via webcam and auto-curates YouTube Music tracks through mpv.",
	RunE: func(cmd *cobra.Command, args []string) error {
		return runApp()
	},
}

var configureCmd = &cobra.Command{
	Use:   "configure",
	Short: "Interactive first-time configuration",
	RunE: func(cmd *cobra.Command, args []string) error {
		cfg, err := config.Load(cfgFile)
		if err != nil {
			fmt.Fprintf(os.Stderr, "warning: could not load existing config: %v\n", err)
			cfg = config.DefaultConfig()
		}

		fmt.Println("sato-pulse configuration")
		fmt.Println("========================")
		fmt.Println("Press Enter to keep default values shown in [brackets].")
		fmt.Println()

		cfg.Capture.CameraIndex = promptInt("Camera index", cfg.Capture.CameraIndex)
		cfg.Capture.IntervalSeconds = promptInt("Sampling interval (seconds)", cfg.Capture.IntervalSeconds)
		cfg.Capture.Resolution = promptString("Camera resolution (low/medium/high)", cfg.Capture.Resolution)
		backend := promptString(
			"Emotion backend (deepface_mobilenet/deepface_opencv)",
			cfg.Emotion.ModelBackend,
		)
		if err := validateEmotionBackend(backend); err != nil {
			return err
		}
		cfg.Emotion.ModelBackend = backend
		cfg.Mpv.VolumeDefault = promptInt("Default volume (0-100)", cfg.Mpv.VolumeDefault)
		cfg.Mpv.SocketPath = promptString("mpv socket path", cfg.Mpv.SocketPath)

		if err := config.Save(cfg, cfgFile); err != nil {
			return fmt.Errorf("failed to save config: %w", err)
		}

		fmt.Println()
		fmt.Println("Configuration saved successfully!")
		return nil
	},
}

func promptString(label string, defaultVal string) string {
	fmt.Printf("  %s [%s]: ", label, defaultVal)
	var input string
	fmt.Scanln(&input)
	if input == "" {
		return defaultVal
	}
	return input
}

func promptInt(label string, defaultVal int) int {
	fmt.Printf("  %s [%d]: ", label, defaultVal)
	var input string
	fmt.Scanln(&input)
	if input == "" {
		return defaultVal
	}
	val, err := strconv.Atoi(input)
	if err != nil {
		fmt.Printf("    invalid number, using default %d\n", defaultVal)
		return defaultVal
	}
	return val
}

func isSupportedEmotionBackend(name string) bool {
	for _, backend := range supportedEmotionBackends {
		if backend == name {
			return true
		}
	}
	return false
}

func validateEmotionBackend(name string) error {
	if isSupportedEmotionBackend(name) {
		return nil
	}
	return fmt.Errorf("unsupported emotion backend %q, valid: %v", name, supportedEmotionBackends)
}

func init() {
	rootCmd.PersistentFlags().StringVar(&cfgFile, "config", "", "config file (default ~/.config/sato-pulse/config.toml)")
	rootCmd.PersistentFlags().StringVar(&logLevel, "log-level", "info", "log level (debug, info, warn, error)")
	rootCmd.PersistentFlags().IntVar(&samplingInterval, "sampling-interval", 10, "emotion sampling interval in seconds")
	rootCmd.PersistentFlags().BoolVar(&dryRun, "dry-run", false, "log what would play without actual playback")
	rootCmd.PersistentFlags().BoolVar(&background, "background", false, "run headless without TUI")

	rootCmd.AddCommand(configureCmd)
	rootCmd.AddCommand(setupCmd)
	rootCmd.AddCommand(statusCmd)
	rootCmd.AddCommand(historyCmd)
	rootCmd.AddCommand(exportCmd)
	exportCmd.Flags().String("format", "csv", "export format: csv or json")
	exportCmd.Flags().String("output", "", "output file path (default: stdout)")
	exportCmd.Flags().String("from", "", "start date (YYYY-MM-DD)")
	exportCmd.Flags().String("to", "", "end date (YYYY-MM-DD)")

	rootCmd.AddCommand(modelCmd)
}

var modelCmd = &cobra.Command{
	Use:   "model",
	Short: "Manage emotion detection model",
}

var modelSetCmd = &cobra.Command{
	Use:   "set [backend]",
	Short: "Switch emotion detection backend",
	Args:  cobra.ExactArgs(1),
	RunE: func(cmd *cobra.Command, args []string) error {
		backend := args[0]
		if err := validateEmotionBackend(backend); err != nil {
			return err
		}

		cfg, err := config.Load(cfgFile)
		if err != nil {
			cfg = config.DefaultConfig()
		}
		cfg.Emotion.ModelBackend = backend
		if err := config.Save(cfg, cfgFile); err != nil {
			return fmt.Errorf("save config: %w", err)
		}
		fmt.Printf("Emotion backend set to %q\n", backend)
		fmt.Println("The backend will be used on the next capture request.")
		return nil
	},
}

func init() {
	modelCmd.AddCommand(modelSetCmd)
}

var exportCmd = &cobra.Command{
	Use:   "export",
	Short: "Export mood history as CSV or JSON",
	RunE: func(cmd *cobra.Command, args []string) error {
		format, _ := cmd.Flags().GetString("format")
		output, _ := cmd.Flags().GetString("output")
		fromDate, _ := cmd.Flags().GetString("from")
		toDate, _ := cmd.Flags().GetString("to")

		homeDir, _ := os.UserHomeDir()
		dbPath := homeDir + "/.local/share/sato-pulse/history.db"

		if _, err := os.Stat(dbPath); err != nil {
			return fmt.Errorf("no history database found at %s", dbPath)
		}

		db, err := sql.Open("sqlite3", dbPath)
		if err != nil {
			return fmt.Errorf("open database: %w", err)
		}
		defer db.Close()

		results, err := loadExportRows(db, fromDate, toDate)
		if err != nil {
			return err
		}

		var w *os.File
		if output != "" {
			w, err = os.Create(output)
			if err != nil {
				return fmt.Errorf("create output file: %w", err)
			}
			defer w.Close()
		} else {
			w = os.Stdout
		}

		switch format {
		case "json":
			enc := json.NewEncoder(w)
			enc.SetIndent("", "  ")
			if err := enc.Encode(results); err != nil {
				return fmt.Errorf("encode json: %w", err)
			}
		default:
			fmt.Fprintln(w, "mood,confidence,timestamp,video_id,title,artist,search_query")
			for _, r := range results {
				fmt.Fprintf(w, "%s,%.4f,%s,%s,%q,%q,%q\n",
					r.Mood, r.Confidence, r.Timestamp, r.VideoID, r.Title, r.Artist, r.SearchQuery)
			}
		}

		if output != "" {
			fmt.Fprintf(os.Stderr, "Exported %d records to %s\n", len(results), output)
		}

		return nil
	},
}

var setupCmd = &cobra.Command{
	Use:   "setup",
	Short: "Set up YouTube Music authentication and check dependencies",
	RunE: func(cmd *cobra.Command, args []string) error {
		fmt.Println("Checking dependencies...")

		if err := mpv.CheckDependencies(); err != nil {
			fmt.Printf("  MISSING: %v\n", err)
		} else {
			fmt.Println("  OK: mpv and yt-dlp found")
		}

		fmt.Println()
		fmt.Println("sato-pulse is a local desktop app for macOS and Linux.")
		fmt.Println("YouTube Music setup requires browser cookie extraction.")
		fmt.Println("This is handled by ytmusicapi through the Python subprocess.")
		fmt.Println("Run: cd mood-engine && python -c \"from ytmusicapi import YTMusic; YTMusic.setup(filepath='~/.config/sato-pulse/headers_auth.json')\"")

		return nil
	},
}

var statusCmd = &cobra.Command{
	Use:   "status",
	Short: "Check component health without starting the TUI",
	RunE: func(cmd *cobra.Command, args []string) error {
		cfg, err := config.Load(cfgFile)
		if err != nil {
			fmt.Printf("warning: %v\n", err)
			cfg = config.DefaultConfig()
		}
		if err := validateEmotionBackend(cfg.Emotion.ModelBackend); err != nil {
			return err
		}

		engineConfig := runtimeConfigFromApp(cfg)
		mpvErr := mpv.CheckDependencies()
		mpvClient := mpv.NewClient(cfg.Mpv.SocketPath, cfg.Mpv.YtdlFormat)
		playbackReady := false
		mpvHealthErr := mpvErr
		if mpvErr == nil {
			if err := mpvClient.Start(); err != nil {
				mpvHealthErr = fmt.Errorf("mpv start failed: %w", err)
			} else {
				playbackReady = true
				mpvClient.Stop()
			}
		}

		ipcMgr := ipc.NewManager()
		ipcStartErr := ipcMgr.Start()
		if ipcStartErr == nil {
			defer ipcMgr.Stop()
		}

		var healthResult *ipc.HealthResult
		var healthErr error
		if ipcStartErr == nil {
			healthResult, healthErr = ipcMgr.SendHealthCheck(engineConfig)
		}

		_, healthStatus := deriveStartupState(mpvHealthErr, ipcStartErr, healthErr, healthResult)
		emotionBackend := cfg.Emotion.ModelBackend
		if healthResult != nil && healthResult.EmotionBackend != "" {
			emotionBackend = healthResult.EmotionBackend
		}
		healthStatus = enrichHealthStatus(
			cfg,
			healthStatus,
			formatPlaybackStatus(false, playbackReady, mpvHealthErr),
			deriveLastRuntimeError(false, mpvHealthErr, ipcStartErr, healthErr, healthResult),
		)

		fmt.Println("sato-pulse status")
		fmt.Println("=================")
		fmt.Println("  target: local desktop (macOS/Linux)")
		fmt.Printf("  mpv/yt-dlp: %s\n", healthStatus.Mpv)
		fmt.Printf("  playback: %s\n", healthStatus.Playback)
		fmt.Printf("  python: %s\n", healthStatus.Python)
		fmt.Printf("  webcam: %s\n", healthStatus.Camera)
		fmt.Printf("  ytmusic api: %s\n", healthStatus.YTMusic)
		fmt.Printf("  ytmusic auth file: %s\n", healthStatus.AuthFile)
		fmt.Printf("  config: %s\n", config.ResolvedPath(cfgFile))
		fmt.Printf("  mpv socket: %s\n", cfg.Mpv.SocketPath)
		fmt.Printf("  emotion backend: %s\n", emotionBackend)
		fmt.Printf("  sampling interval: %ds\n", cfg.Capture.IntervalSeconds)
		fmt.Printf("  smoothing window: %d\n", cfg.Emotion.SmoothingWindow)
		fmt.Printf("  confidence threshold: %.2f\n", cfg.Emotion.ConfidenceThreshold)
		fmt.Printf("  last runtime failure: %s\n", healthStatus.LastError)

		return nil
	},
}

var historyCmd = &cobra.Command{
	Use:   "history",
	Short: "Query mood session history",
	RunE: func(cmd *cobra.Command, args []string) error {
		homeDir, _ := os.UserHomeDir()
		dbPath := homeDir + "/.local/share/sato-pulse/history.db"

		if _, err := os.Stat(dbPath); err != nil {
			fmt.Println("No history database found at", dbPath)
			fmt.Println("History will be created after your first sato-pulse session.")
			return nil
		}

		db, err := sql.Open("sqlite3", dbPath)
		if err != nil {
			return fmt.Errorf("open database: %w", err)
		}
		defer db.Close()

		fmt.Println("sato-pulse history")
		fmt.Println("==================")

		// Mood distribution summary
		distRows, err := db.Query(`
			SELECT mood, COUNT(*) as cnt
			FROM mood_history
			WHERE timestamp >= datetime('now', '-7 days')
			GROUP BY mood ORDER BY cnt DESC`)
		if err == nil {
			fmt.Println("\nMood distribution (last 7 days):")
			for distRows.Next() {
				var mood string
				var cnt int
				distRows.Scan(&mood, &cnt)
				fmt.Printf("  %-12s %d entries\n", mood, cnt)
			}
			distRows.Close()
		}

		// Recent mood transitions
		moodRows, err := db.Query(`
			SELECT mood, confidence, timestamp
			FROM mood_history
			ORDER BY timestamp DESC LIMIT 20`)
		if err == nil {
			fmt.Println("\nRecent mood entries:")
			for moodRows.Next() {
				var mood, ts string
				var confidence float64
				moodRows.Scan(&mood, &confidence, &ts)
				fmt.Printf("  %s  %-12s  %.0f%%\n", ts, mood, confidence*100)
			}
			moodRows.Close()
		}

		// Recent tracks played
		tracks, err := loadRecentTracks(db, 10)
		if err == nil {
			fmt.Println("\nRecent tracks:")
			for _, track := range tracks {
				fmt.Printf("  %s  [%s] %s - %s", track.Timestamp, track.Mood, track.Artist, track.Title)
				if track.SearchQuery != "" {
					fmt.Printf("  {%s}", track.SearchQuery)
				}
				fmt.Println()
			}
		}

		return nil
	},
}

func runApp() error {
	cfg, err := config.Load(cfgFile)
	if err != nil {
		slog.Warn("config load failed, using defaults", "err", err)
		cfg = config.DefaultConfig()
	}
	if err := validateEmotionBackend(cfg.Emotion.ModelBackend); err != nil {
		return err
	}

	if samplingInterval > 0 {
		cfg.Capture.IntervalSeconds = samplingInterval
	}
	engineConfig := runtimeConfigFromApp(cfg)

	mpvErr := mpv.CheckDependencies()
	mpvHealthErr := mpvErr

	ipcMgr := ipc.NewManager()
	ipcStartErr := ipcMgr.Start()
	if ipcStartErr != nil {
		slog.Warn("python subprocess failed to start", "err", ipcStartErr)
	}
	defer ipcMgr.Stop()

	var healthResult *ipc.HealthResult
	var healthErr error
	if ipcStartErr == nil {
		healthResult, healthErr = ipcMgr.SendHealthCheck(engineConfig)
		if healthErr != nil {
			slog.Warn("python health check failed", "err", healthErr)
		}
	}

	mpvClient := mpv.NewClient(cfg.Mpv.SocketPath, cfg.Mpv.YtdlFormat)
	playbackDryRun := dryRun || mpvErr != nil
	if !playbackDryRun {
		if err := mpvClient.Start(); err != nil {
			slog.Warn("mpv failed to start", "err", err)
			playbackDryRun = true
			mpvHealthErr = fmt.Errorf("mpv start failed: %w", err)
		} else {
			defer mpvClient.Stop()

			if err := mpvClient.SetVolume(cfg.Mpv.VolumeDefault); err != nil {
				slog.Debug("set initial volume failed", "err", err)
			}
		}
	}

	playbackReady := !playbackDryRun && mpvClient.IsRunning()
	initialState, healthStatus := deriveStartupState(mpvHealthErr, ipcStartErr, healthErr, healthResult)
	healthStatus = enrichHealthStatus(
		cfg,
		healthStatus,
		formatPlaybackStatus(dryRun, playbackReady, mpvHealthErr),
		deriveLastRuntimeError(dryRun, mpvHealthErr, ipcStartErr, healthErr, healthResult),
	)

	queueMgr := queue.NewManager(3)
	aggregator, aggErr := analytics.NewAggregator()
	if aggErr != nil {
		slog.Warn("analytics init failed", "err", aggErr)
	}
	if aggregator != nil {
		defer aggregator.Close()
	}

	moodBridge := bridge.New(
		ipcMgr, mpvClient, queueMgr, aggregator,
		cfg.MoodQueries, cfg.Mapping.DebounceSec, playbackDryRun,
	)
	controlCh := make(chan tui.ControlAction, 16)
	moodChangeCh := make(chan tui.MoodChangeMsg, 16)
	healthCh := make(chan tui.HealthMsg, 16)
	statusCh := make(chan tui.StatusMsg, 16)
	runtimeStopCh := make(chan struct{})
	defer close(runtimeStopCh)
	var healthMu sync.Mutex
	healthState := healthStatus
	emitHealth := func(snapshot tui.HealthMsg) {
		select {
		case healthCh <- snapshot:
		default:
		}
	}
	setRuntimeError := func(message string) {
		if message == "" {
			return
		}
		healthMu.Lock()
		if healthState.LastError == message {
			healthMu.Unlock()
			return
		}
		healthState.LastError = message
		snapshot := healthState
		healthMu.Unlock()
		emitHealth(snapshot)
	}
	emitStatus := func(text string) {
		if text == "" {
			return
		}
		select {
		case statusCh <- tui.StatusMsg{Text: text}:
		default:
		}
	}
	ipcMgr.OnError(func(msg ipc.ErrorMsg) {
		formatted := formatIPCError(msg)
		setRuntimeError(formatted)
		emitStatus(formatted)
	})
	go func() {
		for {
			select {
			case <-runtimeStopCh:
				return
			case action := <-controlCh:
				moodMsg, err := applyControlAction(action, moodBridge, mpvClient)
				if err != nil {
					slog.Debug("control action failed", "type", action.Type, "err", err)
					errMsg := fmt.Sprintf("%s failed: %v", action.Type, err)
					setRuntimeError(errMsg)
					emitStatus(errMsg)
					continue
				}
				if moodMsg != nil {
					select {
					case moodChangeCh <- *moodMsg:
					default:
					}
					emitStatus(fmt.Sprintf("active soundtrack: %s", moodMsg.Mood))
				}
			}
		}
	}()

	emotionCh := make(chan ipc.EmotionResult, 10)
	ipcMgr.OnEmotion(func(r ipc.EmotionResult) {
		select {
		case emotionCh <- r:
		default:
		}
		if r.MoodChanged && r.Mood != nil {
			go func(mood string, confidence float64) {
				changed, err := moodBridge.OnMoodChange(mood, confidence, bridge.MoodSourceAuto)
				if err != nil {
					slog.Debug("auto mood change failed", "mood", mood, "err", err)
					errMsg := fmt.Sprintf("auto mood switch failed: %v", err)
					setRuntimeError(errMsg)
					emitStatus(errMsg)
					return
				}
				if !changed {
					return
				}
				select {
				case moodChangeCh <- tui.MoodChangeMsg{
					Mood:       mood,
					Confidence: confidence,
					Source:     bridge.MoodSourceAuto,
				}:
				default:
				}
				emitStatus(fmt.Sprintf("active soundtrack: %s", mood))
			}(*r.Mood, r.MoodConfidence)
		}
	})

	var nowPlayingCh <-chan mpv.NowPlaying
	if !playbackDryRun && mpvClient.IsRunning() {
		observer := mpv.NewObserver(mpvClient, 1*time.Second)
		observer.Start()
		defer observer.Stop()
		tuiNowPlayingCh := make(chan mpv.NowPlaying, 10)
		nowPlayingCh = tuiNowPlayingCh
		go forwardNowPlayingUpdates(observer.Updates(), tuiNowPlayingCh, runtimeStopCh, moodBridge.OnTrackEnded)
	}

	if ipcStartErr == nil {
		captureStopCh := make(chan struct{})
		defer close(captureStopCh)
		go startCaptureLoop(
			func() error {
				return ipcMgr.SendCaptureRequest(engineConfig)
			},
			time.Duration(cfg.Capture.IntervalSeconds)*time.Second,
			captureStopCh,
			func(err error) {
				slog.Debug("capture request failed", "err", err)
				errMsg := fmt.Sprintf("capture request failed: %v", err)
				setRuntimeError(errMsg)
				emitStatus(errMsg)
			},
		)
	}

	if background {
		slog.Info("running in background mode (no TUI)")
		slog.Info("startup health",
			"mpv", healthStatus.Mpv,
			"python", healthStatus.Python,
			"camera", healthStatus.Camera,
			"ytmusic", healthStatus.YTMusic,
		)
		sigCh := make(chan os.Signal, 1)
		signal.Notify(sigCh, os.Interrupt, syscall.SIGTERM)
		<-sigCh
		slog.Info("shutting down")
		return nil
	}

	model := tui.NewModelWithState(
		cfg,
		emotionCh,
		nowPlayingCh,
		moodChangeCh,
		healthCh,
		statusCh,
		controlCh,
		initialState,
		healthStatus,
	)
	p := tea.NewProgram(model, tea.WithAltScreen())
	if _, err := p.Run(); err != nil {
		return fmt.Errorf("tui error: %w", err)
	}

	return nil
}

func setupLogging() {
	var level slog.Level
	switch logLevel {
	case "debug":
		level = slog.LevelDebug
	case "warn":
		level = slog.LevelWarn
	case "error":
		level = slog.LevelError
	default:
		level = slog.LevelInfo
	}
	handler := slog.NewJSONHandler(os.Stderr, &slog.HandlerOptions{
		Level: level,
	})
	slog.SetDefault(slog.New(handler))
}

func main() {
	setupLogging()
	if err := rootCmd.Execute(); err != nil {
		os.Exit(1)
	}
}
