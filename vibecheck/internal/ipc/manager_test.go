package ipc

import "testing"

func TestShouldRestartLockedFalseWhenStopping(t *testing.T) {
	manager := NewManager()
	manager.stopping = true

	if manager.shouldRestartLocked() {
		t.Fatal("expected manager not to restart while stopping")
	}
}

func TestShouldRestartLockedFalseAtRetryLimit(t *testing.T) {
	manager := NewManager()
	manager.retries = maxRetries

	if manager.shouldRestartLocked() {
		t.Fatal("expected manager not to restart after reaching retry limit")
	}
}

func TestShouldRestartLockedTrueWhenRunningBelowRetryLimit(t *testing.T) {
	manager := NewManager()
	manager.retries = maxRetries - 1

	if !manager.shouldRestartLocked() {
		t.Fatal("expected manager to allow restart before retry limit")
	}
}
