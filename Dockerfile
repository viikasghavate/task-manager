# ── Build frontend ──
FROM node:22-alpine AS frontend-builder
WORKDIR /app/frontend
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci --include=dev
COPY frontend/ .
RUN npm run build

# ── Build backend ──
FROM node:22-alpine AS backend-builder
WORKDIR /app/backend
COPY backend/package.json backend/package-lock.json ./
RUN npm ci --include=dev
COPY backend/ .
RUN npm run build

# ── Production image ──
FROM node:22-alpine
WORKDIR /app

# Copy backend
COPY --from=backend-builder /app/backend/dist ./dist
COPY --from=backend-builder /app/backend/node_modules ./node_modules
COPY --from=backend-builder /app/backend/package.json ./
COPY --from=backend-builder /app/backend/drizzle.config.ts ./
COPY --from=backend-builder /app/backend/drizzle ./drizzle

# Copy frontend build
COPY --from=frontend-builder /app/frontend/dist ./public

EXPOSE 3001

ENV NODE_ENV=production
ENV PORT=3001

# Run migrations on startup, then start the app
CMD npx drizzle-kit push 2>/dev/null && node dist/index.js
