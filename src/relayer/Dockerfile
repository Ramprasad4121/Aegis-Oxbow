# ──────────────────────────────────────────────────
# Build stage
# ──────────────────────────────────────────────────
FROM node:20-alpine AS builder

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY tsconfig.json ./
COPY src/ ./src/

RUN npm run build

# ──────────────────────────────────────────────────
# Production stage
# ──────────────────────────────────────────────────
FROM node:20-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production

COPY package*.json ./
RUN npm ci --omit=dev

COPY --from=builder /app/dist ./dist

# Copy deployment.json if it exists (populated by deploy script)
COPY deployment.json* ./

EXPOSE 4000

HEALTHCHECK --interval=15s --timeout=5s --start-period=10s CMD wget -qO- http://localhost:4000/health || exit 1

CMD ["node", "dist/index.js"]
