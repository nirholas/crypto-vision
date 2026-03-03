"use client";

import { useState, useEffect } from "react";
import { useAccount } from "wagmi";
import { Header } from "@/components/Header";
import { WalletConnect } from "@/components/WalletConnect";
import type { SweepSettings, OutputTokenOption } from "@/lib/types";
import { OUTPUT_TOKEN_OPTIONS, DEFAULT_SETTINGS } from "@/lib/types";
import { SUPPORTED_CHAINS } from "@/lib/chains";

export default function SettingsPage() {
  const { isConnected, address } = useAccount();
  const [settings, setSettings] = useState<SweepSettings>(DEFAULT_SETTINGS);
  const [isSaving, setIsSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);

  // Load settings from localStorage
  useEffect(() => {
    if (address) {
      const saved = localStorage.getItem(`sweep-settings-${address}`);
      if (saved) {
        try {
          setSettings(JSON.parse(saved));
        } catch (e) {
          console.error("Failed to load settings:", e);
        }
      }
    }
  }, [address]);

  const handleSave = async () => {
    if (!address) return;

    setIsSaving(true);
    try {
      localStorage.setItem(`sweep-settings-${address}`, JSON.stringify(settings));
      setSaveMessage("Settings saved successfully!");
      setTimeout(() => setSaveMessage(null), 3000);
    } catch (e) {
      setSaveMessage("Failed to save settings");
    } finally {
      setIsSaving(false);
    }
  };

  const handleReset = () => {
    setSettings(DEFAULT_SETTINGS);
    if (address) {
      localStorage.removeItem(`sweep-settings-${address}`);
    }
    setSaveMessage("Settings reset to defaults");
    setTimeout(() => setSaveMessage(null), 3000);
  };

  if (!isConnected) {
    return (
      <main className="min-h-screen bg-gradient-to-b from-background to-background/80">
        <Header />
        <div className="container mx-auto px-4 py-20 text-center">
          <div className="mb-8">
            <span className="text-8xl">⚙️</span>
          </div>
          <h1 className="text-3xl font-bold mb-4">Settings</h1>
          <p className="text-muted-foreground mb-8">
            Connect your wallet to manage your preferences.
          </p>
          <WalletConnect />
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-gradient-to-b from-background to-background/80">
      <Header />

      <div className="container mx-auto px-4 py-8">
        <div className="max-w-2xl mx-auto">
          {/* Page Header */}
          <div className="mb-8">
            <h1 className="text-3xl font-bold mb-2">Settings</h1>
            <p className="text-muted-foreground">
              Customize your Sweep experience
            </p>
          </div>

          {/* Save Message */}
          {saveMessage && (
            <div
              className={`mb-6 p-4 rounded-lg ${
                saveMessage.includes("Failed")
                  ? "bg-red-500/10 text-red-500"
                  : "bg-green-500/10 text-green-500"
              }`}
            >
              {saveMessage}
            </div>
          )}

          {/* Settings Sections */}
          <div className="space-y-6">
            {/* Sweep Defaults */}
            <div className="bg-card rounded-xl border p-6">
              <h2 className="text-lg font-semibold mb-4">Sweep Defaults</h2>

              {/* Min Dust Value */}
              <div className="mb-6">
                <label className="text-sm text-muted-foreground block mb-2">
                  Minimum Dust Value (USD)
                </label>
                <input
                  type="number"
                  value={settings.minDustValue}
                  onChange={(e) =>
                    setSettings({
                      ...settings,
                      minDustValue: parseFloat(e.target.value) || 0.1,
                    })
                  }
                  className="w-full px-4 py-2 bg-background border rounded-lg"
                  min="0.01"
                  step="0.1"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Tokens below this value will be filtered out
                </p>
              </div>

              {/* Max Dust Value */}
              <div className="mb-6">
                <label className="text-sm text-muted-foreground block mb-2">
                  Maximum Dust Value (USD)
                </label>
                <input
                  type="number"
                  value={settings.maxDustValue}
                  onChange={(e) =>
                    setSettings({
                      ...settings,
                      maxDustValue: parseFloat(e.target.value) || 100,
                    })
                  }
                  className="w-full px-4 py-2 bg-background border rounded-lg"
                  min="1"
                  step="10"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Tokens above this value won&apos;t be classified as dust
                </p>
              </div>

              {/* Default Output Token */}
              <div className="mb-6">
                <label className="text-sm text-muted-foreground block mb-2">
                  Default Output Token
                </label>
                <select
                  value={settings.outputToken}
                  onChange={(e) =>
                    setSettings({ ...settings, outputToken: e.target.value })
                  }
                  className="w-full px-4 py-2 bg-background border rounded-lg"
                >
                  {OUTPUT_TOKEN_OPTIONS.map((token) => (
                    <option key={token.symbol} value={token.symbol}>
                      {token.symbol} - {token.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Slippage Tolerance */}
              <div className="mb-6">
                <label className="text-sm text-muted-foreground block mb-2">
                  Default Slippage Tolerance (%)
                </label>
                <div className="flex gap-2">
                  {[0.1, 0.5, 1.0, 3.0].map((value) => (
                    <button
                      key={value}
                      onClick={() => setSettings({ ...settings, slippage: value })}
                      className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${
                        settings.slippage === value
                          ? "bg-primary text-primary-foreground"
                          : "bg-muted hover:bg-muted/80"
                      }`}
                    >
                      {value}%
                    </button>
                  ))}
                </div>
              </div>

              {/* Include Spam */}
              <div>
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={settings.includeSpam}
                    onChange={(e) =>
                      setSettings({ ...settings, includeSpam: e.target.checked })
                    }
                    className="w-5 h-5 rounded border-muted-foreground"
                  />
                  <div>
                    <span className="font-medium">Include Spam Tokens</span>
                    <p className="text-sm text-muted-foreground">
                      Show tokens that may be spam or airdrop scams
                    </p>
                  </div>
                </label>
              </div>
            </div>

            {/* Display Settings */}
            <div className="bg-card rounded-xl border p-6">
              <h2 className="text-lg font-semibold mb-4">Display</h2>

              {/* Theme would go here if we had theme switching */}
              <p className="text-sm text-muted-foreground">
                More display options coming soon...
              </p>
            </div>

            {/* Actions */}
            <div className="flex gap-4">
              <button
                onClick={handleReset}
                className="flex-1 px-6 py-3 bg-secondary text-secondary-foreground rounded-lg font-semibold hover:bg-secondary/80 transition-colors"
              >
                Reset to Defaults
              </button>
              <button
                onClick={handleSave}
                disabled={isSaving}
                className="flex-1 px-6 py-3 bg-primary text-primary-foreground rounded-lg font-semibold hover:bg-primary/90 transition-colors disabled:opacity-50"
              >
                {isSaving ? "Saving..." : "Save Settings"}
              </button>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
