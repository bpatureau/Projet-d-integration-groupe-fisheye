package middleware

import (
	"context"
	"net/http"
	"os"
	"strings"

	"fisheye/internal/store"
	"fisheye/internal/tokens"
	"fisheye/internal/utils"

	"github.com/joho/godotenv"
)

type contextKey string

const (
	UserContextKey = contextKey("user")
	IsDeviceKey    = contextKey("is_device")
)

type Middleware struct {
	UserStore    store.UserStore
	TokenStore   store.TokenStore
	Logger       *utils.Logger
	DeviceAPIKey string
}

func NewMiddleware(userStore store.UserStore, tokenStore store.TokenStore, logger *utils.Logger) *Middleware {
	godotenv.Load()

	deviceAPIKey := os.Getenv("DEVICE_API_KEY")
	if deviceAPIKey == "" {
		logger.Warning("middleware", "DEVICE_API_KEY not configured")
	}

	return &Middleware{
		UserStore:    userStore,
		TokenStore:   tokenStore,
		Logger:       logger,
		DeviceAPIKey: deviceAPIKey,
	}
}

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
			utils.WriteUnauthorized(w, "Invalid authorization header format")
			return
		}

		switch headerParts[0] {
		case "Bearer":
			m.authenticateWithToken(w, r, headerParts[1], next)
		case "ApiKey":
			m.authenticateWithApiKey(w, r, headerParts[1], next)
		default:
			m.Logger.Warning("middleware", "Unknown auth type: "+headerParts[0])
			utils.WriteUnauthorized(w, "Invalid authorization type")
		}
	})
}

func (m *Middleware) authenticateWithToken(w http.ResponseWriter, r *http.Request, token string, next http.Handler) {
	user, err := m.UserStore.GetUserByToken(token)
	if err != nil {
		m.Logger.Warning("middleware", "Token validation error: "+err.Error())
		utils.WriteUnauthorized(w, "Invalid or expired token")
		return
	}

	if user == nil {
		utils.WriteUnauthorized(w, "Invalid or expired token")
		return
	}

	go m.TokenStore.ExtendTokenExpiry(token, tokens.DefaultTTL)

	m.Logger.Debug("middleware", "User authenticated: "+user.Username)
	r = SetUser(r, user)
	r = SetDevice(r, false)
	next.ServeHTTP(w, r)
}

func (m *Middleware) authenticateWithApiKey(w http.ResponseWriter, r *http.Request, apiKey string, next http.Handler) {
	if m.DeviceAPIKey == "" {
		m.Logger.Error("middleware", "Device API key not configured", nil)
		utils.WriteInternalError(w)
		return
	}

	if apiKey != m.DeviceAPIKey {
		m.Logger.Warning("middleware", "Invalid API key attempt")
		utils.WriteUnauthorized(w, "Invalid API key")
		return
	}

	m.Logger.Debug("middleware", "Device authenticated")
	r = SetUser(r, store.AnonymousUser)
	r = SetDevice(r, true)
	next.ServeHTTP(w, r)
}

func (m *Middleware) RequireAuth(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		user := GetUser(r)
		isDevice := IsDevice(r)

		if user.IsAnonymous() && !isDevice {
			m.Logger.Warning("middleware", "Unauthorized access attempt")
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
			m.Logger.Warning("middleware", "Anonymous access to admin route")
			utils.WriteUnauthorized(w, "Authentication required")
			return
		}

		if !user.IsAdmin() {
			m.Logger.Warning("middleware", "Non-admin access attempt: "+user.Username)
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
			m.Logger.Debug("middleware", "Admin accessing device route: "+user.Username)
			next.ServeHTTP(w, r)
			return
		}

		m.Logger.Warning("middleware", "Unauthorized device route access")
		utils.WriteForbidden(w, "Device or admin access required")
	})
}

func (m *Middleware) LogRequest(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		user := GetUser(r)
		isDevice := IsDevice(r)

		var authInfo string
		if isDevice {
			authInfo = "device"
		} else if !user.IsAnonymous() {
			authInfo = "user:" + user.Username
		} else {
			authInfo = "anonymous"
		}

		m.Logger.Info("request", r.Method+" "+r.URL.Path+" ["+authInfo+"]")
		next.ServeHTTP(w, r)
	})
}
