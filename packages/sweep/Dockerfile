# ============================================
# Sweep API Server - Production Dockerfile
# Using tsx for direct TypeScript execution
# ============================================

# Single stage build - simpler and faster
FROM node:20-alpine

WORKDIR /app

# Install build dependencies for native modules
RUN apk add --no-cache python3 make g++ dumb-init wget

# Copy package files
COPY package*.json ./

# Install all dependencies (including tsx for runtime)
RUN npm ci --legacy-peer-deps

# Copy source code
COPY tsconfig.json ./
COPY drizzle.config.ts ./
COPY src ./src
COPY drizzle ./drizzle

# Create non-root user
RUN addgroup --system --gid 1001 nodejs \
    && adduser --system --uid 1001 sweepbank \
    && chown -R sweepbank:nodejs /app

# Set environment
ENV NODE_ENV=production
ENV PORT=3000

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:3000/health || exit 1

# Switch to non-root user
USER sweepbank

# Use dumb-init to handle signals properly
ENTRYPOINT ["dumb-init", "--"]

# Start with tsx (direct TypeScript execution)
CMD ["npx", "tsx", "src/api/index.ts"]
