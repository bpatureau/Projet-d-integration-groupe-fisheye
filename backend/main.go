package main

import (
	"context"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"fisheye/internal/app"
)

func main() {
	application, err := app.NewApplication()
	if err != nil {
		panic(err)
	}
	defer application.Close()

	server := &http.Server{
		Addr:         ":8080",
		IdleTimeout:  time.Minute,
		ReadTimeout:  10 * time.Second,
		WriteTimeout: 30 * time.Second,
	}

	// Graceful shutdown
	go func() {
		application.Logger.Info("server", "Starting server on :8080")
		if err := server.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			application.Logger.Error("server", "Server failed to start", err)
			os.Exit(1)
		}
	}()

	// Attendre signal d'arrêt
	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit

	application.Logger.Info("server", "Shutting down server")
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	if err := server.Shutdown(ctx); err != nil {
		application.Logger.Error("server", "Server forced to shutdown", err)
	}

	application.Logger.Info("server", "Server stopped")
}
