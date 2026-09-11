# syntax=docker/dockerfile:1.7

# Build stage — CGO disabled, so no build-base/gcc (saves minutes on cold builds)
FROM golang:1.26-alpine AS builder

WORKDIR /app
RUN apk add --no-cache git ca-certificates

COPY go.mod go.sum ./
RUN --mount=type=cache,target=/go/pkg/mod \
	go mod download

COPY . .
RUN --mount=type=cache,target=/go/pkg/mod \
	--mount=type=cache,target=/root/.cache/go-build \
	CGO_ENABLED=0 GOOS=linux go build -trimpath -ldflags="-s -w" -o /app/moh-pms-api .

# Runtime stage
FROM alpine:3.21

WORKDIR /app
RUN apk add --no-cache ca-certificates tzdata curl

COPY --from=builder /app/moh-pms-api /app/moh-pms-api
COPY --from=builder /app/config /app/config
COPY --from=builder /app/database /app/database
COPY --from=builder /app/bootstrap /app/bootstrap
COPY --from=builder /app/routes /app/routes
COPY --from=builder /app/app /app/app
COPY --from=builder /app/resources /app/resources
COPY --from=builder /app/public /app/public
COPY --from=builder /app/scripts /app/scripts

RUN chmod +x /app/scripts/docker-entrypoint.sh /app/scripts/docker-dev-entrypoint.sh

EXPOSE 3030
CMD ["/app/scripts/docker-entrypoint.sh"]
