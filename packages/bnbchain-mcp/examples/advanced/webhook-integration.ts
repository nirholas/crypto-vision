#!/usr/bin/env npx ts-node
/**
 * Webhook Integration - Advanced Example
 * 
 * This example demonstrates how to:
 * - Create an HTTP server with Express.js
 * - Implement SSE (Server-Sent Events) for real-time updates
 * - Set up webhook endpoints for external integrations
 * - Add rate limiting and authentication
 * - Handle concurrent requests to MCP tools
 * 
 * Difficulty: ⭐⭐⭐ Advanced
 * Prerequisites: Node.js 18+, pnpm
 * Estimated Time: 40 minutes
 * 
 * @author Nich
 * @license MIT
 */

import "dotenv/config"
import express, { type Request, type Response, type NextFunction } from "express"
import chalk from "chalk"
import {
  createMCPClient,
  callTool,
  printHeader,
  printSection,
  printKeyValue,
  printSuccess,
  printError,
  printInfo,
  formatNumber,
  formatUSD,
  getEnv,
  NETWORKS
} from "../lib/utils.js"
import type { Client } from "@modelcontextprotocol/sdk/client/index.js"

// ============================================================================
// Configuration
// ============================================================================

const PORT = parseInt(getEnv("PORT", "3000"))
const HOST = getEnv("HOST", "0.0.0.0")
const WEBHOOK_SECRET = getEnv("WEBHOOK_SECRET", "")
const RATE_LIMIT_WINDOW = 60 * 1000 // 1 minute
const RATE_LIMIT_MAX = 100 // requests per window

// ============================================================================
// Types
// ============================================================================

interface SSEClient {
  id: string
  response: Response
  topics: Set<string>
}

interface WebhookPayload {
  event: string
  data: Record<string, unknown>
  timestamp: string
}

interface RateLimitEntry {
  count: number
  resetTime: number
}

// ============================================================================
// Rate Limiter
// ============================================================================

const rateLimitStore = new Map<string, RateLimitEntry>()

function rateLimit(req: Request, res: Response, next: NextFunction): void {
  const ip = req.ip || req.socket.remoteAddress || "unknown"
  const now = Date.now()
  
  let entry = rateLimitStore.get(ip)
  
  if (!entry || now > entry.resetTime) {
    entry = {
      count: 1,
      resetTime: now + RATE_LIMIT_WINDOW
    }
    rateLimitStore.set(ip, entry)
    next()
    return
  }
  
  entry.count++
  
  if (entry.count > RATE_LIMIT_MAX) {
    res.status(429).json({
      error: "Too many requests",
      retryAfter: Math.ceil((entry.resetTime - now) / 1000)
    })
    return
  }
  
  next()
}

// ============================================================================
// Authentication Middleware
// ============================================================================

function authenticateWebhook(req: Request, res: Response, next: NextFunction): void {
  if (!WEBHOOK_SECRET) {
    // No secret configured, skip auth
    next()
    return
  }
  
  const signature = req.headers["x-webhook-signature"]
  
  if (!signature || signature !== WEBHOOK_SECRET) {
    res.status(401).json({ error: "Unauthorized" })
    return
  }
  
  next()
}

// ============================================================================
// SSE Manager
// ============================================================================

class SSEManager {
  private clients: Map<string, SSEClient> = new Map()
  
  addClient(res: Response, topics: string[] = ["*"]): string {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2)}`
    
    res.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      "Connection": "keep-alive",
      "Access-Control-Allow-Origin": "*"
    })
    
    const client: SSEClient = {
      id,
      response: res,
      topics: new Set(topics)
    }
    
    this.clients.set(id, client)
    
    // Send initial connection message
    this.sendToClient(id, "connected", { clientId: id })
    
    // Handle disconnect
    res.on("close", () => {
      this.clients.delete(id)
      console.log(chalk.gray(`[SSE] Client ${id} disconnected`))
    })
    
    console.log(chalk.green(`[SSE] Client ${id} connected`))
    return id
  }
  
  sendToClient(clientId: string, event: string, data: unknown): void {
    const client = this.clients.get(clientId)
    if (!client) return
    
    const message = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`
    client.response.write(message)
  }
  
  broadcast(event: string, data: unknown, topic = "*"): void {
    for (const client of this.clients.values()) {
      if (client.topics.has("*") || client.topics.has(topic)) {
        const message = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`
        client.response.write(message)
      }
    }
  }
  
  getClientCount(): number {
    return this.clients.size
  }
}

// ============================================================================
// Server Setup
// ============================================================================

async function createServer(): Promise<void> {
  const app = express()
  const sseManager = new SSEManager()
  let mcpClient: Client | null = null
  
  // Middleware
  app.use(express.json())
  app.use(rateLimit)
  
  // CORS
  app.use((req, res, next) => {
    res.header("Access-Control-Allow-Origin", "*")
    res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept, X-Webhook-Signature")
    res.header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
    if (req.method === "OPTIONS") {
      res.sendStatus(200)
      return
    }
    next()
  })
  
  // Connect to MCP
  printInfo("Connecting to MCP server...")
  try {
    mcpClient = await createMCPClient()
    printSuccess("Connected to Universal Crypto MCP")
  } catch (error) {
    printError(`Failed to connect to MCP: ${(error as Error).message}`)
    process.exit(1)
  }
  
  // ========== Health Check ==========
  app.get("/health", (req, res) => {
    res.json({
      status: "ok",
      mcpConnected: mcpClient !== null,
      sseClients: sseManager.getClientCount(),
      timestamp: new Date().toISOString()
    })
  })
  
  // ========== SSE Endpoint ==========
  app.get("/events", (req, res) => {
    const topics = (req.query.topics as string)?.split(",") || ["*"]
    const clientId = sseManager.addClient(res, topics)
    
    // Keep connection alive
    const keepAlive = setInterval(() => {
      sseManager.sendToClient(clientId, "ping", { time: Date.now() })
    }, 30000)
    
    res.on("close", () => {
      clearInterval(keepAlive)
    })
  })
  
  // ========== API Endpoints ==========
  
  // Get balance
  app.get("/api/balance/:address", async (req, res) => {
    const { address } = req.params
    const network = (req.query.network as string) || "ethereum"
    
    try {
      const result = await callTool(mcpClient!, "get_native_balance", {
        address,
        network
      })
      
      res.json({
        success: true,
        data: result,
        network,
        timestamp: new Date().toISOString()
      })
      
      // Broadcast to SSE clients
      sseManager.broadcast("balance", { address, network, result }, "balance")
      
    } catch (error) {
      res.status(500).json({
        success: false,
        error: (error as Error).message
      })
    }
  })
  
  // Get gas prices
  app.get("/api/gas/:network", async (req, res) => {
    const { network } = req.params
    
    try {
      const result = await callTool(mcpClient!, "get_gas_price", { network })
      
      res.json({
        success: true,
        data: result,
        network,
        timestamp: new Date().toISOString()
      })
      
      // Broadcast to SSE clients
      sseManager.broadcast("gas", { network, result }, "gas")
      
    } catch (error) {
      res.status(500).json({
        success: false,
        error: (error as Error).message
      })
    }
  })
  
  // Get token info
  app.get("/api/token/:network/:address", async (req, res) => {
    const { network, address } = req.params
    
    try {
      const result = await callTool(mcpClient!, "get_erc20_token_info", {
        tokenAddress: address,
        network
      })
      
      res.json({
        success: true,
        data: result,
        timestamp: new Date().toISOString()
      })
      
    } catch (error) {
      res.status(500).json({
        success: false,
        error: (error as Error).message
      })
    }
  })
  
  // Get market data
  app.get("/api/market/:coinId", async (req, res) => {
    const { coinId } = req.params
    
    try {
      const result = await callTool(mcpClient!, "market_get_coin_by_id", {
        coinId,
        currency: "USD"
      })
      
      res.json({
        success: true,
        data: result,
        timestamp: new Date().toISOString()
      })
      
    } catch (error) {
      res.status(500).json({
        success: false,
        error: (error as Error).message
      })
    }
  })
  
  // Security check
  app.get("/api/security/:network/:address", async (req, res) => {
    const { network, address } = req.params
    
    try {
      const result = await callTool(mcpClient!, "security_check_token", {
        tokenAddress: address,
        network
      })
      
      res.json({
        success: true,
        data: result,
        timestamp: new Date().toISOString()
      })
      
      // Broadcast to SSE clients (security alerts are important)
      sseManager.broadcast("security", { network, address, result }, "security")
      
    } catch (error) {
      res.status(500).json({
        success: false,
        error: (error as Error).message
      })
    }
  })
  
  // ========== Webhook Endpoints ==========
  
  // Incoming webhook handler
  app.post("/webhook/incoming", authenticateWebhook, async (req, res) => {
    const payload = req.body as WebhookPayload
    
    console.log(chalk.blue(`[Webhook] Received: ${payload.event}`))
    
    try {
      // Handle different webhook events
      switch (payload.event) {
        case "price_alert":
          // Fetch current price and compare
          if (payload.data.coinId) {
            const result = await callTool(mcpClient!, "market_get_coin_by_id", {
              coinId: payload.data.coinId as string,
              currency: "USD"
            })
            sseManager.broadcast("price_alert", { ...payload.data, result }, "alerts")
          }
          break
          
        case "balance_check":
          // Check balance for address
          if (payload.data.address && payload.data.network) {
            const result = await callTool(mcpClient!, "get_native_balance", {
              address: payload.data.address as string,
              network: payload.data.network as string
            })
            sseManager.broadcast("balance_check", { ...payload.data, result }, "alerts")
          }
          break
          
        case "security_scan":
          // Run security check
          if (payload.data.tokenAddress && payload.data.network) {
            const result = await callTool(mcpClient!, "security_check_token", {
              tokenAddress: payload.data.tokenAddress as string,
              network: payload.data.network as string
            })
            sseManager.broadcast("security_scan", { ...payload.data, result }, "alerts")
          }
          break
          
        default:
          // Forward unknown events to SSE clients
          sseManager.broadcast(payload.event, payload.data, "custom")
      }
      
      res.json({
        success: true,
        processed: payload.event,
        timestamp: new Date().toISOString()
      })
      
    } catch (error) {
      res.status(500).json({
        success: false,
        error: (error as Error).message
      })
    }
  })
  
  // Webhook registration (for outgoing webhooks)
  const webhookRegistry = new Map<string, { url: string; events: string[] }>()
  
  app.post("/webhook/register", authenticateWebhook, (req, res) => {
    const { url, events } = req.body
    
    if (!url || !events || !Array.isArray(events)) {
      res.status(400).json({ error: "Missing url or events" })
      return
    }
    
    const id = `wh_${Date.now()}`
    webhookRegistry.set(id, { url, events })
    
    console.log(chalk.green(`[Webhook] Registered: ${id} -> ${url}`))
    
    res.json({
      success: true,
      webhookId: id,
      events
    })
  })
  
  app.delete("/webhook/:id", authenticateWebhook, (req, res) => {
    const { id } = req.params
    
    if (webhookRegistry.has(id)) {
      webhookRegistry.delete(id)
      res.json({ success: true })
    } else {
      res.status(404).json({ error: "Webhook not found" })
    }
  })
  
  // ========== Documentation ==========
  
  app.get("/", (req, res) => {
    res.json({
      name: "Universal Crypto MCP Webhook Server",
      version: "1.0.0",
      endpoints: {
        health: "GET /health",
        events: "GET /events - SSE endpoint",
        api: {
          balance: "GET /api/balance/:address?network=ethereum",
          gas: "GET /api/gas/:network",
          token: "GET /api/token/:network/:address",
          market: "GET /api/market/:coinId",
          security: "GET /api/security/:network/:address"
        },
        webhooks: {
          incoming: "POST /webhook/incoming",
          register: "POST /webhook/register",
          unregister: "DELETE /webhook/:id"
        }
      },
      sseTopics: ["balance", "gas", "security", "alerts", "custom"],
      documentation: "https://universal-crypto-mcp.vercel.app/"
    })
  })
  
  // ========== Error Handler ==========
  
  app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
    console.error(chalk.red(`[Error] ${err.message}`))
    res.status(500).json({
      error: "Internal server error",
      message: err.message
    })
  })
  
  // ========== Start Server ==========
  
  app.listen(PORT, HOST, () => {
    printHeader("🌐 Webhook Integration Server")
    printSection("Server Info")
    printKeyValue("Host", HOST)
    printKeyValue("Port", PORT.toString())
    printKeyValue("MCP Connected", "Yes")
    
    printSection("Endpoints")
    console.log(`  Health:    http://${HOST}:${PORT}/health`)
    console.log(`  SSE:       http://${HOST}:${PORT}/events`)
    console.log(`  API:       http://${HOST}:${PORT}/api/...`)
    console.log(`  Webhooks:  http://${HOST}:${PORT}/webhook/...`)
    
    printSection("SSE Topics")
    console.log("  balance, gas, security, alerts, custom")
    
    if (WEBHOOK_SECRET) {
      printSuccess("Webhook authentication enabled")
    } else {
      printWarning("Webhook authentication disabled (set WEBHOOK_SECRET)")
    }
    
    printInfo("\nPress Ctrl+C to stop server")
  })
  
  // Graceful shutdown
  process.on("SIGINT", async () => {
    printInfo("\nShutting down server...")
    if (mcpClient) {
      await mcpClient.close()
    }
    process.exit(0)
  })
}

// ============================================================================
// Main Entry Point
// ============================================================================

async function main(): Promise<void> {
  await createServer()
}

main().catch(console.error)

// ============================================================================
// Usage Examples
// ============================================================================

/**
 * @example Start server
 * ```bash
 * npx ts-node advanced/webhook-integration.ts
 * ```
 * 
 * @example With custom port
 * ```bash
 * PORT=8080 npx ts-node advanced/webhook-integration.ts
 * ```
 * 
 * @example With authentication
 * ```bash
 * WEBHOOK_SECRET=my-secret-key npx ts-node advanced/webhook-integration.ts
 * ```
 * 
 * @example Test endpoints
 * ```bash
 * # Health check
 * curl http://localhost:3000/health
 * 
 * # Get balance
 * curl http://localhost:3000/api/balance/0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045?network=ethereum
 * 
 * # Get gas prices
 * curl http://localhost:3000/api/gas/ethereum
 * 
 * # SSE connection
 * curl -N http://localhost:3000/events?topics=balance,gas
 * 
 * # Incoming webhook
 * curl -X POST http://localhost:3000/webhook/incoming \
 *   -H "Content-Type: application/json" \
 *   -d '{"event": "price_alert", "data": {"coinId": "ethereum"}, "timestamp": "2024-01-01T00:00:00Z"}'
 * ```
 */
