package utils

import (
	"fisheye/internal/store"
	"fmt"
	"regexp"
	"time"
)

var timeFormatRegex = regexp.MustCompile(`^([0-1][0-9]|2[0-3]):[0-5][0-9]$`)

func GetCurrentSchedule(schedule map[string]store.DaySchedule) store.DaySchedule {
	days := []string{"sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"}
	today := days[time.Now().Weekday()]

	if daySchedule, ok := schedule[today]; ok {
		return daySchedule
	}

	return store.DaySchedule{Enabled: false}
}

func ValidateTimeFormat(timeStr string) error {
	if timeStr == "" {
		return nil // Empty is allowed for disabled schedules
	}

	if !timeFormatRegex.MatchString(timeStr) {
		return NewValidationError(fmt.Sprintf("invalid time format '%s', expected HH:MM (24-hour format)", timeStr))
	}

	return nil
}

func ValidateSchedule(schedule map[string]store.DaySchedule) error {
	validDays := map[string]bool{
		"monday": true, "tuesday": true, "wednesday": true, "thursday": true,
		"friday": true, "saturday": true, "sunday": true,
	}

	for day, daySchedule := range schedule {
		if !validDays[day] {
			return NewValidationError(fmt.Sprintf("invalid day '%s'", day))
		}

		if daySchedule.Enabled {
			if err := ValidateTimeFormat(daySchedule.Start); err != nil {
				return fmt.Errorf("%s start time: %w", day, err)
			}

			if err := ValidateTimeFormat(daySchedule.End); err != nil {
				return fmt.Errorf("%s end time: %w", day, err)
			}

			if daySchedule.Start == "" || daySchedule.End == "" {
				return NewValidationError(fmt.Sprintf("%s: start and end times required when enabled", day))
			}

			// Validate that start is before end
			if daySchedule.Start >= daySchedule.End {
				return NewValidationError(fmt.Sprintf("%s: start time must be before end time", day))
			}
		}
	}

	return nil
}
