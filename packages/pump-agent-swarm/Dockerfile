# ── Stage 1: build ──────────────────────────────────────────────
FROM node:20-slim AS builder

WORKDIR /app

# Install build tools for native deps (anchor, ed25519-hd-key)
RUN apt-get update && \
    apt-get install -y --no-install-recommends python3 make g++ git && \
    rm -rf /var/lib/apt/lists/*

# Copy package manifests first (better layer caching)
COPY package.json package-lock.json* pnpm-lock.yaml* ./

# Install deps — supports both npm and pnpm
RUN if [ -f pnpm-lock.yaml ]; then \
      corepack enable && corepack prepare pnpm@latest --activate && pnpm install --frozen-lockfile; \
    else \
      npm ci; \
    fi

# Copy source
COPY tsconfig.json tsconfig.build.json ./
COPY src/ src/

# Build
RUN npx tsc -p tsconfig.build.json

# ── Stage 2: production ────────────────────────────────────────
FROM node:20-slim AS runner

WORKDIR /app

ENV NODE_ENV=production

# Non-root user for security
RUN groupadd --gid 1001 swarm && \
    useradd --uid 1001 --gid swarm --create-home swarm

# Copy built output + production deps
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./package.json

USER swarm

HEALTHCHECK --interval=30s --timeout=10s --retries=3 \
  CMD node -e "process.exit(0)"

ENTRYPOINT ["node", "dist/index.js"]
