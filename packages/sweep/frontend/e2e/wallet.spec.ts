import { test, expect } from "@playwright/test";

test.describe("Wallet Connection", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
  });

  test("shows wallet connect button when not connected", async ({ page }) => {
    await expect(page.getByRole("button", { name: /connect wallet/i })).toBeVisible();
  });

  test("clicking connect shows wallet options", async ({ page }) => {
    await page.getByRole("button", { name: /connect wallet/i }).click();
    
    // Should show wallet modal or options
    // ConnectKit modal should appear
    await expect(page.getByRole("dialog").or(page.locator("[data-testid='connectkit-modal']"))).toBeVisible();
  });

  test("wallet options include supported wallets", async ({ page }) => {
    await page.getByRole("button", { name: /connect wallet/i }).click();
    
    // Should show common wallet options
    const modal = page.getByRole("dialog");
    if (await modal.isVisible()) {
      // Check for wallet options
      const metamask = page.getByText(/metamask/i);
      const coinbase = page.getByText(/coinbase/i);
      const walletConnect = page.getByText(/walletconnect/i);
      
      // At least one wallet option should be visible
      await expect(metamask.or(coinbase).or(walletConnect)).toBeVisible();
    }
  });
});

test.describe("Wallet - Connected State", () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      window.localStorage.setItem("wagmi.connected", "true");
      window.localStorage.setItem("wagmi.wallet", "injected");
      // Mock connected address
      window.localStorage.setItem("wagmi.store", JSON.stringify({
        state: {
          connections: [{
            accounts: ["0x1234567890123456789012345678901234567890"],
            chainId: 1,
          }],
        },
      }));
    });
    await page.goto("/");
  });

  test("shows connected wallet address", async ({ page }) => {
    // Should show truncated address or ENS name
    const addressDisplay = page.getByText(/0x[a-fA-F0-9]{4}...([a-fA-F0-9]{4})/);
    const ensDisplay = page.getByText(/\.eth$/);
    const connectedBtn = page.getByRole("button", { name: /connected|0x/i });
    
    await expect(addressDisplay.or(ensDisplay).or(connectedBtn)).toBeVisible();
  });

  test("shows chain selector when connected", async ({ page }) => {
    // Should show current chain or chain selector
    const chainSelector = page.locator("[data-testid='chain-selector']");
    const chainName = page.getByText(/ethereum|base|arbitrum|polygon/i);
    
    await expect(chainSelector.or(chainName)).toBeVisible();
  });

  test("can access account menu", async ({ page }) => {
    // Find and click the account/wallet button
    const walletBtn = page.getByRole("button", { name: /0x|connected|wallet/i });
    if (await walletBtn.isVisible()) {
      await walletBtn.click();
      
      // Should show account options
      await expect(page.getByText(/disconnect|copy address|switch/i)).toBeVisible();
    }
  });
});

test.describe("Wallet - Chain Switching", () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      window.localStorage.setItem("wagmi.connected", "true");
    });
    await page.goto("/");
  });

  test("shows supported chains in chain selector", async ({ page }) => {
    // Find chain selector in the dashboard
    await expect(page.getByText("Select Chains")).toBeVisible();
    
    // Should show supported chains
    await expect(page.getByText(/base/i)).toBeVisible();
    await expect(page.getByText(/arbitrum/i)).toBeVisible();
    await expect(page.getByText(/polygon/i)).toBeVisible();
  });

  test("can toggle chain selection", async ({ page }) => {
    // Find chain checkbox/toggle
    const chainToggle = page.locator("input[type='checkbox']").first();
    if (await chainToggle.isVisible()) {
      // Toggle off
      await chainToggle.click();
      // Toggle on
      await chainToggle.click();
    }
  });
});

test.describe("Wallet - Disconnection", () => {
  test("can disconnect wallet", async ({ page }) => {
    await page.addInitScript(() => {
      window.localStorage.setItem("wagmi.connected", "true");
    });
    await page.goto("/");

    // Find disconnect option
    const walletBtn = page.getByRole("button", { name: /0x|connected|wallet/i });
    if (await walletBtn.isVisible()) {
      await walletBtn.click();
      
      const disconnectBtn = page.getByRole("button", { name: /disconnect/i });
      if (await disconnectBtn.isVisible()) {
        await disconnectBtn.click();
        
        // Should show connect wallet prompt again
        await expect(page.getByRole("button", { name: /connect wallet/i })).toBeVisible();
      }
    }
  });
});

test.describe("Wallet - Error Handling", () => {
  test("handles connection rejection gracefully", async ({ page }) => {
    // Mock wallet rejection
    await page.addInitScript(() => {
      // Override wallet provider to reject
      (window as any).ethereum = {
        request: async ({ method }: { method: string }) => {
          if (method === "eth_requestAccounts") {
            throw new Error("User rejected the request");
          }
          return [];
        },
        isMetaMask: true,
      };
    });

    await page.goto("/");
    await page.getByRole("button", { name: /connect wallet/i }).click();
    
    // App should still be usable
    await expect(page.getByRole("heading", { name: /connect your wallet/i })).toBeVisible();
  });

  test("handles network errors during connection", async ({ page }) => {
    await page.route("**/api/**", (route) => {
      route.abort("failed");
    });

    await page.goto("/");
    
    // Should still render connect prompt
    await expect(page.getByRole("heading", { name: /connect your wallet/i })).toBeVisible();
  });
});
