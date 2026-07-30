# ─── Stage 1: Install dependencies ────────────────────────────
# Debian rather than Alpine: the native `canvas` dependency publishes prebuilt
# binaries for glibc only, so on musl it would have to compile from source.
FROM node:22-slim AS deps
WORKDIR /app
COPY package*.json ./
RUN npm ci --ignore-scripts

# ─── Stage 2: Build TypeScript ────────────────────────────────
FROM node:22-slim AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY tsconfig*.json ./
COPY package*.json ./
COPY src/ src/
RUN npm run build

# ─── Stage 3: Production ─────────────────────────────────────
FROM node:22-slim AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=8080

# Production deps only (smaller image). Install scripts stay enabled so
# `canvas` fetches its prebuilt binding; without them it has no bindings at all.
COPY package*.json ./
RUN npm ci --omit=dev && npm cache clean --force

COPY --from=builder /app/dist ./dist
COPY --from=builder /app/package.json ./

# Agent prompts and templates needed at runtime
COPY agents/src ./agents/src

# Security: non-root user
RUN groupadd -g 1001 appuser && useradd -u 1001 -g appuser -m appuser
USER appuser

EXPOSE 8080

# Health check for Docker / orchestrators
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "fetch('http://localhost:8080/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "dist/src/index.js"]
