# Multi-stage Dockerfile: Build PWA and serve behind Nginx reverse proxy
FROM node:22-alpine AS builder

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

# Stage 2: Nginx reverse proxy
FROM nginx:alpine

COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/nginx.conf
COPY nginx.conf.template /etc/nginx/templates/nginx.conf.template

# Default backend configuration (can be overridden via environment variables)
ENV BACKEND_API_SERVER=http://127.0.0.1:8081
ENV BACKEND_API_HOST=127.0.0.1:8081
ENV NGINX_ENVSUBST_FILTER="BACKEND_API_SERVER BACKEND_API_HOST"
ENV NGINX_ENVSUBST_OUTPUT_DIR=/etc/nginx

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
