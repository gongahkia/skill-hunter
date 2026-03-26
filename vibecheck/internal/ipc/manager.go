package ipc

import (
	"bufio"
	"encoding/json"
	"fmt"
	"io"
	"log/slog"
	"os/exec"
	"sync"
	"time"

	"github.com/google/uuid"
)

const (
	maxRetries      = 3
	responseTimeout = 5 * time.Second
)

type Manager struct {
	cmd       *exec.Cmd
	stdin     io.WriteCloser
	stdout    *bufio.Scanner
	stderr    io.ReadCloser
	mu        sync.Mutex
	pending   map[string]chan json.RawMessage
	pendingMu sync.Mutex
	running   bool
	stopping  bool
	retries   int
	onEmotion func(EmotionResult)
	onSearch  func(SearchResult)
	onHealth  func(HealthResult)
	onError   func(ErrorMsg)
	stopCh    chan struct{}
}

func NewManager() *Manager {
	return &Manager{
		pending: make(map[string]chan json.RawMessage),
		stopCh:  make(chan struct{}),
	}
}

func (m *Manager) OnEmotion(fn func(EmotionResult)) { m.onEmotion = fn }
func (m *Manager) OnSearch(fn func(SearchResult))   { m.onSearch = fn }
func (m *Manager) OnHealth(fn func(HealthResult))   { m.onHealth = fn }
func (m *Manager) OnError(fn func(ErrorMsg))        { m.onError = fn }

func (m *Manager) Start() error {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.stopping = false
	return m.startProcess()
}

func (m *Manager) startProcess() error {
	cmd := exec.Command("python3", "-m", "mood_engine")
	cmd.Dir = ""

	stdin, err := cmd.StdinPipe()
	if err != nil {
		return fmt.Errorf("ipc: stdin pipe: %w", err)
	}

	stdout, err := cmd.StdoutPipe()
	if err != nil {
		return fmt.Errorf("ipc: stdout pipe: %w", err)
	}

	stderr, err := cmd.StderrPipe()
	if err != nil {
		return fmt.Errorf("ipc: stderr pipe: %w", err)
	}

	if err := cmd.Start(); err != nil {
		return fmt.Errorf("ipc: start subprocess: %w", err)
	}

	m.cmd = cmd
	m.stdin = stdin
	m.stdout = bufio.NewScanner(stdout)
	m.stderr = stderr
	m.running = true

	go m.readLoop()
	go m.drainStderr()

	return nil
}

func (m *Manager) readLoop() {
	for m.stdout.Scan() {
		line := m.stdout.Bytes()
		var base Message
		if err := json.Unmarshal(line, &base); err != nil {
			slog.Error("ipc: invalid json from python", "err", err)
			continue
		}

		m.pendingMu.Lock()
		ch, ok := m.pending[base.ID]
		if ok {
			delete(m.pending, base.ID)
		}
		m.pendingMu.Unlock()

		if ok {
			raw := make(json.RawMessage, len(line))
			copy(raw, line)
			ch <- raw
			continue
		}

		m.dispatch(base.Type, line)
	}

	m.mu.Lock()
	m.running = false
	stopping := m.stopping
	m.mu.Unlock()

	if stopping {
		slog.Info("ipc: python subprocess stopped")
		return
	}

	slog.Warn("ipc: python subprocess stdout closed")
	m.tryRestart()
}

func (m *Manager) dispatch(msgType string, data []byte) {
	switch msgType {
	case TypeEmotionResult:
		if m.onEmotion != nil {
			var r EmotionResult
			if err := json.Unmarshal(data, &r); err == nil {
				m.onEmotion(r)
			}
		}
	case TypeSearchResult:
		if m.onSearch != nil {
			var r SearchResult
			if err := json.Unmarshal(data, &r); err == nil {
				m.onSearch(r)
			}
		}
	case TypeHealthResult:
		if m.onHealth != nil {
			var r HealthResult
			if err := json.Unmarshal(data, &r); err == nil {
				m.onHealth(r)
			}
		}
	case TypeError:
		if m.onError != nil {
			var r ErrorMsg
			if err := json.Unmarshal(data, &r); err == nil {
				m.onError(r)
			}
		}
	}
}

func (m *Manager) drainStderr() {
	buf := make([]byte, 4096)
	for {
		n, err := m.stderr.Read(buf)
		if n > 0 {
			slog.Debug("python stderr", "output", string(buf[:n]))
		}
		if err != nil {
			return
		}
	}
}

func (m *Manager) tryRestart() {
	m.mu.Lock()
	defer m.mu.Unlock()

	if !m.shouldRestartLocked() {
		if m.retries >= maxRetries {
			slog.Error("ipc: max retries reached, not restarting")
		}
		return
	}

	m.retries++
	backoff := time.Duration(1<<uint(m.retries-1)) * time.Second
	slog.Info("ipc: restarting subprocess", "attempt", m.retries, "backoff", backoff)

	time.Sleep(backoff)

	if err := m.startProcess(); err != nil {
		slog.Error("ipc: restart failed", "err", err)
	} else {
		slog.Info("ipc: subprocess restarted")
	}
}

func (m *Manager) shouldRestartLocked() bool {
	return !m.stopping && m.retries < maxRetries
}

func (m *Manager) Send(v any) error {
	m.mu.Lock()
	defer m.mu.Unlock()

	if !m.running {
		return fmt.Errorf("ipc: subprocess not running")
	}

	data, err := Encode(v)
	if err != nil {
		return fmt.Errorf("ipc: encode: %w", err)
	}

	_, err = m.stdin.Write(data)
	if err != nil {
		return fmt.Errorf("ipc: write: %w", err)
	}

	return nil
}

func (m *Manager) SendRequest(v any, id string) (json.RawMessage, error) {
	ch := make(chan json.RawMessage, 1)

	m.pendingMu.Lock()
	m.pending[id] = ch
	m.pendingMu.Unlock()

	if err := m.Send(v); err != nil {
		m.pendingMu.Lock()
		delete(m.pending, id)
		m.pendingMu.Unlock()
		return nil, err
	}

	select {
	case resp := <-ch:
		return resp, nil
	case <-time.After(responseTimeout):
		m.pendingMu.Lock()
		delete(m.pending, id)
		m.pendingMu.Unlock()
		return nil, fmt.Errorf("ipc: response timeout for %s", id)
	}
}

func (m *Manager) SendHealthCheck(cfg RuntimeConfig) (*HealthResult, error) {
	id := uuid.New().String()
	req := HealthCheck{
		Message: NewMessage(TypeHealthCheck, id),
		Config:  cfg,
	}

	raw, err := m.SendRequest(req, id)
	if err != nil {
		return nil, err
	}

	var result HealthResult
	if err := json.Unmarshal(raw, &result); err != nil {
		return nil, fmt.Errorf("ipc: decode health result: %w", err)
	}

	return &result, nil
}

func (m *Manager) SendCaptureRequest(cfg RuntimeConfig) error {
	id := uuid.New().String()
	req := CaptureRequest{
		Message: NewMessage(TypeCaptureRequest, id),
		Config:  cfg,
	}
	return m.Send(req)
}

func (m *Manager) SendSearchRequest(query string, limit int) (*SearchResult, error) {
	id := uuid.New().String()
	req := SearchRequest{
		Message: NewMessage(TypeSearchRequest, id),
		Query:   query,
		Limit:   limit,
	}

	raw, err := m.SendRequest(req, id)
	if err != nil {
		return nil, err
	}

	var result SearchResult
	if err := json.Unmarshal(raw, &result); err != nil {
		return nil, fmt.Errorf("ipc: decode search result: %w", err)
	}

	return &result, nil
}

func (m *Manager) SendShutdown() error {
	id := uuid.New().String()
	req := Shutdown{Message: NewMessage(TypeShutdown, id)}
	return m.Send(req)
}

func (m *Manager) Stop() {
	m.mu.Lock()
	m.stopping = true
	if !m.running {
		m.mu.Unlock()
		return
	}
	cmd := m.cmd
	m.mu.Unlock()

	if err := m.Send(Shutdown{Message: NewMessage(TypeShutdown, uuid.New().String())}); err != nil {
		slog.Warn("ipc: shutdown send failed", "err", err)
	}

	done := make(chan struct{})
	go func() {
		if cmd != nil && cmd.Process != nil {
			cmd.Wait()
		}
		close(done)
	}()

	select {
	case <-done:
	case <-time.After(2 * time.Second):
		if cmd != nil && cmd.Process != nil {
			cmd.Process.Kill()
		}
	}

	m.mu.Lock()
	m.running = false
	m.mu.Unlock()
}

func (m *Manager) IsRunning() bool {
	m.mu.Lock()
	defer m.mu.Unlock()
	return m.running
}
