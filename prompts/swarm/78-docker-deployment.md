# Prompt 78 — Docker & Deployment Configuration

## Agent Identity & Rules

```
You are the DOCKER-DEPLOYMENT builder.

RULES:
- Work on current branch (main), commit as nirholas
- Always use isBackground: true for terminals, always kill_terminal after
- No placeholder configs — real, production-ready Docker and deployment files
- Commit message: "feat(swarm): add Docker, docker-compose, and deployment configs for pump-agent-swarm"
```

## Objective

Create production-ready Docker and deployment configurations for the pump-agent-swarm. This includes a multi-stage Dockerfile, a docker-compose setup for local development, environment variable templates, and a Cloud Run / GKE deployment config. The swarm should be deployable with a single `docker compose up` for local dev, or pushed to Google Cloud for persistent operation.

## File Ownership

- **Creates**: `packages/pump-agent-swarm/Dockerfile`
- **Creates**: `packages/pump-agent-swarm/docker-compose.yml`
- **Creates**: `packages/pump-agent-swarm/.env.example`
- **Creates**: `packages/pump-agent-swarm/deploy/cloudrun.yaml`
- **Creates**: `packages/pump-agent-swarm/deploy/k8s-deployment.yaml`
- **Creates**: `packages/pump-agent-swarm/.dockerignore`

## Dependencies

- All source files (01-77)
- Root `package.json` for workspace context
- `infra/` directory in root for existing deployment patterns

## Deliverables

### Create `packages/pump-agent-swarm/Dockerfile`

Multi-stage build for minimal production image:

```dockerfile
# Stage 1: Dependencies
FROM node:20-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json* ./
# Copy root workspace files needed for install
COPY ../../package.json /workspace/package.json
COPY ../../package-lock.json* /workspace/package-lock.json
RUN npm ci --workspace=packages/pump-agent-swarm

# Stage 2: Build
FROM node:20-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

# Stage 3: Production
FROM node:20-alpine AS runner
WORKDIR /app

# Security: non-root user
RUN addgroup -g 1001 -S swarm && adduser -S swarm -u 1001 -G swarm

# Runtime dependencies only
COPY --from=deps /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/package.json ./package.json

# Create data directory for SQLite
RUN mkdir -p /app/data && chown -R swarm:swarm /app/data

# Volume for persistent database
VOLUME ["/app/data"]

USER swarm

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=10s --retries=3 \
  CMD node -e "fetch('http://localhost:${PORT:-3847}/health').then(r => r.ok ? process.exit(0) : process.exit(1))"

EXPOSE 3847

ENV NODE_ENV=production
ENV DATA_DIR=/app/data

CMD ["node", "dist/demo/cli-runner.js", "--headless"]
```

**Notes for the builder:**
- The Dockerfile above is a template. Adapt paths based on actual monorepo structure
- If the package uses workspace protocol (`workspace:*`), you may need to copy the full workspace and build from root
- Test `docker build` locally to verify

### Create `packages/pump-agent-swarm/docker-compose.yml`

```yaml
version: "3.9"

services:
  swarm:
    build:
      context: .
      dockerfile: Dockerfile
    container_name: pump-swarm
    restart: unless-stopped
    env_file: .env
    ports:
      - "3847:3847"          # Dashboard API
      - "3848:3848"          # WebSocket hub
    volumes:
      - swarm-data:/app/data  # SQLite persistence
      - ./logs:/app/logs       # Log files
    environment:
      - NODE_ENV=production
      - DATA_DIR=/app/data
      - LOG_DIR=/app/logs
    deploy:
      resources:
        limits:
          cpus: "2.0"
          memory: 2G
        reservations:
          cpus: "0.5"
          memory: 512M
    healthcheck:
      test: ["CMD", "node", "-e", "fetch('http://localhost:3847/health').then(r => r.ok ? process.exit(0) : process.exit(1))"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 15s
    logging:
      driver: json-file
      options:
        max-size: "50m"
        max-file: "5"

  # Optional: monitoring with Grafana
  # Uncomment to enable the monitoring stack
  #
  # prometheus:
  #   image: prom/prometheus:latest
  #   container_name: swarm-prometheus
  #   volumes:
  #     - ./deploy/prometheus.yml:/etc/prometheus/prometheus.yml
  #     - prometheus-data:/prometheus
  #   ports:
  #     - "9090:9090"
  #
  # grafana:
  #   image: grafana/grafana:latest
  #   container_name: swarm-grafana
  #   volumes:
  #     - grafana-data:/var/lib/grafana
  #   ports:
  #     - "3000:3000"
  #   environment:
  #     - GF_SECURITY_ADMIN_PASSWORD=swarmadmin

volumes:
  swarm-data:
    driver: local
  # prometheus-data:
  # grafana-data:
```

### Create `packages/pump-agent-swarm/.env.example`

Template for all environment variables used across prompts 01-75:

```bash
# ═══════════════════════════════════════════
# Pump Agent Swarm — Environment Configuration
# ═══════════════════════════════════════════
# Copy to .env and fill in real values

# ── Solana Configuration ──────────────────
SOLANA_RPC_URL=https://api.mainnet-beta.solana.com
SOLANA_RPC_BACKUP_URL=https://rpc.helius.xyz/?api-key=YOUR_KEY
SOLANA_NETWORK=mainnet-beta
# For testing, use devnet:
# SOLANA_RPC_URL=https://api.devnet.solana.com
# SOLANA_NETWORK=devnet

# ── Master Wallet ─────────────────────────
# Base58 encoded private key of the master wallet
# ⚠️ NEVER commit this value. Use secrets manager in production.
MASTER_WALLET_PRIVATE_KEY=

# ── Wallet Vault ──────────────────────────
# AES-256-GCM encryption key for wallet storage (64 hex chars)
WALLET_ENCRYPTION_KEY=
# HD derivation seed phrase (BIP39 mnemonic)
WALLET_SEED_PHRASE=

# ── Jito Bundle Engine ────────────────────
JITO_BLOCK_ENGINE_URL=https://mainnet.block-engine.jito.wtf
JITO_AUTH_KEYPAIR=
JITO_TIP_LAMPORTS=10000

# ── Pump.fun API ──────────────────────────
PUMPFUN_API_URL=https://frontend-api-v3.pump.fun

# ── Jupiter DEX ───────────────────────────
JUPITER_API_URL=https://api.jup.ag

# ── AI / LLM ─────────────────────────────
OPENROUTER_API_KEY=
OPENROUTER_MODEL=google/gemini-2.0-flash-001
# Alternative models:
# OPENROUTER_MODEL=anthropic/claude-sonnet-4
# OPENROUTER_MODEL=openai/gpt-4o

# ── Image Generation ─────────────────────
# Stability AI or OpenAI for token art
STABILITY_API_KEY=
OPENAI_API_KEY=

# ── Telegram Bot ──────────────────────────
TELEGRAM_BOT_TOKEN=
TELEGRAM_CHAT_ID=
TELEGRAM_AUTHORIZED_USERS=123456789,987654321

# ── Dashboard ─────────────────────────────
DASHBOARD_PORT=3847
WEBSOCKET_PORT=3848
DASHBOARD_API_KEY=

# ── Risk Management ──────────────────────
MAX_TOTAL_INVESTMENT_SOL=10.0
MAX_SINGLE_TRADE_SOL=0.5
MAX_PORTFOLIO_DRAWDOWN_PERCENT=25
STOP_LOSS_PERCENT=15
TAKE_PROFIT_PERCENT=100

# ── Trading Parameters ───────────────────
DEFAULT_STRATEGY=ORGANIC
MAX_CONCURRENT_AGENTS=10
MAX_WALLETS=20
TRADE_COOLDOWN_MS=5000
MAX_SLIPPAGE_BPS=500

# ── Anti-Detection ───────────────────────
TIMING_JITTER_MIN_MS=1000
TIMING_JITTER_MAX_MS=15000
WALLET_ROTATION_THRESHOLD=50
AMOUNT_RANDOMIZATION_PERCENT=15

# ── Database ──────────────────────────────
DATA_DIR=./data
# DB_PATH defaults to $DATA_DIR/swarm.db

# ── Logging ───────────────────────────────
LOG_LEVEL=info
LOG_DIR=./logs
LOG_FORMAT=json

# ── Helius (optional, premium RPC) ───────
HELIUS_API_KEY=

# ── x402 Analytics (optional) ────────────
X402_PAYMENT_ENDPOINT=
X402_WALLET_PRIVATE_KEY=
```

### Create `packages/pump-agent-swarm/.dockerignore`

```
node_modules
dist
.env
.env.local
*.db
*.db-wal
*.db-shm
data/
logs/
coverage/
.git
.gitignore
.vscode
*.md
!README.md
src/__tests__
vitest.config.ts
vitest.e2e.config.ts
tsconfig.json
tsconfig.build.json
deploy/
```

### Create `packages/pump-agent-swarm/deploy/cloudrun.yaml`

Cloud Run service definition for Google Cloud:

```yaml
apiVersion: serving.knative.dev/v1
kind: Service
metadata:
  name: pump-agent-swarm
  labels:
    cloud.googleapis.com/location: us-central1
  annotations:
    run.googleapis.com/ingress: internal-and-cloud-load-balancing
    run.googleapis.com/execution-environment: gen2
spec:
  template:
    metadata:
      annotations:
        run.googleapis.com/cpu-throttling: "false"
        run.googleapis.com/startup-cpu-boost: "true"
        autoscaling.knative.dev/minScale: "1"
        autoscaling.knative.dev/maxScale: "1"
    spec:
      containerConcurrency: 80
      timeoutSeconds: 3600
      containers:
        - image: gcr.io/PROJECT_ID/pump-agent-swarm:latest
          ports:
            - name: http1
              containerPort: 3847
          resources:
            limits:
              cpu: "2"
              memory: 2Gi
          env:
            - name: NODE_ENV
              value: production
            - name: SOLANA_RPC_URL
              valueFrom:
                secretKeyRef:
                  key: latest
                  name: solana-rpc-url
            - name: MASTER_WALLET_PRIVATE_KEY
              valueFrom:
                secretKeyRef:
                  key: latest
                  name: master-wallet-key
            - name: WALLET_ENCRYPTION_KEY
              valueFrom:
                secretKeyRef:
                  key: latest
                  name: wallet-encryption-key
            - name: OPENROUTER_API_KEY
              valueFrom:
                secretKeyRef:
                  key: latest
                  name: openrouter-api-key
            - name: TELEGRAM_BOT_TOKEN
              valueFrom:
                secretKeyRef:
                  key: latest
                  name: telegram-bot-token
            - name: JITO_AUTH_KEYPAIR
              valueFrom:
                secretKeyRef:
                  key: latest
                  name: jito-auth-keypair
          volumeMounts:
            - name: swarm-data
              mountPath: /app/data
      volumes:
        - name: swarm-data
          emptyDir:
            sizeLimit: 1Gi
```

### Create `packages/pump-agent-swarm/deploy/k8s-deployment.yaml`

Kubernetes deployment for GKE or any K8s cluster:

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: pump-agent-swarm
  namespace: crypto-vision
  labels:
    app: pump-agent-swarm
spec:
  replicas: 1
  strategy:
    type: Recreate  # Single instance — no rolling update needed
  selector:
    matchLabels:
      app: pump-agent-swarm
  template:
    metadata:
      labels:
        app: pump-agent-swarm
    spec:
      serviceAccountName: pump-swarm-sa
      containers:
        - name: swarm
          image: gcr.io/PROJECT_ID/pump-agent-swarm:latest
          ports:
            - containerPort: 3847
              name: http
            - containerPort: 3848
              name: websocket
          resources:
            requests:
              cpu: 500m
              memory: 512Mi
            limits:
              cpu: "2"
              memory: 2Gi
          volumeMounts:
            - name: data
              mountPath: /app/data
          envFrom:
            - secretRef:
                name: pump-swarm-secrets
            - configMapRef:
                name: pump-swarm-config
          livenessProbe:
            httpGet:
              path: /health
              port: 3847
            initialDelaySeconds: 15
            periodSeconds: 30
          readinessProbe:
            httpGet:
              path: /health
              port: 3847
            initialDelaySeconds: 5
            periodSeconds: 10
      volumes:
        - name: data
          persistentVolumeClaim:
            claimName: pump-swarm-pvc
---
apiVersion: v1
kind: Service
metadata:
  name: pump-agent-swarm
  namespace: crypto-vision
spec:
  selector:
    app: pump-agent-swarm
  ports:
    - name: http
      port: 80
      targetPort: 3847
    - name: websocket
      port: 8080
      targetPort: 3848
  type: ClusterIP
---
apiVersion: v1
kind: PersistentVolumeClaim
metadata:
  name: pump-swarm-pvc
  namespace: crypto-vision
spec:
  accessModes:
    - ReadWriteOnce
  resources:
    requests:
      storage: 5Gi
  storageClassName: standard
---
apiVersion: v1
kind: ConfigMap
metadata:
  name: pump-swarm-config
  namespace: crypto-vision
data:
  NODE_ENV: production
  SOLANA_NETWORK: mainnet-beta
  DASHBOARD_PORT: "3847"
  WEBSOCKET_PORT: "3848"
  LOG_LEVEL: info
  MAX_CONCURRENT_AGENTS: "10"
  DEFAULT_STRATEGY: ORGANIC
```

### Success Criteria

- `docker build -t pump-swarm .` succeeds from `packages/pump-agent-swarm/`
- `docker compose up` starts the swarm with health check passing
- `.env.example` documents every environment variable used across all prompts
- `.dockerignore` excludes dev files, tests, and sensitive data
- Cloud Run YAML references secrets via Secret Manager
- K8s deployment includes PVC for data persistence, health probes, resource limits
- Non-root container user for security
- Compiles with `npx tsc --noEmit`
