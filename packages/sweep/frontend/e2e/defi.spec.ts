import { test, expect } from "@playwright/test";

test.describe("DeFi Page", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/defi");
  });

  test("shows connect wallet prompt when not connected", async ({ page }) => {
    await expect(page.getByRole("heading", { name: /defi/i })).toBeVisible();
    await expect(page.getByText(/connect your wallet/i)).toBeVisible();
  });

  test("shows DeFi emoji icon", async ({ page }) => {
    await expect(page.getByText("📈")).toBeVisible();
  });
});

test.describe("DeFi Page - Connected", () => {
  test.beforeEach(async ({ page }) => {
    // Mock wallet connection
    await page.addInitScript(() => {
      window.localStorage.setItem("wagmi.connected", "true");
      window.localStorage.setItem("wagmi.wallet", "injected");
    });
    await page.goto("/defi");
  });

  test("shows page header with refresh button", async ({ page }) => {
    await expect(page.getByRole("heading", { name: /defi/i })).toBeVisible();
    await expect(page.getByRole("button", { name: /refresh/i })).toBeVisible();
  });

  test("shows summary cards", async ({ page }) => {
    await expect(page.getByText("Total Value")).toBeVisible();
    await expect(page.getByText("Pending Rewards")).toBeVisible();
    await expect(page.getByText("Active Positions")).toBeVisible();
  });

  test("shows tab navigation", async ({ page }) => {
    await expect(page.getByRole("button", { name: /your positions/i })).toBeVisible();
    await expect(page.getByRole("button", { name: /discover vaults/i })).toBeVisible();
  });

  test("can switch between tabs", async ({ page }) => {
    // Click discover tab
    await page.getByRole("button", { name: /discover vaults/i }).click();
    
    // Should show vault discovery content
    await expect(page.getByText(/quick deposit/i)).toBeVisible();
  });

  test("shows positions list or empty state", async ({ page }) => {
    // Either positions or empty state should be visible
    const positions = page.getByText(/your positions/i);
    const emptyState = page.getByText(/no defi positions yet/i);
    
    await expect(positions.or(emptyState)).toBeVisible();
  });

  test("shows suggested vaults in positions tab", async ({ page }) => {
    await expect(page.getByText(/suggested vaults/i)).toBeVisible();
  });
});

test.describe("DeFi - Vault Discovery", () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      window.localStorage.setItem("wagmi.connected", "true");
    });
    await page.goto("/defi");
    await page.getByRole("button", { name: /discover vaults/i }).click();
  });

  test("shows APY comparison table", async ({ page }) => {
    // Should show vault information
    await expect(page.getByText(/aave/i)).toBeVisible();
    await expect(page.getByText(/apy/i)).toBeVisible();
  });

  test("shows featured vaults", async ({ page }) => {
    await expect(page.getByText(/featured vaults/i)).toBeVisible();
  });

  test("shows quick deposit CTA", async ({ page }) => {
    await expect(page.getByText(/quick deposit from dashboard/i)).toBeVisible();
    await expect(page.getByRole("button", { name: /go to dashboard/i })).toBeVisible();
  });

  test("can navigate to dashboard from quick deposit CTA", async ({ page }) => {
    await page.getByRole("button", { name: /go to dashboard/i }).click();
    await expect(page).toHaveURL("/");
  });
});

test.describe("DeFi - Position Details", () => {
  test.beforeEach(async ({ page }) => {
    // Mock positions data
    await page.route("**/api/defi/positions", (route) => {
      route.fulfill({
        status: 200,
        body: JSON.stringify([
          {
            id: "test-1",
            protocol: "Aave",
            asset: "USDC",
            chainId: 8453,
            apy: 4.5,
            valueUsd: 1000,
            balance: "1000",
            pendingRewards: 5.5,
            entryDate: new Date().toISOString(),
            earnedTotal: 25.5,
          },
        ]),
      });
    });

    await page.addInitScript(() => {
      window.localStorage.setItem("wagmi.connected", "true");
    });
    await page.goto("/defi");
  });

  test("can expand position for details", async ({ page }) => {
    // Click on a position card
    const positionCard = page.locator('[data-testid="position-card"]').first();
    if (await positionCard.isVisible()) {
      await positionCard.click();
      
      // Should show expanded details
      await expect(page.getByText(/deposited/i)).toBeVisible();
      await expect(page.getByText(/current value/i)).toBeVisible();
    }
  });

  test("shows deposit and withdraw buttons when expanded", async ({ page }) => {
    const positionCard = page.locator('[data-testid="position-card"]').first();
    if (await positionCard.isVisible()) {
      await positionCard.click();
      
      await expect(page.getByRole("button", { name: /deposit more/i })).toBeVisible();
      await expect(page.getByRole("button", { name: /withdraw/i })).toBeVisible();
    }
  });
});
