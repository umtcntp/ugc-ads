# =========================
# DEV (optional - local/dev)
# =========================
FROM node:22-bookworm-slim AS dev
WORKDIR /app

COPY package*.json ./
COPY prisma ./prisma
RUN npm ci
RUN npx prisma generate

COPY . .
EXPOSE 5050
CMD ["npm", "run", "server"]


# =========================
# BUILD (compile TS + prisma)
# =========================
FROM node:22-bookworm-slim AS build
WORKDIR /app

COPY package*.json ./
COPY prisma ./prisma
RUN npm ci

COPY . .

RUN npx prisma generate
RUN npm run build

# production için dev deps çıkart
RUN npm prune --omit=dev


# =========================
# PROD (small runtime image)
# =========================
FROM node:22-bookworm-slim AS production
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=5050

COPY --from=build /app/package.json ./package.json
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY --from=build /app/prisma ./prisma

EXPOSE 5050
CMD ["npm", "start"]

