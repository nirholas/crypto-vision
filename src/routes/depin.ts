/**
 * Crypto Vision — DePIN Route
 *
 * Decentralized Physical Infrastructure Network data from DePINscan.
 *
 * GET /api/depin/projects           — All DePIN projects
 * GET /api/depin/project/:slug      — Single project detail
 * GET /api/depin/categories         — Project categories
 * GET /api/depin/metrics            — Aggregate DePIN metrics
 * GET /api/depin/category/:category — Projects filtered by category
 */

import { Hono } from "hono";
import { z } from "zod";
import { ApiError, extractErrorMessage } from "../lib/api-error.js";
import { validateParam } from "../lib/validation.js";
import * as depin from "../sources/depinscan.js";

export const depinRoutes = new Hono();

// ─── Shared Schemas ──────────────────────────────────────────

const SlugSchema = z
  .string()
  .min(1)
  .max(128)
  .regex(/^[a-zA-Z0-9_-]+$/, "Invalid format");

// ─── GET /api/depin/projects ─────────────────────────────────

/**
 * @openapi
 * /api/depin/projects:
 *   get:
 *     summary: List all DePIN projects
 *     tags: [DePIN]
 *     responses:
 *       200:
 *         description: Array of DePIN projects with count
 *       502:
 *         description: Upstream service error
 */
depinRoutes.get("/projects", async (c) => {
  try {
    const data = await depin.getProjects();
    return c.json({
      count: Array.isArray(data) ? data.length : 0,
      data,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    return ApiError.upstream(c, "depin.ninja", extractErrorMessage(err));
  }
});

// ─── GET /api/depin/project/:slug ────────────────────────────

/**
 * @openapi
 * /api/depin/project/{slug}:
 *   get:
 *     summary: Get a single DePIN project by slug
 *     tags: [DePIN]
 *     parameters:
 *       - in: path
 *         name: slug
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Project detail
 *       400:
 *         description: Invalid slug parameter
 *       502:
 *         description: Upstream service error
 */
depinRoutes.get("/project/:slug", async (c) => {
  const validated = validateParam(c, "slug", SlugSchema);
  if (!validated.success) return validated.error;

  try {
    const data = await depin.getProject(validated.data);
    return c.json({ data, timestamp: new Date().toISOString() });
  } catch (err) {
    return ApiError.upstream(c, "depin.ninja", extractErrorMessage(err));
  }
});

// ─── GET /api/depin/categories ───────────────────────────────

/**
 * @openapi
 * /api/depin/categories:
 *   get:
 *     summary: List DePIN project categories
 *     tags: [DePIN]
 *     responses:
 *       200:
 *         description: Array of category names
 *       502:
 *         description: Upstream service error
 */
depinRoutes.get("/categories", async (c) => {
  try {
    const data = await depin.getCategories();
    return c.json({ data, timestamp: new Date().toISOString() });
  } catch (err) {
    return ApiError.upstream(c, "depin.ninja", extractErrorMessage(err));
  }
});

// ─── GET /api/depin/metrics ──────────────────────────────────

/**
 * @openapi
 * /api/depin/metrics:
 *   get:
 *     summary: Aggregate DePIN network metrics
 *     tags: [DePIN]
 *     responses:
 *       200:
 *         description: Aggregate metrics across all DePIN projects
 *       502:
 *         description: Upstream service error
 */
depinRoutes.get("/metrics", async (c) => {
  try {
    const data = await depin.getMetrics();
    return c.json({ data, timestamp: new Date().toISOString() });
  } catch (err) {
    return ApiError.upstream(c, "depin.ninja", extractErrorMessage(err));
  }
});

// ─── GET /api/depin/category/:category ───────────────────────

/**
 * @openapi
 * /api/depin/category/{category}:
 *   get:
 *     summary: List DePIN projects filtered by category
 *     tags: [DePIN]
 *     parameters:
 *       - in: path
 *         name: category
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Array of projects in the given category
 *       400:
 *         description: Invalid category parameter
 *       502:
 *         description: Upstream service error
 */
depinRoutes.get("/category/:category", async (c) => {
  const validated = validateParam(c, "category", SlugSchema);
  if (!validated.success) return validated.error;

  try {
    const data = await depin.getProjectsByCategory(validated.data);
    return c.json({
      category: validated.data,
      count: Array.isArray(data) ? data.length : 0,
      data,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    return ApiError.upstream(c, "depin.ninja", extractErrorMessage(err));
  }
});
