# Build stage
FROM golang:1.26-alpine AS builder

WORKDIR /app
RUN apk add --no-cache git build-base

COPY go.mod go.sum ./
RUN go mod download

COPY . .
RUN CGO_ENABLED=0 GOOS=linux go build -o /app/moh-pms-api .

# Runtime stage
FROM alpine:3.21

WORKDIR /app
RUN apk add --no-cache ca-certificates tzdata

COPY --from=builder /app/moh-pms-api /app/moh-pms-api
COPY --from=builder /app/artisan /app/artisan
COPY --from=builder /app/.env.example /app/.env.example
COPY --from=builder /app/config /app/config
COPY --from=builder /app/database /app/database
COPY --from=builder /app/bootstrap /app/bootstrap
COPY --from=builder /app/routes /app/routes
COPY --from=builder /app/app /app/app
COPY --from=builder /app/resources /app/resources
COPY --from=builder /app/public /app/public
COPY --from=builder /app/scripts /app/scripts

RUN chmod +x /app/scripts/docker-entrypoint.sh

EXPOSE 3030
CMD ["/app/scripts/docker-entrypoint.sh"]
