package routes

import (
	"fisheye/internal/app"

	"github.com/go-chi/chi/v5"
	"github.com/go-chi/chi/v5/middleware"
)

func SetupRoutes(app *app.Application) *chi.Mux {
	router := chi.NewRouter()

	// Middleware global
	router.Use(middleware.Recoverer)

	// Routes publiques
	router.Get("/health", app.HealthCheck)
	router.Post("/auth/register", app.AuthHandler.HandleRegister)
	router.Post("/auth/login", app.AuthHandler.HandleLogin)
	router.Post("/auth/refresh", app.AuthHandler.HandleRefreshToken)

	// Authentifié uniquement
	router.Group(func(r chi.Router) {
		r.Use(app.Middleware.AuthenticateUser)
		r.Use(app.Middleware.LogRequest)
		r.Use(app.Middleware.RequireAuth)

		r.Get("/auth/me", app.AuthHandler.HandleMe)
		r.Post("/auth/logout", app.AuthHandler.HandleLogout)
		r.Post("/auth/change-password", app.AuthHandler.HandleChangePassword)
		r.Delete("/auth/account", app.AuthHandler.HandleDeleteAccount)

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
		r.Use(app.Middleware.AuthenticateUser)
		r.Use(app.Middleware.LogRequest)
		r.Use(app.Middleware.RequireAdmin)

		// Gestion des utilisateurs
		r.Get("/users", app.UserHandler.HandleListUsers)
		r.Get("/users/{id}", app.UserHandler.HandleGetUser)
		r.Post("/users", app.UserHandler.HandleCreateUser)
		r.Patch("/users/{id}", app.UserHandler.HandleUpdateUser)
		r.Delete("/users/{id}", app.UserHandler.HandleDeleteUser)
		r.Post("/users/{id}/reset-password", app.UserHandler.HandleResetUserPassword)

		// Statistiques des visites
		r.Get("/visits/stats", app.VisitHandler.HandleGetStatistics)
	})

	// Raspberry Pi uniquement
	router.Group(func(r chi.Router) {
		r.Use(app.Middleware.AuthenticateUser)
		r.Use(app.Middleware.LogRequest)
		r.Use(app.Middleware.RequireDevice)

		r.Post("/visits", app.VisitHandler.HandleCreateVisit)
	})

	return router
}
