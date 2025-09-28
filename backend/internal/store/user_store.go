package store

import (
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
	GetUserByID(id uuid.UUID) (*User, error)
	GetUserByUsername(username string) (*User, error)
	GetUserByEmail(email string) (*User, error)
	GetUserByToken(tokenPlaintext string) (*User, error)
	UpdateUser(*User) error
	UpdateUserPassword(id uuid.UUID, passwordHash Password) error
	DeleteUser(id uuid.UUID) error

	UsernameExists(username string) (bool, error)
	EmailExists(email string) (bool, error)

	CountUsers() (int, error)
	CountAdmins() (int, error)
	ListUsers(limit, offset int, search, role string) ([]*User, int, error)
}

func (s *PostgresUserStore) CreateUser(user *User) error {
	query := `
		INSERT INTO users (username, email, password_hash, role)
		VALUES ($1, $2, $3, $4)
		RETURNING id, created_at, updated_at
	`

	err := s.db.QueryRow(
		query,
		user.Username,
		user.Email,
		user.PasswordHash.hash,
		user.Role,
	).Scan(&user.ID, &user.CreatedAt, &user.UpdatedAt)

	return err
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

func (s *PostgresUserStore) GetUserByUsername(username string) (*User, error) {
	user := &User{PasswordHash: Password{}}

	query := `
		SELECT id, username, email, password_hash, role, created_at, updated_at
		FROM users
		WHERE LOWER(username) = LOWER($1)
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

func (s *PostgresUserStore) GetUserByEmail(email string) (*User, error) {
	user := &User{PasswordHash: Password{}}

	query := `
		SELECT id, username, email, password_hash, role, created_at, updated_at
		FROM users
		WHERE LOWER(email) = LOWER($1)
	`

	err := s.db.QueryRow(query, email).Scan(
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

func (s *PostgresUserStore) GetUserByToken(tokenPlaintext string) (*User, error) {
	tokenHash := sha256.Sum256([]byte(tokenPlaintext))

	query := `
		SELECT u.id, u.username, u.email, u.password_hash, u.role, u.created_at, u.updated_at
		FROM users u
		INNER JOIN tokens t ON t.user_id = u.id
		WHERE t.hash = $1 
			AND t.expiry > $2 
	`

	user := &User{PasswordHash: Password{}}

	err := s.db.QueryRow(query, tokenHash[:], time.Now()).Scan(
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

	err := s.db.QueryRow(
		query,
		user.Username,
		user.Email,
		user.Role,
		user.ID,
	).Scan(&user.UpdatedAt)

	return err
}

func (s *PostgresUserStore) UpdateUserPassword(id uuid.UUID, passwordHash Password) error {
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

func (s *PostgresUserStore) UsernameExists(username string) (bool, error) {
	var exists bool
	query := `SELECT EXISTS(SELECT 1 FROM users WHERE LOWER(username) = LOWER($1))`
	err := s.db.QueryRow(query, username).Scan(&exists)
	return exists, err
}

func (s *PostgresUserStore) EmailExists(email string) (bool, error) {
	var exists bool
	query := `SELECT EXISTS(SELECT 1 FROM users WHERE LOWER(email) = LOWER($1))`
	err := s.db.QueryRow(query, email).Scan(&exists)
	return exists, err
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

func (s *PostgresUserStore) ListUsers(limit, offset int, search, role string) ([]*User, int, error) {
	whereConditions := []string{"1=1"}
	whereArgs := []any{}
	argPosition := 1
	orderBy := "created_at DESC"

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

	var total int
	countQuery := fmt.Sprintf("SELECT COUNT(*) FROM users WHERE %s", whereClause)
	if err := s.db.QueryRow(countQuery, whereArgs...).Scan(&total); err != nil {
		return nil, 0, err
	}

	finalArgs := make([]any, len(whereArgs))
	copy(finalArgs, whereArgs)
	finalArgPosition := len(whereArgs) + 1

	if search != "" {
		orderBy = fmt.Sprintf(`
			CASE 
				WHEN username ILIKE $%d THEN 1
				WHEN username ILIKE $%d THEN 2
				ELSE 3
			END,
			created_at DESC`, finalArgPosition, finalArgPosition+1)

		finalArgs = append(finalArgs, search, search+"%")
		finalArgPosition += 2
	}

	finalArgs = append(finalArgs, limit, offset)

	query := fmt.Sprintf(`
		SELECT id, username, email, password_hash, role, created_at, updated_at
		FROM users
		WHERE %s
		ORDER BY %s
		LIMIT $%d OFFSET $%d
	`, whereClause, orderBy, finalArgPosition, finalArgPosition+1)

	rows, err := s.db.Query(query, finalArgs...)
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

	if err = rows.Err(); err != nil {
		return nil, 0, err
	}

	return users, total, nil
}
