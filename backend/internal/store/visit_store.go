package store

import (
	"database/sql"
	"fmt"
	"strings"
	"time"

	"github.com/google/uuid"
)

type Visit struct {
	ID           uuid.UUID  `json:"id"`
	Type         string     `json:"type"`
	Status       string     `json:"status"`
	ResponseTime *int64     `json:"response_time,omitempty"`
	RespondedAt  *time.Time `json:"responded_at,omitempty"`
	CreatedAt    time.Time  `json:"created_at"`
	UpdatedAt    time.Time  `json:"updated_at"`
}

type VisitStatistics struct {
	TotalVisits      int     `json:"total_visits"`
	AnsweredVisits   int     `json:"answered_visits"`
	UnansweredVisits int     `json:"unanswered_visits"`
	IgnoredVisits    int     `json:"ignored_visits"`
	AvgResponseTime  float64 `json:"avg_response_time_seconds"`
	TodayVisits      int     `json:"today_visits"`
	WeekVisits       int     `json:"week_visits"`
	MonthVisits      int     `json:"month_visits"`
}

type VisitStore interface {
	CreateVisit(*Visit) error
	GetVisitByID(id uuid.UUID) (*Visit, error)
	ListVisits(limit, offset int, status, visitType string, startDate, endDate *time.Time) ([]*Visit, int, error)
	UpdateVisitStatus(id uuid.UUID, status string) error
	MarkAsResponded(id uuid.UUID) error
	GetVisitStatistics() (*VisitStatistics, error)
}

type PostgresVisitStore struct {
	db *sql.DB
}

func NewPostgresVisitStore(db *sql.DB) *PostgresVisitStore {
	return &PostgresVisitStore{db: db}
}

func (s *PostgresVisitStore) CreateVisit(visit *Visit) error {
	query := `
		INSERT INTO visits (type, status)
		VALUES ($1, $2)
		RETURNING id, created_at, updated_at
	`

	err := s.db.QueryRow(query, visit.Type, visit.Status).
		Scan(&visit.ID, &visit.CreatedAt, &visit.UpdatedAt)
	return err
}

func (s *PostgresVisitStore) GetVisitByID(id uuid.UUID) (*Visit, error) {
	visit := &Visit{}

	query := `
		SELECT id, type, status, response_time, responded_at, created_at, updated_at
		FROM visits
		WHERE id = $1
	`

	err := s.db.QueryRow(query, id).Scan(
		&visit.ID,
		&visit.Type,
		&visit.Status,
		&visit.ResponseTime,
		&visit.RespondedAt,
		&visit.CreatedAt,
		&visit.UpdatedAt,
	)

	if err == sql.ErrNoRows {
		return nil, nil
	}

	return visit, err
}

func (s *PostgresVisitStore) ListVisits(limit, offset int, status, visitType string, startDate, endDate *time.Time) ([]*Visit, int, error) {
	whereConditions := []string{"1=1"}
	args := []any{}
	argPosition := 1

	if status != "" {
		whereConditions = append(whereConditions, fmt.Sprintf("status = $%d", argPosition))
		args = append(args, status)
		argPosition++
	}

	if visitType != "" {
		whereConditions = append(whereConditions, fmt.Sprintf("type = $%d", argPosition))
		args = append(args, visitType)
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
	countQuery := fmt.Sprintf("SELECT COUNT(*) FROM visits WHERE %s", whereClause)
	if err := s.db.QueryRow(countQuery, args...).Scan(&total); err != nil {
		return nil, 0, err
	}

	finalArgs := append(args, limit, offset)

	query := fmt.Sprintf(`
		SELECT id, type, status, response_time, responded_at, created_at, updated_at
		FROM visits
		WHERE %s
		ORDER BY created_at DESC
		LIMIT $%d OFFSET $%d
	`, whereClause, argPosition, argPosition+1)

	rows, err := s.db.Query(query, finalArgs...)
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
			&visit.ResponseTime,
			&visit.RespondedAt,
			&visit.CreatedAt,
			&visit.UpdatedAt,
		)
		if err != nil {
			return nil, 0, err
		}
		visits = append(visits, visit)
	}

	if err = rows.Err(); err != nil {
		return nil, 0, err
	}

	return visits, total, nil
}

func (s *PostgresVisitStore) UpdateVisitStatus(id uuid.UUID, status string) error {
	query := `
		UPDATE visits
		SET status = $1, updated_at = CURRENT_TIMESTAMP
		WHERE id = $2
	`

	_, err := s.db.Exec(query, status, id)
	return err
}

func (s *PostgresVisitStore) MarkAsResponded(id uuid.UUID) error {
	query := `
		UPDATE visits
		SET 
			status = 'answered',
			responded_at = CURRENT_TIMESTAMP,
			response_time = EXTRACT(EPOCH FROM (CURRENT_TIMESTAMP - created_at))::BIGINT,
			updated_at = CURRENT_TIMESTAMP
		WHERE id = $1 AND status != 'answered'
	`

	_, err := s.db.Exec(query, id)
	return err
}

func (s *PostgresVisitStore) GetVisitStatistics() (*VisitStatistics, error) {
	now := time.Now()
	startOfDay := time.Date(now.Year(), now.Month(), now.Day(), 0, 0, 0, 0, now.Location())
	startOfWeek := now.AddDate(0, 0, -int(now.Weekday()))
	startOfMonth := time.Date(now.Year(), now.Month(), 1, 0, 0, 0, 0, now.Location())

	query := `
		SELECT 
			COUNT(*) as total,
			COUNT(CASE WHEN status = 'answered' THEN 1 END) as answered,
			COUNT(CASE WHEN status = 'unanswered' THEN 1 END) as unanswered,
			COUNT(CASE WHEN status = 'ignored' THEN 1 END) as ignored,
			AVG(response_time) as avg_response_time,
			COUNT(CASE WHEN created_at >= $1 THEN 1 END) as today,
			COUNT(CASE WHEN created_at >= $2 THEN 1 END) as week,
			COUNT(CASE WHEN created_at >= $3 THEN 1 END) as month
		FROM visits
	`

	stats := &VisitStatistics{}
	var avgResponseTime sql.NullFloat64

	err := s.db.QueryRow(query, startOfDay, startOfWeek, startOfMonth).Scan(
		&stats.TotalVisits,
		&stats.AnsweredVisits,
		&stats.UnansweredVisits,
		&stats.IgnoredVisits,
		&avgResponseTime,
		&stats.TodayVisits,
		&stats.WeekVisits,
		&stats.MonthVisits,
	)

	if avgResponseTime.Valid {
		stats.AvgResponseTime = avgResponseTime.Float64
	}

	return stats, err
}
