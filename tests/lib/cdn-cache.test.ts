/**
 * Tests for lib/cdn-cache.ts — CDN Cache-Control header middleware
 *
 * Validates cache header injection, skip conditions.
 */

import { Hono } from "hono";
import { describe, expect, it } from "vitest";
import { cdnCacheHeaders } from "../../src/lib/cdn-cache.js";

describe("cdnCacheHeaders", () => {
    it("sets Cache-Control on successful GET responses", async () => {
        const app = new Hono();
        app.use("*", cdnCacheHeaders);
        app.get("/api/data", (c) => c.json({ ok: true }));

        const res = await app.request("/api/data");
        expect(res.status).toBe(200);
        const cc = res.headers.get("cache-control");
        expect(cc).toContain("public");
        expect(cc).toContain("max-age=30");
        expect(cc).toContain("stale-while-revalidate=60");
    });

    it("skips POST requests", async () => {
        const app = new Hono();
        app.use("*", cdnCacheHeaders);
        app.post("/api/data", (c) => c.json({ created: true }));

        const res = await app.request("/api/data", { method: "POST" });
        expect(res.status).toBe(200);
        // CDN cache middleware shouldn't add Cache-Control for POST
        // (It may or may not be present depending on other logic)
        const cc = res.headers.get("cache-control");
        if (cc) {
            // If there's a Cache-Control, it shouldn't be from our middleware
            // (no public, max-age pattern)
            expect(cc).not.toContain("public");
        }
    });

    it("skips error responses (status >= 400)", async () => {
        const app = new Hono();
        app.use("*", cdnCacheHeaders);
        app.get("/api/bad", (c) => c.json({ error: "bad" }, 400));

        const res = await app.request("/api/bad");
        expect(res.status).toBe(400);
        const cc = res.headers.get("cache-control");
        if (cc) {
            expect(cc).not.toContain("s-maxage=30");
        }
    });

    it("does not override existing Cache-Control headers", async () => {
        const app = new Hono();
        app.use("*", cdnCacheHeaders);
        app.get("/api/custom", (c) => {
            c.header("Cache-Control", "no-cache");
            return c.json({ ok: true });
        });

        const res = await app.request("/api/custom");
        expect(res.status).toBe(200);
        const cc = res.headers.get("cache-control");
        expect(cc).toBe("no-cache");
    });
});
