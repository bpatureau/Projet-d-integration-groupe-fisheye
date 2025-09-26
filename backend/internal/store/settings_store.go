package store

type Settings struct {
}

type SettingsStore interface {
	GetSettings() (*Settings, error)
	UpdateSettings(*Settings) error
}
