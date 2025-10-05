package utils

import (
	"context"
	"fisheye/internal/store"
	"fmt"
	"log"
	"os"
	"time"
)

type Logger struct {
	fileLogger *log.Logger
	logStore   store.LogStore
	file       *os.File
	debugMode  bool
}

func NewFileLogger(logFilePath string, debugMode bool) (*Logger, error) {
	file, err := os.OpenFile(logFilePath, os.O_APPEND|os.O_CREATE|os.O_WRONLY, 0644)
	if err != nil {
		return nil, fmt.Errorf("failed to open log file: %w", err)
	}

	return &Logger{
		fileLogger: log.New(file, "", log.Ldate|log.Ltime|log.Lshortfile),
		file:       file,
		debugMode:  debugMode,
	}, nil
}

func (l *Logger) SetLogStore(logStore store.LogStore) {
	l.logStore = logStore
}

func (l *Logger) Debug(component, message string) {
	if l.debugMode {
		l.log("debug", component, message)
	}
}

func (l *Logger) Info(component, message string) {
	l.log("info", component, message)
}

func (l *Logger) Warning(component, message string) {
	l.log("warning", component, message)
}

func (l *Logger) Error(component, message string, err error) {
	msg := message
	if err != nil {
		msg = fmt.Sprintf("%s: %v", message, err)
	}
	l.log("error", component, msg)
}

func (l *Logger) log(level, component, message string) {
	logMsg := fmt.Sprintf("[%s] %s: %s", level, component, message)
	l.fileLogger.Println(logMsg)

	// Store in database if available
	if l.logStore != nil {
		ctx, cancel := context.WithTimeout(context.Background(), 2*time.Second)
		defer cancel()

		if err := l.logStore.Create(ctx, level, message, component); err != nil {
			l.fileLogger.Printf("[error] logger: failed to insert log into database: %v", err)
		}
	}
}

func (l *Logger) Close() error {
	if l.file != nil {
		return l.file.Close()
	}
	return nil
}
