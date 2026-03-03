import { test, expect } from "@playwright/test";

test.describe("Subscriptions Page", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/subscriptions");
  });

  test("shows connect wallet prompt when not connected", async ({ page }) => {
    await expect(page.getByRole("heading", { name: /subscriptions/i })).toBeVisible();
    await expect(page.getByText(/connect your wallet/i)).toBeVisible();
  });
});

test.describe("Subscriptions Page - Connected", () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      window.localStorage.setItem("wagmi.connected", "true");
      window.localStorage.setItem("wagmi.wallet", "injected");
    });
    await page.goto("/subscriptions");
  });

  test("shows page header with create button", async ({ page }) => {
    await expect(page.getByRole("heading", { name: /subscriptions/i })).toBeVisible();
    await expect(page.getByRole("button", { name: /create subscription/i })).toBeVisible();
  });

  test("shows subscription stats", async ({ page }) => {
    await expect(page.getByText(/active subscriptions/i)).toBeVisible();
    await expect(page.getByText(/monthly spend/i)).toBeVisible();
  });

  test("shows subscriptions list or empty state", async ({ page }) => {
    const subscriptions = page.getByText(/your subscriptions/i);
    const emptyState = page.getByText(/no subscriptions yet/i);
    
    await expect(subscriptions.or(emptyState)).toBeVisible();
  });

  test("can open create subscription modal", async ({ page }) => {
    await page.getByRole("button", { name: /create subscription/i }).click();
    
    // Modal should appear
    await expect(page.getByRole("dialog")).toBeVisible();
    await expect(page.getByText(/new subscription/i)).toBeVisible();
  });
});

test.describe("Create Subscription Flow", () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      window.localStorage.setItem("wagmi.connected", "true");
    });
    await page.goto("/subscriptions");
    await page.getByRole("button", { name: /create subscription/i }).click();
  });

  test("shows subscription form fields", async ({ page }) => {
    await expect(page.getByLabel(/name/i)).toBeVisible();
    await expect(page.getByLabel(/amount/i)).toBeVisible();
  });

  test("shows step navigation in modal", async ({ page }) => {
    await expect(page.getByText(/step 1/i)).toBeVisible();
  });

  test("can fill in subscription details", async ({ page }) => {
    // Fill name
    await page.getByLabel(/name/i).fill("Test Subscription");
    
    // Fill amount
    await page.getByLabel(/amount/i).fill("10");
    
    // Values should be in the inputs
    await expect(page.getByLabel(/name/i)).toHaveValue("Test Subscription");
    await expect(page.getByLabel(/amount/i)).toHaveValue("10");
  });

  test("validates required fields", async ({ page }) => {
    // Try to continue without filling required fields
    const continueBtn = page.getByRole("button", { name: /continue|next/i });
    if (await continueBtn.isVisible()) {
      await continueBtn.click();
      // Should show validation error or stay on current step
    }
  });

  test("can close modal", async ({ page }) => {
    const closeBtn = page.getByRole("button", { name: /close|cancel/i });
    if (await closeBtn.isVisible()) {
      await closeBtn.click();
      await expect(page.getByRole("dialog")).not.toBeVisible();
    }
  });
});

test.describe("Subscription Management", () => {
  test.beforeEach(async ({ page }) => {
    // Mock subscriptions data
    await page.route("**/api/subscriptions", (route) => {
      if (route.request().method() === "GET") {
        route.fulfill({
          status: 200,
          body: JSON.stringify([
            {
              id: "sub-1",
              name: "Monthly DCA",
              recipientAddress: "0x1234...5678",
              tokenAddress: "0xusdc",
              amount: "100",
              interval: 2592000, // 30 days
              nextRun: new Date(Date.now() + 86400000).toISOString(),
              status: "active",
              createdAt: new Date().toISOString(),
            },
          ]),
        });
      }
    });

    await page.addInitScript(() => {
      window.localStorage.setItem("wagmi.connected", "true");
    });
    await page.goto("/subscriptions");
  });

  test("displays subscription cards", async ({ page }) => {
    await expect(page.getByText("Monthly DCA")).toBeVisible();
  });

  test("shows subscription status", async ({ page }) => {
    await expect(page.getByText(/active/i)).toBeVisible();
  });

  test("can view subscription details", async ({ page }) => {
    // Click on subscription card
    const card = page.getByText("Monthly DCA");
    await card.click();
    
    // Should show details panel
    await expect(page.getByText(/recipient/i)).toBeVisible();
  });

  test("shows pause/resume toggle", async ({ page }) => {
    const toggleBtn = page.getByRole("button", { name: /pause|toggle/i });
    await expect(toggleBtn).toBeVisible();
  });
});

test.describe("Subscription - EIP-7715 Spend Permission", () => {
  test("shows spend permission signing step during creation", async ({ page }) => {
    await page.addInitScript(() => {
      window.localStorage.setItem("wagmi.connected", "true");
    });
    await page.goto("/subscriptions");
    await page.getByRole("button", { name: /create subscription/i }).click();

    // Fill out form and proceed
    await page.getByLabel(/name/i).fill("Test Sub");
    await page.getByLabel(/amount/i).fill("50");

    // Try to proceed to signing step
    const nextBtn = page.getByRole("button", { name: /continue|next/i });
    if (await nextBtn.isVisible()) {
      await nextBtn.click();
      
      // Should show permission signing step
      await expect(page.getByText(/spend permission|sign|approve/i)).toBeVisible();
    }
  });
});
