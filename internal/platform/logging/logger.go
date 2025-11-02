package logging

import (
	"log/slog"
	"os"
	"strings"
)

// New builds a slog.Logger configured for console output and the provided level.
func New(level string) *slog.Logger {
	var programLevel slog.Level
	switch strings.ToLower(level) {
	case "debug":
		programLevel = slog.LevelDebug
	case "warn", "warning":
		programLevel = slog.LevelWarn
	case "error":
		programLevel = slog.LevelError
	default:
		programLevel = slog.LevelInfo
	}

	handler := slog.NewTextHandler(os.Stdout, &slog.HandlerOptions{Level: programLevel})
	return slog.New(handler)
}
