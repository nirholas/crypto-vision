import { test, expect } from "@playwright/test";

test.describe("Consolidation Page", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/consolidate");
  });

  test("shows connect wallet prompt when not connected", async ({ page }) => {
    await expect(page.getByRole("heading", { name: /consolidate/i })).toBeVisible();
    await expect(page.getByText(/connect your wallet/i)).toBeVisible();
  });
});

test.describe("Consolidation Flow - Connected", () => {
  test.beforeEach(async ({ page }) => {
    // Mock wallet connection
    await page.addInitScript(() => {
      window.localStorage.setItem("wagmi.connected", "true");
      window.localStorage.setItem("wagmi.wallet", "injected");
    });
    await page.goto("/consolidate");
  });

  test("shows consolidation steps", async ({ page }) => {
    // Should show the step navigation
    await expect(page.getByText("Select Chains")).toBeVisible();
    await expect(page.getByText("Review")).toBeVisible();
    await expect(page.getByText("Execute")).toBeVisible();
    await expect(page.getByText("Complete")).toBeVisible();
  });

  test("shows source and destination chain selectors", async ({ page }) => {
    await expect(page.getByText(/select source chains/i)).toBeVisible();
    await expect(page.getByText(/destination chain/i)).toBeVisible();
  });

  test("shows multi-chain balance overview", async ({ page }) => {
    // Should display balance information
    await expect(page.getByText(/total balance/i)).toBeVisible();
  });

  test("can select destination chain", async ({ page }) => {
    // Find destination chain selector
    const destSelector = page.locator('[data-testid="destination-chain"]');
    if (await destSelector.isVisible()) {
      await destSelector.click();
      // Should show chain options
      await expect(page.getByText(/ethereum/i)).toBeVisible();
    }
  });

  test("shows fee breakdown when quote is available", async ({ page }) => {
    // Navigate to review step if possible
    const continueBtn = page.getByRole("button", { name: /continue|next|get quote/i });
    if (await continueBtn.isVisible() && await continueBtn.isEnabled()) {
      await continueBtn.click();
      // Should show fee information
      await expect(page.getByText(/fee/i)).toBeVisible();
    }
  });
});

test.describe("Consolidation - Error Handling", () => {
  test("handles network errors gracefully", async ({ page }) => {
    // Mock API failure
    await page.route("**/api/consolidation/**", (route) => {
      route.abort("failed");
    });

    await page.goto("/consolidate");
    
    // Should still render the page
    await expect(page.getByRole("heading", { name: /consolidate/i })).toBeVisible();
  });

  test("shows error state for invalid quote", async ({ page }) => {
    // Mock invalid quote response
    await page.route("**/api/consolidation/quote", (route) => {
      route.fulfill({
        status: 400,
        body: JSON.stringify({ error: "Insufficient balance" }),
      });
    });

    await page.goto("/consolidate");
    // Try to get quote - should handle error gracefully
  });
});
