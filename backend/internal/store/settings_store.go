package store

import (
	"context"
	"database/sql"
	"time"

	"github.com/google/uuid"
	"github.com/lib/pq"
)

type Settings struct {
	ID                     uuid.UUID `json:"id"`
	DeviceName             string    `json:"device_name"`
	DoNotDisturb           bool      `json:"do_not_disturb"`
	WelcomeMessages        []string  `json:"welcome_messages"`
	MessageRotationSeconds int       `json:"message_rotation_seconds"`
	CreatedAt              time.Time `json:"created_at"`
	UpdatedAt              time.Time `json:"updated_at"`
}

type SettingsStore interface {
	Get(ctx context.Context) (*Settings, error)
	Update(ctx context.Context, settings *Settings) error
	Initialize(ctx context.Context) error
}

type PostgresSettingsStore struct {
	db *sql.DB
}

func NewPostgresSettingsStore(db *sql.DB) *PostgresSettingsStore {
	return &PostgresSettingsStore{db: db}
}

func (s *PostgresSettingsStore) Get(ctx context.Context) (*Settings, error) {
	settings := &Settings{}

	var messages pq.StringArray

	query := `
		SELECT id, device_name, do_not_disturb, welcome_messages, 
		       message_rotation_seconds, created_at, updated_at
		FROM settings
		LIMIT 1
	`

	err := s.db.QueryRowContext(ctx, query).Scan(
		&settings.ID,
		&settings.DeviceName,
		&settings.DoNotDisturb,
		&messages,
		&settings.MessageRotationSeconds,
		&settings.CreatedAt,
		&settings.UpdatedAt,
	)

	if err == sql.ErrNoRows {
		if err := s.Initialize(ctx); err != nil {
			return nil, err
		}
		return s.Get(ctx)
	}
	if err != nil {
		return nil, err
	}

	settings.WelcomeMessages = []string(messages)

	return settings, nil
}

func (s *PostgresSettingsStore) Update(ctx context.Context, settings *Settings) error {
	query := `
		UPDATE settings
		SET device_name = $1, 
		    do_not_disturb = $2, 
		    welcome_messages = $3,
		    message_rotation_seconds = $4,
		    updated_at = CURRENT_TIMESTAMP
		WHERE id = $5
		RETURNING updated_at
	`

	err := s.db.QueryRowContext(
		ctx,
		query,
		settings.DeviceName,
		settings.DoNotDisturb,
		pq.Array(settings.WelcomeMessages),
		settings.MessageRotationSeconds,
		settings.ID,
	).Scan(&settings.UpdatedAt)

	return err
}

func (s *PostgresSettingsStore) Initialize(ctx context.Context) error {
	query := `
		INSERT INTO settings (
			device_name, 
			do_not_disturb, 
			welcome_messages,
			message_rotation_seconds
		) VALUES ($1, $2, $3, $4)
		ON CONFLICT ((true)) DO NOTHING
	`

	defaultMessages := []string{
		"Welcome! Please ring the bell.",
		"Someone will be with you shortly.",
	}

	_, err := s.db.ExecContext(
		ctx,
		query,
		"Fisheye Doorbell",
		false,
		pq.Array(defaultMessages),
		30,
	)

	return err
}
