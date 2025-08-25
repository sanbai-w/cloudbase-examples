package config

import (
	"fmt"
	"os"

	"github.com/joho/godotenv"
)

type Config struct {
	Port          string
	MySQLUsername string
	MySQLPassword string
	MySQLAddress  string // host:port
	MySQLDatabase string
	TableName     string
}

func Load() (*Config, error) {
	// Load .env file if it exists
	if err := godotenv.Load(); err != nil {
		// It's okay if .env file doesn't exist, just log it
		fmt.Printf("Warning: .env file not found or could not be loaded: %v\n", err)
	}

	cfg := &Config{
		Port:          getEnv("PORT", "8080"),
		MySQLUsername: os.Getenv("MYSQL_USERNAME"),
		MySQLPassword: os.Getenv("MYSQL_PASSWORD"),
		MySQLAddress:  getEnv("MYSQL_ADDRESS", ""),
		MySQLDatabase: getEnv("MYSQL_DATABASE", ""),
		TableName:     getEnv("TABLE_NAME", "counters"),
	}
	if cfg.MySQLUsername == "" || cfg.MySQLAddress == "" || cfg.MySQLDatabase == "" {
		return nil, fmt.Errorf("missing required MYSQL_* env vars: MYSQL_USERNAME, MYSQL_ADDRESS, MYSQL_DATABASE")
	}
	return cfg, nil
}

func getEnv(key, def string) string {
	v := os.Getenv(key)
	if v == "" {
		return def
	}
	return v
}
