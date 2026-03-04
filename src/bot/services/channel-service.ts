/**
 * Crypto Vision — Call Channel Service
 *
 * Manages forwarding of calls to dedicated Telegram channels.
 *
 * @copyright 2024-2026 nirholas. All rights reserved.
 */

import { eq, and } from "drizzle-orm";
import { getDb } from "../db/index.js";
import {
  callChannels,
  groupMembers,
  type CallChannel,
} from "../db/schema.js";
import { logger } from "@/lib/logger";

const log = logger.child({ module: "crypto-vision:call-channels" });

/**
 * Register a call channel for a group.
 */
export async function registerCallChannel(
  groupId: string,
  channelTelegramId: string,
  channelTitle?: string,
  permission: "owner" | "owner_admins" | "everyone" = "everyone",
): Promise<CallChannel> {
  const db = getDb();

  // Upsert — if channel already linked, update settings
  const existing = await db.query.callChannels.findFirst({
    where: and(
      eq(callChannels.groupId, groupId),
      eq(callChannels.channelTelegramId, channelTelegramId),
    ),
  });

  if (existing) {
    const [updated] = await db
      .update(callChannels)
      .set({ channelTitle, permission })
      .where(eq(callChannels.id, existing.id))
      .returning();
    return updated;
  }

  const [created] = await db
    .insert(callChannels)
    .values({
      groupId,
      channelTelegramId,
      channelTitle,
      permission,
    })
    .returning();

  log.info({ groupId, channelTelegramId }, "Call channel registered");
  return created;
}

/**
 * Verify a call channel (after admin pastes verify message).
 */
export async function verifyCallChannel(channelId: string): Promise<CallChannel> {
  const db = getDb();
  const [updated] = await db
    .update(callChannels)
    .set({ isVerified: true })
    .where(eq(callChannels.id, channelId))
    .returning();
  log.info({ channelId }, "Call channel verified");
  return updated;
}

/**
 * Get all verified call channels for a group.
 */
export async function getGroupCallChannels(
  groupId: string,
): Promise<CallChannel[]> {
  const db = getDb();
  return db.query.callChannels.findMany({
    where: and(
      eq(callChannels.groupId, groupId),
      eq(callChannels.isVerified, true),
    ),
  });
}

/**
 * Check if a user is allowed to have their calls forwarded to a channel
 * based on the channel's permission setting.
 */
export async function canForwardToChannel(
  channel: CallChannel,
  userId: string,
): Promise<boolean> {
  if (channel.permission === "everyone") return true;

  const db = getDb();
  const member = await db.query.groupMembers.findFirst({
    where: and(
      eq(groupMembers.groupId, channel.groupId),
      eq(groupMembers.userId, userId),
    ),
  });

  if (!member) return false;

  if (channel.permission === "owner") return member.isOwner;
  if (channel.permission === "owner_admins") return member.isOwner || member.isAdmin;

  return false;
}

/**
 * Remove a call channel.
 */
export async function removeCallChannel(channelId: string): Promise<void> {
  const db = getDb();
  await db.delete(callChannels).where(eq(callChannels.id, channelId));
  log.info({ channelId }, "Call channel removed");
}
