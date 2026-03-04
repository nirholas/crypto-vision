/**
 * Crypto Vision — PNL Card Generator
 *
 * Generates PNL (Profit & Loss) card images using HTML Canvas.
 * Creates visually appealing cards showing call performance data.
 *
 * @copyright 2024-2026 nirholas. All rights reserved.
 */

import { createCanvas, type Canvas } from "canvas";
import { type Call } from "../db/schema.js";
import { formatMarketCap, formatMultiplier, formatPercentage } from "./token-data.js";
import { logger } from "@/lib/logger";

const log = logger.child({ module: "crypto-vision:pnl-card" });

const CARD_WIDTH = 800;
const CARD_HEIGHT = 500;

interface PnlCardData {
  tokenSymbol: string;
  tokenName: string;
  chain: string;
  callType: string;
  callerUsername: string;
  callerWinRate: number;
  callerRank: string;
  marketCapAtCall: number;
  athMarketCap: number;
  priceAtCall: number;
  athPrice: number;
  peakMultiplier: number;
  calledAt: Date;
  athTimestamp: Date | null;
}

/**
 * Get color for multiplier display.
 */
function getMultiplierColor(multiplier: number): string {
  if (multiplier >= 30) return "#FFD700"; // Gold — legendary
  if (multiplier >= 15) return "#E040FB"; // Purple — elite
  if (multiplier >= 5) return "#00E676";  // Green — great
  if (multiplier >= 2) return "#40C4FF";  // Blue — strong
  if (multiplier >= 1.5) return "#B0BEC5"; // Grey — solid
  return "#FF5252"; // Red — weak
}

/**
 * Get background gradient colors for a call type.
 */
function getCallTypeGradient(callType: string): [string, string] {
  if (callType === "alpha") return ["#1a1a2e", "#16213e"];
  return ["#1a1a2e", "#0f3460"]; // gamble
}

/**
 * Get rank tier emoji.
 */
function getRankEmoji(rank: string): string {
  switch (rank) {
    case "oracle": return "🏆";
    case "guru": return "💼";
    case "contender": return "⚖️";
    case "novice": return "🛠";
    case "amateur": return "🚧";
    default: return "📊";
  }
}

/**
 * Format date for display.
 */
function formatDate(date: Date): string {
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/**
 * Generate a PNL card image as a Buffer (PNG).
 */
export function generatePnlCard(data: PnlCardData): Buffer {
  const canvas = createCanvas(CARD_WIDTH, CARD_HEIGHT);
  const ctx = canvas.getContext("2d");

  // Background gradient
  const [gradStart, gradEnd] = getCallTypeGradient(data.callType);
  const gradient = ctx.createLinearGradient(0, 0, CARD_WIDTH, CARD_HEIGHT);
  gradient.addColorStop(0, gradStart);
  gradient.addColorStop(1, gradEnd);
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, CARD_WIDTH, CARD_HEIGHT);

  // Border glow effect
  const borderColor = getMultiplierColor(data.peakMultiplier);
  ctx.strokeStyle = borderColor;
  ctx.lineWidth = 3;
  ctx.strokeRect(2, 2, CARD_WIDTH - 4, CARD_HEIGHT - 4);

  // Inner subtle border
  ctx.strokeStyle = "rgba(255,255,255,0.1)";
  ctx.lineWidth = 1;
  ctx.strokeRect(10, 10, CARD_WIDTH - 20, CARD_HEIGHT - 20);

  // Header — Token info
  ctx.fillStyle = "#FFFFFF";
  ctx.font = "bold 32px Arial, sans-serif";
  ctx.fillText(`${data.tokenSymbol}`, 30, 55);

  ctx.fillStyle = "#B0BEC5";
  ctx.font = "16px Arial, sans-serif";
  ctx.fillText(data.tokenName, 30, 80);

  // Call type badge
  const badgeText = data.callType.toUpperCase();
  ctx.font = "bold 14px Arial, sans-serif";
  const badgeWidth = ctx.measureText(badgeText).width + 20;
  const badgeX = CARD_WIDTH - badgeWidth - 30;
  ctx.fillStyle = data.callType === "alpha" ? "#00E676" : "#FF9100";
  roundRect(ctx, badgeX, 35, badgeWidth, 28, 14);
  ctx.fill();
  ctx.fillStyle = "#000000";
  ctx.fillText(badgeText, badgeX + 10, 54);

  // Chain badge
  ctx.fillStyle = "rgba(255,255,255,0.1)";
  ctx.font = "12px Arial, sans-serif";
  const chainText = data.chain.toUpperCase();
  const chainWidth = ctx.measureText(chainText).width + 16;
  roundRect(ctx, badgeX - chainWidth - 10, 35, chainWidth, 28, 14);
  ctx.fill();
  ctx.fillStyle = "#90CAF9";
  ctx.fillText(chainText, badgeX - chainWidth - 2, 54);

  // Divider
  ctx.strokeStyle = "rgba(255,255,255,0.1)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(30, 100);
  ctx.lineTo(CARD_WIDTH - 30, 100);
  ctx.stroke();

  // Multiplier — BIG center display
  const multiplierColor = getMultiplierColor(data.peakMultiplier);
  ctx.fillStyle = multiplierColor;
  ctx.font = "bold 72px Arial, sans-serif";
  const multiplierText = formatMultiplier(data.peakMultiplier);
  const mWidth = ctx.measureText(multiplierText).width;
  ctx.fillText(multiplierText, (CARD_WIDTH - mWidth) / 2, 190);

  // Percentage gain
  const percentGain = (data.peakMultiplier - 1) * 100;
  ctx.fillStyle = percentGain >= 0 ? "#00E676" : "#FF5252";
  ctx.font = "bold 24px Arial, sans-serif";
  const pctText = formatPercentage(percentGain);
  const pWidth = ctx.measureText(pctText).width;
  ctx.fillText(pctText, (CARD_WIDTH - pWidth) / 2, 225);

  // Stats grid — 2 columns
  const statsY = 260;
  const col1X = 50;
  const col2X = CARD_WIDTH / 2 + 30;

  // Market Cap at Call
  drawStatLabel(ctx, "Market Cap at Call", col1X, statsY);
  drawStatValue(ctx, formatMarketCap(data.marketCapAtCall), col1X, statsY + 25);

  // ATH Market Cap
  drawStatLabel(ctx, "ATH After Call", col2X, statsY);
  drawStatValue(
    ctx,
    formatMarketCap(data.athMarketCap),
    col2X,
    statsY + 25,
    "#00E676",
  );

  // Price at Call
  drawStatLabel(ctx, "Price at Call", col1X, statsY + 65);
  drawStatValue(ctx, `$${data.priceAtCall.toFixed(8)}`, col1X, statsY + 90);

  // ATH Price
  drawStatLabel(ctx, "ATH Price", col2X, statsY + 65);
  drawStatValue(
    ctx,
    `$${data.athPrice.toFixed(8)}`,
    col2X,
    statsY + 90,
    "#00E676",
  );

  // Date / Time
  drawStatLabel(ctx, "Called At", col1X, statsY + 130);
  drawStatValue(ctx, formatDate(data.calledAt), col1X, statsY + 155);

  if (data.athTimestamp) {
    drawStatLabel(ctx, "ATH Reached", col2X, statsY + 130);
    drawStatValue(ctx, formatDate(data.athTimestamp), col2X, statsY + 155);
  }

  // Footer — Caller info
  ctx.fillStyle = "rgba(255,255,255,0.05)";
  ctx.fillRect(0, CARD_HEIGHT - 55, CARD_WIDTH, 55);

  ctx.fillStyle = "#B0BEC5";
  ctx.font = "14px Arial, sans-serif";
  const callerText = `${getRankEmoji(data.callerRank)} @${data.callerUsername} · WR: ${data.callerWinRate.toFixed(1)}%`;
  ctx.fillText(callerText, 30, CARD_HEIGHT - 25);

  // Branding
  ctx.fillStyle = "rgba(255,255,255,0.3)";
  ctx.font = "12px Arial, sans-serif";
  ctx.fillText("Crypto Vision", CARD_WIDTH - 80, CARD_HEIGHT - 25);

  return canvas.toBuffer("image/png");
}

/**
 * Generate a Group PNL card showing overall group performance.
 */
export function generateGroupPnlCard(data: {
  groupTitle: string;
  timeframe: string;
  totalCalls: number;
  totalWins: number;
  winRate: number;
  avgMultiplier: number;
  totalPoints: number;
  uniqueCallers: number;
  topCallers: Array<{ username: string | null; points: number; winRate: number }>;
}): Buffer {
  const canvas = createCanvas(CARD_WIDTH, CARD_HEIGHT + 100);
  const ctx = canvas.getContext("2d");

  // Background
  const gradient = ctx.createLinearGradient(0, 0, CARD_WIDTH, CARD_HEIGHT + 100);
  gradient.addColorStop(0, "#0d1117");
  gradient.addColorStop(1, "#161b22");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, CARD_WIDTH, CARD_HEIGHT + 100);

  // Border
  ctx.strokeStyle = "#30363d";
  ctx.lineWidth = 2;
  ctx.strokeRect(2, 2, CARD_WIDTH - 4, CARD_HEIGHT + 96);

  // Header
  ctx.fillStyle = "#FFFFFF";
  ctx.font = "bold 28px Arial, sans-serif";
  ctx.fillText(`📊 ${data.groupTitle}`, 30, 50);

  ctx.fillStyle = "#8b949e";
  ctx.font = "16px Arial, sans-serif";
  ctx.fillText(`Performance · ${data.timeframe}`, 30, 75);

  // Divider
  ctx.strokeStyle = "#30363d";
  ctx.beginPath();
  ctx.moveTo(30, 95);
  ctx.lineTo(CARD_WIDTH - 30, 95);
  ctx.stroke();

  // Stats grid
  const statsStartY = 130;
  const statSpacing = 180;

  // Row 1
  drawGroupStat(ctx, "Total Calls", data.totalCalls.toString(), 50, statsStartY);
  drawGroupStat(ctx, "Wins", data.totalWins.toString(), 50 + statSpacing, statsStartY, "#00E676");
  drawGroupStat(ctx, "Win Rate", `${data.winRate.toFixed(1)}%`, 50 + statSpacing * 2, statsStartY, data.winRate >= 50 ? "#00E676" : "#FF5252");
  drawGroupStat(ctx, "Callers", data.uniqueCallers.toString(), 50 + statSpacing * 3, statsStartY);

  // Row 2
  drawGroupStat(ctx, "Avg Multiplier", formatMultiplier(data.avgMultiplier), 50, statsStartY + 80, getMultiplierColor(data.avgMultiplier));
  drawGroupStat(ctx, "Total Points", data.totalPoints.toString(), 50 + statSpacing, statsStartY + 80);

  // Top callers section
  const topY = statsStartY + 180;
  ctx.fillStyle = "#FFFFFF";
  ctx.font = "bold 18px Arial, sans-serif";
  ctx.fillText("🏆 Top Callers", 30, topY);

  data.topCallers.slice(0, 5).forEach((caller, i) => {
    const y = topY + 30 + i * 28;
    const medal = i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : `${i + 1}.`;
    ctx.fillStyle = "#8b949e";
    ctx.font = "14px Arial, sans-serif";
    ctx.fillText(
      `${medal} @${caller.username ?? "anon"} · ${caller.points} pts · WR: ${caller.winRate.toFixed(1)}%`,
      50,
      y,
    );
  });

  // Branding
  ctx.fillStyle = "rgba(255,255,255,0.3)";
  ctx.font = "12px Arial, sans-serif";
  ctx.fillText("Crypto Vision", CARD_WIDTH - 80, CARD_HEIGHT + 80);

  return canvas.toBuffer("image/png");
}

/**
 * Generate a user rank card.
 */
export function generateRankCard(data: {
  username: string;
  rankTier: string;
  winRate: number;
  totalCalls: number;
  totalWins: number;
  performancePoints: number;
  topCalls: Array<{
    tokenSymbol: string | null;
    peakMultiplier: number | null;
    calledAt: Date;
  }>;
}): Buffer {
  const canvas = createCanvas(600, 400);
  const ctx = canvas.getContext("2d");

  // Background with rank-tier border color
  const tierColors: Record<string, string> = {
    oracle: "#FFD700",
    guru: "#E040FB",
    contender: "#40C4FF",
    novice: "#FF9100",
    amateur: "#757575",
  };
  const borderColor = tierColors[data.rankTier] ?? "#757575";

  const gradient = ctx.createLinearGradient(0, 0, 600, 400);
  gradient.addColorStop(0, "#0d1117");
  gradient.addColorStop(1, "#161b22");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 600, 400);

  // Rank border glow
  ctx.strokeStyle = borderColor;
  ctx.lineWidth = 4;
  ctx.strokeRect(2, 2, 596, 396);

  // Inner glow
  ctx.shadowColor = borderColor;
  ctx.shadowBlur = 20;
  ctx.strokeRect(6, 6, 588, 388);
  ctx.shadowBlur = 0;

  // Header
  ctx.fillStyle = "#FFFFFF";
  ctx.font = "bold 28px Arial, sans-serif";
  const rankEmoji = getRankEmoji(data.rankTier);
  ctx.fillText(
    `${rankEmoji} @${data.username}`,
    25,
    45,
  );

  // Rank badge
  ctx.fillStyle = borderColor;
  ctx.font = "bold 16px Arial, sans-serif";
  const tierText = data.rankTier.toUpperCase();
  const tierWidth = ctx.measureText(tierText).width + 20;
  roundRect(ctx, 25, 58, tierWidth, 26, 13);
  ctx.fill();
  ctx.fillStyle = "#000";
  ctx.fillText(tierText, 35, 76);

  // Stats
  const sy = 110;
  drawStatLabel(ctx, "Win Rate", 25, sy);
  ctx.fillStyle = data.winRate >= 50 ? "#00E676" : "#FF5252";
  ctx.font = "bold 24px Arial, sans-serif";
  ctx.fillText(`${data.winRate.toFixed(1)}%`, 25, sy + 30);

  drawStatLabel(ctx, "Total Calls", 200, sy);
  ctx.fillStyle = "#FFFFFF";
  ctx.font = "bold 24px Arial, sans-serif";
  ctx.fillText(`${data.totalCalls}`, 200, sy + 30);

  drawStatLabel(ctx, "Wins", 370, sy);
  ctx.fillStyle = "#00E676";
  ctx.font = "bold 24px Arial, sans-serif";
  ctx.fillText(`${data.totalWins}`, 370, sy + 30);

  drawStatLabel(ctx, "Points", 470, sy);
  ctx.fillStyle = data.performancePoints >= 0 ? "#FFD700" : "#FF5252";
  ctx.font = "bold 24px Arial, sans-serif";
  ctx.fillText(`${data.performancePoints}`, 470, sy + 30);

  // Top 3 calls
  ctx.fillStyle = "#FFFFFF";
  ctx.font = "bold 18px Arial, sans-serif";
  ctx.fillText("🔥 Best Calls", 25, 195);

  data.topCalls.slice(0, 3).forEach((call, i) => {
    const y = 225 + i * 45;
    const medal = i === 0 ? "🥇" : i === 1 ? "🥈" : "🥉";
    const mult = call.peakMultiplier ?? 1;
    const color = getMultiplierColor(mult);

    ctx.fillStyle = "#8b949e";
    ctx.font = "16px Arial, sans-serif";
    ctx.fillText(`${medal} ${call.tokenSymbol ?? "???"}`, 40, y);

    ctx.fillStyle = color;
    ctx.font = "bold 16px Arial, sans-serif";
    ctx.fillText(formatMultiplier(mult), 200, y);

    ctx.fillStyle = "#586069";
    ctx.font = "12px Arial, sans-serif";
    ctx.fillText(formatDate(call.calledAt), 300, y);
  });

  // Branding
  ctx.fillStyle = "rgba(255,255,255,0.3)";
  ctx.font = "12px Arial, sans-serif";
  ctx.fillText("Crypto Vision", 520, 380);

  return canvas.toBuffer("image/png");
}

// ─── Canvas Helpers ─────────────────────────────────────────

function drawStatLabel(
  ctx: ReturnType<Canvas["getContext"]>,
  label: string,
  x: number,
  y: number,
): void {
  ctx.fillStyle = "#8b949e";
  ctx.font = "12px Arial, sans-serif";
  ctx.fillText(label, x, y);
}

function drawStatValue(
  ctx: ReturnType<Canvas["getContext"]>,
  value: string,
  x: number,
  y: number,
  color = "#FFFFFF",
): void {
  ctx.fillStyle = color;
  ctx.font = "bold 18px Arial, sans-serif";
  ctx.fillText(value, x, y);
}

function drawGroupStat(
  ctx: ReturnType<Canvas["getContext"]>,
  label: string,
  value: string,
  x: number,
  y: number,
  color = "#FFFFFF",
): void {
  ctx.fillStyle = "#8b949e";
  ctx.font = "12px Arial, sans-serif";
  ctx.fillText(label, x, y);
  ctx.fillStyle = color;
  ctx.font = "bold 22px Arial, sans-serif";
  ctx.fillText(value, x, y + 28);
}

function roundRect(
  ctx: ReturnType<Canvas["getContext"]>,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
): void {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}
