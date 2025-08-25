package db

import (
	"database/sql"
	"fmt"
	"time"

	"gorm.io/driver/mysql"
	"gorm.io/gorm"
)

type Database struct {
	Gorm      *gorm.DB
	SQL       *sql.DB
	TableName string
}

type Counter struct {
	ID        uint      `gorm:"primaryKey"`
	Count     int       `gorm:"not null;default:1"`
	CreatedAt time.Time `gorm:"column:createdAt;not null"`
	UpdatedAt time.Time `gorm:"column:updatedAt;not null"`
}

func (Counter) TableName() string {
	// will be set dynamically via session.Table
	return "counters"
}

func Init(username, password, address, database, tableName string) (*Database, error) {
	dsn := fmt.Sprintf("%s:%s@tcp(%s)/%s?charset=utf8mb4&parseTime=True&loc=Local", username, password, address, database)
	g, err := gorm.Open(mysql.Open(dsn), &gorm.Config{})
	if err != nil {
		return nil, err
	}
	sqldb, err := g.DB()
	if err != nil {
		return nil, err
	}
	sqldb.SetMaxOpenConns(10)
	sqldb.SetMaxIdleConns(5)
	sqldb.SetConnMaxLifetime(5 * time.Minute)

	// migrate with dynamic table name
	if err := g.Table(tableName).AutoMigrate(&Counter{}); err != nil {
		return nil, err
	}
	return &Database{Gorm: g, SQL: sqldb, TableName: tableName}, nil
}

func (d *Database) InsertOne() error {
	return d.Gorm.Table(d.TableName).Create(&Counter{}).Error
}

func (d *Database) Truncate() error {
	return d.Gorm.Exec(fmt.Sprintf("TRUNCATE TABLE %s", d.TableName)).Error
}

func (d *Database) CountAll() (int64, error) {
	var count int64
	if err := d.Gorm.Table(d.TableName).Count(&count).Error; err != nil {
		return 0, err
	}
	return count, nil
}
