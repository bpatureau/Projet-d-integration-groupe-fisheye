package middleware

import (
	"context"
	"errors"
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
	AuthTypeBearer = "Bearer"
	AuthTypeApiKey = "ApiKey"
)

type Middleware struct {
	UserStore    store.UserStore
	Logger       *utils.Logger
	DeviceAPIKey string
}

func NewMiddleware(userStore store.UserStore, logger *utils.Logger) *Middleware {
	godotenv.Load()

	deviceAPIKey := os.Getenv("DEVICE_API_KEY")
	if deviceAPIKey == "" {
		logger.Warning("middleware", "DEVICE_API_KEY not configured - device authentication disabled")
	} else {
		logger.Info("middleware", "Device API authentication enabled")
	}

	return &Middleware{
		UserStore:    userStore,
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

func (m *Middleware) parseAuthHeader(authHeader string) (authType, authValue string, err error) {
	if authHeader == "" {
		return "", "", nil
	}

	parts := strings.Split(authHeader, " ")
	if len(parts) != 2 {
		return "", "", errors.New("invalid authorization header format")
	}

	return parts[0], parts[1], nil
}

func (m *Middleware) authenticateWithApiKey(apiKey string) (bool, error) {
	if m.DeviceAPIKey == "" {
		return false, errors.New("device API key not configured")
	}

	if apiKey != m.DeviceAPIKey {
		return false, errors.New("invalid API key")
	}

	return true, nil
}

func (m *Middleware) authenticateWithToken(token string) (*store.User, error) {
	user, err := m.UserStore.GetUserToken(tokens.ScopeAuth, token)
	if err != nil {
		return nil, err
	}

	if user == nil {
		return nil, errors.New("invalid or expired token")
	}

	return user, nil
}

func (m *Middleware) AuthenticateUser(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Add("Vary", "Authorization")

		authType, authValue, err := m.parseAuthHeader(r.Header.Get("Authorization"))
		if err != nil {
			m.Logger.Warning("middleware", err.Error())
			utils.WriteUnauthorized(w, err.Error())
			return
		}

		if authType == "" {
			r = SetUser(r, store.AnonymousUser)
			r = SetDevice(r, false)
			next.ServeHTTP(w, r)
			return
		}

		switch authType {
		case AuthTypeApiKey:
			m.handleApiKeyAuth(w, r, authValue, next)
		case AuthTypeBearer:
			m.handleBearerAuth(w, r, authValue, next)
		default:
			m.Logger.Warning("middleware", "Unknown auth type: "+authType)
			utils.WriteUnauthorized(w, "invalid authorization type")
		}
	})
}

func (m *Middleware) handleApiKeyAuth(w http.ResponseWriter, r *http.Request, apiKey string, next http.Handler) {
	isValid, err := m.authenticateWithApiKey(apiKey)

	if err != nil {
		if err.Error() == "device API key not configured" {
			m.Logger.Error("middleware", err.Error(), nil)
			utils.WriteInternalError(w)
		} else {
			m.Logger.Warning("middleware", "Invalid API key attempt")
			r = SetUser(r, store.AnonymousUser)
			r = SetDevice(r, false)
			next.ServeHTTP(w, r)
			return
		}
		return
	}

	if isValid {
		m.Logger.Debug("middleware", "Device authenticated successfully")
		r = SetUser(r, store.AnonymousUser)
		r = SetDevice(r, true)
		next.ServeHTTP(w, r)
	}
}

func (m *Middleware) handleBearerAuth(w http.ResponseWriter, r *http.Request, token string, next http.Handler) {
	user, err := m.authenticateWithToken(token)

	if err != nil {
		m.Logger.Warning("middleware", "Token validation failed: "+err.Error())
		r = SetUser(r, store.AnonymousUser)
		r = SetDevice(r, false)
		next.ServeHTTP(w, r)
		return
	}

	m.Logger.Debug("middleware", "User authenticated: "+user.Username)
	r = SetUser(r, user)
	r = SetDevice(r, false)
	next.ServeHTTP(w, r)
}

func (m *Middleware) RequireAuth(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		user := GetUser(r)
		isDevice := IsDevice(r)

		if !user.IsAnonymous() || isDevice {
			next.ServeHTTP(w, r)
			return
		}

		m.Logger.Warning("middleware", "Unauthorized access attempt to protected route")
		utils.WriteUnauthorized(w, "authentication required")
	})
}

func (m *Middleware) RequireAdmin(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		user := GetUser(r)

		if user.IsAnonymous() {
			m.Logger.Warning("middleware", "Anonymous user tried to access admin route")
			utils.WriteUnauthorized(w, "authentication required")
			return
		}

		if !user.IsAdmin() {
			m.Logger.Warning("middleware", "Non-admin user tried to access admin route: "+user.Username)
			utils.WriteForbidden(w, "admin access required")
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

		m.Logger.Warning("middleware", "Unauthorized access to device route")
		utils.WriteForbidden(w, "device or admin access required")
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
