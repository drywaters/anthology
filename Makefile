.DEFAULT_GOAL := help

BIN_DIR ?= bin
WEB_DIR ?= web
DEPLOY_DIR ?= deploy

DATA_STORE ?= memory
PORT ?= 8080
ALLOWED_ORIGINS ?= http://localhost:4200,http://localhost:8080
API_TOKEN ?= local-dev-token
DATABASE_URL ?= postgres://anthology:anthology@localhost:5432/anthology?sslmode=disable

REGISTRY ?= registry.bitofbytes.io
IMAGE_REPO ?= anthology
LOG_LEVEL ?= info
PLATFORMS ?= linux/amd64,linux/arm64/v8

.PHONY: help configure-image ensure-image-tag api-run api-test api-build api-clean fmt tidy web-install web-start web-test web-lint web-build compose-up compose-down compose-logs docker-build docker-push docker-publish docker-buildx build run local clean

help: ## Show all available targets.
	@echo "Anthology targets"
	@grep -E '^[a-zA-Z0-9_-]+:.*?##' $(MAKEFILE_LIST) | sort | awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-20s\033[0m %s\n", $$1, $$2}'

configure-image: ## Evaluate container image metadata defaults.
	$(eval IMAGE_NAME ?= $(REGISTRY)/$(IMAGE_REPO))
	$(eval SHORT_SHA := $(shell git rev-parse --short HEAD 2>/dev/null))
	$(eval IMAGE_TAG ?= $(if $(SHORT_SHA),$(SHORT_SHA),dev))
	$(eval IMAGE := $(IMAGE_NAME):$(IMAGE_TAG))
	@true

ensure-image-tag: configure-image ## Abort if git metadata is unavailable for image tagging.
	@test -n "$(strip $(SHORT_SHA))" || (echo "Unable to determine git short SHA. Commit your work before building images." >&2; exit 1)

api-run: ## Run the Go API with in-memory defaults.
	DATA_STORE=$(DATA_STORE) \
	PORT=$(PORT) \
	ALLOWED_ORIGINS=$(ALLOWED_ORIGINS) \
	API_TOKEN=$(API_TOKEN) \
	DATABASE_URL=$(DATABASE_URL) \
	LOG_LEVEL=$(LOG_LEVEL) \
	go run ./cmd/api

run: api-run ## Alias for api-run to match the bitofbytes workflow.

api-test: ## Execute all Go unit tests.
	go test ./...

api-build: ## Compile the Go API into ./bin/anthology.
	mkdir -p $(BIN_DIR)
	go build -o $(BIN_DIR)/anthology ./cmd/api

api-clean: ## Remove compiled Go binaries.
	rm -rf $(BIN_DIR)

fmt: ## gofmt all Go source files.
	gofmt -w $$(go list -f '{{.Dir}}' ./...)

tidy: ## Go module tidy.
	go mod tidy

web-install: ## Install Angular dependencies.
	cd $(WEB_DIR) && npm install

web-start: ## Start the Angular dev server (ng serve).
	cd $(WEB_DIR) && npm start

web-test: ## Run Angular unit tests once.
	cd $(WEB_DIR) && npm test -- --watch=false

web-lint: ## Run Angular lint checks.
	cd $(WEB_DIR) && npm run lint

web-build: ## Build the Angular production bundle.
	cd $(WEB_DIR) && npm run build

compose-up: ## Build and start the docker compose stack (API + Postgres).
	cd $(DEPLOY_DIR) && docker compose up --build

compose-down: ## Stop the docker compose stack.
	cd $(DEPLOY_DIR) && docker compose down

compose-logs: ## Tail docker compose logs.
	cd $(DEPLOY_DIR) && docker compose logs -f

docker-build: configure-image ## Build the API container image.
	docker build \
		-f Docker/Dockerfile \
		--build-arg LOG_LEVEL=$(LOG_LEVEL) \
		-t $(IMAGE) \
		.

docker-push: ensure-image-tag ## Push the API container image.
	docker push $(IMAGE)

docker-publish: ## Build and push the image locally.
	$(MAKE) docker-build docker-push

docker-buildx: ensure-image-tag ## Build and push a multi-arch image via buildx.
	@echo ">> Building and pushing $(IMAGE) for $(PLATFORMS)"
	-docker buildx inspect >/dev/null 2>&1 || docker buildx create --use
	docker buildx build \
		-f Docker/Dockerfile \
		--platform=$(PLATFORMS) \
		--build-arg LOG_LEVEL=$(LOG_LEVEL) \
		-t $(IMAGE) \
		--push \
		.

build: api-test web-test docker-build ## Run both test suites then build the container image.

local: ## Run the API and Angular dev server concurrently.
	$(MAKE) -j 2 api-run web-start

clean: api-clean ## Clean build artifacts (alias for api-clean).
