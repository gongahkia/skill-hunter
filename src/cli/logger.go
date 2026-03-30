package main

import (
	"fmt"
	"io"
	"os"
	"sync"
	"time"
)

type Logger struct {
	verbose bool
	writer  io.Writer
	mu      sync.Mutex
}

func NewLogger(verbose bool, path string) (*Logger, error) {
	if path == "" {
		return &Logger{
			verbose: verbose,
			writer:  os.Stderr,
		}, nil
	}

	file, err := os.OpenFile(path, os.O_CREATE|os.O_WRONLY|os.O_APPEND, 0o644)
	if err != nil {
		return nil, fmt.Errorf("open log file: %w", err)
	}

	return &Logger{
		verbose: verbose,
		writer:  io.MultiWriter(os.Stderr, file),
	}, nil
}

func (logger *Logger) log(level string, format string, args ...any) {
	if logger == nil {
		return
	}
	if level == "DEBUG" && !logger.verbose {
		return
	}

	logger.mu.Lock()
	defer logger.mu.Unlock()

	_, _ = fmt.Fprintf(
		logger.writer,
		"[%s] %s %s\n",
		level,
		time.Now().Format(time.RFC3339),
		fmt.Sprintf(format, args...),
	)
}

func (logger *Logger) Debugf(format string, args ...any) {
	logger.log("DEBUG", format, args...)
}

func (logger *Logger) Warnf(format string, args ...any) {
	logger.log("WARN", format, args...)
}

func (logger *Logger) Errorf(format string, args ...any) {
	logger.log("ERROR", format, args...)
}
