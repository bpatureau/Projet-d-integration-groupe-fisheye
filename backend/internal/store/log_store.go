package store

import (
	"database/sql"
	"fmt"
	"strings"
	"time"

	"github.com/google/uuid"
)

type LogEntry struct {
	ID        uuid.UUID `json:"id"`
	Level     string    `json:"level"`
	Message   string    `json:"message"`
	Component string    `json:"component,omitempty"`
	CreatedAt time.Time `json:"created_at"`
}

type LogStore interface {
	CreateLog(level, message, component string) error
	ListLogs(limit, offset int, level, component string, startDate, endDate *time.Time) ([]*LogEntry, int, error)
	DeleteOldLogs(olderThanDays int) (int64, error)
}

type PostgresLogStore struct {
	db *sql.DB
}

func NewPostgresLogStore(db *sql.DB) *PostgresLogStore {
	return &PostgresLogStore{db: db}
}

func (s *PostgresLogStore) CreateLog(level, message, component string) error {
	query := `
		INSERT INTO system_logs (level, message, component)
		VALUES ($1, $2, $3)
	`

	_, err := s.db.Exec(query, level, message, component)
	return err
}

func (s *PostgresLogStore) ListLogs(limit, offset int, level, component string, startDate, endDate *time.Time) ([]*LogEntry, int, error) {
	whereConditions := []string{"1=1"}
	args := []any{}
	argPosition := 1

	if level != "" {
		whereConditions = append(whereConditions, fmt.Sprintf("level = $%d", argPosition))
		args = append(args, level)
		argPosition++
	}

	if component != "" {
		whereConditions = append(whereConditions, fmt.Sprintf("component = $%d", argPosition))
		args = append(args, component)
		argPosition++
	}

	if startDate != nil {
		whereConditions = append(whereConditions, fmt.Sprintf("created_at >= $%d", argPosition))
		args = append(args, *startDate)
		argPosition++
	}

	if endDate != nil {
		whereConditions = append(whereConditions, fmt.Sprintf("created_at <= $%d", argPosition))
		args = append(args, *endDate)
		argPosition++
	}

	whereClause := strings.Join(whereConditions, " AND ")

	var total int
	countQuery := fmt.Sprintf("SELECT COUNT(*) FROM system_logs WHERE %s", whereClause)
	if err := s.db.QueryRow(countQuery, args...).Scan(&total); err != nil {
		return nil, 0, err
	}

	finalArgs := append(args, limit, offset)

	query := fmt.Sprintf(`
		SELECT id, level, message, component, created_at
		FROM system_logs
		WHERE %s
		ORDER BY created_at DESC
		LIMIT $%d OFFSET $%d
	`, whereClause, argPosition, argPosition+1)

	rows, err := s.db.Query(query, finalArgs...)
	if err != nil {
		return nil, 0, err
	}
	defer rows.Close()

	logs := []*LogEntry{}
	for rows.Next() {
		log := &LogEntry{}
		err := rows.Scan(
			&log.ID,
			&log.Level,
			&log.Message,
			&log.Component,
			&log.CreatedAt,
		)
		if err != nil {
			return nil, 0, err
		}
		logs = append(logs, log)
	}

	if err = rows.Err(); err != nil {
		return nil, 0, err
	}

	return logs, total, nil
}

func (s *PostgresLogStore) DeleteOldLogs(olderThanDays int) (int64, error) {
	cutoffDate := time.Now().AddDate(0, 0, -olderThanDays)

	query := `
		DELETE FROM system_logs
		WHERE created_at < $1
	`

	result, err := s.db.Exec(query, cutoffDate)
	if err != nil {
		return 0, err
	}

	return result.RowsAffected()
}
