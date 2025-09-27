package middleware

import (
	"context"
	"net/http"
	"os"
	"strings"

	"fisheye/internal/store"
	"fisheye/internal/tokens"
	"fisheye/internal/utils"
)

type Middleware struct {
	UserStore    store.UserStore
	Logger       *utils.Logger
	DeviceAPIKey string
}

func NewMiddleware(userStore store.UserStore, logger *utils.Logger) *Middleware {
	return &Middleware{
		UserStore:    userStore,
		Logger:       logger,
		DeviceAPIKey: os.Getenv("DEVICE_API_KEY"),
	}
}

type contextKey string

const (
	UserContextKey = contextKey("user")
	IsDeviceKey    = contextKey("is_device")
)

func SetUser(r *http.Request, user *store.User) *http.Request {
	ctx := context.WithValue(r.Context(), UserContextKey, user)
	return r.WithContext(ctx)
}

func SetDevice(r *http.Request, isDevice bool) *http.Request {
	ctx := context.WithValue(r.Context(), IsDeviceKey, isDevice)
	return r.WithContext(ctx)
}

func GetUser(r *http.Request) *store.User {
	user, ok := r.Context().Value(UserContextKey).(*store.User)
	if !ok {
		return store.AnonymousUser
	}
	return user
}

func IsDevice(r *http.Request) bool {
	isDevice, ok := r.Context().Value(IsDeviceKey).(bool)
	return ok && isDevice
}

func (m *Middleware) AuthenticateUser(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Add("Vary", "Authorization")
		authHeader := r.Header.Get("Authorization")

		if authHeader == "" {
			r = SetUser(r, store.AnonymousUser)
			r = SetDevice(r, false)
			next.ServeHTTP(w, r)
			return
		}

		headerParts := strings.Split(authHeader, " ")
		if len(headerParts) != 2 {
			m.Logger.Warning("middleware", "Invalid authorization header format")
			utils.WriteUnauthorized(w, "Invalid authorization header")
			return
		}

		// Vérifier si c'est une clé API device
		if headerParts[0] == "ApiKey" {
			if m.DeviceAPIKey == "" {
				m.Logger.Error("middleware", "DEVICE_API_KEY not configured", nil)
				utils.WriteInternalError(w)
				return
			}

			if headerParts[1] == m.DeviceAPIKey {
				// C'est le device authentifié
				r = SetUser(r, store.AnonymousUser) // Pas d'utilisateur spécifique
				r = SetDevice(r, true)
				next.ServeHTTP(w, r)
				return
			} else {
				utils.WriteUnauthorized(w, "Invalid API key")
				return
			}
		}

		// Sinon, c'est un token Bearer classique
		if headerParts[0] != "Bearer" {
			m.Logger.Warning("middleware", "Invalid authorization type")
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
		r = SetDevice(r, false)
		next.ServeHTTP(w, r)
	})
}

func (m *Middleware) RequireAuth(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		user := GetUser(r)
		if user.IsAnonymous() && !IsDevice(r) {
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
		if IsDevice(r) {
			next.ServeHTTP(w, r)
			return
		}

		user := GetUser(r)
		if !user.IsAnonymous() && user.IsAdmin() {
			next.ServeHTTP(w, r)
			return
		}

		utils.WriteForbidden(w, "Device or admin access required")
	})
}
