package routes

import (
	"fisheye/internal/app"
	"fisheye/internal/middleware"

	"github.com/go-chi/chi/v5"
	chiMiddleware "github.com/go-chi/chi/v5/middleware"
	"golang.org/x/time/rate"
)

func SetupRoutes(app *app.Application) *chi.Mux {
	router := chi.NewRouter()

	// Global middleware
	router.Use(chiMiddleware.Recoverer)
	router.Use(chiMiddleware.RequestID)
	router.Use(chiMiddleware.RealIP)
	router.Use(chiMiddleware.Logger)

	// Rate limiter for auth endpoints (10 requests per minute)
	authLimiter := middleware.NewRateLimiter(rate.Limit(10.0/60.0), 5, app.Logger)

	router.Route("/api", func(r chi.Router) {
		// Health check
		r.Get("/health", app.HealthHandler.HandleHealth)

		// Authentication
		r.Route("/auth", func(r chi.Router) {
			r.Use(authLimiter.StrictLimit)
			r.Post("/login", app.AuthHandler.Login)
		})

		// Device endpoints (doorbell only)
		r.Route("/device", func(r chi.Router) {
			r.Use(app.Middleware.AuthenticateUser)
			r.Use(app.Middleware.LogRequest)
			r.Use(app.Middleware.RequireDevice)

			r.Post("/ring", app.DeviceHandler.Ring)
			r.Post("/visits/{id}/message", app.DeviceHandler.AddMessage)
			r.Post("/visits/{id}/answer", app.DeviceHandler.AnswerVisit)
			r.Get("/settings", app.DeviceHandler.GetSettings)
		})

		// User endpoints (authenticated users)
		r.Group(func(r chi.Router) {
			r.Use(app.Middleware.AuthenticateUser)
			r.Use(app.Middleware.LogRequest)
			r.Use(app.Middleware.RequireAuth)

			// Auth
			r.Post("/auth/logout", app.AuthHandler.Logout)

			// Profile management
			r.Route("/profile", func(r chi.Router) {
				r.Get("/", app.ProfileHandler.Get)
				r.Put("/", app.ProfileHandler.Update)
				r.Post("/password", app.ProfileHandler.ChangePassword)
			})

			// Visits
			r.Route("/visits", func(r chi.Router) {
				r.Get("/", app.VisitHandler.List)
				r.Get("/stats", app.VisitHandler.GetStats)
				r.Get("/{id}", app.VisitHandler.GetByID)
				r.Patch("/{id}", app.VisitHandler.Update)
				r.Get("/{id}/message", app.VisitHandler.DownloadMessage)

				// Admin only
				r.With(app.Middleware.RequireAdmin).Delete("/{id}", app.VisitHandler.Delete)
			})

			// Settings (read for all, write for admin)
			r.Route("/settings", func(r chi.Router) {
				r.Get("/", app.SettingsHandler.Get)
				r.With(app.Middleware.RequireAdmin).Put("/", app.SettingsHandler.Update)
			})
		})

		// Admin endpoints
		r.Route("/admin", func(r chi.Router) {
			r.Use(app.Middleware.AuthenticateUser)
			r.Use(app.Middleware.LogRequest)
			r.Use(app.Middleware.RequireAdmin)

			// User management
			r.Route("/users", func(r chi.Router) {
				r.Get("/", app.AdminHandler.ListUsers)
				r.Post("/", app.AdminHandler.CreateUser)
				r.Get("/{id}", app.AdminHandler.GetUser)
				r.Put("/{id}", app.AdminHandler.UpdateUser)
				r.Delete("/{id}", app.AdminHandler.DeleteUser)
				r.Post("/{id}/password", app.AdminHandler.ResetPassword)
			})

			// System logs
			r.Route("/logs", func(r chi.Router) {
				r.Get("/", app.AdminHandler.ListLogs)
				r.Delete("/", app.AdminHandler.ClearOldLogs)
			})
		})
	})

	return router
}
