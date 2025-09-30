package utils

import (
	"encoding/json"
	"net/http"
)

type APIResponse struct {
	Success bool      `json:"success"`
	Data    any       `json:"data,omitempty"`
	Error   *APIError `json:"error,omitempty"`
	Meta    any       `json:"meta,omitempty"`
}

type APIError struct {
	Code    string `json:"code"`
	Message string `json:"message"`
}

type PaginationMeta struct {
	Limit  int `json:"limit"`
	Offset int `json:"offset"`
	Total  int `json:"total,omitempty"`
}

func WriteSuccess(w http.ResponseWriter, status int, data any) {
	WriteResponse(w, status, APIResponse{
		Success: true,
		Data:    data,
	})
}

func WriteSuccessWithMeta(w http.ResponseWriter, status int, data any, meta any) {
	WriteResponse(w, status, APIResponse{
		Success: true,
		Data:    data,
		Meta:    meta,
	})
}

func WriteError(w http.ResponseWriter, status int, code, message string) {
	WriteResponse(w, status, APIResponse{
		Success: false,
		Error: &APIError{
			Code:    code,
			Message: message,
		},
	})
}

func WriteValidationError(w http.ResponseWriter, message string) {
	WriteError(w, http.StatusBadRequest, "VALIDATION_ERROR", message)
}

func WriteInternalError(w http.ResponseWriter) {
	WriteError(w, http.StatusInternalServerError, "INTERNAL_ERROR", "Internal server error")
}

func WriteUnauthorized(w http.ResponseWriter, message string) {
	WriteError(w, http.StatusUnauthorized, "UNAUTHORIZED", message)
}

func WriteForbidden(w http.ResponseWriter, message string) {
	WriteError(w, http.StatusForbidden, "FORBIDDEN", message)
}

func WriteNotFound(w http.ResponseWriter, message string) {
	WriteError(w, http.StatusNotFound, "NOT_FOUND", message)
}

func WriteRateLimitExceeded(w http.ResponseWriter, message string) {
	WriteError(w, http.StatusTooManyRequests, "RATE_LIMIT", message)
}

func WriteResponse(w http.ResponseWriter, status int, response APIResponse) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	json.NewEncoder(w).Encode(response)
}
