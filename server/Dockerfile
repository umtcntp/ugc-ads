# Development stage for backend
FROM node:22-bookworm-slim AS development
WORKDIR /app
COPY package*.json ./
COPY prisma ./prisma
RUN npm ci
RUN npx prisma generate
COPY . .
CMD ["npm", "run", "server"]


# Production stage for backend
FROM node:22-bookworm-slim AS production
WORKDIR /app
COPY package*.json ./
COPY prisma ./prisma
RUN npm ci --omit=dev
COPY . .
CMD ["npm", "start"]
