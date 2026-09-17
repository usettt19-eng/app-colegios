# syntax=docker/dockerfile:1

# ---- Etapa 1: build (frontend + bundling del servidor) ----
FROM node:22-bookworm-slim AS builder
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm install --legacy-peer-deps

COPY . .
RUN npm run build

# ---- Etapa 2: runtime (solo dependencias de producción + dist) ----
FROM node:22-bookworm-slim AS runner
WORKDIR /app
ENV NODE_ENV=production

COPY package.json package-lock.json ./
RUN npm install --omit=dev --legacy-peer-deps && npm cache clean --force

COPY --from=builder /app/dist ./dist

EXPOSE 3000
CMD ["node", "dist/server.cjs"]
