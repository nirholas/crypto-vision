"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import type { SecurityReport } from "@/lib/security-scanner";
import type { ContractExplanation } from "@/lib/contract-whisperer";

interface AnalysisResult {
  success: boolean;
  address: string;
  network: string;
  contractName?: string;
  compilerVersion?: string;
  isVerified: boolean;
  isProxy: boolean;
  implementationAddress?: string;
  hasSourceCode: boolean;
  securityReport: SecurityReport;
  explanation: ContractExplanation | null;
}

interface ContractAnalyzerProps {
  address: string;
  network: string;
  onClose: () => void;
}

export function ContractAnalyzer({ address, network, onClose }: ContractAnalyzerProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [hasAnalyzed, setHasAnalyzed] = useState(false);

  const analyze = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ address, network }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to analyze");
      }

      setResult(data);
      setHasAnalyzed(true);
      
      if (data.securityReport.riskLevel === "danger") {
        toast.error("⚠️ High risk contract detected!");
      } else if (data.securityReport.riskLevel === "warning") {
        toast.warning("⚠️ Multiple risks found - proceed with caution");
      } else {
        toast.success("Analysis complete!");
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Analysis failed";
      setError(message);
      toast.error(message);
    } finally {
      setIsLoading(false);
    }
  };

  const getRiskColor = (level: string) => {
    switch (level) {
      case "safe":
        return "bg-emerald-500";
      case "caution":
        return "bg-yellow-500";
      case "warning":
        return "bg-orange-500";
      case "danger":
        return "bg-red-500";
      default:
        return "bg-slate-500";
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case "critical":
        return "bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 border-red-200 dark:border-red-800";
      case "high":
        return "bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400 border-orange-200 dark:border-orange-800";
      case "medium":
        return "bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400 border-yellow-200 dark:border-yellow-800";
      case "low":
        return "bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 border-blue-200 dark:border-blue-800";
      default:
        return "bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300";
    }
  };

  const getSeverityIcon = (severity: string) => {
    switch (severity) {
      case "critical":
        return "🚨";
      case "high":
        return "⚠️";
      case "medium":
        return "⚡";
      case "low":
        return "ℹ️";
      default:
        return "📝";
    }
  };

  if (!hasAnalyzed) {
    return (
      <Card className="bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm border-slate-200 dark:border-slate-700 mb-6">
        <CardHeader>
          <CardTitle className="text-slate-800 dark:text-slate-100 flex items-center gap-2">
            🛡️ Security Scanner
          </CardTitle>
          <CardDescription className="dark:text-slate-400">
            Scan this contract for potential risks before creating an MCP server
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4">
            <Button
              onClick={analyze}
              disabled={isLoading}
              className="bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white"
            >
              {isLoading ? (
                <>
                  <span className="animate-spin mr-2">⏳</span>
                  Scanning...
                </>
              ) : (
                <>🔍 Scan Contract</>
              )}
            </Button>
            <Button variant="ghost" onClick={onClose}>
              Skip
            </Button>
          </div>
          {isLoading && (
            <div className="mt-4 space-y-2">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-4 w-1/2" />
            </div>
          )}
          {error && (
            <p className="mt-4 text-red-500 text-sm">{error}</p>
          )}
        </CardContent>
      </Card>
    );
  }

  if (!result) return null;

  const { securityReport, explanation } = result;

  return (
    <Card className="bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm border-slate-200 dark:border-slate-700 mb-6 overflow-hidden">
      {/* Risk Score Header */}
      <div className={`${getRiskColor(securityReport.riskLevel)} px-6 py-4`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="text-4xl font-bold text-white">
              {securityReport.overallScore}
            </div>
            <div>
              <div className="text-white font-semibold text-lg">
                {securityReport.riskLevel === "safe" && "✅ Low Risk"}
                {securityReport.riskLevel === "caution" && "⚡ Moderate Risk"}
                {securityReport.riskLevel === "warning" && "⚠️ High Risk"}
                {securityReport.riskLevel === "danger" && "🚨 Critical Risk"}
              </div>
              <div className="text-white/80 text-sm">
                {result.contractName || address.slice(0, 10) + "..."}
              </div>
            </div>
          </div>
          <div className="flex gap-2">
            {result.isVerified && (
              <Badge className="bg-white/20 text-white border-white/30">
                ✓ Verified
              </Badge>
            )}
            {result.isProxy && (
              <Badge className="bg-white/20 text-white border-white/30">
                🔄 Proxy
              </Badge>
            )}
          </div>
        </div>
      </div>

      <CardContent className="pt-6 space-y-6">
        {/* Contract Explanation */}
        {explanation && (
          <div>
            <h3 className="font-semibold text-slate-800 dark:text-slate-200 mb-2 flex items-center gap-2">
              🎯 What This Contract Does
            </h3>
            <p className="text-slate-600 dark:text-slate-400 mb-3">
              {explanation.purpose}
            </p>
            
            {/* Main Functions */}
            <div className="flex flex-wrap gap-2 mb-4">
              {explanation.mainFunctions.slice(0, 8).map((func, idx) => (
                <Badge
                  key={idx}
                  variant="outline"
                  className={
                    func.type === "read"
                      ? "bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400 border-emerald-200"
                      : func.type === "payable"
                      ? "bg-purple-50 dark:bg-purple-900/20 text-purple-700 dark:text-purple-400 border-purple-200"
                      : "bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400 border-amber-200"
                  }
                  title={func.description}
                >
                  {func.type === "read" ? "📖" : func.type === "payable" ? "💰" : "✏️"} {func.name}
                </Badge>
              ))}
            </div>

            {/* Tokenomics */}
            {explanation.tokenomics && (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2 p-3 bg-slate-50 dark:bg-slate-900 rounded-lg">
                <div className="text-center">
                  <div className="text-lg">{explanation.tokenomics.canMint ? "⚠️" : "✅"}</div>
                  <div className="text-xs text-slate-500">Mintable</div>
                </div>
                <div className="text-center">
                  <div className="text-lg">{explanation.tokenomics.canBurn ? "🔥" : "—"}</div>
                  <div className="text-xs text-slate-500">Burnable</div>
                </div>
                <div className="text-center">
                  <div className="text-lg">{explanation.tokenomics.hasFees ? "💸" : "✅"}</div>
                  <div className="text-xs text-slate-500">Has Fees</div>
                </div>
                <div className="text-center">
                  <div className="text-lg">{explanation.tokenomics.hasMaxSupply ? "📊" : "♾️"}</div>
                  <div className="text-xs text-slate-500">Max Supply</div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Risks */}
        {securityReport.risks.length > 0 && (
          <div>
            <h3 className="font-semibold text-slate-800 dark:text-slate-200 mb-3 flex items-center gap-2">
              ⚠️ Detected Risks ({securityReport.risks.length})
            </h3>
            <div className="space-y-2 max-h-[250px] overflow-y-auto">
              {securityReport.risks.map((risk, idx) => (
                <div
                  key={idx}
                  className={`p-3 rounded-lg border ${getSeverityColor(risk.severity)}`}
                >
                  <div className="flex items-start gap-2">
                    <span>{getSeverityIcon(risk.severity)}</span>
                    <div>
                      <div className="font-medium">{risk.title}</div>
                      <div className="text-sm opacity-80">{risk.description}</div>
                    </div>
                    <Badge variant="outline" className="ml-auto shrink-0 text-xs">
                      {risk.severity}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Positives */}
        {securityReport.positives.length > 0 && (
          <div>
            <h3 className="font-semibold text-slate-800 dark:text-slate-200 mb-2 flex items-center gap-2">
              ✅ Positive Indicators
            </h3>
            <div className="flex flex-wrap gap-2">
              {securityReport.positives.map((positive, idx) => (
                <Badge
                  key={idx}
                  className="bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800"
                >
                  {positive}
                </Badge>
              ))}
            </div>
          </div>
        )}

        {/* Permissions */}
        {explanation?.permissions && explanation.permissions.length > 0 && (
          <div>
            <h3 className="font-semibold text-slate-800 dark:text-slate-200 mb-2 flex items-center gap-2">
              🔐 Access Control
            </h3>
            <div className="space-y-2">
              {explanation.permissions.map((perm, idx) => (
                <div
                  key={idx}
                  className={`p-3 rounded-lg border ${
                    perm.riskLevel === "dangerous"
                      ? "bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800"
                      : perm.riskLevel === "moderate"
                      ? "bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-800"
                      : "bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-800"
                  }`}
                >
                  <div className="font-medium text-slate-800 dark:text-slate-200">
                    {perm.role}
                  </div>
                  <div className="text-sm text-slate-600 dark:text-slate-400">
                    {perm.capabilities.slice(0, 5).join(", ")}
                    {perm.capabilities.length > 5 && ` +${perm.capabilities.length - 5} more`}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Risk Summary */}
        {explanation?.riskSummary && (
          <div className="p-4 bg-slate-100 dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-700">
            <div className="font-medium text-slate-800 dark:text-slate-200 mb-1">
              📋 Summary
            </div>
            <p className="text-sm text-slate-600 dark:text-slate-400">
              {explanation.riskSummary}
            </p>
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-2 pt-2">
          <Button
            variant="outline"
            onClick={() => setHasAnalyzed(false)}
            className="border-slate-300 dark:border-slate-600"
          >
            🔄 Re-scan
          </Button>
          <Button
            variant="outline"
            onClick={onClose}
            className="border-slate-300 dark:border-slate-600"
          >
            Close
          </Button>
          {securityReport.riskLevel !== "danger" && (
            <Button
              className="ml-auto bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white"
              onClick={onClose}
            >
              ✓ Proceed with Server
            </Button>
          )}
          {securityReport.riskLevel === "danger" && (
            <Button
              variant="destructive"
              className="ml-auto"
              onClick={onClose}
            >
              ⚠️ Proceed Anyway (Risky)
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
