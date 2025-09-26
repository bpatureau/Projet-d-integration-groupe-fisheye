package app

import (
	"database/sql"
	"fmt"

	"fisheye/internal/store"
	"fisheye/internal/utils"
	"fisheye/migrations"
)

type Application struct {
	Logger *utils.Logger
	DB     *sql.DB
}

func NewApplication() (*Application, error) {
	logger, err := utils.NewFileLogger("app.log")
	if err != nil {
		return nil, fmt.Errorf("failed to create logger: %w", err)
	}

	logger.Info("app", "Opening database connection")
	db, err := store.Open()
	if err != nil {
		logger.Error("app", "Failed to open database", err)
		logger.Close()
		return nil, fmt.Errorf("failed to open database: %w", err)
	}

	logger.Info("app", "Running database migrations")
	if err := store.MigrateFS(db, migrations.FS, "."); err != nil {
		logger.Error("app", "Failed to run migrations", err)
		db.Close()
		logger.Close()
		return nil, fmt.Errorf("failed to run migrations: %w", err)
	}

	logger.SetDB(db)
	logger.Info("app", "Application initialized successfully")

	return &Application{
		Logger: logger,
		DB:     db,
	}, nil
}

func (app *Application) Close() error {
	if app.DB != nil {
		app.Logger.Info("app", "Closing database connection")
		app.DB.Close()
	}
	if app.Logger != nil {
		app.Logger.Info("app", "Shutting down application")
		return app.Logger.Close()
	}
	return nil
}
