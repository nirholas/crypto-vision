/**
 * MCP Hosting Platform - Wildcard Server
 * @description Standalone Express server for handling *.agenti.cash subdomain requests
 * @author nirholas
 * 
 * This server runs on port 3001 and handles all wildcard subdomain traffic.
 * It routes requests to the appropriate hosted MCP server based on the subdomain.
 * 
 * Architecture:
 * - Main app runs on port 3000 (api.agenti.cash, www.agenti.cash)
 * - This wildcard server runs on port 3001 (*.agenti.cash)
 * - Nginx routes traffic based on subdomain
 */

import "dotenv/config"

import express from 'express'
import type { Request, Response, NextFunction } from 'express'
import cors from 'cors'

import {
  extractSubdomain,
  isReservedSubdomain,
  routeToHostedServer,
} from './router.js'
import Logger from '@/utils/logger.js'

// ============================================================================
// Types
// ============================================================================

interface WildcardRequest extends Request {
  subdomain?: string
}

// ============================================================================
// Server Configuration
// ============================================================================

const WILDCARD_PORT = process.env.WILDCARD_PORT || 3001
const NODE_ENV = process.env.NODE_ENV || 'development'

// Reserved subdomains that should be handled by the main app
const MAIN_APP_SUBDOMAINS = ['www', 'api', 'app', 'admin', 'dashboard', 'docs']

// ============================================================================
// Express App
// ============================================================================

const app = express()

// Trust proxy for proper IP detection behind nginx
app.set('trust proxy', true)

// CORS configuration
app.use(cors({
  origin: (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) => {
    // Allow requests with no origin (mobile apps, curl, etc.)
    if (!origin) return callback(null, true)
    
    // Allow any agenti.cash subdomain
    if (origin.match(/^https?:\/\/([^.]+\.)?agenti\.cash$/)) {
      return callback(null, true)
    }
    
    // Allow localhost in development
    if (NODE_ENV === 'development' && origin.includes('localhost')) {
      return callback(null, true)
    }
    
    callback(null, true) // Allow all origins for MCP
  },
  methods: ['GET', 'POST', 'DELETE', 'OPTIONS'],
  allowedHeaders: [
    'Content-Type',
    'mcp-session-id',
    'last-event-id',
    'x-payment-proof',
    'authorization',
  ],
  exposedHeaders: ['mcp-session-id'],
  credentials: true,
}))

// Body parsing
app.use(express.json({ limit: '10mb' }))
app.use(express.urlencoded({ extended: true }))

// Request logging
app.use((req: WildcardRequest, res: Response, next: NextFunction) => {
  const start = Date.now()
  const subdomain = extractSubdomain(req.hostname)
  
  res.on('finish', () => {
    const duration = Date.now() - start
    Logger.info('Request', {
      method: req.method,
      path: req.path,
      subdomain,
      status: res.statusCode,
      duration: `${duration}ms`,
      ip: req.ip,
    })
  })
  
  next()
})

// ============================================================================
// Wildcard Subdomain Middleware
// ============================================================================

/**
 * Main wildcard subdomain handler
 * Routes requests to hosted MCP servers based on subdomain
 */
app.use(async (req: WildcardRequest, res: Response, next: NextFunction) => {
  const subdomain = extractSubdomain(req.hostname)
  
  // No subdomain - shouldn't reach this server, but handle gracefully
  if (!subdomain) {
    Logger.warn('Request without subdomain', { hostname: req.hostname })
    return res.redirect('https://agenti.cash')
  }
  
  // Reserved subdomains should be handled by main app
  if (MAIN_APP_SUBDOMAINS.includes(subdomain)) {
    Logger.debug('Reserved subdomain, proxying to main app', { subdomain })
    // In production, nginx should route these directly to main app
    // For now, redirect
    return res.redirect(`https://agenti.cash${req.path}`)
  }
  
  // Check for other reserved subdomains
  if (isReservedSubdomain(subdomain)) {
    return res.status(403).json({
      error: 'Reserved subdomain',
      message: `The subdomain '${subdomain}' is reserved for system use`,
    })
  }
  
  // Store subdomain on request for logging/debugging
  req.subdomain = subdomain
  
  try {
    // Route to the hosted MCP server
    await routeToHostedServer(subdomain, req, res)
  } catch (error) {
    Logger.error('Error routing to hosted server', {
      subdomain,
      path: req.path,
      error,
    })
    
    if (!res.headersSent) {
      res.status(500).json({
        error: 'Server Error',
        message: 'Failed to route request to hosted server',
      })
    }
  }
})

// ============================================================================
// Error Handling
// ============================================================================

// 404 handler
app.use((req: Request, res: Response) => {
  res.status(404).json({
    error: 'Not Found',
    message: `No route found for ${req.method} ${req.path}`,
    help: 'Visit https://agenti.cash/docs for API documentation',
  })
})

// Global error handler
app.use((err: Error, req: Request, res: Response, _next: NextFunction) => {
  Logger.error('Unhandled error', {
    error: err.message,
    stack: err.stack,
    path: req.path,
    method: req.method,
  })
  
  if (!res.headersSent) {
    res.status(500).json({
      error: 'Internal Server Error',
      message: NODE_ENV === 'development' ? err.message : 'An unexpected error occurred',
    })
  }
})

// ============================================================================
// Health Check (for load balancer / kubernetes)
// ============================================================================

// Health endpoint on a different port for load balancer checks
const healthApp = express()

healthApp.get('/health', (req: Request, res: Response) => {
  res.json({
    status: 'healthy',
    service: 'mcp-wildcard-server',
    port: WILDCARD_PORT,
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    memory: process.memoryUsage(),
  })
})

healthApp.get('/ready', (req: Request, res: Response) => {
  // Add any readiness checks here (database, redis, etc.)
  res.json({
    ready: true,
    timestamp: new Date().toISOString(),
  })
})

// ============================================================================
// Server Startup
// ============================================================================

/**
 * Start the wildcard server
 */
export async function startWildcardServer(): Promise<void> {
  try {
    // Start main wildcard server
    app.listen(WILDCARD_PORT, () => {
      Logger.info(`🚀 MCP Wildcard Server running on port ${WILDCARD_PORT}`)
      Logger.info(`   Environment: ${NODE_ENV}`)
      Logger.info(`   Handling: *.agenti.cash`)
      Logger.info(`   Health check: http://localhost:${WILDCARD_PORT}/health`)
    })
    
    // Start health check server on a separate port
    const HEALTH_PORT = Number(WILDCARD_PORT) + 1000 // 4001 by default
    healthApp.listen(HEALTH_PORT, () => {
      Logger.info(`   Health server: http://localhost:${HEALTH_PORT}/health`)
    })
    
    // Graceful shutdown
    const shutdown = async (signal: string) => {
      Logger.info(`${signal} received, shutting down gracefully...`)
      
      // Give existing requests time to complete
      setTimeout(() => {
        Logger.info('Shutdown complete')
        process.exit(0)
      }, 5000)
    }
    
    process.on('SIGTERM', () => shutdown('SIGTERM'))
    process.on('SIGINT', () => shutdown('SIGINT'))
    
  } catch (error) {
    Logger.error('Failed to start wildcard server', { error })
    process.exit(1)
  }
}

// ============================================================================
// CLI Entry Point
// ============================================================================

// Start server if run directly
if (process.argv[1]?.includes('wildcard-server')) {
  startWildcardServer()
}

export default app
