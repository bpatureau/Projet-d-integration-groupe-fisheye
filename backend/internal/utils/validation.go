package utils

import (
	"errors"
	"fmt"
	"regexp"
	"strings"
)

var emailRegex = regexp.MustCompile(`^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$`)

func NewValidationError(message string) error {
	return errors.New(message)
}

func ValidateEmail(email string) error {
	if email == "" {
		return NewValidationError("email is required")
	}
	if !emailRegex.MatchString(email) {
		return NewValidationError("invalid email format")
	}
	return nil
}

func ValidateUsername(username string) error {
	if username == "" {
		return NewValidationError("username is required")
	}
	if len(username) < 3 {
		return NewValidationError("username must be at least 3 characters")
	}
	if len(username) > 50 {
		return NewValidationError("username cannot exceed 50 characters")
	}
	return nil
}

func ValidatePassword(password string) error {
	if password == "" {
		return NewValidationError("password is required")
	}
	if len(password) < 8 {
		return NewValidationError("password must be at least 8 characters")
	}
	if len(password) > 128 {
		return NewValidationError("password cannot exceed 128 characters")
	}
	return nil
}

func ValidateRequired(value, fieldName string) error {
	if strings.TrimSpace(value) == "" {
		return NewValidationError(fmt.Sprintf("%s is required", fieldName))
	}
	return nil
}
