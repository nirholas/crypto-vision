import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { authMiddleware } from "../middleware/auth.js";
import { strictRateLimit } from "../middleware/ratelimit.js";
import {
  getSubscriptionService,
  createSubscriptionSchema,
  updateSubscriptionSchema,
} from "../../services/subscriptions/index.js";

const subscriptionsRoute = new Hono();

// Apply authentication to all routes
subscriptionsRoute.use("*", authMiddleware);

// Apply rate limiting
subscriptionsRoute.use("*", strictRateLimit);

// ============================================================================
// POST /subscriptions - Create new auto-sweep subscription
// ============================================================================
subscriptionsRoute.post(
  "/",
  zValidator("json", createSubscriptionSchema),
  async (c) => {
    const userId = c.get("userId");
    const walletAddress = c.get("walletAddress");
    const body = c.req.valid("json");

    // Verify wallet ownership
    if (body.walletAddress.toLowerCase() !== walletAddress.toLowerCase()) {
      return c.json(
        { error: "Not authorized to create subscription for this wallet" },
        403
      );
    }

    try {
      const subscriptionService = getSubscriptionService();
      const subscription = await subscriptionService.createSubscription(
        userId, 
        body as import("../../services/subscriptions/types.js").CreateSubscriptionRequest
      );

      return c.json(
        {
          success: true,
          subscription: {
            id: subscription.id,
            walletAddress: subscription.walletAddress,
            sourceChains: subscription.sourceChains,
            destinationChain: subscription.destinationChain,
            destinationAsset: subscription.destinationAsset,
            destinationProtocol: subscription.destinationProtocol,
            triggerType: subscription.triggerType,
            thresholdUsd: subscription.thresholdUsd,
            schedulePattern: subscription.schedulePattern,
            status: subscription.status,
            spendPermissionExpiry: subscription.spendPermissionExpiry.toISOString(),
            createdAt: subscription.createdAt.toISOString(),
          },
        },
        201
      );
    } catch (error) {
      console.error("[SubscriptionsAPI] Error creating subscription:", error);
      
      if (error instanceof Error) {
        return c.json({ error: error.message }, 400);
      }
      
      return c.json({ error: "Failed to create subscription" }, 500);
    }
  }
);

// ============================================================================
// GET /subscriptions - List user's subscriptions
// ============================================================================
subscriptionsRoute.get("/", async (c) => {
  const userId = c.get("userId");

  try {
    const subscriptionService = getSubscriptionService();
    const subscriptions = await subscriptionService.listSubscriptions(userId);

    return c.json({
      success: true,
      subscriptions,
      total: subscriptions.length,
    });
  } catch (error) {
    console.error("[SubscriptionsAPI] Error listing subscriptions:", error);
    return c.json({ error: "Failed to list subscriptions" }, 500);
  }
});

// ============================================================================
// GET /subscriptions/:id - Get subscription details
// ============================================================================
subscriptionsRoute.get("/:id", async (c) => {
  const userId = c.get("userId");
  const subscriptionId = c.req.param("id");

  // Validate UUID format
  if (!isValidUuid(subscriptionId)) {
    return c.json({ error: "Invalid subscription ID" }, 400);
  }

  try {
    const subscriptionService = getSubscriptionService();
    const subscription = await subscriptionService.getSubscriptionDetails(
      subscriptionId,
      userId
    );

    if (!subscription) {
      return c.json({ error: "Subscription not found" }, 404);
    }

    return c.json({
      success: true,
      subscription,
    });
  } catch (error) {
    console.error("[SubscriptionsAPI] Error getting subscription:", error);
    return c.json({ error: "Failed to get subscription" }, 500);
  }
});

// ============================================================================
// PATCH /subscriptions/:id - Update subscription
// ============================================================================
subscriptionsRoute.patch(
  "/:id",
  zValidator("json", updateSubscriptionSchema),
  async (c) => {
    const userId = c.get("userId");
    const subscriptionId = c.req.param("id");
    const updates = c.req.valid("json");

    // Validate UUID format
    if (!isValidUuid(subscriptionId)) {
      return c.json({ error: "Invalid subscription ID" }, 400);
    }

    try {
      const subscriptionService = getSubscriptionService();
      const subscription = await subscriptionService.updateSubscription(
        subscriptionId,
        userId,
        updates
      );

      if (!subscription) {
        return c.json({ error: "Subscription not found" }, 404);
      }

      return c.json({
        success: true,
        subscription: {
          id: subscription.id,
          walletAddress: subscription.walletAddress,
          sourceChains: subscription.sourceChains,
          destinationChain: subscription.destinationChain,
          destinationAsset: subscription.destinationAsset,
          destinationProtocol: subscription.destinationProtocol,
          triggerType: subscription.triggerType,
          thresholdUsd: subscription.thresholdUsd,
          schedulePattern: subscription.schedulePattern,
          status: subscription.status,
          updatedAt: subscription.updatedAt.toISOString(),
        },
      });
    } catch (error) {
      console.error("[SubscriptionsAPI] Error updating subscription:", error);
      
      if (error instanceof Error) {
        return c.json({ error: error.message }, 400);
      }
      
      return c.json({ error: "Failed to update subscription" }, 500);
    }
  }
);

// ============================================================================
// DELETE /subscriptions/:id - Cancel subscription
// ============================================================================
subscriptionsRoute.delete("/:id", async (c) => {
  const userId = c.get("userId");
  const subscriptionId = c.req.param("id");

  // Validate UUID format
  if (!isValidUuid(subscriptionId)) {
    return c.json({ error: "Invalid subscription ID" }, 400);
  }

  try {
    const subscriptionService = getSubscriptionService();
    const cancelled = await subscriptionService.cancelSubscription(
      subscriptionId,
      userId
    );

    if (!cancelled) {
      return c.json({ error: "Subscription not found" }, 404);
    }

    return c.json({
      success: true,
      message: "Subscription cancelled successfully",
    });
  } catch (error) {
    console.error("[SubscriptionsAPI] Error cancelling subscription:", error);
    return c.json({ error: "Failed to cancel subscription" }, 500);
  }
});

// ============================================================================
// POST /subscriptions/:id/pause - Pause subscription
// ============================================================================
subscriptionsRoute.post("/:id/pause", async (c) => {
  const userId = c.get("userId");
  const subscriptionId = c.req.param("id");

  // Validate UUID format
  if (!isValidUuid(subscriptionId)) {
    return c.json({ error: "Invalid subscription ID" }, 400);
  }

  try {
    const subscriptionService = getSubscriptionService();
    const paused = await subscriptionService.pauseSubscription(
      subscriptionId,
      userId
    );

    if (!paused) {
      return c.json(
        { error: "Subscription not found or cannot be paused" },
        404
      );
    }

    return c.json({
      success: true,
      message: "Subscription paused successfully",
    });
  } catch (error) {
    console.error("[SubscriptionsAPI] Error pausing subscription:", error);
    return c.json({ error: "Failed to pause subscription" }, 500);
  }
});

// ============================================================================
// POST /subscriptions/:id/resume - Resume subscription
// ============================================================================
subscriptionsRoute.post("/:id/resume", async (c) => {
  const userId = c.get("userId");
  const subscriptionId = c.req.param("id");

  // Validate UUID format
  if (!isValidUuid(subscriptionId)) {
    return c.json({ error: "Invalid subscription ID" }, 400);
  }

  try {
    const subscriptionService = getSubscriptionService();
    const resumed = await subscriptionService.resumeSubscription(
      subscriptionId,
      userId
    );

    if (!resumed) {
      return c.json(
        { error: "Subscription not found or cannot be resumed" },
        404
      );
    }

    return c.json({
      success: true,
      message: "Subscription resumed successfully",
    });
  } catch (error) {
    console.error("[SubscriptionsAPI] Error resuming subscription:", error);
    
    if (error instanceof Error) {
      return c.json({ error: error.message }, 400);
    }
    
    return c.json({ error: "Failed to resume subscription" }, 500);
  }
});

// ============================================================================
// GET /subscriptions/:id/sweeps - Get sweep history for a subscription
// ============================================================================
subscriptionsRoute.get("/:id/sweeps", async (c) => {
  const userId = c.get("userId");
  const subscriptionId = c.req.param("id");

  // Validate UUID format
  if (!isValidUuid(subscriptionId)) {
    return c.json({ error: "Invalid subscription ID" }, 400);
  }

  // Get pagination params
  const page = parseInt(c.req.query("page") || "1", 10);
  const limit = Math.min(parseInt(c.req.query("limit") || "20", 10), 100);

  try {
    const subscriptionService = getSubscriptionService();
    
    // First verify the subscription belongs to the user
    const subscription = await subscriptionService.getSubscriptionDetails(
      subscriptionId,
      userId
    );

    if (!subscription) {
      return c.json({ error: "Subscription not found" }, 404);
    }

    // For now, return the recent sweeps from the subscription details
    // In production, this would support proper pagination
    return c.json({
      success: true,
      sweeps: subscription.recentSweeps,
      pagination: {
        page,
        limit,
        total: subscription.totalSweeps,
      },
    });
  } catch (error) {
    console.error("[SubscriptionsAPI] Error getting sweep history:", error);
    return c.json({ error: "Failed to get sweep history" }, 500);
  }
});

// ============================================================================
// Helper Functions
// ============================================================================

function isValidUuid(id: string): boolean {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return uuidRegex.test(id);
}

export default subscriptionsRoute;
