/**
 * DeFi API Routes
 * Exposes DeFi functionality through REST API
 */

import { Hono } from "hono";
import { z } from "zod";
import { zValidator } from "@hono/zod-validator";
import {
  defiAggregator,
  DeFiProtocol,
  type DeFiProductType,
  RiskLevel,
} from "../../services/defi/index.js";
import { defiRouter } from "../../services/defi/router.js";

// ============================================================
// Schemas
// ============================================================

const chainParamSchema = z.object({
  chain: z.string(),
});

const protocolParamSchema = z.object({
  chain: z.string(),
  protocol: z.nativeEnum(DeFiProtocol),
});

const vaultParamSchema = z.object({
  chain: z.string(),
  protocol: z.nativeEnum(DeFiProtocol),
  vaultAddress: z.string(),
});

const quoteQuerySchema = z.object({
  amount: z.string(),
  userAddress: z.string(),
});

const routeQuerySchema = z.object({
  assetAddress: z.string(),
  amount: z.string(),
  userAddress: z.string(),
  maxRiskLevel: z.nativeEnum(RiskLevel).optional(),
  minApy: z.coerce.number().optional(),
  minTvl: z.coerce.number().optional(),
});

const multiRouteBodySchema = z.object({
  assets: z.array(
    z.object({
      address: z.string(),
      amount: z.string(),
      valueUsd: z.number(),
    })
  ),
  userAddress: z.string(),
  preferences: z
    .object({
      maxRiskLevel: z.nativeEnum(RiskLevel).optional(),
      minApy: z.number().optional(),
      minTvl: z.number().optional(),
      preferCompounding: z.boolean().optional(),
      maxGasPercent: z.number().optional(),
      preferredProtocols: z.array(z.nativeEnum(DeFiProtocol)).optional(),
      excludedProtocols: z.array(z.nativeEnum(DeFiProtocol)).optional(),
    })
    .optional(),
});

const portfolioQuerySchema = z.object({
  userAddress: z.string(),
  chains: z.string().optional(), // Comma-separated
});

// ============================================================
// Routes
// ============================================================

const defiRoutes = new Hono();

/**
 * GET /defi/chains
 * Get all supported chains
 */
defiRoutes.get("/chains", async (c) => {
  const chains = defiAggregator.getSupportedChains();
  return c.json({
    success: true,
    data: chains,
  });
});

/**
 * GET /defi/protocols
 * Get all supported protocols
 */
defiRoutes.get("/protocols", async (c) => {
  const protocols = defiAggregator.getSupportedProtocols();
  return c.json({
    success: true,
    data: protocols.map((p) => ({
      id: p,
      name: defiAggregator.getProvider(p).name,
      supportedChains: defiAggregator.getProvider(p).supportedChains,
    })),
  });
});

/**
 * GET /defi/protocols/:chain
 * Get protocols available on a specific chain
 */
defiRoutes.get(
  "/protocols/:chain",
  zValidator("param", chainParamSchema),
  async (c) => {
    const { chain } = c.req.valid("param");
    const protocols = defiAggregator.getProtocolsForChain(chain);

    return c.json({
      success: true,
      data: protocols.map((p) => ({
        id: p,
        name: defiAggregator.getProvider(p).name,
      })),
    });
  }
);

/**
 * GET /defi/vaults/:chain
 * Get all vaults on a chain
 */
defiRoutes.get(
  "/vaults/:chain",
  zValidator("param", chainParamSchema),
  async (c) => {
    const { chain } = c.req.valid("param");
    
    try {
      const vaults = await defiAggregator.getAllVaults(chain);
      
      return c.json({
        success: true,
        data: {
          chain,
          count: vaults.length,
          vaults: vaults.map((v) => ({
            id: v.id,
            protocol: v.protocol,
            name: v.name,
            symbol: v.symbol,
            address: v.address,
            productType: v.productType,
            depositToken: v.depositToken,
            apy: v.apy,
            apyBase: v.apyBase,
            apyReward: v.apyReward,
            tvlUsd: v.tvlUsd,
            riskLevel: v.riskLevel,
            audited: v.audited,
          })),
        },
      });
    } catch (error: any) {
      return c.json(
        {
          success: false,
          error: error.message || "Failed to fetch vaults",
        },
        500
      );
    }
  }
);

/**
 * GET /defi/vaults/:chain/:protocol
 * Get vaults for a specific protocol on a chain
 */
defiRoutes.get(
  "/vaults/:chain/:protocol",
  zValidator("param", protocolParamSchema),
  async (c) => {
    const { chain, protocol } = c.req.valid("param");
    
    try {
      const provider = defiAggregator.getProvider(protocol);
      const vaults = await provider.getVaults(chain);
      
      return c.json({
        success: true,
        data: {
          chain,
          protocol,
          count: vaults.length,
          vaults,
        },
      });
    } catch (error: any) {
      return c.json(
        {
          success: false,
          error: error.message || "Failed to fetch vaults",
        },
        500
      );
    }
  }
);

/**
 * GET /defi/vault/:chain/:protocol/:vaultAddress
 * Get specific vault details
 */
defiRoutes.get(
  "/vault/:chain/:protocol/:vaultAddress",
  zValidator("param", vaultParamSchema),
  async (c) => {
    const { chain, protocol, vaultAddress } = c.req.valid("param");
    
    try {
      const provider = defiAggregator.getProvider(protocol);
      const vault = await provider.getVault(chain, vaultAddress);
      
      if (!vault) {
        return c.json(
          {
            success: false,
            error: "Vault not found",
          },
          404
        );
      }
      
      return c.json({
        success: true,
        data: vault,
      });
    } catch (error: any) {
      return c.json(
        {
          success: false,
          error: error.message || "Failed to fetch vault",
        },
        500
      );
    }
  }
);

/**
 * GET /defi/apy/:chain/:protocol/:vaultAddress
 * Get APY for a specific vault
 */
defiRoutes.get(
  "/apy/:chain/:protocol/:vaultAddress",
  zValidator("param", vaultParamSchema),
  async (c) => {
    const { chain, protocol, vaultAddress } = c.req.valid("param");
    
    try {
      const provider = defiAggregator.getProvider(protocol);
      const apy = await provider.getApy(chain, vaultAddress);
      
      return c.json({
        success: true,
        data: apy,
      });
    } catch (error: any) {
      return c.json(
        {
          success: false,
          error: error.message || "Failed to fetch APY",
        },
        500
      );
    }
  }
);

/**
 * GET /defi/quote/deposit/:chain/:protocol/:vaultAddress
 * Get deposit quote
 */
defiRoutes.get(
  "/quote/deposit/:chain/:protocol/:vaultAddress",
  zValidator("param", vaultParamSchema),
  zValidator("query", quoteQuerySchema),
  async (c) => {
    const { chain, protocol, vaultAddress } = c.req.valid("param");
    const { amount, userAddress } = c.req.valid("query");
    
    try {
      const quote = await defiAggregator.getDepositQuote(
        protocol,
        chain,
        vaultAddress,
        amount,
        userAddress
      );
      
      return c.json({
        success: true,
        data: quote,
      });
    } catch (error: any) {
      return c.json(
        {
          success: false,
          error: error.message || "Failed to get deposit quote",
        },
        500
      );
    }
  }
);

/**
 * GET /defi/quote/withdraw/:chain/:protocol/:vaultAddress
 * Get withdraw quote
 */
defiRoutes.get(
  "/quote/withdraw/:chain/:protocol/:vaultAddress",
  zValidator("param", vaultParamSchema),
  zValidator("query", quoteQuerySchema),
  async (c) => {
    const { chain, protocol, vaultAddress } = c.req.valid("param");
    const { amount, userAddress } = c.req.valid("query");
    
    try {
      const quote = await defiAggregator.getWithdrawQuote(
        protocol,
        chain,
        vaultAddress,
        amount,
        userAddress
      );
      
      return c.json({
        success: true,
        data: quote,
      });
    } catch (error: any) {
      return c.json(
        {
          success: false,
          error: error.message || "Failed to get withdraw quote",
        },
        500
      );
    }
  }
);

/**
 * GET /defi/best-yield/:chain
 * Find best yield for an asset
 */
defiRoutes.get(
  "/best-yield/:chain",
  zValidator("param", chainParamSchema),
  zValidator("query", routeQuerySchema),
  async (c) => {
    const { chain } = c.req.valid("param");
    const { assetAddress, maxRiskLevel, minApy, minTvl } = c.req.valid("query");
    
    try {
      const comparison = await defiAggregator.findBestYield(chain, assetAddress, {
        maxRiskLevel,
        minApy,
        minTvl,
        optimizeFor: "apy",
      });
      
      return c.json({
        success: true,
        data: comparison,
      });
    } catch (error: any) {
      return c.json(
        {
          success: false,
          error: error.message || "Failed to find best yield",
        },
        500
      );
    }
  }
);

/**
 * GET /defi/route/:chain
 * Find best route for dust token
 */
defiRoutes.get(
  "/route/:chain",
  zValidator("param", chainParamSchema),
  zValidator("query", routeQuerySchema),
  async (c) => {
    const { chain } = c.req.valid("param");
    const { assetAddress, amount, userAddress, maxRiskLevel, minApy, minTvl } =
      c.req.valid("query");
    
    try {
      const route = await defiRouter.findBestRoute(
        chain,
        assetAddress,
        amount,
        userAddress,
        { maxRiskLevel, minApy, minTvl, optimizeFor: "apy" }
      );
      
      if (!route) {
        return c.json(
          {
            success: false,
            error: "No suitable route found",
          },
          404
        );
      }
      
      return c.json({
        success: true,
        data: route,
      });
    } catch (error: any) {
      return c.json(
        {
          success: false,
          error: error.message || "Failed to find route",
        },
        500
      );
    }
  }
);

/**
 * POST /defi/route/multi/:chain
 * Find routes for multiple dust tokens
 */
defiRoutes.post(
  "/route/multi/:chain",
  zValidator("param", chainParamSchema),
  zValidator("json", multiRouteBodySchema),
  async (c) => {
    const { chain } = c.req.valid("param");
    const { assets, userAddress, preferences } = c.req.valid("json");
    
    try {
      const routes = await defiRouter.findMultiAssetRoute(
        chain,
        assets as { address: string; amount: string; valueUsd: number }[],
        userAddress,
        preferences
      );
      
      return c.json({
        success: true,
        data: routes,
      });
    } catch (error: any) {
      return c.json(
        {
          success: false,
          error: error.message || "Failed to find routes",
        },
        500
      );
    }
  }
);

/**
 * GET /defi/recommend/:chain
 * Get recommended destination for dust
 */
defiRoutes.get(
  "/recommend/:chain",
  zValidator("param", chainParamSchema),
  async (c) => {
    const { chain } = c.req.valid("param");
    const totalValueUsd = Number(c.req.query("totalValueUsd") || "100");
    const maxRiskLevel = c.req.query("maxRiskLevel") as RiskLevel | undefined;
    
    try {
      const recommendation = await defiRouter.getRecommendedDestination(
        chain,
        totalValueUsd,
        { maxRiskLevel, optimizeFor: "apy" }
      );
      
      if (!recommendation) {
        return c.json(
          {
            success: false,
            error: "No suitable destination found",
          },
          404
        );
      }
      
      return c.json({
        success: true,
        data: recommendation,
      });
    } catch (error: any) {
      return c.json(
        {
          success: false,
          error: error.message || "Failed to get recommendation",
        },
        500
      );
    }
  }
);

/**
 * GET /defi/positions/:chain
 * Get user positions on a chain
 */
defiRoutes.get(
  "/positions/:chain",
  zValidator("param", chainParamSchema),
  async (c) => {
    const { chain } = c.req.valid("param");
    const userAddress = c.req.query("userAddress");
    
    if (!userAddress) {
      return c.json(
        {
          success: false,
          error: "userAddress query parameter required",
        },
        400
      );
    }
    
    try {
      const positions = await defiAggregator.getAllPositions(chain, userAddress);
      
      return c.json({
        success: true,
        data: {
          chain,
          userAddress,
          count: positions.length,
          positions,
        },
      });
    } catch (error: any) {
      return c.json(
        {
          success: false,
          error: error.message || "Failed to fetch positions",
        },
        500
      );
    }
  }
);

/**
 * GET /defi/portfolio
 * Get user portfolio across all chains
 */
defiRoutes.get(
  "/portfolio",
  zValidator("query", portfolioQuerySchema),
  async (c) => {
    const { userAddress, chains: chainsParam } = c.req.valid("query");
    
    const chains = chainsParam
      ? chainsParam.split(",")
      : defiAggregator.getSupportedChains();
    
    try {
      const portfolio = await defiAggregator.getPortfolioValue(chains, userAddress);
      
      return c.json({
        success: true,
        data: portfolio,
      });
    } catch (error: any) {
      return c.json(
        {
          success: false,
          error: error.message || "Failed to fetch portfolio",
        },
        500
      );
    }
  }
);

/**
 * GET /defi/top-vaults
 * Get top vaults by APY
 */
defiRoutes.get("/top-vaults", async (c) => {
  const limit = Number(c.req.query("limit") || "10");
  const productType = c.req.query("productType") as DeFiProductType | undefined;
  
  try {
    const vaults = await defiAggregator.getTopVaultsByApy(limit, productType);
    
    return c.json({
      success: true,
      data: vaults,
    });
  } catch (error: any) {
    return c.json(
      {
        success: false,
        error: error.message || "Failed to fetch top vaults",
      },
      500
    );
  }
});

/**
 * GET /defi/staking/:chain
 * Get staking options on a chain
 */
defiRoutes.get(
  "/staking/:chain",
  zValidator("param", chainParamSchema),
  async (c) => {
    const { chain } = c.req.valid("param");
    
    try {
      const options = await defiAggregator.getStakingOptions(chain);
      
      return c.json({
        success: true,
        data: {
          chain,
          count: options.length,
          options,
        },
      });
    } catch (error: any) {
      return c.json(
        {
          success: false,
          error: error.message || "Failed to fetch staking options",
        },
        500
      );
    }
  }
);

/**
 * GET /defi/lending/:chain
 * Get lending options on a chain
 */
defiRoutes.get(
  "/lending/:chain",
  zValidator("param", chainParamSchema),
  async (c) => {
    const { chain } = c.req.valid("param");
    
    try {
      const options = await defiAggregator.getLendingOptions(chain);
      
      return c.json({
        success: true,
        data: {
          chain,
          count: options.length,
          options,
        },
      });
    } catch (error: any) {
      return c.json(
        {
          success: false,
          error: error.message || "Failed to fetch lending options",
        },
        500
      );
    }
  }
);

/**
 * GET /defi/compare-apy/:chain
 * Compare APYs across protocols for an asset
 */
defiRoutes.get(
  "/compare-apy/:chain",
  zValidator("param", chainParamSchema),
  async (c) => {
    const { chain } = c.req.valid("param");
    const assetAddress = c.req.query("assetAddress");
    
    if (!assetAddress) {
      return c.json(
        {
          success: false,
          error: "assetAddress query parameter required",
        },
        400
      );
    }
    
    try {
      const comparison = await defiAggregator.compareApys(chain, assetAddress);
      
      return c.json({
        success: true,
        data: {
          chain,
          asset: assetAddress,
          comparison,
        },
      });
    } catch (error: any) {
      return c.json(
        {
          success: false,
          error: error.message || "Failed to compare APYs",
        },
        500
      );
    }
  }
);

export default defiRoutes;
