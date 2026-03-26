package mpv

import (
	"errors"
	"fmt"
	"log/slog"
	"os"
	"os/exec"
	"time"
)

var (
	ErrNotConnected = errors.New("mpv: not connected")
	ErrTimeout      = errors.New("mpv: ipc timeout")
	ErrMpvNotFound  = errors.New("mpv: binary not found")
	ErrYtdlpNotFound = errors.New("mpv: yt-dlp binary not found")
)

type MpvClient struct {
	cmd        *exec.Cmd
	socketPath string
	ytdlFormat string
	ipc        *IPCConn
	running    bool
	waitCh     chan struct{}
}

func NewClient(socketPath string, ytdlFormat string) *MpvClient {
	return &MpvClient{
		socketPath: socketPath,
		ytdlFormat: ytdlFormat,
	}
}

func CheckDependencies() error {
	if _, err := exec.LookPath("mpv"); err != nil {
		return fmt.Errorf("%w: install mpv (https://mpv.io)", ErrMpvNotFound)
	}
	if _, err := exec.LookPath("yt-dlp"); err != nil {
		return fmt.Errorf("%w: install yt-dlp (https://github.com/yt-dlp/yt-dlp)", ErrYtdlpNotFound)
	}
	return nil
}

func (c *MpvClient) Start() error {
	os.Remove(c.socketPath)

	args := []string{
		"--idle",
		"--no-video",
		"--input-ipc-server=" + c.socketPath,
		"--really-quiet",
		"--ytdl-format=" + c.ytdlFormat,
	}

	c.cmd = exec.Command("mpv", args...)
	c.cmd.Stdout = nil
	c.cmd.Stderr = nil

	if err := c.cmd.Start(); err != nil {
		return fmt.Errorf("mpv: start: %w", err)
	}

	for i := 0; i < 20; i++ {
		time.Sleep(100 * time.Millisecond)
		if _, err := os.Stat(c.socketPath); err == nil {
			break
		}
	}

	ipc, err := NewIPCConn(c.socketPath)
	if err != nil {
		c.cmd.Process.Kill()
		return fmt.Errorf("mpv: connect ipc: %w", err)
	}

	c.ipc = ipc
	c.running = true
	c.waitCh = make(chan struct{})
	waitCh := c.waitCh

	go func() {
		if c.cmd != nil {
			c.cmd.Wait()
			c.running = false
			close(waitCh)
			slog.Warn("mpv process exited")
		}
	}()

	slog.Info("mpv started", "socket", c.socketPath)
	return nil
}

func (c *MpvClient) Stop() {
	if c.ipc != nil {
		c.ipc.Command("quit")
		c.ipc.Close()
	}

	waitCh := c.waitCh
	if c.cmd != nil && c.cmd.Process != nil {
		select {
		case <-waitCh:
		case <-time.After(2 * time.Second):
			c.cmd.Process.Kill()
			if waitCh != nil {
				select {
				case <-waitCh:
				case <-time.After(2 * time.Second):
				}
			}
		}
	}

	os.Remove(c.socketPath)
	c.running = false
	c.waitCh = nil
}

func (c *MpvClient) IsRunning() bool {
	return c.running
}

func (c *MpvClient) Play(url string) error {
	if !c.IsRunning() {
		return ErrNotConnected
	}
	_, err := c.ipc.Command("loadfile", url, "replace")
	if err != nil {
		return fmt.Errorf("mpv play %q: %w", url, err)
	}
	return nil
}

func (c *MpvClient) Pause() error {
	if !c.IsRunning() {
		return ErrNotConnected
	}
	return c.ipc.SetProperty("pause", true)
}

func (c *MpvClient) Resume() error {
	if !c.IsRunning() {
		return ErrNotConnected
	}
	return c.ipc.SetProperty("pause", false)
}

func (c *MpvClient) TogglePause() error {
	if !c.IsRunning() {
		return ErrNotConnected
	}
	_, err := c.ipc.Command("cycle", "pause")
	return err
}

func (c *MpvClient) Skip() error {
	if !c.IsRunning() {
		return ErrNotConnected
	}
	_, err := c.ipc.Command("playlist-next")
	return err
}

func (c *MpvClient) SetVolume(pct int) error {
	if !c.IsRunning() {
		return ErrNotConnected
	}
	return c.ipc.SetProperty("volume", pct)
}

func (c *MpvClient) GetVolume() (int, error) {
	if !c.IsRunning() {
		return 0, ErrNotConnected
	}
	val, err := c.ipc.GetProperty("volume")
	if err != nil {
		return 0, err
	}
	switch v := val.(type) {
	case float64:
		return int(v), nil
	default:
		return 0, fmt.Errorf("mpv: unexpected volume type %T", val)
	}
}

func (c *MpvClient) Seek(seconds float64) error {
	if !c.IsRunning() {
		return ErrNotConnected
	}
	_, err := c.ipc.Command("seek", seconds, "relative")
	return err
}

func (c *MpvClient) GetPosition() (float64, error) {
	if !c.IsRunning() {
		return 0, ErrNotConnected
	}
	val, err := c.ipc.GetProperty("time-pos")
	if err != nil {
		return 0, err
	}
	switch v := val.(type) {
	case float64:
		return v, nil
	default:
		return 0, nil
	}
}

func (c *MpvClient) GetDuration() (float64, error) {
	if !c.IsRunning() {
		return 0, ErrNotConnected
	}
	val, err := c.ipc.GetProperty("duration")
	if err != nil {
		return 0, err
	}
	switch v := val.(type) {
	case float64:
		return v, nil
	default:
		return 0, nil
	}
}

func (c *MpvClient) GetTitle() (string, error) {
	if !c.IsRunning() {
		return "", ErrNotConnected
	}
	val, err := c.ipc.GetProperty("media-title")
	if err != nil {
		return "", err
	}
	switch v := val.(type) {
	case string:
		return v, nil
	default:
		return "", nil
	}
}
