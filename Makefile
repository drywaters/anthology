.DEFAULT_GOAL := help

BIN_DIR ?= bin
WEB_DIR ?= web

DATA_STORE ?= memory
PORT ?= 8080
ALLOWED_ORIGINS ?= http://localhost:4200,http://localhost:8080
API_TOKEN ?= local-dev-token
GOOGLE_BOOKS_API_KEY ?= local-google-books-api-key
DATABASE_URL ?= postgres://anthology:anthology@localhost:5432/anthology?sslmode=disable

REGISTRY ?= registry.bitofbytes.io
IMAGE_REPO ?= anthology
API_IMAGE_REPO ?= anthology-api
UI_IMAGE_REPO ?= anthology-ui
LOG_LEVEL ?= info
PLATFORMS ?= linux/amd64,linux/arm64/v8

.PHONY: help configure-image ensure-image-tag api-run api-test api-build api-clean fmt tidy web-install web-start web-test web-lint web-build docker-build docker-build-api docker-build-ui docker-push docker-push-api docker-push-ui docker-publish docker-buildx docker-buildx-api docker-buildx-ui build run local clean

help: ## Show all available targets.
	@echo "Anthology targets"
	@grep -E '^[a-zA-Z0-9_-]+:.*?##' $(MAKEFILE_LIST) | sort | awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-20s\033[0m %s\n", $$1, $$2}'

configure-image: ## Evaluate container image metadata defaults.
	$(eval SHORT_SHA := $(shell git rev-parse --short HEAD 2>/dev/null))
	$(eval IMAGE_TAG ?= $(if $(SHORT_SHA),$(SHORT_SHA),dev))
	$(eval API_IMAGE := $(REGISTRY)/$(API_IMAGE_REPO):$(IMAGE_TAG))
	$(eval UI_IMAGE := $(REGISTRY)/$(UI_IMAGE_REPO):$(IMAGE_TAG))
	@true

ensure-image-tag: configure-image ## Abort if git metadata is unavailable for image tagging.
	@test -n "$(strip $(SHORT_SHA))" || (echo "Unable to determine git short SHA. Commit your work before building images." >&2; exit 1)

api-run: ## Run the Go API with in-memory defaults.
	DATA_STORE=$(DATA_STORE) \
	PORT=$(PORT) \
	ALLOWED_ORIGINS=$(ALLOWED_ORIGINS) \
	API_TOKEN=$(API_TOKEN) \
	GOOGLE_BOOKS_API_KEY=$(GOOGLE_BOOKS_API_KEY) \
	DATABASE_URL=$(DATABASE_URL) \
	LOG_LEVEL=$(LOG_LEVEL) \
	go run ./cmd/api

run: api-run ## Alias for api-run to match common tooling expectations.

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

docker-build-api: IMAGE_REPO=$(API_IMAGE_REPO)
docker-build-api: configure-image ## Build the API container image.
	docker build \
		-f Docker/Dockerfile.api \
		--build-arg LOG_LEVEL=$(LOG_LEVEL) \
		-t $(API_IMAGE) \
		.

docker-build-ui: IMAGE_REPO=$(UI_IMAGE_REPO)
docker-build-ui: configure-image ## Build the UI container image.
	docker build \
		-f Docker/Dockerfile.ui \
		-t $(UI_IMAGE) \
		.

docker-build: docker-build-api docker-build-ui ## Build both API and UI container images.

docker-push-api: IMAGE_REPO=$(API_IMAGE_REPO)
docker-push-api: ensure-image-tag ## Push the API container image.
	docker push $(API_IMAGE)

docker-push-ui: IMAGE_REPO=$(UI_IMAGE_REPO)
docker-push-ui: ensure-image-tag ## Push the UI container image.
	docker push $(UI_IMAGE)

docker-push: docker-push-api docker-push-ui ## Push both API and UI container images.

docker-publish: ## Build and push both images locally.
	$(MAKE) docker-build docker-push

docker-buildx-api: IMAGE_REPO=$(API_IMAGE_REPO)
docker-buildx-api: ensure-image-tag ## Build and push a multi-arch API image via buildx.
	@echo ">> Building and pushing $(API_IMAGE) for $(PLATFORMS)"
	-docker buildx inspect >/dev/null 2>&1 || docker buildx create --use
	docker buildx build \
		-f Docker/Dockerfile.api \
		--platform=$(PLATFORMS) \
		--build-arg LOG_LEVEL=$(LOG_LEVEL) \
		-t $(API_IMAGE) \
		--push \
		.

docker-buildx-ui: IMAGE_REPO=$(UI_IMAGE_REPO)
docker-buildx-ui: ensure-image-tag ## Build and push a multi-arch UI image via buildx.
	@echo ">> Building and pushing $(UI_IMAGE) for $(PLATFORMS)"
	-docker buildx inspect >/dev/null 2>&1 || docker buildx create --use
	docker buildx build \
		-f Docker/Dockerfile.ui \
		--platform=$(PLATFORMS) \
		-t $(UI_IMAGE) \
		--push \
		.

docker-buildx: docker-buildx-api docker-buildx-ui ## Build and push multi-arch API and UI images via buildx.

build: api-test web-test docker-build ## Run both test suites then build the container images.

local: ## Run the API and Angular dev server concurrently.
	$(MAKE) -j 2 api-run web-start

clean: api-clean ## Clean build artifacts (alias for api-clean).
