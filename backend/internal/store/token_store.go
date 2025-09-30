package store

import (
	"context"
	"crypto/sha256"
	"database/sql"
	"fisheye/internal/tokens"
	"time"

	"github.com/google/uuid"
)

type TokenStore interface {
	Create(ctx context.Context, userID uuid.UUID, ttl time.Duration) (*tokens.Token, error)
	GetByPlaintext(ctx context.Context, tokenPlaintext string) (*tokens.Token, error)
	Delete(ctx context.Context, tokenPlaintext string) error
	DeleteExpired(ctx context.Context) error
	DeleteAllForUser(ctx context.Context, userID uuid.UUID, exceptToken *string) error
	ExtendExpiry(ctx context.Context, tokenPlaintext string, ttl time.Duration) error
}

type PostgresTokenStore struct {
	db *sql.DB
}

func NewPostgresTokenStore(db *sql.DB) *PostgresTokenStore {
	return &PostgresTokenStore{db: db}
}

func (s *PostgresTokenStore) Create(ctx context.Context, userID uuid.UUID, ttl time.Duration) (*tokens.Token, error) {
	token, err := tokens.GenerateToken(userID, ttl)
	if err != nil {
		return nil, err
	}

	query := `
		INSERT INTO tokens (hash, user_id, expiry)
		VALUES ($1, $2, $3)
	`
	_, err = s.db.ExecContext(ctx, query, token.Hash, token.UserID, token.Expiry)
	if err != nil {
		return nil, err
	}

	return token, nil
}

func (s *PostgresTokenStore) GetByPlaintext(ctx context.Context, tokenPlaintext string) (*tokens.Token, error) {
	tokenHash := sha256.Sum256([]byte(tokenPlaintext))

	query := `
		SELECT hash, user_id, expiry
		FROM tokens
		WHERE hash = $1 AND expiry > $2
	`

	token := &tokens.Token{Plaintext: tokenPlaintext}

	err := s.db.QueryRowContext(ctx, query, tokenHash[:], time.Now()).Scan(
		&token.Hash,
		&token.UserID,
		&token.Expiry,
	)

	if err == sql.ErrNoRows {
		return nil, nil
	}

	return token, err
}

func (s *PostgresTokenStore) Delete(ctx context.Context, tokenPlaintext string) error {
	tokenHash := sha256.Sum256([]byte(tokenPlaintext))
	query := `DELETE FROM tokens WHERE hash = $1`
	_, err := s.db.ExecContext(ctx, query, tokenHash[:])
	return err
}

func (s *PostgresTokenStore) DeleteExpired(ctx context.Context) error {
	query := `DELETE FROM tokens WHERE expiry < $1`
	_, err := s.db.ExecContext(ctx, query, time.Now())
	return err
}

func (s *PostgresTokenStore) DeleteAllForUser(ctx context.Context, userID uuid.UUID, exceptToken *string) error {
	if exceptToken == nil {
		query := `DELETE FROM tokens WHERE user_id = $1`
		_, err := s.db.ExecContext(ctx, query, userID)
		return err
	}

	tokenHash := sha256.Sum256([]byte(*exceptToken))
	query := `DELETE FROM tokens WHERE user_id = $1 AND hash != $2`
	_, err := s.db.ExecContext(ctx, query, userID, tokenHash[:])
	return err
}

func (s *PostgresTokenStore) ExtendExpiry(ctx context.Context, tokenPlaintext string, ttl time.Duration) error {
	tokenHash := sha256.Sum256([]byte(tokenPlaintext))
	newExpiry := time.Now().Add(ttl)

	query := `
		UPDATE tokens 
		SET expiry = $1 
		WHERE hash = $2 AND expiry > $3
	`

	_, err := s.db.ExecContext(ctx, query, newExpiry, tokenHash[:], time.Now())
	return err
}
