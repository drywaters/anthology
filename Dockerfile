# syntax=docker/dockerfile:1

ARG GO_VERSION=1.22
ARG NODE_VERSION=20

FROM node:${NODE_VERSION}-bookworm AS ui-deps
WORKDIR /ui
COPY web/package.json web/package-lock.json ./
RUN npm ci

FROM node:${NODE_VERSION}-bookworm AS ui-builder
WORKDIR /ui
COPY --from=ui-deps /ui/node_modules ./node_modules
COPY web/ ./
RUN npm run build

FROM golang:${GO_VERSION} AS go-builder
WORKDIR /app
COPY go.mod go.sum ./
RUN go mod download
COPY cmd ./cmd
COPY internal ./internal
COPY migrations ./migrations
RUN CGO_ENABLED=0 GOOS=linux go build -o /bin/anthology ./cmd/api

FROM gcr.io/distroless/base-debian12
WORKDIR /
COPY --from=go-builder /bin/anthology /anthology
COPY --from=go-builder /migrations /migrations
COPY --from=ui-builder /ui/dist /web/dist
ENV PORT=8080
EXPOSE 8080
ENTRYPOINT ["/anthology"]
