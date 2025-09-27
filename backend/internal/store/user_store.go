package store

import (
	"crypto/sha256"
	"database/sql"
	"errors"
	"time"

	"github.com/google/uuid"
	"golang.org/x/crypto/bcrypt"
)

type Password struct {
	plaintText *string
	hash       []byte
}

func (p *Password) Set(plaintextPassword string) error {
	hash, err := bcrypt.GenerateFromPassword([]byte(plaintextPassword), 12)
	if err != nil {
		return err
	}

	p.plaintText = &plaintextPassword
	p.hash = hash
	return nil
}

func (p *Password) Matches(plaintextPassword string) (bool, error) {
	err := bcrypt.CompareHashAndPassword(p.hash, []byte(plaintextPassword))
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

type PostgresUserStore struct {
	db *sql.DB
}

func NewPostgresUserStore(db *sql.DB) *PostgresUserStore {
	return &PostgresUserStore{db: db}
}

type UserStore interface {
	CreateUser(*User) error
	GetUserByUsername(username string) (*User, error)
	GetUserByID(id uuid.UUID) (*User, error)
	UpdateUser(*User) error
	UpdatePassword(id uuid.UUID, passwordHash Password) error
	DeleteUser(id uuid.UUID) error
	GetUserToken(scope, tokenPlainText string) (*User, error)
	CountUsers() (int, error)
	CountAdmins() (int, error)
}

func (s *PostgresUserStore) CountUsers() (int, error) {
	var count int
	query := `SELECT COUNT(*) FROM users`
	err := s.db.QueryRow(query).Scan(&count)
	return count, err
}

func (s *PostgresUserStore) CountAdmins() (int, error) {
	var count int
	query := `SELECT COUNT(*) FROM users WHERE role = 'admin'`
	err := s.db.QueryRow(query).Scan(&count)
	return count, err
}

func (s *PostgresUserStore) CreateUser(user *User) error {
	query := `
  INSERT INTO users (username, email, password_hash, role)
  VALUES ($1, $2, $3, $4)
  RETURNING id, created_at, updated_at
  `

	err := s.db.QueryRow(query, user.Username, user.Email, user.PasswordHash.hash, user.Role).
		Scan(&user.ID, &user.CreatedAt, &user.UpdatedAt)
	return err
}

func (s *PostgresUserStore) GetUserByUsername(username string) (*User, error) {
	user := &User{PasswordHash: Password{}}

	query := `
  SELECT id, username, email, password_hash, role, created_at, updated_at
  FROM users
  WHERE username = $1
  `

	err := s.db.QueryRow(query, username).Scan(
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

func (s *PostgresUserStore) GetUserByID(id uuid.UUID) (*User, error) {
	user := &User{PasswordHash: Password{}}

	query := `
		SELECT id, username, email, password_hash, role, created_at, updated_at
		FROM users
		WHERE id = $1
	`

	err := s.db.QueryRow(query, id).Scan(
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

func (s *PostgresUserStore) UpdateUser(user *User) error {
	query := `
  UPDATE users
  SET username = $1, email = $2, role = $3, updated_at = CURRENT_TIMESTAMP
  WHERE id = $4
  RETURNING updated_at
  `

	err := s.db.QueryRow(query, user.Username, user.Email, user.Role, user.ID).
		Scan(&user.UpdatedAt)
	return err
}

func (s *PostgresUserStore) UpdatePassword(id uuid.UUID, passwordHash Password) error {
	query := `
		UPDATE users
		SET password_hash = $1, updated_at = CURRENT_TIMESTAMP
		WHERE id = $2
	`

	_, err := s.db.Exec(query, passwordHash.hash, id)
	return err
}

func (s *PostgresUserStore) DeleteUser(id uuid.UUID) error {
	query := `DELETE FROM users WHERE id = $1`
	_, err := s.db.Exec(query, id)
	return err
}

func (s *PostgresUserStore) GetUserToken(scope, plaintextPassword string) (*User, error) {
	tokenHash := sha256.Sum256([]byte(plaintextPassword))

	query := `
  SELECT u.id, u.username, u.email, u.password_hash, u.role, u.created_at, u.updated_at
  FROM users u
  INNER JOIN tokens t ON t.user_id = u.id
  WHERE t.hash = $1 AND t.scope = $2 and t.expiry > $3
  `

	user := &User{PasswordHash: Password{}}

	err := s.db.QueryRow(query, tokenHash[:], scope, time.Now()).Scan(
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
