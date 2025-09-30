package api

import (
	"context"
	"database/sql"
	"net/http"
	"time"

	"fisheye/internal/utils"
)

type HealthHandler struct {
	db *sql.DB
}

func NewHealthHandler(db *sql.DB) *HealthHandler {
	return &HealthHandler{
		db: db,
	}
}

func (h *HealthHandler) HandleHealth(w http.ResponseWriter, r *http.Request) {
	ctx, cancel := context.WithTimeout(r.Context(), 5*time.Second)
	defer cancel()

	err := h.db.PingContext(ctx)

	if err != nil {
		health := map[string]any{
			"status":  "unhealthy",
			"message": "Database connection failed",
		}
		utils.WriteSuccess(w, http.StatusServiceUnavailable, health)
		return
	}

	health := map[string]any{
		"status":    "healthy",
		"message":   "All systems operational",
		"timestamp": time.Now().Unix(),
	}
	utils.WriteSuccess(w, http.StatusOK, health)
}
