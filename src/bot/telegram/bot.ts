/**
 * Crypto Vision — Telegram Bot Entry Point
 *
 * Complete call-tracking Telegram bot built with grammY.
 * Handles all group commands, DM commands, and admin commands.
 *
 * @copyright 2024-2026 nirholas. All rights reserved.
 */

import { Bot, Context, InlineKeyboard, InputFile } from "grammy";
import { logger } from "@/lib/logger";
import { findOrCreateUser, getUserByUsername, calculateWinRate, calculateAvgGain, getTopCalls, refreshUserStats, setUserBlockedInGroup, getUserCallCount24h } from "../services/user-service.js";
import { findOrCreateGroup, getGroupByTelegramId, updateGroupSettings, upsertGroupMember, wipeLeaderboard, resetGroupSettings, isGroupPremium, getMaxCallsForGroup } from "../services/group-service.js";
import { createCall, getRecentCalls, getUserCalls, getAlphaCalls, getGambleCalls, getCallById } from "../services/call-service.js";
import { getCallsLeaderboard, getPerformanceLeaderboard, getLosersLeaderboard, getUserWinRateInGroup, getGroupStats } from "../services/leaderboard-service.js";
import { getTokenData, parseTokenInput, formatMarketCap, type TokenData } from "../services/token-data.js";
import { generatePnlCard, generateGroupPnlCard, generateRankCard } from "../services/pnl-card.js";
import { getPremiumStatus, getActiveButtonAds, recordAdImpression } from "../services/premium-service.js";
import { getReferralStats, requestReferral } from "../services/referral-service.js";
import { getHardcoreStats, startHardcoreRound, getActiveSession } from "../services/hardcore-service.js";
import { registerCallChannel, verifyCallChannel, getGroupCallChannels, canForwardToChannel } from "../services/channel-service.js";
import {
  formatSimpleCallMessage,
  formatAdvancedCallMessage,
  formatAutoCallPrompt,
  formatCallsLeaderboard,
  formatPerformanceLeaderboard,
  formatWinRate,
  formatCallsList,
  formatSettings,
  formatHardcoreStats,
  formatInsiderAlert,
  formatReferralStats,
  formatPremiumStatus,
  escapeHtml,
} from "../messages/formatter.js";

const log = logger.child({ module: "crypto-vision:bot" });

// Active auto-call timers (messageId -> timeout)
const autoCallTimers = new Map<string, ReturnType<typeof setTimeout>>();

/**
 * Create and configure the bot instance.
 */
export function createBot(token: string): Bot {
  const bot = new Bot(token);

  // Error handler — log but never re-throw to keep polling alive
  bot.catch((err) => {
    log.error(
      {
        err: err.error,
        updateId: err.ctx?.update?.update_id,
        chatId: err.ctx?.chat?.id,
        userId: err.ctx?.from?.id,
      },
      "Bot error in update handler",
    );
  });

  // ─── Middleware: Register users and groups ─────────────────

  bot.use(async (ctx, next) => {
    try {
      if (ctx.from) {
        await findOrCreateUser(
          ctx.from.id.toString(),
          ctx.from.username ?? undefined,
          ctx.from.first_name,
          ctx.from.last_name ?? undefined,
        );
      }

      if (ctx.chat && (ctx.chat.type === "group" || ctx.chat.type === "supergroup")) {
        let group;
        try {
          group = await findOrCreateGroup(
            ctx.chat.id.toString(),
            ctx.chat.title,
          );
        } catch (dbErr) {
          log.error({ err: dbErr, chatId: ctx.chat.id }, "DB error in middleware — skipping update");
          return; // skip this update but keep polling alive
        }

        if (ctx.from) {
          const user = await findOrCreateUser(ctx.from.id.toString());
          // Check if admin
          try {
            const member = await ctx.getChatMember(ctx.from.id);
            const isAdmin = member.status === "administrator" || member.status === "creator";
            const isOwner = member.status === "creator";
            await upsertGroupMember(group.id, user.id, isAdmin, isOwner);
          } catch {
            await upsertGroupMember(group.id, user.id);
          }
        }
      }
    } catch (err) {
      log.warn({ err }, "Middleware registration error");
    }

    await next();
  });

  // ─── Group Commands ───────────────────────────────────────

  // /leaderboard [losers] — Show leaderboard
  bot.command("leaderboard", async (ctx) => {
    if (!ctx.chat || ctx.chat.type === "private") return;

    const group = await getGroupByTelegramId(ctx.chat.id.toString());
    if (!group) return;

    const args = ctx.match?.trim().toLowerCase();

    if (args === "losers") {
      // Show losers leaderboard
      const keyboard = new InlineKeyboard()
        .text("24h", "lb_losers_24h")
        .text("7d", "lb_losers_7d")
        .text("30d", "lb_losers_30d")
        .text("All", "lb_losers_all");

      await ctx.reply("Select timeframe for Losers Leaderboard:", {
        reply_markup: keyboard,
      });
      return;
    }

    // Show leaderboard type selection
    const keyboard = new InlineKeyboard()
      .text("📊 Calls", "lb_type_calls")
      .text("🏆 Performance", "lb_type_perf");

    await ctx.reply("Choose leaderboard type:", { reply_markup: keyboard });
  });

  // /last [N] — Show most recent calls
  bot.command("last", async (ctx) => {
    if (!ctx.chat || ctx.chat.type === "private") return;

    const group = await getGroupByTelegramId(ctx.chat.id.toString());
    if (!group) return;

    const count = parseInt(ctx.match || "5", 10);
    const limit = Math.min(Math.max(count, 1), 20);
    const recentCalls = await getRecentCalls(group.id, limit);

    if (recentCalls.length === 0) {
      await ctx.reply("No recent calls found.");
      return;
    }

    let msg = `📋 <b>Last ${recentCalls.length} Calls</b>\n\n`;
    for (const call of recentCalls) {
      const symbol = call.tokenSymbol ?? "???";
      const mult = call.peakMultiplier ? `${call.peakMultiplier.toFixed(2)}x` : "1x";
      const type = call.callType === "alpha" ? "🔷" : "🎲";
      const date = call.calledAt.toLocaleDateString("en-US", { month: "short", day: "numeric" });
      msg += `${type} <b>${escapeHtml(symbol)}</b> · ${mult} · ${date}\n`;
    }

    await ctx.reply(msg, { parse_mode: "HTML" });
  });

  // /pnl + CA — Generate PNL card for a token call
  bot.command("pnl", async (ctx) => {
    if (!ctx.match) {
      await ctx.reply("Usage: /pnl <contract_address>");
      return;
    }

    const parsed = parseTokenInput(ctx.match.trim());
    if (!parsed) {
      await ctx.reply("❌ Invalid token address or URL.");
      return;
    }

    // Find the user's call for this token
    const user = await findOrCreateUser(ctx.from!.id.toString());
    const group = ctx.chat?.type !== "private"
      ? await getGroupByTelegramId(ctx.chat!.id.toString())
      : null;

    const userCalls = group
      ? await getUserCalls(user.id, group.id, 100)
      : [];

    const matchingCall = userCalls.find(
      (c) => c.tokenAddress.toLowerCase() === parsed.address.toLowerCase(),
    );

    if (!matchingCall) {
      await ctx.reply("❌ No call found for this token. Make a call first!");
      return;
    }

    const winRate = await calculateWinRate(user.id);
    const token = await getTokenData(parsed.address, parsed.chain);

    try {
      const cardBuffer = generatePnlCard({
        tokenSymbol: matchingCall.tokenSymbol ?? "???",
        tokenName: matchingCall.tokenName ?? "Unknown",
        chain: matchingCall.chain,
        callType: matchingCall.callType,
        callerUsername: ctx.from!.username ?? "anonymous",
        callerWinRate: winRate,
        callerRank: user.rankTier,
        marketCapAtCall: parseFloat(matchingCall.marketCapAtCall ?? "0"),
        athMarketCap: parseFloat(matchingCall.athAfterCall ?? matchingCall.marketCapAtCall ?? "0"),
        priceAtCall: parseFloat(matchingCall.priceAtCall ?? "0"),
        athPrice: parseFloat(matchingCall.athAfterCall ?? matchingCall.priceAtCall ?? "0"),
        peakMultiplier: matchingCall.peakMultiplier ?? 1,
        calledAt: matchingCall.calledAt,
        athTimestamp: matchingCall.athTimestamp,
      });

      await ctx.replyWithPhoto(new InputFile(cardBuffer, "pnl.png"));
    } catch (err) {
      log.error({ err }, "PNL card generation failed");
      await ctx.reply("❌ Failed to generate PNL card.");
    }
  });

  // /gpnl — Generate Group PNL Card
  bot.command("gpnl", async (ctx) => {
    if (!ctx.chat || ctx.chat.type === "private") return;

    const keyboard = new InlineKeyboard()
      .text("24h", "gpnl_24h")
      .text("7d", "gpnl_7d")
      .text("30d", "gpnl_30d")
      .text("All", "gpnl_all");

    await ctx.reply("Select timeframe for Group PNL:", { reply_markup: keyboard });
  });

  // /calls @username — Show user calls
  bot.command("calls", async (ctx) => {
    if (!ctx.chat || ctx.chat.type === "private") return;

    const group = await getGroupByTelegramId(ctx.chat.id.toString());
    if (!group) return;

    let targetUser;
    const mention = ctx.match?.trim();

    if (mention) {
      targetUser = await getUserByUsername(mention);
    } else {
      targetUser = await findOrCreateUser(ctx.from!.id.toString());
    }

    if (!targetUser) {
      await ctx.reply("❌ User not found.");
      return;
    }

    const userCalls = await getUserCalls(targetUser.id, group.id);
    const msg = formatCallsList(userCalls, targetUser.username);
    await ctx.reply(msg, { parse_mode: "HTML" });
  });

  // /alpha [CA] — Show or make alpha call
  bot.command("alpha", async (ctx) => {
    if (!ctx.chat || ctx.chat.type === "private") return;

    const group = await getGroupByTelegramId(ctx.chat.id.toString());
    if (!group) return;

    const arg = ctx.match?.trim();

    if (!arg) {
      // Show last 5 alpha calls
      const alphaCalls = await getAlphaCalls(group.id, 5);
      if (alphaCalls.length === 0) {
        await ctx.reply("No alpha calls found.");
        return;
      }
      const msg = formatCallsList(alphaCalls, null);
      await ctx.reply(`🔷 <b>Recent Alpha Calls</b>\n\n${msg}`, { parse_mode: "HTML" });
      return;
    }

    // Make alpha call
    await handleNewCall(ctx, group, arg, "alpha");
  });

  // /gamble [CA] — Show or make gamble call
  bot.command("gamble", async (ctx) => {
    if (!ctx.chat || ctx.chat.type === "private") return;

    const group = await getGroupByTelegramId(ctx.chat.id.toString());
    if (!group) return;

    const arg = ctx.match?.trim();

    if (!arg) {
      const gambleCalls = await getGambleCalls(group.id, 10);
      if (gambleCalls.length === 0) {
        await ctx.reply("No gamble calls found.");
        return;
      }
      const msg = formatCallsList(gambleCalls, null);
      await ctx.reply(`🎲 <b>Recent Gamble Calls</b>\n\n${msg}`, { parse_mode: "HTML" });
      return;
    }

    await handleNewCall(ctx, group, arg, "gamble");
  });

  // /winrate @username — Get user win rate
  bot.command("winrate", async (ctx) => {
    if (!ctx.chat || ctx.chat.type === "private") return;

    const group = await getGroupByTelegramId(ctx.chat.id.toString());
    if (!group) return;

    let targetUser;
    const mention = ctx.match?.trim();

    if (mention) {
      targetUser = await getUserByUsername(mention);
    } else {
      targetUser = await findOrCreateUser(ctx.from!.id.toString());
    }

    if (!targetUser) {
      await ctx.reply("❌ User not found.");
      return;
    }

    const stats = await getUserWinRateInGroup(targetUser.id, group.id);
    const msg = formatWinRate(targetUser.username, stats.totalCalls, stats.wins, stats.winRate);
    await ctx.reply(msg, { parse_mode: "HTML" });
  });

  // /hardcore — Show hardcore mode stats
  bot.command("hardcore", async (ctx) => {
    if (!ctx.chat || ctx.chat.type === "private") return;

    const group = await getGroupByTelegramId(ctx.chat.id.toString());
    if (!group) return;

    if (!group.hardcoreEnabled) {
      await ctx.reply("💀 Hardcore Mode is not enabled. Use /settings to enable it.");
      return;
    }

    const stats = await getHardcoreStats(group.id);
    if (!stats.session) {
      await ctx.reply("💀 No active hardcore round. Starting one now...");
      await startHardcoreRound(group);
      const newStats = await getHardcoreStats(group.id);
      if (newStats.session) {
        const msg = formatHardcoreStats(
          newStats.session.roundNumber,
          newStats.session.endsAt,
          newStats.members,
        );
        await ctx.reply(msg, { parse_mode: "HTML" });
      }
      return;
    }

    const msg = formatHardcoreStats(
      stats.session.roundNumber,
      stats.session.endsAt,
      stats.members,
    );
    await ctx.reply(msg, { parse_mode: "HTML" });
  });

  // ─── DM Commands ──────────────────────────────────────────

  // /rank — Generate user rank card (DM only)
  bot.command("rank", async (ctx) => {
    if (ctx.chat?.type !== "private") {
      await ctx.reply("Use /rank in DM with the bot.");
      return;
    }

    const user = await findOrCreateUser(ctx.from!.id.toString());
    const updatedUser = await refreshUserStats(user.id);
    const winRate = await calculateWinRate(user.id);
    const topCalls = await getTopCalls(user.id, 3);

    try {
      const cardBuffer = generateRankCard({
        username: updatedUser.username ?? "anonymous",
        rankTier: updatedUser.rankTier,
        winRate,
        totalCalls: updatedUser.totalCalls,
        totalWins: updatedUser.totalWins,
        performancePoints: updatedUser.performancePoints,
        topCalls: topCalls.map((c) => ({
          tokenSymbol: c.tokenSymbol,
          peakMultiplier: c.peakMultiplier,
          calledAt: c.calledAt,
        })),
      });

      await ctx.replyWithPhoto(new InputFile(cardBuffer, "rank.png"));
    } catch (err) {
      log.error({ err }, "Rank card generation failed");
      // Fallback to text
      await ctx.reply(
        `🏆 <b>Your Rank</b>\n\n` +
        `Rank: ${updatedUser.rankTier.toUpperCase()}\n` +
        `Win Rate: ${winRate.toFixed(1)}%\n` +
        `Total Calls: ${updatedUser.totalCalls}\n` +
        `Points: ${updatedUser.performancePoints}`,
        { parse_mode: "HTML" },
      );
    }
  });

  // /ref — Request referral (DM only)
  bot.command("ref", async (ctx) => {
    if (ctx.chat?.type !== "private") {
      await ctx.reply("Use /ref in DM with the bot.");
      return;
    }

    const user = await findOrCreateUser(ctx.from!.id.toString());
    const existing = await getReferralStats(user.id);

    if (existing) {
      const msg = formatReferralStats(existing);
      await ctx.reply(msg, { parse_mode: "HTML" });
      return;
    }

    // Ask for wallet address
    await ctx.reply(
      "🔗 <b>Referral Program</b>\n\n" +
      "Earn 20% commission on every purchase made through your referral link.\n\n" +
      "Send your wallet address to get started:",
      { parse_mode: "HTML" },
    );
    // The wallet address will be handled by the message handler
  });

  // /payments — Show payment menu (DM only)
  bot.command("payments", async (ctx) => {
    if (ctx.chat?.type !== "private") {
      await ctx.reply("Use /payments in DM with the bot.");
      return;
    }

    const keyboard = new InlineKeyboard()
      .text("⭐ Premium (0.2 ETH)", "pay_premium")
      .row()
      .text("📢 24h Ad (0.1 ETH)", "pay_ad_24h")
      .text("📢 72h Ad (0.35 ETH)", "pay_ad_72h")
      .row()
      .text("📢 1W Ad (0.7 ETH)", "pay_ad_1w")
      .text("📡 Broadcast (0.7 ETH)", "pay_broadcast")
      .row()
      .text("🚨 Insider Alerts", "pay_insider");

    await ctx.reply(
      "💳 <b>Payments</b>\n\nSelect a product to purchase:",
      { parse_mode: "HTML", reply_markup: keyboard },
    );
  });

  // ─── Admin Commands ───────────────────────────────────────

  // /settings — Group settings
  bot.command("settings", async (ctx) => {
    if (!ctx.chat || ctx.chat.type === "private") return;

    const group = await getGroupByTelegramId(ctx.chat.id.toString());
    if (!group) return;

    // Check if user is admin
    try {
      const member = await ctx.getChatMember(ctx.from!.id);
      if (member.status !== "administrator" && member.status !== "creator") {
        await ctx.reply("❌ Only admins can change settings.");
        return;
      }
    } catch {
      await ctx.reply("❌ Could not verify admin status.");
      return;
    }

    const msg = formatSettings({
      callMode: group.callMode,
      displayMode: group.displayMode,
      hardcoreEnabled: group.hardcoreEnabled,
      hardcoreMinWinRate: group.hardcoreMinWinRate ?? 55,
      hardcoreMinCalls: group.hardcoreMinCalls ?? 5,
      maxCallsPerUser: group.maxCallsPerUser,
      language: group.language,
      isPremium: isGroupPremium(group),
    });

    const keyboard = new InlineKeyboard()
      .text(
        group.callMode === "auto" ? "✅ Auto Calls" : "🔘 Auto Calls",
        "set_mode_auto",
      )
      .text(
        group.callMode === "button" ? "✅ Button Mode" : "🔘 Button Mode",
        "set_mode_button",
      )
      .row()
      .text(
        group.displayMode === "simple" ? "✅ Simple" : "🔘 Simple",
        "set_display_simple",
      )
      .text(
        group.displayMode === "advanced" ? "✅ Advanced" : "🔘 Advanced",
        "set_display_advanced",
      )
      .row()
      .text(
        group.hardcoreEnabled ? "✅ Hardcore ON" : "💀 Hardcore OFF",
        "set_hardcore_toggle",
      );

    await ctx.reply(msg, { parse_mode: "HTML", reply_markup: keyboard });
  });

  // /language — Set group language
  bot.command("language", async (ctx) => {
    if (!ctx.chat || ctx.chat.type === "private") return;

    const keyboard = new InlineKeyboard()
      .text("🇬🇧 English", "lang_en")
      .text("🇨🇳 中文", "lang_zh")
      .text("🇩🇪 Deutsch", "lang_de")
      .row()
      .text("🇷🇺 Русский", "lang_ru")
      .text("🇻🇳 Tiếng Việt", "lang_vi")
      .text("🇵🇱 Polski", "lang_pl")
      .row()
      .text("🇧🇷 Português", "lang_pt")
      .text("🇸🇦 العربية", "lang_ar");

    await ctx.reply("🌍 Select group language:", { reply_markup: keyboard });
  });

  // /premium — Check premium status
  bot.command("premium", async (ctx) => {
    if (!ctx.chat || ctx.chat.type === "private") return;

    const group = await getGroupByTelegramId(ctx.chat.id.toString());
    if (!group) return;

    const status = await getPremiumStatus(group.id);
    const msg = formatPremiumStatus(status);
    await ctx.reply(msg, { parse_mode: "HTML" });
  });

  // /reset — Reset group settings
  bot.command("reset", async (ctx) => {
    if (!ctx.chat || ctx.chat.type === "private") return;

    try {
      const member = await ctx.getChatMember(ctx.from!.id);
      if (member.status !== "administrator" && member.status !== "creator") {
        await ctx.reply("❌ Only admins can reset settings.");
        return;
      }
    } catch {
      return;
    }

    const group = await getGroupByTelegramId(ctx.chat.id.toString());
    if (!group) return;

    await resetGroupSettings(group.id);
    await ctx.reply("✅ Group settings have been reset to defaults.");
  });

  // /wipeleaderboard — Clear leaderboard and archive calls
  bot.command("wipeleaderboard", async (ctx) => {
    if (!ctx.chat || ctx.chat.type === "private") return;

    try {
      const member = await ctx.getChatMember(ctx.from!.id);
      if (member.status !== "administrator" && member.status !== "creator") {
        await ctx.reply("❌ Only admins can wipe the leaderboard.");
        return;
      }
    } catch {
      return;
    }

    const keyboard = new InlineKeyboard()
      .text("✅ Yes, wipe it", "wipe_confirm")
      .text("❌ Cancel", "wipe_cancel");

    await ctx.reply(
      "⚠️ <b>Warning:</b> This will archive all current calls and reset the leaderboard. This cannot be undone.\n\nAre you sure?",
      { parse_mode: "HTML", reply_markup: keyboard },
    );
  });

  // /block — Block a user (reply to their message)
  bot.command("block", async (ctx) => {
    if (!ctx.chat || ctx.chat.type === "private") return;

    try {
      const member = await ctx.getChatMember(ctx.from!.id);
      if (member.status !== "administrator" && member.status !== "creator") {
        await ctx.reply("❌ Only admins can block users.");
        return;
      }
    } catch {
      return;
    }

    const repliedTo = ctx.message?.reply_to_message;
    if (!repliedTo?.from) {
      await ctx.reply("❌ Reply to the user's message to block them.");
      return;
    }

    const group = await getGroupByTelegramId(ctx.chat.id.toString());
    if (!group) return;

    const targetUser = await findOrCreateUser(
      repliedTo.from.id.toString(),
      repliedTo.from.username ?? undefined,
    );
    await setUserBlockedInGroup(group.id, targetUser.id, true);
    await ctx.reply(`🚫 @${escapeHtml(repliedTo.from.username ?? "user")} has been blocked from making calls.`, { parse_mode: "HTML" });
  });

  // /unblock — Unblock a user
  bot.command("unblock", async (ctx) => {
    if (!ctx.chat || ctx.chat.type === "private") return;

    try {
      const member = await ctx.getChatMember(ctx.from!.id);
      if (member.status !== "administrator" && member.status !== "creator") {
        await ctx.reply("❌ Only admins can unblock users.");
        return;
      }
    } catch {
      return;
    }

    const repliedTo = ctx.message?.reply_to_message;
    if (!repliedTo?.from) {
      await ctx.reply("❌ Reply to the user's message to unblock them.");
      return;
    }

    const group = await getGroupByTelegramId(ctx.chat.id.toString());
    if (!group) return;

    const targetUser = await findOrCreateUser(repliedTo.from.id.toString());
    await setUserBlockedInGroup(group.id, targetUser.id, false);
    await ctx.reply(`✅ @${escapeHtml(repliedTo.from.username ?? "user")} has been unblocked.`, { parse_mode: "HTML" });
  });

  // /channel — Set up call channel
  bot.command("channel", async (ctx) => {
    if (!ctx.chat || ctx.chat.type === "private") return;

    try {
      const member = await ctx.getChatMember(ctx.from!.id);
      if (member.status !== "administrator" && member.status !== "creator") {
        await ctx.reply("❌ Only admins can manage call channels.");
        return;
      }
    } catch {
      return;
    }

    const keyboard = new InlineKeyboard()
      .text("➕ Add to Channel", "channel_add")
      .text("📋 View Channels", "channel_list");

    await ctx.reply("📢 <b>Call Channels</b>\n\nForward calls to a dedicated channel.", {
      parse_mode: "HTML",
      reply_markup: keyboard,
    });
  });

  // /ads — Set custom ad (Premium only)
  bot.command("ads", async (ctx) => {
    if (!ctx.chat || ctx.chat.type === "private") return;

    const group = await getGroupByTelegramId(ctx.chat.id.toString());
    if (!group) return;

    if (!isGroupPremium(group)) {
      await ctx.reply("⭐ Custom ads are a Premium feature. Use /premium to learn more.");
      return;
    }

    await ctx.reply(
      "📢 <b>Set Custom Ad</b>\n\n" +
      "Send your ad message in this format:\n\n" +
      "<code>Ad Text | Button Label | https://example.com</code>",
      { parse_mode: "HTML" },
    );
  });

  // ─── Callback Query Handlers ──────────────────────────────

  // Leaderboard type selection
  bot.callbackQuery("lb_type_calls", async (ctx) => {
    const keyboard = new InlineKeyboard()
      .text("24h", "lb_calls_24h")
      .text("7d", "lb_calls_7d")
      .text("30d", "lb_calls_30d")
      .text("All", "lb_calls_all");

    await ctx.editMessageText("📊 Select timeframe for Calls Leaderboard:", {
      reply_markup: keyboard,
    });
    await ctx.answerCallbackQuery();
  });

  bot.callbackQuery("lb_type_perf", async (ctx) => {
    const keyboard = new InlineKeyboard()
      .text("24h", "lb_perf_24h")
      .text("7d", "lb_perf_7d")
      .text("30d", "lb_perf_30d")
      .text("All", "lb_perf_all");

    await ctx.editMessageText("🏆 Select timeframe for Performance Leaderboard:", {
      reply_markup: keyboard,
    });
    await ctx.answerCallbackQuery();
  });

  // Calls leaderboard timeframe callbacks
  for (const tf of ["24h", "7d", "30d", "all"] as const) {
    bot.callbackQuery(`lb_calls_${tf}`, async (ctx) => {
      const chatId = ctx.callbackQuery.message?.chat.id;
      if (!chatId) return;

      const group = await getGroupByTelegramId(chatId.toString());
      if (!group) return;

      const entries = await getCallsLeaderboard(group.id, tf);

      // Add ad buttons if any active
      const ads = await getActiveButtonAds();
      let keyboard: InlineKeyboard | undefined;
      if (ads.length > 0) {
        keyboard = new InlineKeyboard();
        for (const ad of ads.slice(0, 3)) {
          if (ad.buttonText && ad.buttonUrl) {
            keyboard.url(ad.buttonText, ad.buttonUrl).row();
            await recordAdImpression(ad.id);
          }
        }
      }

      const msg = formatCallsLeaderboard(entries, tf, group.title ?? "Group");
      await ctx.editMessageText(msg, {
        parse_mode: "HTML",
        reply_markup: keyboard,
      });
      await ctx.answerCallbackQuery();
    });

    // Performance leaderboard
    bot.callbackQuery(`lb_perf_${tf}`, async (ctx) => {
      const chatId = ctx.callbackQuery.message?.chat.id;
      if (!chatId) return;

      const group = await getGroupByTelegramId(chatId.toString());
      if (!group) return;

      const entries = await getPerformanceLeaderboard(group.id, tf);
      const msg = formatPerformanceLeaderboard(entries, tf, group.title ?? "Group");
      await ctx.editMessageText(msg, { parse_mode: "HTML" });
      await ctx.answerCallbackQuery();
    });

    // Losers leaderboard
    bot.callbackQuery(`lb_losers_${tf}`, async (ctx) => {
      const chatId = ctx.callbackQuery.message?.chat.id;
      if (!chatId) return;

      const group = await getGroupByTelegramId(chatId.toString());
      if (!group) return;

      const entries = await getLosersLeaderboard(group.id, tf);
      const msg = formatPerformanceLeaderboard(entries, tf, group.title ?? "Group");
      await ctx.editMessageText(`📉 <b>Losers</b>\n${msg}`, { parse_mode: "HTML" });
      await ctx.answerCallbackQuery();
    });

    // Group PNL
    bot.callbackQuery(`gpnl_${tf}`, async (ctx) => {
      const chatId = ctx.callbackQuery.message?.chat.id;
      if (!chatId) return;

      const group = await getGroupByTelegramId(chatId.toString());
      if (!group) return;

      const stats = await getGroupStats(group.id, tf);
      const topCallers = await getPerformanceLeaderboard(group.id, tf, 5);

      try {
        const cardBuffer = generateGroupPnlCard({
          groupTitle: group.title ?? "Group",
          timeframe: tf,
          totalCalls: stats.totalCalls,
          totalWins: stats.totalWins,
          winRate: stats.winRate,
          avgMultiplier: stats.avgMultiplier,
          totalPoints: stats.totalPoints,
          uniqueCallers: stats.uniqueCallers,
          topCallers: topCallers.map((c) => ({
            username: c.username,
            points: c.totalPoints,
            winRate: c.winRate,
          })),
        });

        await ctx.deleteMessage();
        await ctx.api.sendPhoto(chatId, new InputFile(cardBuffer, "gpnl.png"));
      } catch (err) {
        log.error({ err }, "Group PNL card generation failed");
        await ctx.editMessageText("❌ Failed to generate Group PNL card.");
      }
      await ctx.answerCallbackQuery();
    });
  }

  // Settings callbacks
  bot.callbackQuery("set_mode_auto", async (ctx) => {
    const chatId = ctx.callbackQuery.message?.chat.id;
    if (!chatId) return;
    const group = await getGroupByTelegramId(chatId.toString());
    if (group) {
      await updateGroupSettings(group.id, { callMode: "auto" });
      await ctx.editMessageText("✅ Call mode set to <b>Auto Calls</b>", { parse_mode: "HTML" });
    }
    await ctx.answerCallbackQuery();
  });

  bot.callbackQuery("set_mode_button", async (ctx) => {
    const chatId = ctx.callbackQuery.message?.chat.id;
    if (!chatId) return;
    const group = await getGroupByTelegramId(chatId.toString());
    if (group) {
      await updateGroupSettings(group.id, { callMode: "button" });
      await ctx.editMessageText("✅ Call mode set to <b>Button Mode</b>", { parse_mode: "HTML" });
    }
    await ctx.answerCallbackQuery();
  });

  bot.callbackQuery("set_display_simple", async (ctx) => {
    const chatId = ctx.callbackQuery.message?.chat.id;
    if (!chatId) return;
    const group = await getGroupByTelegramId(chatId.toString());
    if (group) {
      await updateGroupSettings(group.id, { displayMode: "simple" });
      await ctx.editMessageText("✅ Display mode set to <b>Simple</b>", { parse_mode: "HTML" });
    }
    await ctx.answerCallbackQuery();
  });

  bot.callbackQuery("set_display_advanced", async (ctx) => {
    const chatId = ctx.callbackQuery.message?.chat.id;
    if (!chatId) return;
    const group = await getGroupByTelegramId(chatId.toString());
    if (group) {
      await updateGroupSettings(group.id, { displayMode: "advanced" });
      await ctx.editMessageText("✅ Display mode set to <b>Advanced</b>", { parse_mode: "HTML" });
    }
    await ctx.answerCallbackQuery();
  });

  bot.callbackQuery("set_hardcore_toggle", async (ctx) => {
    const chatId = ctx.callbackQuery.message?.chat.id;
    if (!chatId) return;
    const group = await getGroupByTelegramId(chatId.toString());
    if (group) {
      const newState = !group.hardcoreEnabled;
      await updateGroupSettings(group.id, { hardcoreEnabled: newState });
      if (newState) {
        await startHardcoreRound(group);
      }
      await ctx.editMessageText(
        `💀 Hardcore Mode: <b>${newState ? "ENABLED" : "DISABLED"}</b>`,
        { parse_mode: "HTML" },
      );
    }
    await ctx.answerCallbackQuery();
  });

  // Wipe leaderboard confirmation
  bot.callbackQuery("wipe_confirm", async (ctx) => {
    const chatId = ctx.callbackQuery.message?.chat.id;
    if (!chatId) return;
    const group = await getGroupByTelegramId(chatId.toString());
    if (group) {
      const count = await wipeLeaderboard(group.id);
      await ctx.editMessageText(
        `✅ Leaderboard wiped. ${count} calls archived.`,
      );
    }
    await ctx.answerCallbackQuery();
  });

  bot.callbackQuery("wipe_cancel", async (ctx) => {
    await ctx.editMessageText("❌ Leaderboard wipe cancelled.");
    await ctx.answerCallbackQuery();
  });

  // Language callbacks
  for (const lang of ["en", "zh", "de", "ru", "vi", "pl", "pt", "ar"] as const) {
    bot.callbackQuery(`lang_${lang}`, async (ctx) => {
      const chatId = ctx.callbackQuery.message?.chat.id;
      if (!chatId) return;
      const group = await getGroupByTelegramId(chatId.toString());
      if (group) {
        await updateGroupSettings(group.id, { language: lang });
        await ctx.editMessageText(`✅ Language set to <b>${lang.toUpperCase()}</b>`, {
          parse_mode: "HTML",
        });
      }
      await ctx.answerCallbackQuery();
    });
  }

  // Auto-call buttons
  bot.callbackQuery(/^autocall_submit_(.+)$/, async (ctx) => {
    const callKey = ctx.match[1];
    const timer = autoCallTimers.get(callKey);
    if (timer) {
      clearTimeout(timer);
      autoCallTimers.delete(callKey);
    }
    // Call was already auto-submitted or will be submitted by the timer
    await ctx.editMessageText("✅ Call submitted!");
    await ctx.answerCallbackQuery();
  });

  bot.callbackQuery(/^autocall_cancel_(.+)$/, async (ctx) => {
    const callKey = ctx.match[1];
    const timer = autoCallTimers.get(callKey);
    if (timer) {
      clearTimeout(timer);
      autoCallTimers.delete(callKey);
    }
    await ctx.editMessageText("🔍 Just scanning — call cancelled.");
    await ctx.answerCallbackQuery();
  });

  // Button mode call type selection
  bot.callbackQuery(/^buttoncall_(alpha|gamble)_(.+)$/, async (ctx) => {
    const callType = ctx.match[1] as "alpha" | "gamble";
    const tokenAddress = ctx.match[2];
    const chatId = ctx.callbackQuery.message?.chat.id;

    if (!chatId || !ctx.from) return;

    const group = await getGroupByTelegramId(chatId.toString());
    if (!group) return;

    const user = await findOrCreateUser(ctx.from.id.toString());
    const parsed = parseTokenInput(tokenAddress);
    if (!parsed) return;

    const call = await createCall({
      userId: user.id,
      groupId: group.id,
      tokenAddress: parsed.address,
      chain: parsed.chain,
      callType,
      mode: "button",
    });

    const token = await getTokenData(parsed.address, parsed.chain);
    const winRate = await calculateWinRate(user.id);

    const msg = group.displayMode === "advanced"
      ? formatAdvancedCallMessage(call, token, ctx.from.username ?? null, winRate)
      : formatSimpleCallMessage(call, token, ctx.from.username ?? null);

    await ctx.editMessageText(msg, { parse_mode: "HTML" });

    // Forward to call channels
    await forwardCallToChannels(ctx, group.id, call, token, user.id);

    await ctx.answerCallbackQuery("✅ Call submitted!");
  });

  // ─── Message Handler: Auto-detect token addresses ────────

  bot.on("message:text", async (ctx) => {
    if (!ctx.chat || ctx.chat.type === "private") return;

    const group = await getGroupByTelegramId(ctx.chat.id.toString());
    if (!group) return;

    const text = ctx.message.text.trim();
    const parsed = parseTokenInput(text);
    if (!parsed) return;

    // Token address detected in a group message
    const user = await findOrCreateUser(ctx.from.id.toString());

    if (group.callMode === "auto") {
      // Auto mode — submit after 30 seconds unless cancelled
      const token = await getTokenData(parsed.address, parsed.chain);
      const msg = formatAutoCallPrompt(token, ctx.from.username ?? null);

      const callKey = `${ctx.chat.id}_${ctx.message.message_id}`;
      const keyboard = new InlineKeyboard()
        .text("🔍 Just Scanning", `autocall_cancel_${callKey}`);

      const sentMsg = await ctx.reply(msg, {
        parse_mode: "HTML",
        reply_markup: keyboard,
      });

      // Set 30-second timer
      const timer = setTimeout(async () => {
        autoCallTimers.delete(callKey);

        try {
          // Check rate limit
          const callCount = await getUserCallCount24h(user.id, group.id);
          const maxCalls = getMaxCallsForGroup(group);
          if (callCount >= maxCalls) {
            await ctx.api.editMessageText(
              ctx.chat!.id,
              sentMsg.message_id,
              `❌ Daily call limit reached (${maxCalls}/${maxCalls}).`,
            );
            return;
          }

          const call = await createCall({
            userId: user.id,
            groupId: group.id,
            tokenAddress: parsed.address,
            chain: parsed.chain,
            callType: "alpha", // Auto calls default to alpha
            mode: "auto",
            messageId: ctx.message.message_id,
          });

          const winRate = await calculateWinRate(user.id);
          const callMsg = group.displayMode === "advanced"
            ? formatAdvancedCallMessage(call, token, ctx.from.username ?? null, winRate)
            : formatSimpleCallMessage(call, token, ctx.from.username ?? null);

          await ctx.api.editMessageText(ctx.chat!.id, sentMsg.message_id, callMsg, {
            parse_mode: "HTML",
          });

          // Forward to channels
          await forwardCallToChannels(ctx, group.id, call, token, user.id);
        } catch (err) {
          log.error({ err }, "Auto-call submission failed");
        }
      }, 30_000);

      autoCallTimers.set(callKey, timer);
    } else {
      // Button mode — ask user to choose call type
      const token = await getTokenData(parsed.address, parsed.chain);
      const symbol = token?.symbol ?? "???";
      const mcap = token ? ` · MCap: ${formatMarketCap(token.marketCap)}` : "";

      const keyboard = new InlineKeyboard()
        .text(`🔷 Alpha`, `buttoncall_alpha_${parsed.address}`)
        .text(`🎲 Gamble`, `buttoncall_gamble_${parsed.address}`);

      await ctx.reply(
        `🪙 <b>${escapeHtml(symbol)}</b>${mcap}\n\nChoose call type:`,
        { parse_mode: "HTML", reply_markup: keyboard },
      );
    }
  });

  // ─── Start command (DM) ───────────────────────────────────

  bot.command("start", async (ctx) => {
    if (ctx.chat?.type === "private") {
      await ctx.reply(
        `🤖 <b>Welcome to Crypto Vision!</b>\n\n` +
        `I help you track calls and organize them in leaderboards.\n\n` +
        `<b>DM Commands:</b>\n` +
        `/rank — View your rank card\n` +
        `/ref — Get referral link\n` +
        `/payments — Purchase premium/ads\n\n` +
        `<b>Group Commands:</b>\n` +
        `/leaderboard — View leaderboards\n` +
        `/last N — Recent calls\n` +
        `/pnl CA — PNL card\n` +
        `/gpnl — Group PNL\n` +
        `/calls @user — User calls\n` +
        `/alpha [CA] — Alpha calls\n` +
        `/gamble [CA] — Gamble calls\n` +
        `/winrate @user — Win rate\n` +
        `/hardcore — Hardcore stats\n\n` +
        `<b>Admin Commands:</b>\n` +
        `/settings — Group settings\n` +
        `/language — Set language\n` +
        `/premium — Premium status\n` +
        `/channel — Call channels\n` +
        `/wipeleaderboard — Reset board\n` +
        `/block /unblock — User management\n`,
        { parse_mode: "HTML" },
      );
    }
  });

  return bot;
}

// ─── Helpers ────────────────────────────────────────────────

/**
 * Handle creating a new call from a command (/alpha CA, /gamble CA).
 */
async function handleNewCall(
  ctx: Context,
  group: NonNullable<Awaited<ReturnType<typeof getGroupByTelegramId>>>,
  input: string,
  callType: "alpha" | "gamble",
): Promise<void> {
  const parsed = parseTokenInput(input);
  if (!parsed) {
    await ctx.reply("❌ Invalid token address or URL.");
    return;
  }

  const user = await findOrCreateUser(ctx.from!.id.toString());

  // Rate limit check
  const callCount = await getUserCallCount24h(user.id, group.id);
  const maxCalls = getMaxCallsForGroup(group);
  if (callCount >= maxCalls) {
    await ctx.reply(`❌ Daily call limit reached (${maxCalls}/${maxCalls}).`);
    return;
  }

  const call = await createCall({
    userId: user.id,
    groupId: group.id,
    tokenAddress: parsed.address,
    chain: parsed.chain,
    callType,
    mode: "button",
    messageId: ctx.message?.message_id,
  });

  const token = await getTokenData(parsed.address, parsed.chain);
  const winRate = await calculateWinRate(user.id);

  const msg = group.displayMode === "advanced"
    ? formatAdvancedCallMessage(call, token, ctx.from!.username ?? null, winRate)
    : formatSimpleCallMessage(call, token, ctx.from!.username ?? null);

  await ctx.reply(msg, { parse_mode: "HTML" });

  // Forward to channels
  await forwardCallToChannels(ctx, group.id, call, token, user.id);
}

/**
 * Forward a call to all verified call channels for the group.
 */
async function forwardCallToChannels(
  ctx: Context,
  groupId: string,
  call: Awaited<ReturnType<typeof createCall>>,
  token: TokenData | null,
  userId: string,
): Promise<void> {
  try {
    const channels = await getGroupCallChannels(groupId);

    for (const channel of channels) {
      const canForward = await canForwardToChannel(channel, userId);
      if (!canForward) continue;

      const msg = formatSimpleCallMessage(call, token, ctx.from?.username ?? null);
      await ctx.api.sendMessage(channel.channelTelegramId, msg, {
        parse_mode: "HTML",
      });
    }
  } catch (err) {
    log.warn({ err, groupId }, "Failed to forward call to channels");
  }
}
