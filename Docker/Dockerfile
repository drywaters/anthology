# syntax=docker/dockerfile:1

FROM node:20-alpine AS web-builder
WORKDIR /web
COPY web/ ./
RUN npm install \
    && npm run build

FROM golang:1.22-alpine AS api-builder
WORKDIR /src
COPY go.mod go.sum ./
RUN go mod download
COPY cmd ./cmd
COPY internal ./internal
COPY migrations ./migrations
RUN CGO_ENABLED=0 GOOS=linux go build -o /out/anthology ./cmd/api

FROM alpine:3.20
ARG LOG_LEVEL=info
WORKDIR /app

RUN apk add --no-cache ca-certificates

COPY --from=api-builder /out/anthology ./anthology
COPY --from=api-builder /src/migrations ./migrations
COPY --from=web-builder /web/dist ./web-dist

RUN addgroup -S anthology \
    && adduser -S -G anthology anthology \
    && chown -R anthology:anthology /app

ENV PORT=8080
ENV LOG_LEVEL=${LOG_LEVEL}

USER anthology

EXPOSE 8080
ENTRYPOINT ["./anthology"]
