package handlers

import (
	"net/http"

	"mysql-ip-connect/golang/internal/db"

	"github.com/gin-gonic/gin"
)

type Server struct {
	DB *db.Database
}

type CountRequest struct {
	Action string `json:"action"`
}

func NewServer(database *db.Database) *Server {
	return &Server{DB: database}
}

func (s *Server) GetIndex(c *gin.Context) {
	c.File("web/index.html")
}

func (s *Server) GetCount(c *gin.Context) {
	cnt, err := s.DB.CountAll()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"code": 1, "message": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"code": 0, "data": cnt})
}

func (s *Server) PostCount(c *gin.Context) {
	var req CountRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"code": 1, "message": "invalid request"})
		return
	}
	switch req.Action {
	case "inc":
		if err := s.DB.InsertOne(); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"code": 1, "message": err.Error()})
			return
		}
	case "clear":
		if err := s.DB.Truncate(); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"code": 1, "message": err.Error()})
			return
		}
	}
	cnt, err := s.DB.CountAll()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"code": 1, "message": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"code": 0, "data": cnt})
}

func (s *Server) WxOpenID(c *gin.Context) {
	if c.GetHeader("x-wx-source") != "" {
		c.String(http.StatusOK, c.GetHeader("x-wx-openid"))
		return
	}
	c.Status(http.StatusOK)
}
