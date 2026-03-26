package mpv

import (
	"log/slog"
	"time"
)

type NowPlaying struct {
	Title    string
	TimePos  float64
	Duration float64
	Paused   bool
	Idle     bool
}

type Observer struct {
	client  *MpvClient
	updateCh chan NowPlaying
	stopCh   chan struct{}
	interval time.Duration
}

func NewObserver(client *MpvClient, interval time.Duration) *Observer {
	return &Observer{
		client:   client,
		updateCh: make(chan NowPlaying, 10),
		stopCh:   make(chan struct{}),
		interval: interval,
	}
}

func (o *Observer) Updates() <-chan NowPlaying {
	return o.updateCh
}

func (o *Observer) Start() {
	go o.pollLoop()
}

func (o *Observer) Stop() {
	close(o.stopCh)
}

func (o *Observer) pollLoop() {
	ticker := time.NewTicker(o.interval)
	defer ticker.Stop()

	for {
		select {
		case <-o.stopCh:
			return
		case <-ticker.C:
			if !o.client.IsRunning() {
				continue
			}

			np := o.poll()

			select {
			case o.updateCh <- np:
			default:
			}
		}
	}
}

func (o *Observer) poll() NowPlaying {
	np := NowPlaying{}

	title, err := o.client.GetTitle()
	if err == nil {
		np.Title = title
	}

	pos, err := o.client.GetPosition()
	if err == nil {
		np.TimePos = pos
	}

	dur, err := o.client.GetDuration()
	if err == nil {
		np.Duration = dur
	}

	paused, err := o.client.ipc.GetProperty("pause")
	if err == nil {
		if b, ok := paused.(bool); ok {
			np.Paused = b
		}
	}

	idle, err := o.client.ipc.GetProperty("idle-active")
	if err == nil {
		if b, ok := idle.(bool); ok {
			np.Idle = b
		}
	} else {
		slog.Debug("mpv observer: idle-active query failed", "err", err)
	}

	return np
}
