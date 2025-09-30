package store

import (
	"context"
	"crypto/sha256"
	"database/sql"
	"errors"
	"fmt"
	"strings"
	"time"

	"github.com/google/uuid"
	"golang.org/x/crypto/bcrypt"
)

type Password struct {
	plainText *string
	hash      []byte
}

func (p *Password) Set(plainTextPassword string) error {
	hash, err := bcrypt.GenerateFromPassword([]byte(plainTextPassword), 12)
	if err != nil {
		return err
	}

	p.plainText = &plainTextPassword
	p.hash = hash
	return nil
}

func (p *Password) Matches(plainTextPassword string) (bool, error) {
	err := bcrypt.CompareHashAndPassword(p.hash, []byte(plainTextPassword))
	if err != nil {
		switch {
		case errors.Is(err, bcrypt.ErrMismatchedHashAndPassword):
			return false, nil
		default:
			return false, err
		}
	}
	return true, nil
}

type User struct {
	ID           uuid.UUID `json:"id"`
	Username     string    `json:"username"`
	Email        string    `json:"email"`
	PasswordHash Password  `json:"-"`
	Role         string    `json:"role"`
	CreatedAt    time.Time `json:"created_at"`
	UpdatedAt    time.Time `json:"updated_at"`
}

var AnonymousUser = &User{}

func (u *User) IsAnonymous() bool {
	return u == AnonymousUser
}

func (u *User) IsAdmin() bool {
	return u.Role == "admin"
}

type UserStore interface {
	Create(ctx context.Context, user *User) error
	GetByID(ctx context.Context, id uuid.UUID) (*User, error)
	GetByUsername(ctx context.Context, username string) (*User, error)
	GetByEmail(ctx context.Context, email string) (*User, error)
	GetByToken(ctx context.Context, tokenPlaintext string) (*User, error)
	Update(ctx context.Context, user *User) error
	UpdatePassword(ctx context.Context, id uuid.UUID, passwordHash Password) error
	Delete(ctx context.Context, id uuid.UUID) error
	List(ctx context.Context, limit, offset int, search, role string) ([]*User, int, error)

	UsernameExists(ctx context.Context, username string) (bool, error)
	EmailExists(ctx context.Context, email string) (bool, error)
	CountUsers(ctx context.Context) (int, error)
	CountAdmins(ctx context.Context) (int, error)
}

type PostgresUserStore struct {
	db *sql.DB
}

func NewPostgresUserStore(db *sql.DB) *PostgresUserStore {
	return &PostgresUserStore{db: db}
}

func (s *PostgresUserStore) Create(ctx context.Context, user *User) error {
	query := `
		INSERT INTO users (username, email, password_hash, role)
		VALUES ($1, $2, $3, $4)
		RETURNING id, created_at, updated_at
	`

	err := s.db.QueryRowContext(
		ctx,
		query,
		user.Username,
		user.Email,
		user.PasswordHash.hash,
		user.Role,
	).Scan(&user.ID, &user.CreatedAt, &user.UpdatedAt)

	return err
}

func (s *PostgresUserStore) GetByID(ctx context.Context, id uuid.UUID) (*User, error) {
	user := &User{PasswordHash: Password{}}

	query := `
		SELECT id, username, email, password_hash, role, created_at, updated_at
		FROM users
		WHERE id = $1
	`

	err := s.db.QueryRowContext(ctx, query, id).Scan(
		&user.ID,
		&user.Username,
		&user.Email,
		&user.PasswordHash.hash,
		&user.Role,
		&user.CreatedAt,
		&user.UpdatedAt,
	)

	if err == sql.ErrNoRows {
		return nil, nil
	}

	return user, err
}

func (s *PostgresUserStore) GetByUsername(ctx context.Context, username string) (*User, error) {
	user := &User{PasswordHash: Password{}}

	query := `
		SELECT id, username, email, password_hash, role, created_at, updated_at
		FROM users
		WHERE LOWER(username) = LOWER($1)
	`

	err := s.db.QueryRowContext(ctx, query, username).Scan(
		&user.ID,
		&user.Username,
		&user.Email,
		&user.PasswordHash.hash,
		&user.Role,
		&user.CreatedAt,
		&user.UpdatedAt,
	)

	if err == sql.ErrNoRows {
		return nil, nil
	}

	return user, err
}

func (s *PostgresUserStore) GetByEmail(ctx context.Context, email string) (*User, error) {
	user := &User{PasswordHash: Password{}}

	query := `
		SELECT id, username, email, password_hash, role, created_at, updated_at
		FROM users
		WHERE LOWER(email) = LOWER($1)
	`

	err := s.db.QueryRowContext(ctx, query, email).Scan(
		&user.ID,
		&user.Username,
		&user.Email,
		&user.PasswordHash.hash,
		&user.Role,
		&user.CreatedAt,
		&user.UpdatedAt,
	)

	if err == sql.ErrNoRows {
		return nil, nil
	}

	return user, err
}

func (s *PostgresUserStore) GetByToken(ctx context.Context, tokenPlaintext string) (*User, error) {
	tokenHash := sha256.Sum256([]byte(tokenPlaintext))

	query := `
		SELECT u.id, u.username, u.email, u.password_hash, u.role, u.created_at, u.updated_at
		FROM users u
		INNER JOIN tokens t ON t.user_id = u.id
		WHERE t.hash = $1 AND t.expiry > $2
	`

	user := &User{PasswordHash: Password{}}

	err := s.db.QueryRowContext(ctx, query, tokenHash[:], time.Now()).Scan(
		&user.ID,
		&user.Username,
		&user.Email,
		&user.PasswordHash.hash,
		&user.Role,
		&user.CreatedAt,
		&user.UpdatedAt,
	)

	if err == sql.ErrNoRows {
		return nil, nil
	}

	return user, err
}

func (s *PostgresUserStore) Update(ctx context.Context, user *User) error {
	query := `
		UPDATE users
		SET username = $1, email = $2, role = $3, updated_at = CURRENT_TIMESTAMP
		WHERE id = $4
		RETURNING updated_at
	`

	err := s.db.QueryRowContext(
		ctx,
		query,
		user.Username,
		user.Email,
		user.Role,
		user.ID,
	).Scan(&user.UpdatedAt)

	return err
}

func (s *PostgresUserStore) UpdatePassword(ctx context.Context, id uuid.UUID, passwordHash Password) error {
	query := `
		UPDATE users
		SET password_hash = $1, updated_at = CURRENT_TIMESTAMP
		WHERE id = $2
	`

	_, err := s.db.ExecContext(ctx, query, passwordHash.hash, id)
	return err
}

func (s *PostgresUserStore) Delete(ctx context.Context, id uuid.UUID) error {
	query := `DELETE FROM users WHERE id = $1`
	_, err := s.db.ExecContext(ctx, query, id)
	return err
}

func (s *PostgresUserStore) List(ctx context.Context, limit, offset int, search, role string) ([]*User, int, error) {
	whereConditions := []string{"1=1"}
	whereArgs := []any{}
	argPosition := 1

	if search != "" {
		whereConditions = append(whereConditions, fmt.Sprintf(
			"(username ILIKE $%d OR email ILIKE $%d)",
			argPosition, argPosition,
		))
		whereArgs = append(whereArgs, "%"+search+"%")
		argPosition++
	}

	if role != "" {
		whereConditions = append(whereConditions, fmt.Sprintf("role = $%d", argPosition))
		whereArgs = append(whereArgs, role)
		argPosition++
	}

	whereClause := strings.Join(whereConditions, " AND ")

	// Count total
	var total int
	countQuery := fmt.Sprintf("SELECT COUNT(*) FROM users WHERE %s", whereClause)
	if err := s.db.QueryRowContext(ctx, countQuery, whereArgs...).Scan(&total); err != nil {
		return nil, 0, err
	}

	// Get users
	whereArgs = append(whereArgs, limit, offset)
	query := fmt.Sprintf(`
		SELECT id, username, email, password_hash, role, created_at, updated_at
		FROM users
		WHERE %s
		ORDER BY created_at DESC
		LIMIT $%d OFFSET $%d
	`, whereClause, argPosition, argPosition+1)

	rows, err := s.db.QueryContext(ctx, query, whereArgs...)
	if err != nil {
		return nil, 0, err
	}
	defer rows.Close()

	users := []*User{}
	for rows.Next() {
		user := &User{PasswordHash: Password{}}
		err := rows.Scan(
			&user.ID,
			&user.Username,
			&user.Email,
			&user.PasswordHash.hash,
			&user.Role,
			&user.CreatedAt,
			&user.UpdatedAt,
		)
		if err != nil {
			return nil, 0, err
		}
		users = append(users, user)
	}

	return users, total, rows.Err()
}

func (s *PostgresUserStore) UsernameExists(ctx context.Context, username string) (bool, error) {
	var exists bool
	query := `SELECT EXISTS(SELECT 1 FROM users WHERE LOWER(username) = LOWER($1))`
	err := s.db.QueryRowContext(ctx, query, username).Scan(&exists)
	return exists, err
}

func (s *PostgresUserStore) EmailExists(ctx context.Context, email string) (bool, error) {
	var exists bool
	query := `SELECT EXISTS(SELECT 1 FROM users WHERE LOWER(email) = LOWER($1))`
	err := s.db.QueryRowContext(ctx, query, email).Scan(&exists)
	return exists, err
}

func (s *PostgresUserStore) CountUsers(ctx context.Context) (int, error) {
	var count int
	query := `SELECT COUNT(*) FROM users`
	err := s.db.QueryRowContext(ctx, query).Scan(&count)
	return count, err
}

func (s *PostgresUserStore) CountAdmins(ctx context.Context) (int, error) {
	var count int
	query := `SELECT COUNT(*) FROM users WHERE role = 'admin'`
	err := s.db.QueryRowContext(ctx, query).Scan(&count)
	return count, err
}
