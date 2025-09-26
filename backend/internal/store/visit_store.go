package store

import (
	"database/sql"
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

type VisitStore interface {
	CreateVisit(*Visit) error
	GetVisitByID(id uuid.UUID) (*Visit, error)
	ListVisits(limit, offset int) ([]*Visit, int, error)
	UpdateVisitStatus(id uuid.UUID, status string) error
	MarkAsResponded(id uuid.UUID) error
	GetRecentVisits(limit int) ([]*Visit, error)
	GetUnrespondedVisits() ([]*Visit, error)
	GetVisitStatistics() (*VisitStatistics, error)
}

type VisitStatistics struct {
	TotalVisits      int     `json:"total_visits"`
	AnsweredVisits   int     `json:"answered_visits"`
	UnansweredVisits int     `json:"unanswered_visits"`
	IgnoredVisits    int     `json:"ignored_visits"`
	AvgResponseTime  float64 `json:"avg_response_time_seconds"`
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

func (s *PostgresVisitStore) ListVisits(limit, offset int) ([]*Visit, int, error) {
	// Compter le total
	var total int
	countQuery := `SELECT COUNT(*) FROM visits`
	if err := s.db.QueryRow(countQuery).Scan(&total); err != nil {
		return nil, 0, err
	}

	// Récupérer les visites
	query := `
		SELECT id, type, status, response_time, responded_at, created_at, updated_at
		FROM visits
		ORDER BY created_at DESC
		LIMIT $1 OFFSET $2
	`

	rows, err := s.db.Query(query, limit, offset)
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
		WHERE id = $1
	`

	_, err := s.db.Exec(query, id)
	return err
}

func (s *PostgresVisitStore) GetRecentVisits(limit int) ([]*Visit, error) {
	query := `
		SELECT id, type, status, response_time, responded_at, created_at, updated_at
		FROM visits
		ORDER BY created_at DESC
		LIMIT $1
	`

	rows, err := s.db.Query(query, limit)
	if err != nil {
		return nil, err
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
			return nil, err
		}
		visits = append(visits, visit)
	}

	return visits, nil
}

func (s *PostgresVisitStore) GetUnrespondedVisits() ([]*Visit, error) {
	query := `
		SELECT id, type, status, response_time, responded_at, created_at, updated_at
		FROM visits
		WHERE status = 'unanswered'
		ORDER BY created_at DESC
	`

	rows, err := s.db.Query(query)
	if err != nil {
		return nil, err
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
			return nil, err
		}
		visits = append(visits, visit)
	}

	return visits, nil
}

func (s *PostgresVisitStore) GetVisitStatistics() (*VisitStatistics, error) {
	query := `
		SELECT 
			COUNT(*) as total,
			COUNT(CASE WHEN status = 'answered' THEN 1 END) as answered,
			COUNT(CASE WHEN status = 'unanswered' THEN 1 END) as unanswered,
			COUNT(CASE WHEN status = 'ignored' THEN 1 END) as ignored,
			AVG(response_time) as avg_response_time
		FROM visits
	`

	stats := &VisitStatistics{}
	var avgResponseTime sql.NullFloat64

	err := s.db.QueryRow(query).Scan(
		&stats.TotalVisits,
		&stats.AnsweredVisits,
		&stats.UnansweredVisits,
		&stats.IgnoredVisits,
		&avgResponseTime,
	)

	if avgResponseTime.Valid {
		stats.AvgResponseTime = avgResponseTime.Float64
	}

	return stats, err
}
