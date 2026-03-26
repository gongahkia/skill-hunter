package tui

import (
	"fmt"
	"strings"
	"time"

	tea "github.com/charmbracelet/bubbletea"
	"github.com/charmbracelet/lipgloss"
	"sato-pulse/internal/config"
	"sato-pulse/internal/ipc"
	"sato-pulse/internal/mpv"
)

type AppState int

const (
	StateStartup AppState = iota
	StateDashboard
	StateSettings
	StateSetupFlow
)

type MoodEntry struct {
	Mood       string
	Confidence float64
	Timestamp  time.Time
	Emotion    string
}

type Model struct {
	state      AppState
	width      int
	height     int
	focusZone  int
	totalZones int

	// Data
	detectedMood           string
	detectedMoodConfidence float64
	activeMood             string
	activeMoodConfidence   float64
	activeMoodSource       string
	faceDetected           bool
	emotions               map[string]float64
	nowPlaying             mpv.NowPlaying
	moodHistory            []MoodEntry
	sparklineData          []float64
	statusCamera           string
	statusMpv              string
	statusYTMusic          string
	statusPython           string
	statusPlayback         string
	statusBackend          string
	statusAuthFile         string
	statusProvider         string
	lastRuntimeError       string
	frameBase64            string

	// Config
	cfg config.Config

	// Channels
	emotionCh    <-chan ipc.EmotionResult
	nowPlayingCh <-chan mpv.NowPlaying
	moodChangeCh <-chan MoodChangeMsg
	healthCh     <-chan HealthMsg
	statusCh     <-chan StatusMsg
	controlCh    chan<- ControlAction

	// Status
	statusText string
	dndMode    bool
}

func NewModel(
	cfg config.Config,
	emotionCh <-chan ipc.EmotionResult,
	nowPlayingCh <-chan mpv.NowPlaying,
	moodChangeCh <-chan MoodChangeMsg,
	healthCh <-chan HealthMsg,
	statusCh <-chan StatusMsg,
	controlCh chan<- ControlAction,
) Model {
	return Model{
		state:            StateStartup,
		totalZones:       4,
		emotions:         make(map[string]float64),
		cfg:              cfg,
		emotionCh:        emotionCh,
		nowPlayingCh:     nowPlayingCh,
		moodChangeCh:     moodChangeCh,
		healthCh:         healthCh,
		statusCh:         statusCh,
		controlCh:        controlCh,
		statusCamera:     "checking...",
		statusMpv:        "checking...",
		statusYTMusic:    "checking...",
		statusPython:     "checking...",
		statusPlayback:   "checking...",
		statusBackend:    cfg.Emotion.ModelBackend,
		statusAuthFile:   "checking...",
		statusProvider:   cfg.Playback.Source,
		lastRuntimeError: "none",
	}
}

func NewModelWithState(
	cfg config.Config,
	emotionCh <-chan ipc.EmotionResult,
	nowPlayingCh <-chan mpv.NowPlaying,
	moodChangeCh <-chan MoodChangeMsg,
	healthCh <-chan HealthMsg,
	statusCh <-chan StatusMsg,
	controlCh chan<- ControlAction,
	initialState AppState,
	health HealthMsg,
) Model {
	return Model{
		state:            initialState,
		totalZones:       4,
		emotions:         make(map[string]float64),
		cfg:              cfg,
		emotionCh:        emotionCh,
		nowPlayingCh:     nowPlayingCh,
		moodChangeCh:     moodChangeCh,
		healthCh:         healthCh,
		statusCh:         statusCh,
		controlCh:        controlCh,
		statusCamera:     health.Camera,
		statusMpv:        health.Mpv,
		statusYTMusic:    health.YTMusic,
		statusPython:     health.Python,
		statusPlayback:   health.Playback,
		statusBackend:    health.Backend,
		statusAuthFile:   health.AuthFile,
		lastRuntimeError: health.LastError,
	}
}

func (m Model) Init() tea.Cmd {
	var cmds []tea.Cmd
	if m.emotionCh != nil {
		cmds = append(cmds, waitForEmotion(m.emotionCh))
	}
	if m.nowPlayingCh != nil {
		cmds = append(cmds, waitForNowPlaying(m.nowPlayingCh))
	}
	if m.moodChangeCh != nil {
		cmds = append(cmds, waitForMoodChange(m.moodChangeCh))
	}
	if m.healthCh != nil {
		cmds = append(cmds, waitForHealth(m.healthCh))
	}
	if m.statusCh != nil {
		cmds = append(cmds, waitForStatus(m.statusCh))
	}
	cmds = append(cmds, tea.SetWindowTitle("sato-pulse"))
	return tea.Batch(cmds...)
}

func (m Model) Update(msg tea.Msg) (tea.Model, tea.Cmd) {
	var cmds []tea.Cmd

	switch msg := msg.(type) {
	case tea.KeyMsg:
		switch msg.String() {
		case "q", "ctrl+c":
			return m, tea.Quit
		case "tab":
			m.focusZone = (m.focusZone + 1) % m.totalZones
		case " ":
			cmds = append(cmds,
				m.dispatchControl(ControlAction{Type: ActionTogglePause}),
				func() tea.Msg { return StatusMsg{Text: "toggle pause"} },
			)
		case "n":
			cmds = append(cmds,
				m.dispatchControl(ControlAction{Type: ActionNextTrack}),
				func() tea.Msg { return StatusMsg{Text: "next track"} },
			)
		case "p":
			cmds = append(cmds,
				m.dispatchControl(ControlAction{Type: ActionPreviousTrack}),
				func() tea.Msg { return StatusMsg{Text: "previous track"} },
			)
		case "+", "=":
			cmds = append(cmds,
				m.dispatchControl(ControlAction{Type: ActionAdjustVolume, Delta: 5}),
				func() tea.Msg { return StatusMsg{Text: "volume up"} },
			)
		case "-":
			cmds = append(cmds,
				m.dispatchControl(ControlAction{Type: ActionAdjustVolume, Delta: -5}),
				func() tea.Msg { return StatusMsg{Text: "volume down"} },
			)
		case "c":
			if m.state == StateDashboard {
				m.state = StateSettings
			}
		case "s":
			if m.state == StateDashboard {
				m.state = StateSetupFlow
			}
		case "esc":
			if m.state == StateSettings || m.state == StateSetupFlow {
				m.state = StateDashboard
			}
		case "?":
			m.statusText = "q quit | space pause | n/p track | +/- volume | b blacklist | D dnd | 1-5 mood | c settings | s setup"
		case "D":
			m.dndMode = !m.dndMode
			cmds = append(cmds, m.dispatchControl(ControlAction{
				Type:    ActionSetDND,
				Enabled: m.dndMode,
			}))
			if m.dndMode {
				m.statusText = "DND mode ON"
			} else {
				m.statusText = "DND mode OFF"
			}
		case "1":
			cmds = append(cmds, m.manualMoodCommand("FOCUS"))
		case "2":
			cmds = append(cmds, m.manualMoodCommand("STRESSED"))
		case "3":
			cmds = append(cmds, m.manualMoodCommand("RELAXED"))
		case "4":
			cmds = append(cmds, m.manualMoodCommand("TIRED"))
		case "5":
			cmds = append(cmds, m.manualMoodCommand("ENERGIZED"))
		case "b":
			cmds = append(cmds,
				m.dispatchControl(ControlAction{Type: ActionBlacklistTrack}),
				func() tea.Msg { return StatusMsg{Text: "blacklist current track"} },
			)
		}

	case tea.WindowSizeMsg:
		m.width = msg.Width
		m.height = msg.Height
		if m.state == StateStartup {
			m.state = StateDashboard
		}

	case EmotionMsg:
		m.frameBase64 = msg.Result.FrameBase64
		m.faceDetected = msg.Result.FaceDetected
		if msg.Result.FaceDetected {
			m.emotions = msg.Result.Emotions
			if msg.Result.Mood != nil {
				m.detectedMood = *msg.Result.Mood
			} else {
				m.detectedMood = ""
			}
			m.detectedMoodConfidence = msg.Result.MoodConfidence
		} else {
			m.detectedMood = ""
			m.detectedMoodConfidence = 0
			m.emotions = nil
		}
		if m.emotionCh != nil {
			cmds = append(cmds, waitForEmotion(m.emotionCh))
		}

	case NowPlayingMsg:
		m.nowPlaying = msg.State
		if m.nowPlayingCh != nil {
			cmds = append(cmds, waitForNowPlaying(m.nowPlayingCh))
		}

	case MoodChangeMsg:
		m.activeMood = msg.Mood
		m.activeMoodConfidence = msg.Confidence
		if msg.Source != "" {
			m.activeMoodSource = msg.Source
		}
		m.recordMoodChange(msg.Mood, msg.Confidence)
		if m.moodChangeCh != nil {
			cmds = append(cmds, waitForMoodChange(m.moodChangeCh))
		}

	case StatusMsg:
		m.statusText = msg.Text
		if m.statusCh != nil {
			cmds = append(cmds, waitForStatus(m.statusCh))
		}

	case HealthMsg:
		m.statusCamera = msg.Camera
		m.statusMpv = msg.Mpv
		m.statusYTMusic = msg.YTMusic
		m.statusPython = msg.Python
		m.statusPlayback = msg.Playback
		m.statusBackend = msg.Backend
		m.statusAuthFile = msg.AuthFile
		m.lastRuntimeError = msg.LastError
		if m.healthCh != nil {
			cmds = append(cmds, waitForHealth(m.healthCh))
		}
	}

	return m, tea.Batch(cmds...)
}

func (m Model) View() string {
	if m.width == 0 {
		return "Initializing..."
	}

	switch m.state {
	case StateStartup:
		return m.viewStartup()
	case StateSettings:
		return m.viewSettings()
	case StateSetupFlow:
		return m.viewSetupFlow()
	default:
		return m.viewDashboard()
	}
}

func (m Model) viewStartup() string {
	style := lipgloss.NewStyle().
		Width(m.width).
		Height(m.height).
		Align(lipgloss.Center, lipgloss.Center)

	return style.Render("sato-pulse\nStarting up...")
}

func (m Model) viewSettings() string {
	style := lipgloss.NewStyle().
		Width(m.width).
		Height(m.height).
		Padding(1, 2)

	header := titleStyle.Render("Settings") + "\n" +
		dimStyle.Render("Press Esc to return to dashboard") + "\n\n"

	section := func(name string) string {
		return lipgloss.NewStyle().Bold(true).Foreground(lipgloss.Color("99")).Render(name)
	}
	kv := func(key string, val any) string {
		return fmt.Sprintf("  %-22s %v\n", key+":", val)
	}

	var b strings.Builder
	b.WriteString(header)

	b.WriteString(section("Capture") + "\n")
	b.WriteString(kv("Camera index", m.cfg.Capture.CameraIndex))
	b.WriteString(kv("Sampling interval", fmt.Sprintf("%ds", m.cfg.Capture.IntervalSeconds)))
	b.WriteString(kv("Resolution", m.cfg.Capture.Resolution))
	b.WriteString("\n")

	b.WriteString(section("Emotion Detection") + "\n")
	b.WriteString(kv("Backend", m.cfg.Emotion.ModelBackend))
	b.WriteString(kv("Confidence threshold", fmt.Sprintf("%.2f", m.cfg.Emotion.ConfidenceThreshold)))
	b.WriteString(kv("Smoothing window", m.cfg.Emotion.SmoothingWindow))
	b.WriteString("\n")

	b.WriteString(section("Playback") + "\n")
	b.WriteString(kv("mpv socket", m.cfg.Mpv.SocketPath))
	b.WriteString(kv("Volume", fmt.Sprintf("%d%%", m.cfg.Mpv.VolumeDefault)))
	b.WriteString(kv("Audio format", m.cfg.Mpv.YtdlFormat))
	b.WriteString(kv("Debounce", fmt.Sprintf("%ds", m.cfg.Mapping.DebounceSec)))
	b.WriteString("\n")

	b.WriteString(section("YouTube Music") + "\n")
	b.WriteString(kv("Auth file", m.cfg.YTMusic.AuthFilePath))

	return style.Render(b.String())
}

func (m *Model) recordMoodChange(mood string, confidence float64) {
	m.moodHistory = append([]MoodEntry{{
		Mood:       mood,
		Confidence: confidence,
		Timestamp:  time.Now(),
	}}, m.moodHistory...)
	if len(m.moodHistory) > 30 {
		m.moodHistory = m.moodHistory[:30]
	}
	m.sparklineData = append(m.sparklineData, confidence)
	if len(m.sparklineData) > 60 {
		m.sparklineData = m.sparklineData[len(m.sparklineData)-60:]
	}
}

func isHealthyStatus(status string) bool {
	return strings.HasPrefix(strings.ToUpper(status), "OK")
}

func (m Model) dispatchControl(action ControlAction) tea.Cmd {
	if m.controlCh == nil {
		return nil
	}
	return func() tea.Msg {
		m.controlCh <- action
		return nil
	}
}

func (m Model) manualMoodCommand(mood string) tea.Cmd {
	return tea.Batch(
		m.dispatchControl(ControlAction{Type: ActionManualMood, Mood: mood}),
		func() tea.Msg {
			return StatusMsg{Text: fmt.Sprintf("manual mood requested: %s", mood)}
		},
	)
}

func (m Model) viewSetupFlow() string {
	style := lipgloss.NewStyle().
		Width(m.width).
		Height(m.height).
		Padding(1, 2)

	header := titleStyle.Render("Setup Wizard") + "\n" +
		dimStyle.Render("Press Esc to return to dashboard") + "\n\n"

	ok := lipgloss.NewStyle().Foreground(lipgloss.Color("46")).Render
	fail := lipgloss.NewStyle().Foreground(lipgloss.Color("196")).Render
	check := func(label string, pass bool, detail string) string {
		status := ok("OK")
		if !pass {
			status = fail("MISSING")
		}
		line := fmt.Sprintf("  %-24s [%s]", label, status)
		if detail != "" {
			line += "  " + dimStyle.Render(detail)
		}
		return line + "\n"
	}

	var b strings.Builder
	b.WriteString(header)

	b.WriteString(lipgloss.NewStyle().Bold(true).Foreground(lipgloss.Color("99")).Render("Dependencies") + "\n")

	mpvOk := isHealthyStatus(m.statusMpv)
	b.WriteString(check("mpv + yt-dlp", mpvOk, m.statusMpv))

	playbackOk := isHealthyStatus(m.statusPlayback)
	b.WriteString(check("Playback readiness", playbackOk, m.statusPlayback))

	pyOk := isHealthyStatus(m.statusPython)
	b.WriteString(check("Python subprocess", pyOk, m.statusPython))

	camOk := isHealthyStatus(m.statusCamera)
	b.WriteString(check("Webcam", camOk, m.statusCamera))

	b.WriteString("\n")
	b.WriteString(lipgloss.NewStyle().Bold(true).Foreground(lipgloss.Color("99")).Render("Authentication") + "\n")

	authOk := isHealthyStatus(m.statusAuthFile)
	b.WriteString(check("Auth file", authOk, m.statusAuthFile))

	ytOk := isHealthyStatus(m.statusYTMusic)
	b.WriteString(check("YouTube Music API", ytOk, m.statusYTMusic))

	b.WriteString("\n")
	b.WriteString(lipgloss.NewStyle().Bold(true).Foreground(lipgloss.Color("99")).Render("Runtime") + "\n")
	b.WriteString(check("Emotion backend", true, m.statusBackend))
	if m.lastRuntimeError == "" || m.lastRuntimeError == "none" {
		b.WriteString(check("Last runtime failure", true, "none"))
	} else {
		b.WriteString(check("Last runtime failure", false, m.lastRuntimeError))
	}

	b.WriteString("\n")
	b.WriteString(lipgloss.NewStyle().Bold(true).Foreground(lipgloss.Color("99")).Render("Next Steps") + "\n")

	if !mpvOk {
		b.WriteString("  1. Install mpv and yt-dlp\n")
	}
	if !authOk {
		b.WriteString("  " + dimStyle.Render("Run: sato-pulse setup") + "\n")
	}
	if !playbackOk && mpvOk {
		b.WriteString("  2. Re-run status and verify mpv IPC can start locally\n")
	}
	if mpvOk && playbackOk && authOk && camOk {
		b.WriteString("  " + ok("All checks passed! Press Esc to start.") + "\n")
	}

	return style.Render(b.String())
}
