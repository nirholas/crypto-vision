import { test, expect } from "@playwright/test";

test.describe("Dashboard", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
  });

  test("shows connect wallet prompt when not connected", async ({ page }) => {
    // Should display the connect wallet prompt
    await expect(page.getByRole("heading", { name: "Connect Your Wallet" })).toBeVisible();
    await expect(page.getByText("Connect your wallet to scan for dust tokens")).toBeVisible();
    
    // Should show the sweep emoji
    await expect(page.getByText("🧹")).toBeVisible();
  });

  test("shows main navigation header", async ({ page }) => {
    // Header should be visible
    await expect(page.getByRole("banner")).toBeVisible();
    
    // Navigation links should be present
    await expect(page.getByRole("link", { name: /dashboard/i })).toBeVisible();
    await expect(page.getByRole("link", { name: /consolidate/i })).toBeVisible();
    await expect(page.getByRole("link", { name: /defi/i })).toBeVisible();
  });
});

test.describe("Dashboard - Connected", () => {
  test.beforeEach(async ({ page }) => {
    // Mock wallet connection by setting local storage or using a test wallet
    await page.addInitScript(() => {
      // Mock wagmi connection state
      window.localStorage.setItem("wagmi.connected", "true");
      window.localStorage.setItem("wagmi.wallet", "injected");
    });
    await page.goto("/");
  });

  test("shows progress steps when connected", async ({ page }) => {
    // Progress steps should be visible
    await expect(page.getByText("Select Tokens")).toBeVisible();
    await expect(page.getByText("Preview")).toBeVisible();
    await expect(page.getByText("Execute")).toBeVisible();
    await expect(page.getByText("Status")).toBeVisible();
  });

  test("shows quick actions section", async ({ page }) => {
    await expect(page.getByText("Quick Actions")).toBeVisible();
    await expect(page.getByRole("link", { name: /consolidate/i })).toBeVisible();
    await expect(page.getByRole("link", { name: /earn yield/i })).toBeVisible();
  });

  test("shows chain selector", async ({ page }) => {
    await expect(page.getByText("Select Chains")).toBeVisible();
  });

  test("shows dust tokens section", async ({ page }) => {
    await expect(page.getByText("Dust Tokens")).toBeVisible();
    await expect(page.getByText("Select All")).toBeVisible();
    await expect(page.getByText("Deselect All")).toBeVisible();
  });

  test("shows recent activity section", async ({ page }) => {
    await expect(page.getByText("Recent Activity")).toBeVisible();
  });

  test("can click select all button", async ({ page }) => {
    const selectAllBtn = page.getByRole("button", { name: "Select All" });
    await selectAllBtn.click();
    // Should have some selected state change
  });
});

test.describe("Navigation", () => {
  test("can navigate to consolidate page", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("link", { name: /consolidate/i }).click();
    await expect(page).toHaveURL("/consolidate");
    await expect(page.getByRole("heading", { name: /consolidate/i })).toBeVisible();
  });

  test("can navigate to defi page", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("link", { name: /defi/i }).click();
    await expect(page).toHaveURL("/defi");
    await expect(page.getByRole("heading", { name: /defi/i })).toBeVisible();
  });

  test("can navigate to subscriptions page", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("link", { name: /subscriptions/i }).click();
    await expect(page).toHaveURL("/subscriptions");
    await expect(page.getByRole("heading", { name: /subscriptions/i })).toBeVisible();
  });

  test("can navigate to history page", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("link", { name: /history/i }).click();
    await expect(page).toHaveURL("/history");
  });

  test("can navigate to settings page", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("link", { name: /settings/i }).click();
    await expect(page).toHaveURL("/settings");
  });
});
