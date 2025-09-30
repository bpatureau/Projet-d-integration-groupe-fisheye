package app

import (
	"context"
	"database/sql"
	"fmt"
	"time"

	"fisheye/internal/api"
	"fisheye/internal/middleware"
	"fisheye/internal/store"
	"fisheye/internal/utils"
	"fisheye/migrations"
)

type Application struct {
	Logger          *utils.Logger
	AdminHandler    *api.AdminHandler
	AuthHandler     *api.AuthHandler
	ProfileHandler  *api.ProfileHandler
	SettingsHandler *api.SettingsHandler
	VisitHandler    *api.VisitHandler
	DeviceHandler   *api.DeviceHandler
	HealthHandler   *api.HealthHandler
	Middleware      *middleware.Middleware
	DB              *sql.DB
	ctx             context.Context
	cancel          context.CancelFunc
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

	// Configure connection pool
	db.SetMaxOpenConns(25)
	db.SetMaxIdleConns(25)
	db.SetConnMaxLifetime(5 * time.Minute)

	logger.Info("app", "Running database migrations")
	if err := store.MigrateFS(db, migrations.FS, "."); err != nil {
		logger.Error("app", "Failed to run migrations", err)
		db.Close()
		logger.Close()
		return nil, fmt.Errorf("failed to run migrations: %w", err)
	}

	// Initialize stores
	logStore := store.NewPostgresLogStore(db)
	settingsStore := store.NewPostgresSettingsStore(db)
	tokenStore := store.NewPostgresTokenStore(db)
	userStore := store.NewPostgresUserStore(db)
	visitStore := store.NewPostgresVisitStore(db)

	// Set log store for database logging
	logger.SetLogStore(logStore)

	// Initialize system (create default admin if needed)
	if err := initializeSystem(userStore, settingsStore, logger); err != nil {
		logger.Error("app", "Failed to initialize system", err)
		db.Close()
		logger.Close()
		return nil, fmt.Errorf("failed to initialize system: %w", err)
	}

	logger.Info("app", "Application initialized successfully")

	// Initialize handlers
	adminHandler := api.NewAdminHandler(userStore, tokenStore, logStore, logger)
	authHandler := api.NewAuthHandler(userStore, tokenStore, logger)
	profileHandler := api.NewProfileHandler(userStore, tokenStore, logger)
	settingsHandler := api.NewSettingsHandler(settingsStore, logger)
	visitHandler := api.NewVisitHandler(visitStore, logger)
	deviceHandler := api.NewDeviceHandler(visitStore, settingsStore, logger)
	healthHandler := api.NewHealthHandler(db)

	middlewareHandler := middleware.NewMiddleware(userStore, tokenStore, logger)

	appCtx, cancel := context.WithCancel(context.Background())

	app := &Application{
		Logger:          logger,
		AdminHandler:    adminHandler,
		AuthHandler:     authHandler,
		ProfileHandler:  profileHandler,
		SettingsHandler: settingsHandler,
		VisitHandler:    visitHandler,
		DeviceHandler:   deviceHandler,
		HealthHandler:   healthHandler,
		Middleware:      middlewareHandler,
		DB:              db,
		ctx:             appCtx,
		cancel:          cancel,
	}

	// Start background tasks
	app.startBackgroundTasks(tokenStore)

	return app, nil
}

func initializeSystem(userStore store.UserStore, settingsStore store.SettingsStore, logger *utils.Logger) error {
	ctx := context.Background()

	// Initialize users
	count, err := userStore.CountUsers(ctx)
	if err != nil {
		return fmt.Errorf("failed to count users: %w", err)
	}

	if count == 0 {
		logger.Info("app", "No users found. Creating default admin...")

		admin := &store.User{
			Username: "admin",
			Email:    "admin@fisheye.local",
			Role:     "admin",
		}

		if err := admin.PasswordHash.Set("admin"); err != nil {
			return fmt.Errorf("failed to hash password: %w", err)
		}

		if err := userStore.Create(ctx, admin); err != nil {
			return fmt.Errorf("failed to create admin: %w", err)
		}

		logger.Info("app", "Default admin created successfully (username: admin, password: admin)")
	} else {
		logger.Info("app", fmt.Sprintf("System already initialized with %d users", count))
	}

	// Initialize settings
	if _, err := settingsStore.Get(ctx); err != nil {
		logger.Info("app", "Initializing default settings...")
		if err := settingsStore.Initialize(ctx); err != nil {
			return fmt.Errorf("failed to initialize settings: %w", err)
		}
		logger.Info("app", "Default settings initialized")
	}

	return nil
}

func (app *Application) startBackgroundTasks(tokenStore *store.PostgresTokenStore) {
	// Clean up expired tokens periodically
	go func() {
		ticker := time.NewTicker(time.Hour)
		defer ticker.Stop()

		for {
			select {
			case <-app.ctx.Done():
				return
			case <-ticker.C:
				ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
				if err := tokenStore.DeleteExpired(ctx); err != nil {
					app.Logger.Error("app", "Failed to cleanup expired tokens", err)
				}
				cancel()
			}
		}
	}()
}

func (app *Application) Close() error {
	app.Logger.Info("app", "Shutting down application")

	// Cancel context to stop background tasks
	app.cancel()

	// Wait a bit for background tasks to finish
	time.Sleep(2 * time.Second)

	if app.DB != nil {
		app.Logger.Info("app", "Closing database connection")
		if err := app.DB.Close(); err != nil {
			app.Logger.Error("app", "Error closing database", err)
		}
	}

	if app.Logger != nil {
		app.Logger.Info("app", "Application shutdown complete")
		return app.Logger.Close()
	}

	return nil
}
