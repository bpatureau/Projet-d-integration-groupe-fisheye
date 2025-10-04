package calendar

import (
	"context"
	"fmt"
	"os"
	"sync"
	"time"

	"fisheye/internal/utils"

	"golang.org/x/oauth2/google"
	"google.golang.org/api/calendar/v3"
	"google.golang.org/api/option"
)

type CalendarEvent struct {
	ID        string    `json:"id"`
	Summary   string    `json:"summary"`
	StartTime time.Time `json:"start_time"`
	EndTime   time.Time `json:"end_time"`
	AllDay    bool      `json:"all_day"`
}

type CalendarService struct {
	client     *calendar.Service
	calendarID string
	cache      *EventCache
	logger     *utils.Logger
	mu         sync.RWMutex
}

type EventCache struct {
	events     []*CalendarEvent
	lastSync   time.Time
	syncPeriod time.Duration
	mu         sync.RWMutex
}

func NewCalendarService(credentialsPath, calendarID string, logger *utils.Logger) (*CalendarService, error) {
	ctx := context.Background()

	credentialsJSON, err := os.ReadFile(credentialsPath)
	if err != nil {
		return nil, fmt.Errorf("unable to read credentials file: %w", err)
	}

	config, err := google.JWTConfigFromJSON(credentialsJSON, calendar.CalendarReadonlyScope)
	if err != nil {
		return nil, fmt.Errorf("unable to parse credentials: %w", err)
	}

	client := config.Client(ctx)
	calendarService, err := calendar.NewService(ctx, option.WithHTTPClient(client))
	if err != nil {
		return nil, fmt.Errorf("unable to create calendar service: %w", err)
	}

	service := &CalendarService{
		client:     calendarService,
		calendarID: calendarID,
		logger:     logger,
		cache: &EventCache{
			events:     []*CalendarEvent{},
			syncPeriod: 5 * time.Minute,
		},
	}

	if err := service.SyncEvents(); err != nil {
		logger.Warning("calendar", "Initial sync failed: "+err.Error())
	}

	go service.startBackgroundSync()

	return service, nil
}

func (s *CalendarService) SyncEvents() error {
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	now := time.Now()
	endTime := now.AddDate(0, 0, 7)

	events, err := s.client.Events.List(s.calendarID).
		ShowDeleted(false).
		SingleEvents(true).
		TimeMin(now.Format(time.RFC3339)).
		TimeMax(endTime.Format(time.RFC3339)).
		OrderBy("startTime").
		Context(ctx).
		Do()

	if err != nil {
		return fmt.Errorf("failed to fetch calendar events: %w", err)
	}

	calendarEvents := make([]*CalendarEvent, 0)
	for _, event := range events.Items {
		var startTime, endTime time.Time
		var allDay bool

		if event.Start.DateTime != "" {
			startTime, _ = time.Parse(time.RFC3339, event.Start.DateTime)
			endTime, _ = time.Parse(time.RFC3339, event.End.DateTime)
			allDay = false
		} else if event.Start.Date != "" {
			startTime, _ = time.Parse("2006-01-02", event.Start.Date)
			endTime, _ = time.Parse("2006-01-02", event.End.Date)
			allDay = true
		} else {
			continue
		}

		calendarEvents = append(calendarEvents, &CalendarEvent{
			ID:        event.Id,
			Summary:   event.Summary,
			StartTime: startTime,
			EndTime:   endTime,
			AllDay:    allDay,
		})
	}

	s.cache.mu.Lock()
	s.cache.events = calendarEvents
	s.cache.lastSync = time.Now()
	s.cache.mu.Unlock()

	s.logger.Info("calendar", fmt.Sprintf("Synced %d events from calendar", len(calendarEvents)))
	return nil
}

func (s *CalendarService) IsAvailable() bool {
	now := time.Now()

	s.cache.mu.RLock()
	defer s.cache.mu.RUnlock()

	for _, event := range s.cache.events {
		if now.After(event.StartTime) && now.Before(event.EndTime) {
			return true
		}
	}

	return false
}

func (s *CalendarService) GetCurrentEvent() *CalendarEvent {
	now := time.Now()

	s.cache.mu.RLock()
	defer s.cache.mu.RUnlock()

	for _, event := range s.cache.events {
		if now.After(event.StartTime) && now.Before(event.EndTime) {
			return event
		}
	}

	return nil
}

func (s *CalendarService) GetUpcomingEvents(within time.Duration) []*CalendarEvent {
	now := time.Now()
	cutoff := now.Add(within)

	s.cache.mu.RLock()
	defer s.cache.mu.RUnlock()

	upcoming := make([]*CalendarEvent, 0)
	for _, event := range s.cache.events {
		if event.StartTime.After(now) && event.StartTime.Before(cutoff) {
			upcoming = append(upcoming, event)
		}
	}

	return upcoming
}

func (s *CalendarService) GetCachedEvents() []*CalendarEvent {
	s.cache.mu.RLock()
	defer s.cache.mu.RUnlock()

	events := make([]*CalendarEvent, len(s.cache.events))
	copy(events, s.cache.events)
	return events
}

func (s *CalendarService) GetLastSyncTime() time.Time {
	s.cache.mu.RLock()
	defer s.cache.mu.RUnlock()
	return s.cache.lastSync
}

func (s *CalendarService) startBackgroundSync() {
	ticker := time.NewTicker(s.cache.syncPeriod)
	defer ticker.Stop()

	for range ticker.C {
		if err := s.SyncEvents(); err != nil {
			s.logger.Error("calendar", "Background sync failed", err)
		}
	}
}

func (s *CalendarService) TestConnection() error {
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	_, err := s.client.CalendarList.Get(s.calendarID).Context(ctx).Do()
	if err != nil {
		return fmt.Errorf("failed to access calendar: %w", err)
	}

	return nil
}
