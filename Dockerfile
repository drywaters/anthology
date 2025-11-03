# syntax=docker/dockerfile:1
FROM golang:1.22 AS builder
WORKDIR /app

COPY go.mod go.sum ./
RUN go mod download

COPY cmd ./cmd
COPY internal ./internal
COPY migrations ./migrations

RUN CGO_ENABLED=0 GOOS=linux go build -o /bin/anthology ./cmd/api

FROM gcr.io/distroless/base-debian12

COPY --from=builder /bin/anthology /anthology
COPY migrations /migrations

ENV PORT=8080
EXPOSE 8080

ENTRYPOINT ["/anthology"]
