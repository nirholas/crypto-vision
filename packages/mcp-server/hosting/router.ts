/**
 * MCP Hosting Platform - Router
 * @description Express router for hosted MCP servers with subdomain handling
 * @author nirholas
 */

import "dotenv/config"
import { randomUUID } from 'node:crypto'
import express, { Router, Request, Response, NextFunction } from 'express'
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js"
import { isInitializeRequest } from "@modelcontextprotocol/sdk/types.js"
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"

import { createHostedServer } from "./runtime.js"
import type { HostedMCPServer, HostedMCPTool } from "./types.js"
import { RESERVED_SUBDOMAINS, calculatePayout } from "./types.js"
import Logger from "@/utils/logger.js"

// ============================================================================
// Types
// ============================================================================

export interface HostedServerRequest extends Request {
  hostedServer?: HostedMCPServer
  subdomain?: string
}

export interface UsageLog {
  id: string
  serverId: string
  userId: string
  toolName: string
  timestamp: Date
  responseTime: number
  success: boolean
  paymentAmount?: number
  paymentTxHash?: string
  error?: string
}

export interface ServerSession {
  transport: StreamableHTTPServerTransport
  server: McpServer
  serverId: string
  lastAccess: Date
}

// ============================================================================
// Database Interface (mock - replace with actual DB in production)
// ============================================================================

// In-memory storage for development (replace with PostgreSQL/Prisma in production)
const hostedServersDB = new Map<string, HostedMCPServer>()
const usageLogsDB: UsageLog[] = []

/**
 * Get hosted server config by subdomain
 * In production, this queries the database
 */
export async function getServerBySubdomain(subdomain: string): Promise<HostedMCPServer | null> {
  // TODO: Replace with actual database query
  // Example: return await prisma.hostedMCPServer.findUnique({ where: { subdomain } })
  return hostedServersDB.get(subdomain) || null
}

/**
 * Increment call count for a server
 */
export async function incrementCallCount(serverId: string): Promise<void> {
  // TODO: Replace with actual database update
  const server = Array.from(hostedServersDB.values()).find(s => s.id === serverId)
  if (server) {
    server.totalCalls++
    server.callsThisMonth++
    server.updatedAt = new Date()
  }
}

/**
 * Log usage to database
 */
export async function logUsage(log: Omit<UsageLog, 'id'>): Promise<void> {
  const usageLog: UsageLog = {
    ...log,
    id: randomUUID(),
  }
  usageLogsDB.push(usageLog)
  
  Logger.debug("Usage logged", {
    serverId: log.serverId,
    toolName: log.toolName,
    success: log.success,
  })
}

// ============================================================================
// Subdomain Extraction
// ============================================================================

/**
 * Extract subdomain from hostname
 * Examples:
 * - myserver.agenti.cash -> myserver
 * - myserver.localhost -> myserver
 * - api.agenti.cash -> api (reserved)
 * - agenti.cash -> null
 */
export function extractSubdomain(hostname: string): string | null {
  // Handle localhost for development
  if (hostname.includes('localhost')) {
    const parts = hostname.split('.')
    if (parts.length >= 2 && parts[0] && parts[0] !== 'localhost') {
      return parts[0].toLowerCase()
    }
    return null
  }
  
  // Handle agenti.cash domain
  const domainMatch = hostname.match(/^([^.]+)\.agenti\.cash$/i)
  if (domainMatch && domainMatch[1]) {
    return domainMatch[1].toLowerCase()
  }
  
  // Handle custom domains (check against database)
  // For now, extract first part of any multi-part domain
  const parts = hostname.split('.')
  if (parts.length >= 3 && parts[0]) {
    return parts[0].toLowerCase()
  }
  
  return null
}

/**
 * Check if subdomain is reserved
 */
export function isReservedSubdomain(subdomain: string): boolean {
  return RESERVED_SUBDOMAINS.includes(subdomain.toLowerCase())
}

// ============================================================================
// Session Management
// ============================================================================

const sessions = new Map<string, ServerSession>()

// Clean up stale sessions every 5 minutes
setInterval(() => {
  const now = new Date()
  const staleThreshold = 30 * 60 * 1000 // 30 minutes
  
  for (const [sessionId, session] of sessions.entries()) {
    if (now.getTime() - session.lastAccess.getTime() > staleThreshold) {
      Logger.info("Cleaning up stale session", { sessionId, serverId: session.serverId })
      session.transport.close?.()
      sessions.delete(sessionId)
    }
  }
}, 5 * 60 * 1000)

// ============================================================================
// Middleware
// ============================================================================

/**
 * Middleware to load server config from database by subdomain
 */
export async function loadServerConfig(
  req: HostedServerRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  const subdomain = extractSubdomain(req.hostname)
  
  if (!subdomain) {
    res.status(400).json({
      error: "Invalid subdomain",
      message: "Could not extract subdomain from hostname"
    })
    return
  }
  
  if (isReservedSubdomain(subdomain)) {
    res.status(403).json({
      error: "Reserved subdomain",
      message: `The subdomain '${subdomain}' is reserved for system use`
    })
    return
  }
  
  const server = await getServerBySubdomain(subdomain)
  
  if (!server) {
    res.status(404).json({
      error: "Server not found",
      message: `No MCP server found at ${subdomain}.agenti.cash`,
      hint: "Create a server at https://agenti.cash/dashboard"
    })
    return
  }
  
  if (server.status !== 'active') {
    res.status(503).json({
      error: "Server unavailable",
      message: `The MCP server at ${subdomain}.agenti.cash is currently ${server.status}`,
      status: server.status
    })
    return
  }
  
  req.hostedServer = server
  req.subdomain = subdomain
  next()
}

/**
 * Middleware to track usage
 */
export function trackUsage(
  req: HostedServerRequest,
  res: Response,
  next: NextFunction
): void {
  const startTime = Date.now()
  
  // Track response completion
  res.on('finish', async () => {
    if (req.hostedServer) {
      const responseTime = Date.now() - startTime
      
      await incrementCallCount(req.hostedServer.id)
      
      await logUsage({
        serverId: req.hostedServer.id,
        userId: req.hostedServer.userId,
        toolName: req.body?.method || 'unknown',
        timestamp: new Date(),
        responseTime,
        success: res.statusCode < 400,
        error: res.statusCode >= 400 ? `HTTP ${res.statusCode}` : undefined
      })
    }
  })
  
  next()
}

// ============================================================================
// Payment Handling
// ============================================================================

/**
 * Generate 402 Payment Required response
 */
export function generate402Response(
  tool: HostedMCPTool,
  server: HostedMCPServer
): object {
  const { creatorAmount, platformAmount } = calculatePayout(tool.price)
  
  return {
    jsonrpc: "2.0",
    error: {
      code: 402,
      message: "Payment Required",
      data: {
        tool: tool.name,
        price: {
          amount: tool.price,
          currency: "USDC",
        },
        payment: {
          network: "eip155:8453", // Base mainnet
          recipient: server.pricing.payoutAddress,
          breakdown: {
            creatorReceives: creatorAmount,
            platformFee: platformAmount,
          },
        },
        x402: {
          version: "1.0",
          accepts: ["x402"],
          paymentUrl: `https://${server.subdomain}.agenti.cash/mcp`,
          paymentHeader: "X-Payment-Proof",
        },
        acceptedMethods: server.pricing.acceptedPayments,
      }
    }
  }
}

// ============================================================================
// Router
// ============================================================================

export function createHostingRouter(): Router {
  const router = Router()
  
  // Apply middleware to all routes
  router.use(express.json())
  router.use(loadServerConfig)
  router.use(trackUsage)
  
  // Health check endpoint
  router.get('/health', (req: HostedServerRequest, res: Response) => {
    const server = req.hostedServer!
    
    res.json({
      status: "healthy",
      server: {
        name: server.name,
        subdomain: server.subdomain,
        status: server.status,
        toolCount: server.tools.filter(t => t.enabled).length,
        promptCount: server.prompts.filter(p => p.enabled).length,
        resourceCount: server.resources.filter(r => r.enabled).length,
      },
      stats: {
        totalCalls: server.totalCalls,
        callsThisMonth: server.callsThisMonth,
      },
      timestamp: new Date().toISOString()
    })
  })
  
  // Server info endpoint
  router.get('/', (req: HostedServerRequest, res: Response) => {
    const server = req.hostedServer!
    
    res.json({
      name: server.name,
      description: server.description,
      url: `https://${server.subdomain}.agenti.cash`,
      protocol: "mcp",
      transport: "streamable-http",
      endpoints: {
        mcp: "/mcp",
        health: "/health",
      },
      tools: server.tools
        .filter(t => t.enabled)
        .map(t => ({
          name: t.name,
          description: t.description,
          price: t.price > 0 ? { amount: t.price, currency: "USDC" } : null,
        })),
      prompts: server.prompts
        .filter(p => p.enabled)
        .map(p => ({
          name: p.name,
          description: p.description,
          price: p.price > 0 ? { amount: p.price, currency: "USDC" } : null,
        })),
      pricing: {
        acceptedPayments: server.pricing.acceptedPayments,
        defaultToolPrice: server.pricing.defaultToolPrice,
      }
    })
  })
  
  // Main MCP endpoint - handles all MCP protocol messages
  router.post('/mcp', async (req: HostedServerRequest, res: Response) => {
    const hostedConfig = req.hostedServer!
    const sessionId = req.headers["mcp-session-id"] as string | undefined
    let session = sessionId ? sessions.get(sessionId) : undefined
    
    // Check if payment is provided for paid tools
    const paymentProof = req.headers["x-payment-proof"] as string | undefined
    
    // Handle new session initialization
    if (!session) {
      if (!isInitializeRequest(req.body)) {
        res.status(400).json({
          jsonrpc: "2.0",
          error: {
            code: -32600,
            message: "Bad Request: No valid session found. Send an initialize request first."
          },
          id: req.body?.id ?? null
        })
        return
      }
      
      try {
        // Create MCP server from hosted config
        const mcpServer = await createHostedServer(hostedConfig)
        
        const transport = new StreamableHTTPServerTransport({
          sessionIdGenerator: () => randomUUID(),
          onsessioninitialized: (newSessionId: string) => {
            Logger.info("New hosted session initialized", {
              sessionId: newSessionId,
              subdomain: hostedConfig.subdomain,
              serverId: hostedConfig.id,
            })
            sessions.set(newSessionId, {
              transport,
              server: mcpServer,
              serverId: hostedConfig.id,
              lastAccess: new Date(),
            })
          }
        })
        
        // Handle session close
        transport.onclose = () => {
          const sid = transport.sessionId
          if (sid) {
            Logger.info("Hosted session closed", {
              sessionId: sid,
              subdomain: hostedConfig.subdomain,
            })
            sessions.delete(sid)
          }
        }
        
        await mcpServer.connect(transport)
        session = {
          transport,
          server: mcpServer,
          serverId: hostedConfig.id,
          lastAccess: new Date(),
        }
      } catch (error) {
        Logger.error("Failed to create hosted server", {
          subdomain: hostedConfig.subdomain,
          error,
        })
        res.status(500).json({
          jsonrpc: "2.0",
          error: {
            code: -32603,
            message: "Failed to initialize hosted server"
          },
          id: (req.body as any)?.id ?? null
        })
        return
      }
    }
    
    // Update last access time
    session.lastAccess = new Date()
    
    // Check for tool payment requirement
    if (req.body?.method === 'tools/call') {
      const toolName = req.body?.params?.name
      const tool = hostedConfig.tools.find(t => t.name === toolName && t.enabled)
      
      if (tool && tool.price > 0 && !paymentProof) {
        // Return 402 with payment details
        res.status(402).json(generate402Response(tool, hostedConfig))
        
        await logUsage({
          serverId: hostedConfig.id,
          userId: hostedConfig.userId,
          toolName,
          timestamp: new Date(),
          responseTime: 0,
          success: false,
          error: "Payment required"
        })
        return
      }
      
      // If payment provided, inject it into the request for verification
      if (paymentProof) {
        req.body.params = {
          ...req.body.params,
          arguments: {
            ...req.body.params?.arguments,
            _paymentProof: paymentProof,
          }
        }
      }
    }
    
    // Handle the request
    try {
      await session.transport.handleRequest(req, res, req.body)
    } catch (error) {
      Logger.error("Error handling hosted MCP request", {
        sessionId,
        subdomain: hostedConfig.subdomain,
        error,
      })
      if (!res.headersSent) {
        res.status(500).json({
          jsonrpc: "2.0",
          error: {
            code: -32603,
            message: "Internal server error"
          },
          id: req.body?.id ?? null
        })
      }
    }
  })
  
  // Handle GET requests for SSE streams (server-to-client notifications)
  router.get('/mcp', async (req: HostedServerRequest, res: Response) => {
    const sessionId = req.headers["mcp-session-id"] as string
    const session = sessions.get(sessionId)
    
    if (!session) {
      res.status(400).json({
        error: "No valid session found. Send an initialize request first."
      })
      return
    }
    
    session.lastAccess = new Date()
    
    try {
      await session.transport.handleRequest(req, res)
    } catch (error) {
      Logger.error("Error handling SSE stream", {
        sessionId,
        subdomain: req.subdomain,
        error,
      })
      if (!res.headersSent) {
        res.status(500).send("Internal server error")
      }
    }
  })
  
  // Handle session termination
  router.delete('/mcp', async (req: HostedServerRequest, res: Response) => {
    const sessionId = req.headers["mcp-session-id"] as string
    const session = sessions.get(sessionId)
    
    if (!session) {
      res.status(404).json({ error: "Session not found" })
      return
    }
    
    try {
      await session.transport.close?.()
      sessions.delete(sessionId)
      res.status(200).json({ message: "Session terminated" })
      Logger.info("Session terminated via DELETE", {
        sessionId,
        subdomain: req.subdomain,
      })
    } catch (error) {
      Logger.error("Error terminating session", {
        sessionId,
        subdomain: req.subdomain,
        error,
      })
      res.status(500).json({ error: "Failed to terminate session" })
    }
  })
  
  return router
}

// ============================================================================
// Route to Hosted Server (for wildcard-server.ts)
// ============================================================================

/**
 * Route a request to a hosted server
 * Used by the wildcard server to handle subdomain requests
 */
export async function routeToHostedServer(
  subdomain: string,
  req: Request,
  res: Response
): Promise<void> {
  // Add subdomain to request
  (req as HostedServerRequest).subdomain = subdomain
  
  // Create a mini-router for this request
  const router = createHostingRouter()
  
  // Execute the router
  router(req, res, ((err?: unknown) => {
    if (err) {
      Logger.error("Error routing to hosted server", { subdomain, error: err })
      res.status(500).json({
        error: "Internal server error",
        message: err instanceof Error ? err.message : 'Unknown error'
      })
    }
  }) as any)
}

export default {
  createHostingRouter,
  routeToHostedServer,
  extractSubdomain,
  isReservedSubdomain,
  loadServerConfig,
  trackUsage,
  generate402Response,
  getServerBySubdomain,
  incrementCallCount,
  logUsage,
}
