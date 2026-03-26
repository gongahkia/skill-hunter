package queue

import (
	"errors"
	"sync"

	"mood-music/internal/ipc"
)

var ErrQueueEmpty = errors.New("queue: empty")

type Manager struct {
	mu       sync.Mutex
	tracks   []ipc.Track
	history  []ipc.Track
	position int
	refillThreshold int
	onNeedRefill    func()
}

func NewManager(refillThreshold int) *Manager {
	return &Manager{
		refillThreshold: refillThreshold,
	}
}

func (m *Manager) OnNeedRefill(fn func()) {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.onNeedRefill = fn
}

func (m *Manager) LoadTracks(tracks []ipc.Track) {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.tracks = tracks
	m.position = 0
	m.history = nil
}

func (m *Manager) AppendTracks(tracks []ipc.Track) {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.tracks = append(m.tracks, tracks...)
}

func (m *Manager) Clear() {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.tracks = nil
	m.history = nil
	m.position = 0
}

func (m *Manager) Current() (ipc.Track, error) {
	m.mu.Lock()
	defer m.mu.Unlock()

	if len(m.tracks) == 0 {
		return ipc.Track{}, ErrQueueEmpty
	}

	if m.position >= len(m.tracks) {
		return ipc.Track{}, ErrQueueEmpty
	}

	return m.tracks[m.position], nil
}

func (m *Manager) Next() (ipc.Track, error) {
	m.mu.Lock()
	defer m.mu.Unlock()

	if len(m.tracks) == 0 {
		return ipc.Track{}, ErrQueueEmpty
	}

	if m.position < len(m.tracks) {
		m.history = append(m.history, m.tracks[m.position])
	}

	m.position++

	if m.position >= len(m.tracks) {
		return ipc.Track{}, ErrQueueEmpty
	}

	remaining := len(m.tracks) - m.position
	if remaining < m.refillThreshold && m.onNeedRefill != nil {
		go m.onNeedRefill()
	}

	return m.tracks[m.position], nil
}

func (m *Manager) Previous() (ipc.Track, error) {
	m.mu.Lock()
	defer m.mu.Unlock()

	if len(m.history) == 0 {
		return ipc.Track{}, ErrQueueEmpty
	}

	prev := m.history[len(m.history)-1]
	m.history = m.history[:len(m.history)-1]

	if m.position > 0 {
		m.position--
	}

	return prev, nil
}

func (m *Manager) Upcoming() []ipc.Track {
	m.mu.Lock()
	defer m.mu.Unlock()

	if m.position+1 >= len(m.tracks) {
		return nil
	}

	return append([]ipc.Track{}, m.tracks[m.position+1:]...)
}

func (m *Manager) Len() int {
	m.mu.Lock()
	defer m.mu.Unlock()
	return len(m.tracks) - m.position
}
