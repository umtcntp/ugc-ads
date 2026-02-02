# Development Stage (Vite dev server)
FROM node:22-bookworm-slim AS development
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
CMD ["npm", "run", "dev", "--", "--host"]

# Build Stage (creates /dist)
FROM node:22-bookworm-slim AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
ARG VITE_BASEURL
RUN VITE_BASEURL=${VITE_BASEURL} npm run build

# Production Stage (Caddy serves /dist)
FROM caddy:2-alpine AS production
COPY Caddyfile /etc/caddy/Caddyfile
COPY --from=build /app/dist /srv
