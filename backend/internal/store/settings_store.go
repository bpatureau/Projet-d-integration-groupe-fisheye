package store

import (
	"database/sql"
	"encoding/json"
	"time"

	"github.com/google/uuid"
)

type Schedule struct {
	Monday    *DaySchedule `json:"monday,omitempty"`
	Tuesday   *DaySchedule `json:"tuesday,omitempty"`
	Wednesday *DaySchedule `json:"wednesday,omitempty"`
	Thursday  *DaySchedule `json:"thursday,omitempty"`
	Friday    *DaySchedule `json:"friday,omitempty"`
	Saturday  *DaySchedule `json:"saturday,omitempty"`
	Sunday    *DaySchedule `json:"sunday,omitempty"`
}

type DaySchedule struct {
	Enabled bool   `json:"enabled"`
	Start   string `json:"start,omitempty"` // Format: "HH:MM"
	End     string `json:"end,omitempty"`   // Format: "HH:MM"
}

type MOTDMessage struct {
	Text      string     `json:"text"`
	ExpiresAt *time.Time `json:"expires_at,omitempty"`
}

type MOTD struct {
	Enabled         bool          `json:"enabled"`
	Messages        []MOTDMessage `json:"messages"`
	CooldownSeconds int           `json:"cooldown_seconds"`
}

type Settings struct {
	ID        uuid.UUID `json:"id"`
	Name      string    `json:"name"`
	DND       bool      `json:"dnd"`
	MOTD      *MOTD     `json:"motd,omitempty"`
	Schedule  *Schedule `json:"schedule,omitempty"`
	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
}

type SettingsStore interface {
	GetSettings() (*Settings, error)
	UpdateSettings(*Settings) error
	UpdateDND(enabled bool) error
	UpdateMOTD(motd *MOTD) error
	UpdateSchedule(schedule *Schedule) error
	InitializeSettings() error
}

type PostgresSettingsStore struct {
	db *sql.DB
}

func NewPostgresSettingsStore(db *sql.DB) *PostgresSettingsStore {
	return &PostgresSettingsStore{db: db}
}

func (s *PostgresSettingsStore) GetSettings() (*Settings, error) {
	settings := &Settings{}

	query := `
		SELECT id, name, dnd, motd, schedule, created_at, updated_at
		FROM settings
		LIMIT 1
	`

	var motdJSON, scheduleJSON sql.NullString

	err := s.db.QueryRow(query).Scan(
		&settings.ID,
		&settings.Name,
		&settings.DND,
		&motdJSON,
		&scheduleJSON,
		&settings.CreatedAt,
		&settings.UpdatedAt,
	)

	if err == sql.ErrNoRows {
		return s.initializeDefaultSettings()
	} else if err != nil {
		return nil, err
	}

	if motdJSON.Valid && motdJSON.String != "" {
		var motd MOTD
		if err := json.Unmarshal([]byte(motdJSON.String), &motd); err == nil {
			settings.MOTD = &motd
		}
	}

	if scheduleJSON.Valid && scheduleJSON.String != "" {
		var schedule Schedule
		if err := json.Unmarshal([]byte(scheduleJSON.String), &schedule); err == nil {
			settings.Schedule = &schedule
		}
	}

	return settings, nil
}

func (s *PostgresSettingsStore) UpdateSettings(settings *Settings) error {
	motdJSON, _ := json.Marshal(settings.MOTD)
	scheduleJSON, _ := json.Marshal(settings.Schedule)

	query := `
		UPDATE settings
		SET name = $1, dnd = $2, motd = $3, schedule = $4, updated_at = CURRENT_TIMESTAMP
		WHERE id = $5
		RETURNING updated_at
	`

	err := s.db.QueryRow(
		query,
		settings.Name,
		settings.DND,
		motdJSON,
		scheduleJSON,
		settings.ID,
	).Scan(&settings.UpdatedAt)

	return err
}

func (s *PostgresSettingsStore) UpdateDND(enabled bool) error {
	query := `
		UPDATE settings
		SET dnd = $1, updated_at = CURRENT_TIMESTAMP
		WHERE id = (SELECT id FROM settings LIMIT 1)
	`

	_, err := s.db.Exec(query, enabled)
	return err
}

func (s *PostgresSettingsStore) UpdateMOTD(motd *MOTD) error {
	motdJSON, err := json.Marshal(motd)
	if err != nil {
		return err
	}

	query := `
		UPDATE settings
		SET motd = $1, updated_at = CURRENT_TIMESTAMP
		WHERE id = (SELECT id FROM settings LIMIT 1)
	`

	_, err = s.db.Exec(query, motdJSON)
	return err
}

func (s *PostgresSettingsStore) UpdateSchedule(schedule *Schedule) error {
	scheduleJSON, err := json.Marshal(schedule)
	if err != nil {
		return err
	}

	query := `
		UPDATE settings
		SET schedule = $1, updated_at = CURRENT_TIMESTAMP
		WHERE id = (SELECT id FROM settings LIMIT 1)
	`

	_, err = s.db.Exec(query, scheduleJSON)
	return err
}

func (s *PostgresSettingsStore) InitializeSettings() error {
	settings := s.getDefaultSettings()

	motdJSON, _ := json.Marshal(settings.MOTD)
	scheduleJSON, _ := json.Marshal(settings.Schedule)

	query := `
		INSERT INTO settings (name, dnd, motd, schedule)
		VALUES ($1, $2, $3, $4)
		ON CONFLICT DO NOTHING
		RETURNING id, created_at, updated_at
	`

	err := s.db.QueryRow(
		query,
		settings.Name,
		settings.DND,
		motdJSON,
		scheduleJSON,
	).Scan(&settings.ID, &settings.CreatedAt, &settings.UpdatedAt)

	return err
}

func (s *PostgresSettingsStore) initializeDefaultSettings() (*Settings, error) {
	if err := s.InitializeSettings(); err != nil {
		return nil, err
	}

	return s.GetSettings()
}

func (s *PostgresSettingsStore) getDefaultSettings() *Settings {
	return &Settings{
		Name: "Default",
		DND:  false,
		MOTD: &MOTD{
			Enabled: false,
			Messages: []MOTDMessage{
				{Text: "Bienvenue !"},
				{Text: "Nous sommes là pour vous aider"},
				{Text: "N'hésitez pas à nous contacter"},
			},
			CooldownSeconds: 30, // 30 secondes entre chaque rotation
		},
		Schedule: &Schedule{
			Monday: &DaySchedule{
				Enabled: true,
				Start:   "09:00",
				End:     "18:00",
			},
			Tuesday: &DaySchedule{
				Enabled: true,
				Start:   "09:00",
				End:     "18:00",
			},
			Wednesday: &DaySchedule{
				Enabled: true,
				Start:   "09:00",
				End:     "18:00",
			},
			Thursday: &DaySchedule{
				Enabled: true,
				Start:   "09:00",
				End:     "18:00",
			},
			Friday: &DaySchedule{
				Enabled: true,
				Start:   "09:00",
				End:     "18:00",
			},
			Saturday: &DaySchedule{
				Enabled: false,
			},
			Sunday: &DaySchedule{
				Enabled: false,
			},
		},
	}
}
