package utils

import (
	"database/sql"
	"fmt"
	"log"
	"os"
)

type Logger struct {
	fileLogger *log.Logger
	db         *sql.DB
	file       *os.File
}

func NewFileLogger(logFilePath string) (*Logger, error) {
	file, err := os.OpenFile(logFilePath, os.O_APPEND|os.O_CREATE|os.O_WRONLY, 0644)
	if err != nil {
		return nil, fmt.Errorf("failed to open log file: %w", err)
	}

	return &Logger{
		fileLogger: log.New(file, "", log.Ldate|log.Ltime|log.Lshortfile),
		file:       file,
	}, nil
}

func (l *Logger) SetDB(db *sql.DB) {
	l.db = db
}

func (l *Logger) Debug(component, message string) {
	if os.Getenv("DEBUG") == "true" {
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

	// Logger en DB si disponible
	if l.db != nil {
		_, err := l.db.Exec(`
			INSERT INTO system_logs (level, message, component) 
			VALUES ($1, $2, $3)`,
			level, message, component)
		if err != nil {
			// Fallback: log l'erreur DB dans le fichier uniquement
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
