"use client";

import type { SweepQuote } from "@/lib/types";
import { SUPPORTED_CHAINS } from "@/lib/chains";

interface SweepPreviewProps {
  quote: SweepQuote;
  onBack: () => void;
  onConfirm: () => void;
}

export function SweepPreview({ quote, onBack, onConfirm }: SweepPreviewProps) {
  const expiresIn = Math.max(0, Math.floor((quote.expiresAt - Date.now()) / 1000));
  
  return (
    <div className="space-y-6">
      {/* Input Tokens */}
      <div className="bg-card rounded-xl border p-6">
        <h2 className="text-lg font-semibold mb-4">Input Tokens</h2>
        <div className="space-y-3">
          {quote.inputTokens.map((token, i) => {
            const chain = SUPPORTED_CHAINS.find((c) => c.id === token.chainId);
            return (
              <div
                key={i}
                className="flex items-center justify-between p-3 bg-background rounded-lg"
              >
                <div className="flex items-center gap-3">
                  <span>{chain?.icon || "🔗"}</span>
                  <div>
                    <p className="font-medium">{token.symbol}</p>
                    <p className="text-sm text-muted-foreground">
                      {chain?.name}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="font-medium">{token.balance}</p>
                  <p className="text-sm text-muted-foreground">
                    ${token.balanceUsd.toFixed(2)}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
        <div className="mt-4 pt-4 border-t flex justify-between">
          <span className="text-muted-foreground">Total Input</span>
          <span className="font-semibold">${quote.totalInputUsd.toFixed(2)}</span>
        </div>
      </div>

      {/* Arrow */}
      <div className="flex justify-center">
        <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
          <span className="text-2xl">↓</span>
        </div>
      </div>

      {/* Output */}
      <div className="bg-card rounded-xl border p-6">
        <h2 className="text-lg font-semibold mb-4">Output</h2>
        <div className="flex items-center justify-between p-4 bg-background rounded-lg">
          <div className="flex items-center gap-3">
            {quote.outputToken.logoUrl ? (
              <img 
                src={quote.outputToken.logoUrl} 
                alt={quote.outputToken.symbol}
                className="w-10 h-10 rounded-full"
              />
            ) : (
              <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center text-xl">
                $
              </div>
            )}
            <div>
              <p className="font-medium">{quote.outputToken.symbol}</p>
              <p className="text-sm text-muted-foreground">
                {SUPPORTED_CHAINS.find(c => c.id === quote.outputToken.chainId)?.name || 'Unknown Chain'}
              </p>
            </div>
          </div>
          <div className="text-right">
            <p className="font-medium text-xl">{quote.estimatedOutput}</p>
            <p className="text-sm text-muted-foreground">
              ${quote.estimatedOutputUsd.toFixed(2)}
            </p>
          </div>
        </div>
      </div>

      {/* Fees Breakdown */}
      <div className="bg-card rounded-xl border p-6">
        <h2 className="text-lg font-semibold mb-4">Fee Breakdown</h2>
        <div className="space-y-3">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Gas {quote.gasless ? '(sponsored)' : ''}</span>
            <span className={quote.gasless ? "text-green-500" : ""}>
              {quote.gasless ? "Free" : `$${quote.fees.gas.toFixed(2)}`}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Protocol fee (0.3%)</span>
            <span>${quote.fees.protocol.toFixed(2)}</span>
          </div>
          {quote.fees.bridge && quote.fees.bridge > 0 && (
            <div className="flex justify-between">
              <span className="text-muted-foreground">Bridge fee</span>
              <span>${quote.fees.bridge.toFixed(2)}</span>
            </div>
          )}
          <div className="flex justify-between">
            <span className="text-muted-foreground">Price impact</span>
            <span className={quote.priceImpact > 2 ? "text-yellow-500" : ""}>
              {quote.priceImpact.toFixed(2)}%
            </span>
          </div>
          <div className="pt-3 border-t flex justify-between font-semibold">
            <span>Total Fees</span>
            <span>${quote.fees.total.toFixed(2)}</span>
          </div>
        </div>
      </div>

      {/* Summary */}
      <div className="bg-primary/10 rounded-xl p-6">
        <div className="flex items-center justify-between mb-4">
          <span className="text-lg">You receive</span>
          <span className="text-2xl font-bold">
            {quote.estimatedOutput} {quote.outputToken.symbol}
          </span>
        </div>
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <span>Estimated value</span>
          <span>
            ${quote.estimatedOutputUsd.toFixed(2)}
          </span>
        </div>
      </div>

      {/* Route Info */}
      {quote.routes && quote.routes.length > 0 && (
        <div className="bg-card rounded-xl border p-6">
          <h2 className="text-lg font-semibold mb-4">Routes</h2>
          <div className="space-y-2">
            {quote.routes.map((route, i) => {
              const chain = SUPPORTED_CHAINS.find(c => c.id === route.chainId);
              return (
                <div key={i} className="flex items-center justify-between p-2 bg-background rounded-lg text-sm">
                  <div className="flex items-center gap-2">
                    <span>{chain?.icon || "🔗"}</span>
                    <span>{route.dex}</span>
                  </div>
                  <span className="text-muted-foreground">
                    {route.path.join(" → ")}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-4">
        <button
          onClick={onBack}
          className="flex-1 px-6 py-3 bg-secondary text-secondary-foreground rounded-lg font-semibold hover:bg-secondary/80 transition-colors"
        >
          Back
        </button>
        <button
          onClick={onConfirm}
          className="flex-1 px-6 py-3 bg-primary text-primary-foreground rounded-lg font-semibold hover:bg-primary/90 transition-colors"
        >
          Confirm Sweep
        </button>
      </div>

      {/* Quote Expiry */}
      {expiresIn > 0 && (
        <p className="text-center text-sm text-muted-foreground">
          Quote expires in {Math.floor(expiresIn / 60)}:
          {(expiresIn % 60).toString().padStart(2, "0")}
        </p>
      )}
    </div>
  );
}
