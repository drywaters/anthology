package migrate

import (
	"fmt"
	"log/slog"
	"os"
)

type gooseSlogLogger struct {
	logger *slog.Logger
}

func (l gooseSlogLogger) Printf(format string, v ...interface{}) {
	if l.logger == nil {
		return
	}
	msg := fmt.Sprintf(format, v...)
	l.logger.Info(msg)
}

func (l gooseSlogLogger) Fatalf(format string, v ...interface{}) {
	msg := fmt.Sprintf(format, v...)
	if l.logger != nil {
		l.logger.Error(msg)
	}
	os.Exit(1)
}
