package main

import (
	"log"

	"mysql-ip-connect/golang/internal/config"
	"mysql-ip-connect/golang/internal/db"
	"mysql-ip-connect/golang/internal/handlers"

	"github.com/gin-contrib/cors"
	"github.com/gin-gonic/gin"
)

func main() {
	cfg, err := config.Load()
	if err != nil {
		log.Fatalf("config error: %v", err)
	}
	database, err := db.Init(cfg.MySQLUsername, cfg.MySQLPassword, cfg.MySQLAddress, cfg.MySQLDatabase, cfg.TableName)
	if err != nil {
		log.Fatalf("db init error: %v", err)
	}
	r := gin.Default()
	r.Use(cors.Default())

	s := handlers.NewServer(database)

	r.GET("/", s.GetIndex)
	r.GET("/api/count", s.GetCount)
	r.POST("/api/count", s.PostCount)
	r.GET("/api/wx_openid", s.WxOpenID)

	if err := r.Run(":" + cfg.Port); err != nil {
		log.Fatalf("server run error: %v", err)
	}
}
