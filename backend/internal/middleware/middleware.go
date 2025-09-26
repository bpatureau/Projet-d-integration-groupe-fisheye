package middleware

import (
	"context"
	"net/http"
	"strings"

	"fisheye/internal/store"
	"fisheye/internal/tokens"
	"fisheye/internal/utils"
)

type Middleware struct {
	UserStore store.UserStore
	Logger    *utils.Logger
}

func NewMiddleware(userStore store.UserStore, logger *utils.Logger) *Middleware {
	return &Middleware{
		UserStore: userStore,
		Logger:    logger,
	}
}

type contextKey string

const (
	UserContextKey   = contextKey("user")
	DeviceContextKey = contextKey("device")
)

func SetUser(r *http.Request, user *store.User) *http.Request {
	ctx := context.WithValue(r.Context(), UserContextKey, user)
	return r.WithContext(ctx)
}

func GetUser(r *http.Request) *store.User {
	user, ok := r.Context().Value(UserContextKey).(*store.User)
	if !ok {
		return store.AnonymousUser
	}
	return user
}

func (m *Middleware) AuthenticateUser(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Add("Vary", "Authorization")
		authHeader := r.Header.Get("Authorization")

		if authHeader == "" {
			r = SetUser(r, store.AnonymousUser)
			next.ServeHTTP(w, r)
			return
		}

		headerParts := strings.Split(authHeader, " ")
		if len(headerParts) != 2 || headerParts[0] != "Bearer" {
			m.Logger.Warning("middleware", "Invalid authorization header format")
			utils.WriteUnauthorized(w, "Invalid authorization header")
			return
		}

		token := headerParts[1]
		user, err := m.UserStore.GetUserToken(tokens.ScopeAuth, token)
		if err != nil {
			m.Logger.Error("middleware", "Failed to validate user token", err)
			utils.WriteUnauthorized(w, "Invalid token")
			return
		}

		if user == nil {
			utils.WriteUnauthorized(w, "Token expired or invalid")
			return
		}

		r = SetUser(r, user)
		next.ServeHTTP(w, r)
	})
}

func (m *Middleware) RequireAuth(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		user := GetUser(r)
		if user.IsAnonymous() {
			utils.WriteUnauthorized(w, "Authentication required")
			return
		}
		next.ServeHTTP(w, r)
	})
}

func (m *Middleware) RequireAdmin(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		user := GetUser(r)
		if user.IsAnonymous() {
			utils.WriteUnauthorized(w, "Authentication required")
			return
		}
		if !user.IsAdmin() {
			utils.WriteForbidden(w, "Admin access required")
			return
		}
		next.ServeHTTP(w, r)
	})
}

func (m *Middleware) RequireDevice(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		user := GetUser(r)
		if user.IsAnonymous() {
			utils.WriteUnauthorized(w, "Authentication required")
			return
		}
		if !user.IsDevice() && !user.IsAdmin() {
			utils.WriteForbidden(w, "Device access required")
			return
		}
		next.ServeHTTP(w, r)
	})
}

type responseWriter struct {
	http.ResponseWriter
	statusCode int
}

func (rw *responseWriter) WriteHeader(code int) {
	rw.statusCode = code
	rw.ResponseWriter.WriteHeader(code)
}
