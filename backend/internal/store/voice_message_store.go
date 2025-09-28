package store

import (
	"database/sql"
	"fmt"
	"strings"
	"time"

	"github.com/google/uuid"
)

type VoiceMessage struct {
	ID         uuid.UUID  `json:"id"`
	VisitID    uuid.UUID  `json:"visit_id"`
	Filename   string     `json:"filename"`
	FilePath   string     `json:"-"`
	FileSize   int64      `json:"file_size"`
	Duration   int64      `json:"duration"`
	IsListened bool       `json:"is_listened"`
	ListenedAt *time.Time `json:"listened_at,omitempty"`
	CreatedAt  time.Time  `json:"created_at"`
	UpdatedAt  time.Time  `json:"updated_at"`
}

type VoiceMessageStore interface {
	CreateVoiceMessage(*VoiceMessage) error
	GetVoiceMessageByID(id uuid.UUID) (*VoiceMessage, error)
	ListVoiceMessages(limit, offset int, visitID *uuid.UUID, isListened *bool, startDate, endDate *time.Time) ([]*VoiceMessage, int, error)
	MarkAsListened(id uuid.UUID) error
	DeleteVoiceMessage(id uuid.UUID) error
	CountUnlistenedMessages() (int, error)
}

type PostgresVoiceMessageStore struct {
	db *sql.DB
}

func NewPostgresVoiceMessageStore(db *sql.DB) *PostgresVoiceMessageStore {
	return &PostgresVoiceMessageStore{db: db}
}

func (s *PostgresVoiceMessageStore) CreateVoiceMessage(vm *VoiceMessage) error {
	query := `
		INSERT INTO voice_messages (visit_id, filename, file_path, file_size, duration)
		VALUES ($1, $2, $3, $4, $5)
		RETURNING id, created_at, updated_at
	`

	err := s.db.QueryRow(
		query,
		vm.VisitID,
		vm.Filename,
		vm.FilePath,
		vm.FileSize,
		vm.Duration,
	).Scan(&vm.ID, &vm.CreatedAt, &vm.UpdatedAt)

	return err
}

func (s *PostgresVoiceMessageStore) GetVoiceMessageByID(id uuid.UUID) (*VoiceMessage, error) {
	vm := &VoiceMessage{}

	query := `
		SELECT id, visit_id, filename, file_path, file_size, duration, 
			   is_listened, listened_at, created_at, updated_at
		FROM voice_messages
		WHERE id = $1
	`

	err := s.db.QueryRow(query, id).Scan(
		&vm.ID,
		&vm.VisitID,
		&vm.Filename,
		&vm.FilePath,
		&vm.FileSize,
		&vm.Duration,
		&vm.IsListened,
		&vm.ListenedAt,
		&vm.CreatedAt,
		&vm.UpdatedAt,
	)

	if err == sql.ErrNoRows {
		return nil, nil
	}

	return vm, err
}

func (s *PostgresVoiceMessageStore) ListVoiceMessages(limit, offset int, visitID *uuid.UUID, isListened *bool, startDate, endDate *time.Time) ([]*VoiceMessage, int, error) {
	whereConditions := []string{"1=1"}
	args := []any{}
	argPosition := 1

	if visitID != nil {
		whereConditions = append(whereConditions, fmt.Sprintf("visit_id = $%d", argPosition))
		args = append(args, *visitID)
		argPosition++
	}

	if isListened != nil {
		whereConditions = append(whereConditions, fmt.Sprintf("is_listened = $%d", argPosition))
		args = append(args, *isListened)
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
	countQuery := fmt.Sprintf("SELECT COUNT(*) FROM voice_messages WHERE %s", whereClause)
	if err := s.db.QueryRow(countQuery, args...).Scan(&total); err != nil {
		return nil, 0, err
	}

	finalArgs := append(args, limit, offset)

	query := fmt.Sprintf(`
		SELECT id, visit_id, filename, file_path, file_size, duration, 
			   is_listened, listened_at, created_at, updated_at
		FROM voice_messages
		WHERE %s
		ORDER BY created_at DESC
		LIMIT $%d OFFSET $%d
	`, whereClause, argPosition, argPosition+1)

	rows, err := s.db.Query(query, finalArgs...)
	if err != nil {
		return nil, 0, err
	}
	defer rows.Close()

	messages := []*VoiceMessage{}
	for rows.Next() {
		vm := &VoiceMessage{}
		err := rows.Scan(
			&vm.ID,
			&vm.VisitID,
			&vm.Filename,
			&vm.FilePath,
			&vm.FileSize,
			&vm.Duration,
			&vm.IsListened,
			&vm.ListenedAt,
			&vm.CreatedAt,
			&vm.UpdatedAt,
		)
		if err != nil {
			return nil, 0, err
		}
		messages = append(messages, vm)
	}

	if err = rows.Err(); err != nil {
		return nil, 0, err
	}

	return messages, total, nil
}

func (s *PostgresVoiceMessageStore) MarkAsListened(id uuid.UUID) error {
	query := `
		UPDATE voice_messages
		SET is_listened = true, 
			listened_at = CURRENT_TIMESTAMP,
			updated_at = CURRENT_TIMESTAMP
		WHERE id = $1
	`

	_, err := s.db.Exec(query, id)
	return err
}

func (s *PostgresVoiceMessageStore) DeleteVoiceMessage(id uuid.UUID) error {
	query := `DELETE FROM voice_messages WHERE id = $1`
	_, err := s.db.Exec(query, id)
	return err
}

func (s *PostgresVoiceMessageStore) CountUnlistenedMessages() (int, error) {
	var count int
	query := `SELECT COUNT(*) FROM voice_messages WHERE is_listened = false`
	err := s.db.QueryRow(query).Scan(&count)
	return count, err
}
