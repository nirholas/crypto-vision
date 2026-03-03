"use client";

import { useState } from "react";

interface SwapSettingsProps {
  slippage: number;
  deadline: number;
  onSlippageChange: (slippage: number) => void;
  onDeadlineChange: (deadline: number) => void;
}

const SLIPPAGE_OPTIONS = [0.1, 0.5, 1.0, 3.0];

export function SwapSettings({
  slippage,
  deadline,
  onSlippageChange,
  onDeadlineChange,
}: SwapSettingsProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [customSlippage, setCustomSlippage] = useState("");

  const handleCustomSlippage = () => {
    const value = parseFloat(customSlippage);
    if (!isNaN(value) && value > 0 && value <= 50) {
      onSlippageChange(value);
    }
  };

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="p-2 rounded-lg hover:bg-muted transition-colors"
        title="Settings"
      >
        <svg
          className="w-5 h-5"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
          />
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
          />
        </svg>
      </button>

      {isOpen && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-40"
            onClick={() => setIsOpen(false)}
          />

          {/* Panel */}
          <div className="absolute right-0 top-full mt-2 w-80 bg-card border rounded-xl shadow-lg z-50 p-4">
            <h3 className="font-semibold mb-4">Swap Settings</h3>

            {/* Slippage Tolerance */}
            <div className="mb-6">
              <label className="text-sm text-muted-foreground block mb-2">
                Slippage Tolerance
              </label>
              <div className="flex gap-2 mb-2">
                {SLIPPAGE_OPTIONS.map((option) => (
                  <button
                    key={option}
                    onClick={() => onSlippageChange(option)}
                    className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${
                      slippage === option
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted hover:bg-muted/80"
                    }`}
                  >
                    {option}%
                  </button>
                ))}
              </div>
              <div className="flex gap-2">
                <input
                  type="number"
                  placeholder="Custom"
                  value={customSlippage}
                  onChange={(e) => setCustomSlippage(e.target.value)}
                  className="flex-1 px-3 py-2 bg-background border rounded-lg text-sm"
                  step="0.1"
                  min="0.01"
                  max="50"
                />
                <button
                  onClick={handleCustomSlippage}
                  className="px-4 py-2 bg-secondary rounded-lg text-sm hover:bg-secondary/80"
                >
                  Set
                </button>
              </div>
              {slippage > 5 && (
                <p className="text-xs text-yellow-500 mt-2">
                  ⚠️ High slippage may result in unfavorable trades
                </p>
              )}
            </div>

            {/* Transaction Deadline */}
            <div className="mb-4">
              <label className="text-sm text-muted-foreground block mb-2">
                Transaction Deadline
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  value={deadline}
                  onChange={(e) => onDeadlineChange(parseInt(e.target.value) || 20)}
                  className="w-20 px-3 py-2 bg-background border rounded-lg text-sm"
                  min="1"
                  max="180"
                />
                <span className="text-sm text-muted-foreground">minutes</span>
              </div>
            </div>

            {/* Current settings display */}
            <div className="pt-4 border-t">
              <p className="text-xs text-muted-foreground">
                Current: {slippage}% slippage, {deadline}min deadline
              </p>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
