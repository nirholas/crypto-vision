/**
 * Crypto Vision — Message Formatting
 *
 * Telegram message templates for all bot responses.
 * Uses HTML parse mode for rich formatting.
 *
 * @copyright 2024-2026 nirholas. All rights reserved.
 */

import type { Call } from "../db/schema.js";
import type { TokenData } from "../services/token-data.js";
import {
  formatMarketCap,
  formatMultiplier,
  formatPercentage,
} from "../services/token-data.js";
import type {
  CallsLeaderboardEntry,
  PerformanceLeaderboardEntry,
} from "../services/leaderboard-service.js";

/**
 * Escape HTML special characters for Telegram HTML mode.
 */
export function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * Simple mode call message — brief, essential info only.
 */
export function formatSimpleCallMessage(
  call: Call,
  token: TokenData | null,
  callerUsername: string | null,
): string {
  const symbol = call.tokenSymbol ?? "???";
  const name = call.tokenName ?? "Unknown Token";
  const chain = call.chain.toUpperCase();
  const type = call.callType === "alpha" ? "🔷 ALPHA" : "🎲 GAMBLE";
  const caller = callerUsername ? `@${escapeHtml(callerUsername)}` : "Anonymous";

  const mcap = call.marketCapAtCall
    ? formatMarketCap(parseFloat(call.marketCapAtCall))
    : "N/A";

  let msg = `${type} <b>Call</b>\n\n`;
  msg += `🪙 <b>${escapeHtml(symbol)}</b> — ${escapeHtml(name)}\n`;
  msg += `⛓ ${chain}\n`;
  msg += `💰 MCap: ${mcap}\n`;
  msg += `👤 Called by: ${caller}\n`;

  if (token?.dexUrl) {
    msg += `\n📊 <a href="${token.dexUrl}">Chart</a>`;
  }

  msg += `\n\n<code>${call.tokenAddress}</code>`;

  return msg;
}

/**
 * Advanced mode call message — detailed token insights.
 */
export function formatAdvancedCallMessage(
  call: Call,
  token: TokenData | null,
  callerUsername: string | null,
  callerWinRate?: number,
): string {
  const symbol = call.tokenSymbol ?? "???";
  const name = call.tokenName ?? "Unknown Token";
  const chain = call.chain.toUpperCase();
  const type = call.callType === "alpha" ? "🔷 ALPHA" : "🎲 GAMBLE";
  const caller = callerUsername ? `@${escapeHtml(callerUsername)}` : "Anonymous";

  let msg = `${type} <b>Call</b>\n\n`;
  msg += `🪙 <b>${escapeHtml(symbol)}</b> — ${escapeHtml(name)}\n`;
  msg += `⛓ Chain: ${chain}\n\n`;

  // Market data
  msg += `📊 <b>Market Data</b>\n`;
  if (token) {
    msg += `├ 💰 MCap: ${formatMarketCap(token.marketCap)}\n`;
    msg += `├ 💧 Liquidity: ${formatMarketCap(token.liquidity)}\n`;
    msg += `├ 📈 Volume 24h: ${formatMarketCap(token.volume24h)}\n`;
    msg += `├ 💹 Price: $${token.price.toFixed(8)}\n`;
    msg += `├ 📉 24h: ${formatPercentage(token.priceChange24h)}\n`;
    if (token.holders > 0) msg += `├ 👥 Holders: ${token.holders.toLocaleString()}\n`;
    if (token.tokenAge !== "unknown") msg += `├ ⏰ Age: ${token.tokenAge}\n`;
    msg += `└ 📊 <a href="${token.chartUrl}">Chart</a> · <a href="${token.dexUrl}">DEX</a>\n`;
  } else {
    msg += `└ ⚠️ Token data unavailable\n`;
  }

  msg += `\n👤 <b>Caller:</b> ${caller}`;
  if (callerWinRate !== undefined) {
    msg += ` · WR: ${callerWinRate.toFixed(1)}%`;
  }

  msg += `\n\n<code>${call.tokenAddress}</code>`;

  return msg;
}

/**
 * Auto-call confirmation message with "Just Scanning" button.
 */
export function formatAutoCallPrompt(
  token: TokenData | null,
  callerUsername: string | null,
): string {
  const symbol = token?.symbol ?? "???";
  const mcap = token ? formatMarketCap(token.marketCap) : "N/A";
  const caller = callerUsername ? `@${escapeHtml(callerUsername)}` : "Anonymous";

  return (
    `🔔 <b>Auto-Call Detected</b>\n\n` +
    `🪙 <b>${escapeHtml(symbol)}</b> · MCap: ${mcap}\n` +
    `👤 ${caller}\n\n` +
    `⏳ Call will be submitted in 30 seconds...\n` +
    `Press "Just Scanning" to cancel.`
  );
}

/**
 * Format calls leaderboard message.
 */
export function formatCallsLeaderboard(
  entries: CallsLeaderboardEntry[],
  timeframe: string,
  groupTitle: string,
): string {
  if (entries.length === 0) {
    return `📊 <b>Calls Leaderboard — ${escapeHtml(groupTitle)}</b>\n\n⏱ ${timeframe}\n\nNo calls found for this timeframe.`;
  }

  let msg = `📊 <b>Calls Leaderboard — ${escapeHtml(groupTitle)}</b>\n`;
  msg += `⏱ ${timeframe}\n\n`;

  for (const entry of entries) {
    const medal = entry.rank <= 3 ? ["🥇", "🥈", "🥉"][entry.rank - 1] : `${entry.rank}.`;
    const caller = entry.username ? `@${escapeHtml(entry.username)}` : entry.firstName ?? "Anon";
    const mult = formatMultiplier(entry.peakMultiplier);
    const symbol = entry.tokenSymbol ?? "???";
    const type = entry.callType === "alpha" ? "🔷" : "🎲";

    msg += `${medal} ${type} <b>${escapeHtml(symbol)}</b> · ${mult}\n`;
    msg += `    └ ${caller} · ${entry.performancePoints > 0 ? "+" : ""}${entry.performancePoints} pts\n`;
  }

  return msg;
}

/**
 * Format performance leaderboard message.
 */
export function formatPerformanceLeaderboard(
  entries: PerformanceLeaderboardEntry[],
  timeframe: string,
  groupTitle: string,
): string {
  if (entries.length === 0) {
    return `🏆 <b>Performance Leaderboard — ${escapeHtml(groupTitle)}</b>\n\n⏱ ${timeframe}\n\nNo callers found for this timeframe.`;
  }

  let msg = `🏆 <b>Performance Leaderboard — ${escapeHtml(groupTitle)}</b>\n`;
  msg += `⏱ ${timeframe}\n\n`;

  for (const entry of entries) {
    const medal = entry.rank <= 3
      ? ["🥇", "🥈", "🥉"][entry.rank - 1]
      : `${entry.rank}.`;
    const caller = entry.username ? `@${escapeHtml(entry.username)}` : entry.firstName ?? "Anon";
    const tierEmoji = {
      oracle: "🏆",
      guru: "💼",
      contender: "⚖️",
      novice: "🛠",
      amateur: "🚧",
    }[entry.rankTier] ?? "";

    msg += `${medal} ${tierEmoji} <b>${caller}</b>\n`;
    msg += `    ├ Points: ${entry.totalPoints > 0 ? "+" : ""}${entry.totalPoints}\n`;
    msg += `    ├ Calls: ${entry.totalCalls} · Wins: ${entry.totalWins}\n`;
    msg += `    ├ WR: ${entry.winRate.toFixed(1)}%\n`;
    msg += `    └ Avg: ${formatMultiplier(entry.avgMultiplier)}\n`;
  }

  return msg;
}

/**
 * Format win rate message for a user.
 */
export function formatWinRate(
  username: string | null,
  totalCalls: number,
  wins: number,
  winRate: number,
): string {
  const caller = username ? `@${escapeHtml(username)}` : "User";
  return (
    `🎯 <b>Win Rate — ${caller}</b>\n\n` +
    `📊 Total Calls: ${totalCalls}\n` +
    `✅ Wins (≥2x): ${wins}\n` +
    `📈 Win Rate: <b>${winRate.toFixed(1)}%</b>\n`
  );
}

/**
 * Format call detail message (for /calls command).
 */
export function formatCallsList(
  callsList: Call[],
  username: string | null,
): string {
  const caller = username ? `@${escapeHtml(username)}` : "User";

  if (callsList.length === 0) {
    return `📋 <b>Calls — ${caller}</b>\n\nNo calls found.`;
  }

  let msg = `📋 <b>Calls — ${caller}</b>\n\n`;

  for (const call of callsList) {
    const symbol = call.tokenSymbol ?? "???";
    const mult = formatMultiplier(call.peakMultiplier ?? 1);
    const type = call.callType === "alpha" ? "🔷" : "🎲";
    const winIcon = call.isWin ? "✅" : "❌";
    const date = call.calledAt.toLocaleDateString("en-US", { month: "short", day: "numeric" });

    msg += `${winIcon} ${type} <b>${escapeHtml(symbol)}</b> · ${mult} · ${date}\n`;
  }

  return msg;
}

/**
 * Format settings message.
 */
export function formatSettings(settings: {
  callMode: string;
  displayMode: string;
  hardcoreEnabled: boolean;
  hardcoreMinWinRate: number;
  hardcoreMinCalls: number;
  maxCallsPerUser: number;
  language: string;
  isPremium: boolean;
}): string {
  return (
    `⚙️ <b>Group Settings</b>\n\n` +
    `🔘 Call Mode: <b>${settings.callMode === "auto" ? "Auto Calls" : "Button Mode"}</b>\n` +
    `📋 Display: <b>${settings.displayMode === "advanced" ? "Advanced" : "Simple"}</b>\n` +
    `💀 Hardcore: <b>${settings.hardcoreEnabled ? "ON" : "OFF"}</b>\n` +
    (settings.hardcoreEnabled
      ? `    ├ Min WR: ${settings.hardcoreMinWinRate}%\n` +
        `    └ Min Calls: ${settings.hardcoreMinCalls}\n`
      : "") +
    `📊 Max Calls/24h: <b>${settings.maxCallsPerUser}</b>\n` +
    `🌍 Language: <b>${settings.language.toUpperCase()}</b>\n` +
    `⭐ Premium: <b>${settings.isPremium ? "Active" : "Free"}</b>\n`
  );
}

/**
 * Format hardcore stats message.
 */
export function formatHardcoreStats(
  roundNumber: number,
  endsAt: Date,
  members: Array<{
    username: string | null;
    callCount: number;
    winRate: number;
    isAtRisk: boolean;
    isEligible: boolean;
  }>,
): string {
  const timeLeft = endsAt.getTime() - Date.now();
  const daysLeft = Math.max(0, Math.floor(timeLeft / (1000 * 60 * 60 * 24)));
  const hoursLeft = Math.max(0, Math.floor((timeLeft % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60)));

  let msg = `💀 <b>Hardcore Mode — Round ${roundNumber}</b>\n\n`;
  msg += `⏳ Ends in: ${daysLeft}d ${hoursLeft}h\n\n`;

  const atRisk = members.filter((m) => m.isAtRisk);
  const safe = members.filter((m) => !m.isAtRisk && m.isEligible);
  const notEligible = members.filter((m) => !m.isEligible);

  if (atRisk.length > 0) {
    msg += `🔴 <b>At Risk (${atRisk.length})</b>\n`;
    for (const m of atRisk) {
      const name = m.username ? `@${escapeHtml(m.username)}` : "Anon";
      msg += `  ❌ ${name} · ${m.callCount} calls · WR: ${m.winRate.toFixed(1)}%\n`;
    }
    msg += "\n";
  }

  if (safe.length > 0) {
    msg += `🟢 <b>Safe (${safe.length})</b>\n`;
    for (const m of safe.slice(0, 10)) {
      const name = m.username ? `@${escapeHtml(m.username)}` : "Anon";
      msg += `  ✅ ${name} · ${m.callCount} calls · WR: ${m.winRate.toFixed(1)}%\n`;
    }
    if (safe.length > 10) msg += `  ... and ${safe.length - 10} more\n`;
    msg += "\n";
  }

  if (notEligible.length > 0) {
    msg += `⚪ <b>Not Eligible Yet (${notEligible.length})</b>\n`;
    msg += `  Need more calls to be evaluated.\n`;
  }

  return msg;
}

/**
 * Format insider alert notification.
 */
export function formatInsiderAlert(
  call: Call,
  callerUsername: string | null,
  callerWinRate: number,
  callerAvgGain: number,
  callerTotalCalls: number,
): string {
  const symbol = call.tokenSymbol ?? "???";
  const name = call.tokenName ?? "Unknown";
  const chain = call.chain.toUpperCase();
  const mcap = call.marketCapAtCall
    ? formatMarketCap(parseFloat(call.marketCapAtCall))
    : "N/A";
  const caller = callerUsername ? `@${escapeHtml(callerUsername)}` : "Anonymous";

  return (
    `🚨 <b>INSIDER ALERT</b>\n\n` +
    `🪙 <b>${escapeHtml(symbol)}</b> — ${escapeHtml(name)}\n` +
    `⛓ ${chain} · MCap: ${mcap}\n\n` +
    `👤 <b>Caller:</b> ${caller}\n` +
    `├ 🎯 Win Rate: <b>${callerWinRate.toFixed(1)}%</b>\n` +
    `├ 📈 Avg Gain: <b>${formatMultiplier(callerAvgGain)}</b>\n` +
    `└ 📊 Total Calls: <b>${callerTotalCalls}</b>\n\n` +
    `<code>${call.tokenAddress}</code>`
  );
}

/**
 * Format referral stats message.
 */
export function formatReferralStats(stats: {
  referralCode: string | null;
  status: string;
  totalReferrals: number;
  totalEarnings: number;
  walletAddress: string;
}): string {
  return (
    `🔗 <b>Referral Stats</b>\n\n` +
    `📎 Code: <code>${stats.referralCode ?? "N/A"}</code>\n` +
    `📊 Status: <b>${stats.status.toUpperCase()}</b>\n` +
    `👥 Referrals: ${stats.totalReferrals}\n` +
    `💰 Earnings: ${stats.totalEarnings.toFixed(4)} ETH\n` +
    `💳 Wallet: <code>${stats.walletAddress}</code>\n` +
    `\n📌 Share your link: <code>https://t.me/cryptovisionbot?start=${stats.referralCode ?? ""}</code>`
  );
}

/**
 * Format premium status message.
 */
export function formatPremiumStatus(status: {
  isPremium: boolean;
  isLifetime: boolean;
  expiresAt: Date | null;
}): string {
  if (!status.isPremium) {
    return (
      `⭐ <b>Premium Status</b>\n\n` +
      `Status: <b>Free</b>\n\n` +
      `Upgrade to Premium for:\n` +
      `• 40 calls per user/24h (vs 20)\n` +
      `• Custom button ads\n` +
      `• No broadcast ads\n` +
      `• Custom min market cap & liquidity\n` +
      `• Advanced leaderboard settings\n\n` +
      `💰 One-time: 0.2 ETH (lifetime)\n`
    );
  }

  return (
    `⭐ <b>Premium Status</b>\n\n` +
    `Status: <b>✅ Active</b>\n` +
    `Type: <b>${status.isLifetime ? "Lifetime" : "Limited"}</b>\n` +
    (status.expiresAt ? `Expires: ${status.expiresAt.toLocaleDateString()}\n` : "") +
    `\nAll premium features are active ✨`
  );
}
