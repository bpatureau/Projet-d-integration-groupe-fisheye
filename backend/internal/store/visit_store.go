package store

import (
	"context"
	"database/sql"
	"fmt"
	"strings"
	"time"

	"github.com/google/uuid"
)

type Visit struct {
	ID     uuid.UUID `json:"id"`
	Type   string    `json:"type"`
	Status string    `json:"status"`

	// Message fields
	HasMessage        bool       `json:"has_message"`
	MessageType       *string    `json:"message_type,omitempty"`
	MessageText       *string    `json:"message_text,omitempty"`
	MessageFilepath   *string    `json:"message_filepath,omitempty"`
	MessageSize       *int64     `json:"message_size,omitempty"`
	MessageDuration   *int       `json:"message_duration,omitempty"`
	MessageListened   bool       `json:"message_listened"`
	MessageListenedAt *time.Time `json:"message_listened_at,omitempty"`

	// Response tracking
	AnsweredAt   *time.Time `json:"answered_at,omitempty"`
	ResponseTime *int       `json:"response_time,omitempty"`

	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
}

type VisitStore interface {
	Create(ctx context.Context, visit *Visit) error
	GetByID(ctx context.Context, id uuid.UUID) (*Visit, error)
	GetLatestPending(ctx context.Context) (*Visit, error)
	List(ctx context.Context, filter ListFilter) ([]*Visit, int, error)
	Update(ctx context.Context, visit *Visit) error
	Delete(ctx context.Context, id uuid.UUID) error

	AddVoiceMessage(ctx context.Context, visitID uuid.UUID, filepath string, size int64, duration int) error
	AddTextMessage(ctx context.Context, visitID uuid.UUID, text string) error
	MarkMessageListened(ctx context.Context, visitID uuid.UUID) error
	MarkAnswered(ctx context.Context, visitID uuid.UUID) error
	GetStatistics(ctx context.Context) (*VisitStats, error)
}

type ListFilter struct {
	Limit      int
	Offset     int
	Status     string
	HasMessage *bool
	StartDate  *time.Time
	EndDate    *time.Time
}

type VisitStats struct {
	Total              int     `json:"total"`
	Pending            int     `json:"pending"`
	Answered           int     `json:"answered"`
	Missed             int     `json:"missed"`
	Ignored            int     `json:"ignored"`
	WithMessages       int     `json:"with_messages"`
	UnlistenedMessages int     `json:"unlistened_messages"`
	AvgResponseTime    float64 `json:"avg_response_time_seconds"`
	Today              int     `json:"today"`
	ThisWeek           int     `json:"this_week"`
}

type PostgresVisitStore struct {
	db *sql.DB
}

func NewPostgresVisitStore(db *sql.DB) *PostgresVisitStore {
	return &PostgresVisitStore{db: db}
}

func (s *PostgresVisitStore) Create(ctx context.Context, visit *Visit) error {
	query := `
		INSERT INTO visits (type, status)
		VALUES ($1, $2)
		RETURNING id, created_at, updated_at
	`

	err := s.db.QueryRowContext(ctx, query, visit.Type, visit.Status).
		Scan(&visit.ID, &visit.CreatedAt, &visit.UpdatedAt)
	return err
}

func (s *PostgresVisitStore) GetByID(ctx context.Context, id uuid.UUID) (*Visit, error) {
	visit := &Visit{}

	query := `
		SELECT id, type, status, has_message, message_type, message_text, message_filepath,
			   message_size, message_duration, message_listened, message_listened_at,
			   answered_at, response_time, created_at, updated_at
		FROM visits
		WHERE id = $1
	`

	err := s.db.QueryRowContext(ctx, query, id).Scan(
		&visit.ID,
		&visit.Type,
		&visit.Status,
		&visit.HasMessage,
		&visit.MessageType,
		&visit.MessageText,
		&visit.MessageFilepath,
		&visit.MessageSize,
		&visit.MessageDuration,
		&visit.MessageListened,
		&visit.MessageListenedAt,
		&visit.AnsweredAt,
		&visit.ResponseTime,
		&visit.CreatedAt,
		&visit.UpdatedAt,
	)

	if err == sql.ErrNoRows {
		return nil, nil
	}

	return visit, err
}

func (s *PostgresVisitStore) GetLatestPending(ctx context.Context) (*Visit, error) {
	visit := &Visit{}

	query := `
		SELECT id, type, status, has_message, message_type, message_text, message_filepath,
			   message_size, message_duration, message_listened, message_listened_at,
			   answered_at, response_time, created_at, updated_at
		FROM visits
		WHERE status = 'pending'
		ORDER BY created_at DESC
		LIMIT 1
	`

	err := s.db.QueryRowContext(ctx, query).Scan(
		&visit.ID,
		&visit.Type,
		&visit.Status,
		&visit.HasMessage,
		&visit.MessageType,
		&visit.MessageText,
		&visit.MessageFilepath,
		&visit.MessageSize,
		&visit.MessageDuration,
		&visit.MessageListened,
		&visit.MessageListenedAt,
		&visit.AnsweredAt,
		&visit.ResponseTime,
		&visit.CreatedAt,
		&visit.UpdatedAt,
	)

	if err == sql.ErrNoRows {
		return nil, nil
	}

	return visit, err
}

func (s *PostgresVisitStore) List(ctx context.Context, filter ListFilter) ([]*Visit, int, error) {
	whereConditions := []string{"1=1"}
	args := []any{}
	argPosition := 1

	if filter.Status != "" {
		whereConditions = append(whereConditions, fmt.Sprintf("status = $%d", argPosition))
		args = append(args, filter.Status)
		argPosition++
	}

	if filter.HasMessage != nil {
		whereConditions = append(whereConditions, fmt.Sprintf("has_message = $%d", argPosition))
		args = append(args, *filter.HasMessage)
		argPosition++
	}

	if filter.StartDate != nil {
		whereConditions = append(whereConditions, fmt.Sprintf("created_at >= $%d", argPosition))
		args = append(args, *filter.StartDate)
		argPosition++
	}

	if filter.EndDate != nil {
		whereConditions = append(whereConditions, fmt.Sprintf("created_at <= $%d", argPosition))
		args = append(args, *filter.EndDate)
		argPosition++
	}

	whereClause := strings.Join(whereConditions, " AND ")

	// Count total
	var total int
	countQuery := fmt.Sprintf("SELECT COUNT(*) FROM visits WHERE %s", whereClause)
	if err := s.db.QueryRowContext(ctx, countQuery, args...).Scan(&total); err != nil {
		return nil, 0, err
	}

	// Get visits
	args = append(args, filter.Limit, filter.Offset)
	query := fmt.Sprintf(`
		SELECT id, type, status, has_message, message_type, message_text, message_filepath,
			   message_size, message_duration, message_listened, message_listened_at,
			   answered_at, response_time, created_at, updated_at
		FROM visits
		WHERE %s
		ORDER BY created_at DESC
		LIMIT $%d OFFSET $%d
	`, whereClause, argPosition, argPosition+1)

	rows, err := s.db.QueryContext(ctx, query, args...)
	if err != nil {
		return nil, 0, err
	}
	defer rows.Close()

	visits := []*Visit{}
	for rows.Next() {
		visit := &Visit{}
		err := rows.Scan(
			&visit.ID,
			&visit.Type,
			&visit.Status,
			&visit.HasMessage,
			&visit.MessageType,
			&visit.MessageText,
			&visit.MessageFilepath,
			&visit.MessageSize,
			&visit.MessageDuration,
			&visit.MessageListened,
			&visit.MessageListenedAt,
			&visit.AnsweredAt,
			&visit.ResponseTime,
			&visit.CreatedAt,
			&visit.UpdatedAt,
		)
		if err != nil {
			return nil, 0, err
		}
		visits = append(visits, visit)
	}

	return visits, total, rows.Err()
}

func (s *PostgresVisitStore) Update(ctx context.Context, visit *Visit) error {
	query := `
		UPDATE visits
		SET status = $1, updated_at = CURRENT_TIMESTAMP
		WHERE id = $2
		RETURNING updated_at
	`

	err := s.db.QueryRowContext(ctx, query, visit.Status, visit.ID).Scan(&visit.UpdatedAt)
	return err
}

func (s *PostgresVisitStore) Delete(ctx context.Context, id uuid.UUID) error {
	query := `DELETE FROM visits WHERE id = $1`
	_, err := s.db.ExecContext(ctx, query, id)
	return err
}

func (s *PostgresVisitStore) AddVoiceMessage(ctx context.Context, visitID uuid.UUID, filepath string, size int64, duration int) error {
	messageType := "voice"
	query := `
		UPDATE visits
		SET has_message = true,
			message_type = $1,
			message_filepath = $2,
			message_size = $3,
			message_duration = $4,
			updated_at = CURRENT_TIMESTAMP
		WHERE id = $5
	`

	_, err := s.db.ExecContext(ctx, query, messageType, filepath, size, duration, visitID)
	return err
}

func (s *PostgresVisitStore) AddTextMessage(ctx context.Context, visitID uuid.UUID, text string) error {
	messageType := "text"
	query := `
		UPDATE visits
		SET has_message = true,
			message_type = $1,
			message_text = $2,
			updated_at = CURRENT_TIMESTAMP
		WHERE id = $3
	`

	_, err := s.db.ExecContext(ctx, query, messageType, text, visitID)
	return err
}

func (s *PostgresVisitStore) MarkMessageListened(ctx context.Context, visitID uuid.UUID) error {
	query := `
		UPDATE visits
		SET message_listened = true,
			message_listened_at = CURRENT_TIMESTAMP,
			updated_at = CURRENT_TIMESTAMP
		WHERE id = $1 AND has_message = true
	`

	_, err := s.db.ExecContext(ctx, query, visitID)
	return err
}

func (s *PostgresVisitStore) MarkAnswered(ctx context.Context, visitID uuid.UUID) error {
	query := `
		UPDATE visits
		SET status = 'answered',
			answered_at = CURRENT_TIMESTAMP,
			response_time = EXTRACT(EPOCH FROM (CURRENT_TIMESTAMP - created_at))::INTEGER,
			updated_at = CURRENT_TIMESTAMP
		WHERE id = $1 AND status = 'pending'
	`

	_, err := s.db.ExecContext(ctx, query, visitID)
	return err
}

func (s *PostgresVisitStore) GetStatistics(ctx context.Context) (*VisitStats, error) {
	now := time.Now()
	startOfDay := time.Date(now.Year(), now.Month(), now.Day(), 0, 0, 0, 0, now.Location())
	startOfWeek := now.AddDate(0, 0, -int(now.Weekday()))

	query := `
		SELECT 
			COUNT(*) as total,
			COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending,
			COUNT(CASE WHEN status = 'answered' THEN 1 END) as answered,
			COUNT(CASE WHEN status = 'missed' THEN 1 END) as missed,
			COUNT(CASE WHEN status = 'ignored' THEN 1 END) as ignored,
			COUNT(CASE WHEN has_message = true THEN 1 END) as with_messages,
			COUNT(CASE WHEN has_message = true AND message_type = 'voice' AND message_listened = false THEN 1 END) as unlistened,
			AVG(response_time) as avg_response_time,
			COUNT(CASE WHEN created_at >= $1 THEN 1 END) as today,
			COUNT(CASE WHEN created_at >= $2 THEN 1 END) as week
		FROM visits
	`

	stats := &VisitStats{}
	var avgResponseTime sql.NullFloat64

	err := s.db.QueryRowContext(ctx, query, startOfDay, startOfWeek).Scan(
		&stats.Total,
		&stats.Pending,
		&stats.Answered,
		&stats.Missed,
		&stats.Ignored,
		&stats.WithMessages,
		&stats.UnlistenedMessages,
		&avgResponseTime,
		&stats.Today,
		&stats.ThisWeek,
	)

	if avgResponseTime.Valid {
		stats.AvgResponseTime = avgResponseTime.Float64
	}

	return stats, err
}
