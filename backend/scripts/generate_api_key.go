package main

import (
	"crypto/rand"
	"encoding/base64"
	"fmt"
)

func main() {
	// Générer 32 bytes aléatoires
	b := make([]byte, 32)
	_, err := rand.Read(b)
	if err != nil {
		panic(err)
	}

	// Encoder en base64 URL-safe
	apiKey := base64.URLEncoding.EncodeToString(b)

	fmt.Printf("Generated API Key: %s\n", apiKey)
	fmt.Println("\nAdd this to your .env file:")
	fmt.Printf("DEVICE_API_KEY=\"%s\"\n", apiKey)
}
