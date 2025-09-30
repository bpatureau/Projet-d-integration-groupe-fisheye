package store

import (
	"context"
	"database/sql"
	"encoding/json"
	"time"

	"github.com/google/uuid"
	"github.com/lib/pq"
)

type DaySchedule struct {
	Enabled bool   `json:"enabled"`
	Start   string `json:"start,omitempty"` // HH:MM format
	End     string `json:"end,omitempty"`   // HH:MM format
}

type Settings struct {
	ID                     uuid.UUID              `json:"id"`
	DeviceName             string                 `json:"device_name"`
	DoNotDisturb           bool                   `json:"do_not_disturb"`
	WelcomeMessages        []string               `json:"welcome_messages"`
	MessageRotationSeconds int                    `json:"message_rotation_seconds"`
	Schedule               map[string]DaySchedule `json:"schedule"`
	CreatedAt              time.Time              `json:"created_at"`
	UpdatedAt              time.Time              `json:"updated_at"`
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

	var scheduleJSON []byte
	var messages pq.StringArray

	query := `
		SELECT id, device_name, do_not_disturb, welcome_messages, 
		       message_rotation_seconds, schedule, created_at, updated_at
		FROM settings
		LIMIT 1
	`

	err := s.db.QueryRowContext(ctx, query).Scan(
		&settings.ID,
		&settings.DeviceName,
		&settings.DoNotDisturb,
		&messages,
		&settings.MessageRotationSeconds,
		&scheduleJSON,
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

	if err := json.Unmarshal(scheduleJSON, &settings.Schedule); err != nil {
		return nil, err
	}

	return settings, nil
}

func (s *PostgresSettingsStore) Update(ctx context.Context, settings *Settings) error {
	scheduleJSON, err := json.Marshal(settings.Schedule)
	if err != nil {
		return err
	}

	query := `
		UPDATE settings
		SET device_name = $1, 
		    do_not_disturb = $2, 
		    welcome_messages = $3,
		    message_rotation_seconds = $4,
		    schedule = $5,
		    updated_at = CURRENT_TIMESTAMP
		WHERE id = $6
		RETURNING updated_at
	`

	err = s.db.QueryRowContext(
		ctx,
		query,
		settings.DeviceName,
		settings.DoNotDisturb,
		pq.Array(settings.WelcomeMessages),
		settings.MessageRotationSeconds,
		scheduleJSON,
		settings.ID,
	).Scan(&settings.UpdatedAt)

	return err
}

func (s *PostgresSettingsStore) Initialize(ctx context.Context) error {
	defaultSchedule := map[string]DaySchedule{
		"monday":    {Enabled: true, Start: "09:00", End: "18:00"},
		"tuesday":   {Enabled: true, Start: "09:00", End: "18:00"},
		"wednesday": {Enabled: true, Start: "09:00", End: "18:00"},
		"thursday":  {Enabled: true, Start: "09:00", End: "18:00"},
		"friday":    {Enabled: true, Start: "09:00", End: "17:00"},
		"saturday":  {Enabled: false},
		"sunday":    {Enabled: false},
	}

	scheduleJSON, _ := json.Marshal(defaultSchedule)

	query := `
		INSERT INTO settings (
			device_name, 
			do_not_disturb, 
			welcome_messages,
			message_rotation_seconds,
			schedule
		) VALUES ($1, $2, $3, $4, $5)
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
		scheduleJSON,
	)

	return err
}
