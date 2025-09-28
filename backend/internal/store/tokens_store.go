package store

import (
	"crypto/sha256"
	"database/sql"
	"fisheye/internal/tokens"
	"time"

	"github.com/google/uuid"
)

type PostgresTokenStore struct {
	db *sql.DB
}

func NewPostgresTokenStore(db *sql.DB) *PostgresTokenStore {
	return &PostgresTokenStore{db: db}
}

type TokenStore interface {
	CreateNewToken(userID uuid.UUID, ttl time.Duration) (*tokens.Token, error)
	GetToken(tokenPlaintext string) (*tokens.Token, error)
	DeleteToken(tokenPlaintext string) error
	DeleteExpiredTokens() error
	DeleteAllTokensForUser(userID uuid.UUID, exceptToken *string) error
	ExtendTokenExpiry(tokenPlaintext string, ttl time.Duration) error
}

func (s *PostgresTokenStore) CreateNewToken(userID uuid.UUID, ttl time.Duration) (*tokens.Token, error) {
	token, err := tokens.GenerateToken(userID, ttl)
	if err != nil {
		return nil, err
	}

	query := `
		INSERT INTO tokens (hash, user_id, expiry)
		VALUES ($1, $2, $3)
	`
	_, err = s.db.Exec(query, token.Hash, token.UserID, token.Expiry)

	return token, err
}

func (s *PostgresTokenStore) GetToken(tokenPlaintext string) (*tokens.Token, error) {
	tokenHash := sha256.Sum256([]byte(tokenPlaintext))

	query := `
		SELECT hash, user_id, expiry
		FROM tokens
		WHERE hash = $1 AND expiry > $2
	`

	token := &tokens.Token{Plaintext: tokenPlaintext}

	err := s.db.QueryRow(query, tokenHash[:], time.Now()).Scan(
		&token.Hash,
		&token.UserID,
		&token.Expiry,
	)

	if err == sql.ErrNoRows {
		return nil, nil
	}

	return token, err
}

func (s *PostgresTokenStore) DeleteToken(tokenPlaintext string) error {
	tokenHash := sha256.Sum256([]byte(tokenPlaintext))
	query := `DELETE FROM tokens WHERE hash = $1`
	_, err := s.db.Exec(query, tokenHash[:])
	return err
}

func (s *PostgresTokenStore) DeleteExpiredTokens() error {
	query := `DELETE FROM tokens WHERE expiry < $1`
	_, err := s.db.Exec(query, time.Now())
	return err
}

func (s *PostgresTokenStore) DeleteAllTokensForUser(userID uuid.UUID, exceptToken *string) error {
	if exceptToken == nil {
		query := `DELETE FROM tokens WHERE user_id = $1`
		_, err := s.db.Exec(query, userID)
		return err
	}

	tokenHash := sha256.Sum256([]byte(*exceptToken))

	query := `DELETE FROM tokens WHERE user_id = $1 AND hash != $2`
	_, err := s.db.Exec(query, userID, tokenHash[:])
	return err
}

func (s *PostgresTokenStore) ExtendTokenExpiry(tokenPlaintext string, ttl time.Duration) error {
	tokenHash := sha256.Sum256([]byte(tokenPlaintext))
	newExpiry := time.Now().Add(ttl)

	query := `
		UPDATE tokens 
		SET expiry = $1 
		WHERE hash = $2 AND expiry > $3
	`

	_, err := s.db.Exec(query, newExpiry, tokenHash[:], time.Now())
	return err
}
