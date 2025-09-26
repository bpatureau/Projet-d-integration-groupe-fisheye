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

		// Routes des visites
		r.Get("/visits", app.VisitHandler.HandleListVisits)
		r.Get("/visits/recent", app.VisitHandler.HandleGetRecentVisits)
		r.Get("/visits/unresponded", app.VisitHandler.HandleGetUnrespondedVisits)
		r.Get("/visits/{id}", app.VisitHandler.HandleGetVisit)
		r.Patch("/visits/{id}/status", app.VisitHandler.HandleUpdateVisitStatus)
		r.Post("/visits/{id}/respond", app.VisitHandler.HandleRespondToVisit)
	})

	// Admin uniquement
	router.Group(func(r chi.Router) {
		r.Use(app.Middleware.RequireAdmin)
		r.Get("/visits/stats", app.VisitHandler.HandleGetStatistics)
	})

	// Raspberry Pi uniquement
	router.Group(func(r chi.Router) {
		r.Use(app.Middleware.RequireDevice)
		r.Post("/visits", app.VisitHandler.HandleCreateVisit)
	})

	return router
}
