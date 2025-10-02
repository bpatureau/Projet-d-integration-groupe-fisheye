package main

import (
	"context"
	"fisheye/internal/app"
	"fisheye/internal/routes"
	"fmt"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"
)

func main() {
	application, err := app.NewApplication()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Failed to initialize application: %v\n", err)
		os.Exit(1)
	}
	defer func() {
		if err := application.Close(); err != nil {
			fmt.Fprintf(os.Stderr, "Error during shutdown: %v\n", err)
		}
	}()

	if err := runServer(application); err != nil {
		application.Logger.Error("main", "Server error", err)
		os.Exit(1)
	}
}

func runServer(application *app.Application) error {
	// Get server address from environment variable or use default
	addr := os.Getenv("SERVER_HOST")
	if addr == "" {
		addr = "0.0.0.0:8080"
	}

	router := routes.SetupRoutes(application)

	server := &http.Server{
		Addr:           addr,
		Handler:        router,
		IdleTimeout:    time.Minute,
		ReadTimeout:    10 * time.Second,
		WriteTimeout:   30 * time.Second,
		MaxHeaderBytes: 1 << 20, // 1 MB
	}

	serverErrors := make(chan error, 1)

	go func() {
		application.Logger.Info("server", fmt.Sprintf("Starting server on %s", addr))
		fmt.Printf("\n🚀 Server starting on %s\n", addr)
		fmt.Printf("📝 Default admin credentials: admin / admin\n\n")
		serverErrors <- server.ListenAndServe()
	}()

	shutdown := make(chan os.Signal, 1)
	signal.Notify(shutdown, os.Interrupt, syscall.SIGTERM, syscall.SIGINT)

	select {
	case err := <-serverErrors:
		if err != nil && err != http.ErrServerClosed {
			return fmt.Errorf("server error: %w", err)
		}

	case sig := <-shutdown:
		application.Logger.Info("server", fmt.Sprintf("Received signal: %v", sig))
		fmt.Printf("\n⚠️  Shutdown signal received: %v\n", sig)

		ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
		defer cancel()

		application.Logger.Info("server", "Starting graceful shutdown")
		if err := server.Shutdown(ctx); err != nil {
			application.Logger.Error("server", "Graceful shutdown failed, forcing shutdown", err)
			if err := server.Close(); err != nil {
				return fmt.Errorf("forced shutdown failed: %w", err)
			}
		}

		application.Logger.Info("server", "Server stopped successfully")
		fmt.Println("✅ Server stopped successfully")
	}

	return nil
}
