package routes

import (
	"fisheye/internal/app"

	"github.com/go-chi/chi/v5"
	"github.com/go-chi/chi/v5/middleware"
)

func SetupRoutes(app *app.Application) *chi.Mux {
	router := chi.NewRouter()

	// Middleware global
	router.Use(middleware.Logger)
	router.Use(middleware.Recoverer)
	router.Use(app.Middleware.AuthenticateUser)

	// Routes publiques
	router.Get("/health", app.HealthCheck)
	router.Post("/auth/register", app.AuthHandler.HandleRegister)
	router.Post("/auth/login", app.AuthHandler.HandleLogin)

	// Authentifié uniquement
	router.Group(func(r chi.Router) {
		r.Use(app.Middleware.RequireAuth)
		r.Get("/auth/me", app.AuthHandler.HandleMe)
	})

	// Admin uniquement
	router.Group(func(r chi.Router) {
		r.Use(app.Middleware.RequireAdmin)
	})

	// Raspberry Pi uniquement
	router.Group(func(r chi.Router) {
		r.Use(app.Middleware.RequireDevice)
	})

	return router
}
