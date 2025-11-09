SHELL := /bin/bash

APP_NAME ?= anthology
UI_DIR := web
UI_DIST := $(UI_DIR)/dist
GO_CMD := ./cmd/api

.PHONY: help tidy fmt test ui-install ui-build build run clean docker-build docker-run

help:
@echo "Commonly used targets:"
@echo "  make build        Build the Go API and Angular UI"
@echo "  make test         Run Go unit tests"
@echo "  make ui-build     Build the Angular application"
@echo "  make docker-build Build the multi-stage Docker image"

fmt:
go fmt ./...

tidy:
go mod tidy

test:
go test ./...

ui-install:
cd $(UI_DIR) && npm ci

ui-build: ui-install
cd $(UI_DIR) && npm run build

build: ui-build
mkdir -p bin
CGO_ENABLED=0 GOOS=linux go build -o bin/$(APP_NAME) $(GO_CMD)

run:
go run $(GO_CMD)

clean:
rm -rf bin $(UI_DIST)

docker-build:
docker build -t $(APP_NAME):latest .

docker-run:
docker run --rm -p 8080:8080 $(APP_NAME):latest
