package middleware

import (
	"context"
	"fmt"
	"net/http"
	"strings"
	"time"

	"fisheye/internal/store"
	"fisheye/internal/tokens"
	"fisheye/internal/utils"
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

func NewMiddleware(userStore store.UserStore, tokenStore store.TokenStore, deviceAPIKey string, logger *utils.Logger) *Middleware {
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
	ctx := r.Context()

	user, err := m.UserStore.GetByToken(ctx, token)
	if err != nil {
		m.Logger.Warning("middleware", "Token validation error: "+err.Error())
		utils.WriteUnauthorized(w, "Invalid or expired token")
		return
	}

	if user == nil {
		utils.WriteUnauthorized(w, "Invalid or expired token")
		return
	}

	// Extend token expiry asynchronously
	go func() {
		extCtx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer cancel()
		m.TokenStore.ExtendExpiry(extCtx, token, tokens.DefaultTTL)
	}()

	m.Logger.Debug("middleware", "User authenticated: "+user.Username)
	r = SetUser(r, user)
	r = SetDevice(r, false)
	next.ServeHTTP(w, r)
}

func (m *Middleware) authenticateWithApiKey(w http.ResponseWriter, r *http.Request, apiKey string, next http.Handler) {
	if apiKey != m.DeviceAPIKey {
		m.Logger.Warning("middleware", "Invalid API key attempt from: "+r.RemoteAddr)
		utils.WriteUnauthorized(w, "Invalid API key")
		return
	}

	m.Logger.Debug("middleware", "Device authenticated from: "+r.RemoteAddr)
	r = SetUser(r, store.AnonymousUser)
	r = SetDevice(r, true)
	next.ServeHTTP(w, r)
}

func (m *Middleware) RequireAuth(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		user := GetUser(r)
		isDevice := IsDevice(r)

		if user.IsAnonymous() && !isDevice {
			m.Logger.Warning("middleware", "Unauthorized access attempt to protected route")
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
			m.Logger.Warning("middleware", "Non-admin access attempt by: "+user.Username)
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
			m.Logger.Info("middleware", "Admin accessing device route: "+user.Username)
			next.ServeHTTP(w, r)
			return
		}

		m.Logger.Warning("middleware", "Unauthorized device route access from: "+r.RemoteAddr)
		utils.WriteForbidden(w, "Device authentication required")
	})
}

func (m *Middleware) LogRequest(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		user := GetUser(r)
		isDevice := IsDevice(r)

		var authInfo string
		if isDevice {
			authInfo = "device:" + r.RemoteAddr
		} else if !user.IsAnonymous() {
			authInfo = "user:" + user.Username
		} else {
			authInfo = "anonymous"
		}

		m.Logger.Info("request", fmt.Sprintf("%s %s [%s] from %s",
			r.Method,
			r.URL.Path,
			authInfo,
			r.RemoteAddr))

		next.ServeHTTP(w, r)
	})
}
