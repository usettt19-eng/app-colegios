# syntax=docker/dockerfile:1

# ---- Etapa 1: build (frontend + bundling del servidor) ----
FROM node:22-bookworm-slim AS builder
WORKDIR /app

# Vite incrusta las variables VITE_* en el bundle en tiempo de build (no de
# runtime), y .env está excluido del contexto de build vía .dockerignore.
# Por eso se reciben como build args (ver docker-compose.yml) en vez de
# depender del .env que solo se monta al arrancar el contenedor.
ARG VITE_SUPABASE_URL
ARG VITE_SUPABASE_ANON_KEY
ENV VITE_SUPABASE_URL=$VITE_SUPABASE_URL
ENV VITE_SUPABASE_ANON_KEY=$VITE_SUPABASE_ANON_KEY

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
