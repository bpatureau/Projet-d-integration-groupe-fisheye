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
	router.Use(middleware.RequestID)
	router.Use(middleware.RealIP)

	router.Route("/api", func(r chi.Router) {
		r.Get("/health", app.HealthCheck)

		r.Route("/auth", func(r chi.Router) {
			r.Post("/register", app.AuthHandler.HandleRegister)
			r.Post("/login", app.AuthHandler.HandleLogin)
		})

		r.Route("/profile", func(r chi.Router) {
			r.Use(app.Middleware.AuthenticateUser)
			r.Use(app.Middleware.LogRequest)
			r.Use(app.Middleware.RequireAuth)

			r.Get("/", app.ProfileHandler.HandleGetProfile)
			r.Put("/", app.ProfileHandler.HandleUpdateProfile)
			r.Post("/change-password", app.ProfileHandler.HandleChangePassword)
			r.Delete("/", app.ProfileHandler.HandleDeleteAccount)
			r.Post("/logout", app.ProfileHandler.HandleLogout)
		})

		r.Route("/visits", func(r chi.Router) {
			r.Use(app.Middleware.AuthenticateUser)
			r.Use(app.Middleware.LogRequest)

			r.Group(func(r chi.Router) {
				r.Use(app.Middleware.RequireDevice)
				r.Post("/", app.VisitHandler.HandleCreateVisit)
			})

			r.Group(func(r chi.Router) {
				r.Use(app.Middleware.RequireAuth)
				r.Get("/", app.VisitHandler.HandleListVisits)
				r.Get("/stats", app.VisitHandler.HandleGetStatistics)
				r.Get("/voice-messages", app.VoiceMessageHandler.ListVoiceMessages)
				r.Get("/{id}", app.VisitHandler.HandleGetVisit)
				r.Patch("/{id}/status", app.VisitHandler.HandleUpdateVisitStatus)
				r.Post("/{id}/respond", app.VisitHandler.HandleRespondToVisit)

				r.Route("/{id}/voice-messages", func(r chi.Router) {
					r.Get("/", app.VoiceMessageHandler.ListByVisit)
					r.Post("/", app.VoiceMessageHandler.Upload)
					r.Get("/{messageId}", app.VoiceMessageHandler.Download)
					r.Patch("/{messageId}/listen", app.VoiceMessageHandler.MarkAsListened)
					r.Delete("/{messageId}", app.VoiceMessageHandler.DeleteVoiceMessage)
				})
			})
		})

		r.Route("/admin", func(r chi.Router) {
			r.Use(app.Middleware.AuthenticateUser)
			r.Use(app.Middleware.LogRequest)
			r.Use(app.Middleware.RequireAdmin)

			r.Route("/users", func(r chi.Router) {
				r.Get("/", app.AdminHandler.HandleListUsers)
				r.Post("/", app.AdminHandler.HandleCreateUser)
				r.Get("/{id}", app.AdminHandler.HandleGetUser)
				r.Put("/{id}", app.AdminHandler.HandleUpdateUser)
				r.Delete("/{id}", app.AdminHandler.HandleDeleteUser)
				r.Post("/{id}/reset-password", app.AdminHandler.HandleResetUserPassword)
			})

			r.Route("/settings", func(r chi.Router) {
				r.Get("/", app.SettingsHandler.HandleGetSettings)
				r.Put("/", app.SettingsHandler.HandleUpdateSettings)
				r.Post("/toggle-dnd", app.SettingsHandler.HandleToggleDND)
				r.Put("/schedule", app.SettingsHandler.HandleUpdateSchedule)
				r.Put("/motd", app.SettingsHandler.HandleUpdateMOTD)
			})

			r.Route("/stats", func(r chi.Router) {
				r.Get("/visits", app.AdminHandler.HandleGetVisitStatistics)
			})

			r.Route("/logs", func(r chi.Router) {
				r.Get("/", app.AdminHandler.HandleListSystemLogs)
				r.Delete("/", app.AdminHandler.HandleClearLogs)
			})
		})
	})

	return router
}
