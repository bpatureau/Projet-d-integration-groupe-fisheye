package utils

import (
	"errors"
	"regexp"
	"strings"
)

var emailRegex = regexp.MustCompile(`^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$`)

type ValidationError struct {
	Field   string `json:"field"`
	Message string `json:"message"`
}

type ValidationErrors []ValidationError

func (v ValidationErrors) Error() string {
	var msgs []string
	for _, err := range v {
		msgs = append(msgs, err.Field+": "+err.Message)
	}
	return strings.Join(msgs, ", ")
}

func ValidateEmail(email string) error {
	if email == "" {
		return errors.New("email is required")
	}
	if !emailRegex.MatchString(email) {
		return errors.New("invalid email format")
	}
	return nil
}

func ValidateUsername(username string) error {
	if username == "" {
		return errors.New("username is required")
	}
	if len(username) < 3 {
		return errors.New("username must be at least 3 characters")
	}
	if len(username) > 50 {
		return errors.New("username cannot exceed 50 characters")
	}
	return nil
}

func ValidatePassword(password string) error {
	if password == "" {
		return errors.New("password is required")
	}
	if len(password) < 8 {
		return errors.New("password must be at least 8 characters")
	}
	return nil
}

func ValidateRequired(value, fieldName string) error {
	if strings.TrimSpace(value) == "" {
		return errors.New(fieldName + " is required")
	}
	return nil
}

func ValidateVisitType(visitType string) error {
	validTypes := map[string]bool{
		"doorbell":      true,
		"voice_message": true,
		"knock":         true,
	}
	if !validTypes[visitType] {
		return errors.New("invalid visit type")
	}
	return nil
}

func ValidateVisitStatus(status string) error {
	validStatuses := map[string]bool{
		"answered":   true,
		"unanswered": true,
		"ignored":    true,
	}
	if !validStatuses[status] {
		return errors.New("invalid visit status")
	}
	return nil
}
