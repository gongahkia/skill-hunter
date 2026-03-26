package tui

import (
	"fmt"
	"strings"
	"time"

	"github.com/charmbracelet/lipgloss"
)

var (
	moodColors = map[string]lipgloss.Color{
		"FOCUS":     lipgloss.Color("33"),
		"STRESSED":  lipgloss.Color("196"),
		"RELAXED":   lipgloss.Color("46"),
		"TIRED":     lipgloss.Color("226"),
		"ENERGIZED": lipgloss.Color("129"),
	}

	emotionColors = map[string]lipgloss.Color{
		"happy":    lipgloss.Color("46"),
		"angry":    lipgloss.Color("196"),
		"sad":      lipgloss.Color("33"),
		"neutral":  lipgloss.Color("245"),
		"fear":     lipgloss.Color("226"),
		"surprise": lipgloss.Color("51"),
		"disgust":  lipgloss.Color("208"),
	}

	borderStyle = lipgloss.NewStyle().
			Border(lipgloss.RoundedBorder()).
			BorderForeground(lipgloss.Color("240"))

	focusBorderStyle = lipgloss.NewStyle().
				Border(lipgloss.RoundedBorder()).
				BorderForeground(lipgloss.Color("99"))

	titleStyle = lipgloss.NewStyle().
			Bold(true).
			Foreground(lipgloss.Color("99"))

	dimStyle = lipgloss.NewStyle().
			Foreground(lipgloss.Color("245"))
)

func (m Model) viewDashboard() string {
	if m.width < 40 || m.height < 10 {
		return "Terminal too small. Resize to at least 40x10."
	}

	topBar := m.renderTopBar()
	bottomBar := m.renderBottomBar()
	contentHeight := m.height - 4

	leftWidth := m.width / 4
	centerWidth := m.width / 2
	rightWidth := m.width - leftWidth - centerWidth - 6

	if leftWidth < 15 {
		leftWidth = 15
	}
	if rightWidth < 15 {
		rightWidth = 15
	}

	leftCol := m.renderLeftColumn(leftWidth, contentHeight)
	centerCol := m.renderCenterColumn(centerWidth, contentHeight)
	rightCol := m.renderRightColumn(rightWidth, contentHeight)

	columns := lipgloss.JoinHorizontal(lipgloss.Top, leftCol, centerCol, rightCol)

	return lipgloss.JoinVertical(lipgloss.Left, topBar, columns, bottomBar)
}

func (m Model) renderTopBar() string {
	title := titleStyle.Render(" mood-music ")

	moodBadge := m.renderMoodBadge()

	clock := dimStyle.Render(time.Now().Format("15:04:05"))

	dnd := ""
	if m.dndMode {
		dnd = lipgloss.NewStyle().Foreground(lipgloss.Color("196")).Render(" [DND] ")
	}

	privacy := lipgloss.NewStyle().Foreground(lipgloss.Color("46")).Render("●")
	if m.dndMode {
		privacy = lipgloss.NewStyle().Foreground(lipgloss.Color("196")).Render("●")
	}

	gap := strings.Repeat(" ", max(0, m.width-lipgloss.Width(title)-lipgloss.Width(moodBadge)-lipgloss.Width(clock)-lipgloss.Width(dnd)-lipgloss.Width(privacy)-4))

	return lipgloss.JoinHorizontal(lipgloss.Center, title, " ", privacy, " ", moodBadge, dnd, gap, clock)
}

func (m Model) renderMoodBadge() string {
	mood := m.activeMood
	if mood == "" {
		mood = "---"
	}

	color, ok := moodColors[mood]
	if !ok {
		color = lipgloss.Color("245")
	}

	style := lipgloss.NewStyle().
		Bold(true).
		Foreground(lipgloss.Color("0")).
		Background(color).
		Padding(0, 1)

	return style.Render(mood)
}

func (m Model) renderLeftColumn(width, height int) string {
	box := borderStyle
	if m.focusZone == 0 {
		box = focusBorderStyle
	}

	ascii := m.renderASCIIPreview(width-4, height/2-2)
	bars := m.renderEmotionBars(width - 4)

	content := lipgloss.JoinVertical(lipgloss.Left, ascii, "", bars)
	return box.Width(width).Height(height).Render(content)
}

func (m Model) renderCenterColumn(width, height int) string {
	box := borderStyle
	if m.focusZone == 1 {
		box = focusBorderStyle
	}

	nowPlaying := m.renderNowPlaying(width - 4)
	controls := m.renderControls(width - 4)

	content := lipgloss.JoinVertical(lipgloss.Left, nowPlaying, "", controls)
	return box.Width(width).Height(height).Render(content)
}

func (m Model) renderRightColumn(width, height int) string {
	box := borderStyle
	if m.focusZone == 2 {
		box = focusBorderStyle
	}

	history := m.renderMoodHistory(width-4, height-4)
	sparkline := m.renderSparkline(width - 4)

	content := lipgloss.JoinVertical(lipgloss.Left, history, "", sparkline)
	return box.Width(width).Height(height).Render(content)
}

func (m Model) renderBottomBar() string {
	box := borderStyle
	if m.focusZone == 3 {
		box = focusBorderStyle
	}

	status := fmt.Sprintf(
		"cam:%s  play:%s  yt:%s  py:%s  backend:%s",
		m.statusCamera,
		m.statusPlayback,
		m.statusYTMusic,
		m.statusPython,
		m.statusBackend,
	)
	if m.lastRuntimeError != "" && m.lastRuntimeError != "none" {
		status += "  last:" + m.lastRuntimeError
	}

	keys := dimStyle.Render("q:quit ?:keys space:pause n/p:track +/-:vol b:blacklist D:dnd 1-5:mood c:settings s:setup")

	if m.statusText != "" {
		status = m.statusText
		if m.lastRuntimeError != "" && m.lastRuntimeError != "none" {
			status += "  | last:" + m.lastRuntimeError
		}
	}

	gap := strings.Repeat(" ", max(0, m.width-len(status)-lipgloss.Width(keys)-6))
	bar := status + gap + keys

	return box.Width(m.width).Render(bar)
}

func (m Model) renderASCIIPreview(width, height int) string {
	header := titleStyle.Render("Webcam")

	if width < 5 || height < 3 {
		return header + "\n(too small)"
	}

	return header + "\n" + frameToASCII(m.frameBase64, width, height-1)
}

func (m Model) renderEmotionBars(width int) string {
	header := titleStyle.Render("Emotions")

	emotions := []string{"happy", "neutral", "sad", "angry", "surprise", "fear", "disgust"}
	barWidth := width - 12

	if barWidth < 5 {
		barWidth = 5
	}

	lines := []string{header}
	for _, e := range emotions {
		val := m.emotions[e]
		filled := int(val * float64(barWidth))
		if filled > barWidth {
			filled = barWidth
		}

		color, ok := emotionColors[e]
		if !ok {
			color = lipgloss.Color("245")
		}

		bar := lipgloss.NewStyle().Foreground(color).Render(strings.Repeat("█", filled))
		empty := strings.Repeat("░", barWidth-filled)
		label := fmt.Sprintf("%-8s", e[:min(8, len(e))])
		lines = append(lines, fmt.Sprintf("%s %s%s", label, bar, empty))
	}

	return strings.Join(lines, "\n")
}

func (m Model) renderNowPlaying(width int) string {
	header := titleStyle.Render("Now Playing")

	title := m.nowPlaying.Title
	if title == "" {
		title = "Nothing playing"
	}

	state := "▶"
	if m.nowPlaying.Paused {
		state = "⏸"
	}
	if m.nowPlaying.Idle {
		state = "⏹"
	}

	pos := formatDuration(m.nowPlaying.TimePos)
	dur := formatDuration(m.nowPlaying.Duration)

	progressWidth := width - 4
	if progressWidth < 10 {
		progressWidth = 10
	}
	progress := 0.0
	if m.nowPlaying.Duration > 0 {
		progress = m.nowPlaying.TimePos / m.nowPlaying.Duration
	}
	filled := int(progress * float64(progressWidth))
	if filled > progressWidth {
		filled = progressWidth
	}

	progressBar := lipgloss.NewStyle().Foreground(lipgloss.Color("99")).Render(strings.Repeat("━", filled))
	progressEmpty := dimStyle.Render(strings.Repeat("─", progressWidth-filled))

	lines := []string{
		header,
		"",
		fmt.Sprintf("  %s %s", state, title),
		fmt.Sprintf("  Active    %s", m.renderActiveMoodDetails()),
		fmt.Sprintf("  Detected  %s", m.renderDetectedMoodDetails()),
		"",
		fmt.Sprintf("  %s%s", progressBar, progressEmpty),
		fmt.Sprintf("  %s / %s", pos, dur),
	}

	return strings.Join(lines, "\n")
}

func (m Model) renderControls(width int) string {
	header := titleStyle.Render("Controls")
	lines := []string{
		header,
		"",
		"  [Space] Play/Pause",
		"  [n] Next  [p] Previous",
		"  [+/-] Volume",
		"  [b] Blacklist",
		"  [1-5] Manual Mood  [D] DND",
	}
	return strings.Join(lines, "\n")
}

func (m Model) renderMoodHistory(width, height int) string {
	header := titleStyle.Render("Active Mood History")

	maxEntries := height - 2
	if maxEntries < 1 {
		maxEntries = 1
	}
	if maxEntries > 30 {
		maxEntries = 30
	}

	lines := []string{header}
	entries := m.moodHistory
	if len(entries) > maxEntries {
		entries = entries[:maxEntries]
	}

	if len(entries) == 0 {
		lines = append(lines, dimStyle.Render("  No transitions yet"))
	}

	for _, e := range entries {
		color, ok := moodColors[e.Mood]
		if !ok {
			color = lipgloss.Color("245")
		}
		moodLabel := lipgloss.NewStyle().Foreground(color).Render(fmt.Sprintf("%-10s", e.Mood))
		ts := e.Timestamp.Format("15:04:05")
		conf := fmt.Sprintf("%.0f%%", e.Confidence*100)
		line := fmt.Sprintf("  %s %s %s", ts, moodLabel, conf)
		lines = append(lines, line)
	}

	return strings.Join(lines, "\n")
}

func (m Model) renderSparkline(width int) string {
	header := titleStyle.Render("Confidence")

	if len(m.sparklineData) == 0 {
		return header + "\n" + dimStyle.Render("  No data yet")
	}

	braille := []rune("⠀⣀⣤⣶⣿")
	lineWidth := width
	if lineWidth > len(m.sparklineData) {
		lineWidth = len(m.sparklineData)
	}

	data := m.sparklineData[len(m.sparklineData)-lineWidth:]
	chars := make([]rune, len(data))
	for i, v := range data {
		idx := int(v * float64(len(braille)-1))
		if idx >= len(braille) {
			idx = len(braille) - 1
		}
		if idx < 0 {
			idx = 0
		}
		chars[i] = braille[idx]
	}

	return header + "\n  " + string(chars)
}

func formatDuration(seconds float64) string {
	if seconds <= 0 {
		return "0:00"
	}
	m := int(seconds) / 60
	s := int(seconds) % 60
	return fmt.Sprintf("%d:%02d", m, s)
}

func (m Model) renderActiveMoodDetails() string {
	if m.activeMood == "" {
		return dimStyle.Render("not committed")
	}

	source := m.activeMoodSource
	if source == "" {
		source = "auto"
	}

	return fmt.Sprintf("%s %.0f%% (%s)", m.activeMood, m.activeMoodConfidence*100, source)
}

func (m Model) renderDetectedMoodDetails() string {
	if !m.faceDetected && m.frameBase64 != "" {
		return dimStyle.Render("no face detected")
	}
	if m.detectedMood == "" {
		if m.detectedMoodConfidence > 0 {
			return fmt.Sprintf("below threshold %.0f%%", m.detectedMoodConfidence*100)
		}
		return dimStyle.Render("detecting...")
	}

	return fmt.Sprintf("%s %.0f%%", m.detectedMood, m.detectedMoodConfidence*100)
}

func max(a, b int) int {
	if a > b {
		return a
	}
	return b
}

func min(a, b int) int {
	if a < b {
		return a
	}
	return b
}
