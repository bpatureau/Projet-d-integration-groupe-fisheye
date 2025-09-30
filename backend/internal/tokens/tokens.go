package tokens

import (
	"crypto/rand"
	"crypto/sha256"
	"encoding/base32"
	"time"

	"github.com/google/uuid"
)

type Token struct {
	Plaintext string    `json:"token"`
	Hash      []byte    `json:"-"`
	UserID    uuid.UUID `json:"-"`
	Expiry    time.Time `json:"expiry"`
	CreatedAt time.Time `json:"created_at"`
}

const DefaultTTL = 7 * 24 * time.Hour

func GenerateToken(userID uuid.UUID, ttl time.Duration) (*Token, error) {
	token := &Token{
		UserID:    userID,
		Expiry:    time.Now().Add(ttl),
		CreatedAt: time.Now(),
	}

	randomBytes := make([]byte, 32)
	_, err := rand.Read(randomBytes)
	if err != nil {
		return nil, err
	}

	token.Plaintext = base32.StdEncoding.WithPadding(base32.NoPadding).EncodeToString(randomBytes)
	hash := sha256.Sum256([]byte(token.Plaintext))
	token.Hash = hash[:]

	return token, nil
}
