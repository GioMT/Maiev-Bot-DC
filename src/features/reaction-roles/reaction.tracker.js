import path from 'node:path';
import { PermissionFlagsBits } from 'discord.js';
import { JsonStore } from '../../core/storage/json-store.js';
import { configStore, ROOT_DIR } from '../../core/storage/config-store.js';
import { findMessageAcrossGuild } from '../../shared/discord-resolvers.js';

const REACTIONS_FILE = path.join(ROOT_DIR, 'reactions-tracker.json');
const reactionsStore = new JsonStore(REACTIONS_FILE, {}, { debounceMs: 1000 });

export function trackUserReaction(guildId, userId, channelId, messageId, emojiIdentifier) {
  if (!userId || !messageId) return;
  const trackedReactions = reactionsStore.get();
  if (!trackedReactions[userId]) trackedReactions[userId] = [];
  const exists = trackedReactions[userId].some(
    r => r.messageId === messageId && r.emoji === emojiIdentifier
  );
  if (!exists) {
    trackedReactions[userId].push({ guildId, channelId, messageId, emoji: emojiIdentifier });
    reactionsStore.persist();
  }
}

export function untrackUserReaction(guildId, userId, channelId, messageId, emojiIdentifier) {
  const trackedReactions = reactionsStore.get();
  if (!userId || !trackedReactions[userId]) return;
  trackedReactions[userId] = trackedReactions[userId].filter(
    r => !(r.messageId === messageId && r.emoji === emojiIdentifier)
  );
  if (trackedReactions[userId].length === 0) {
    delete trackedReactions[userId];
  }
  reactionsStore.persist();
}

export function getUserTrackedReactions(userId) {
  const trackedReactions = reactionsStore.get();
  return trackedReactions[userId] || [];
}

export function clearUserTrackedReactions(userId) {
  const trackedReactions = reactionsStore.get();
  if (trackedReactions[userId]) {
    delete trackedReactions[userId];
    reactionsStore.persist();
  }
}

/**
 * Remove all reactions of a user when they leave the server.
 */
export async function cleanupUserReactionsOnLeave(client, guild, userId, userTag = '') {
  let removedCount = 0;
  const scannedMessageIds = new Set();
  const botMember = guild.members.me;
  const config = configStore.get();

  const hasManageMessages = botMember.permissions.has(PermissionFlagsBits.ManageMessages);
  if (!hasManageMessages) {
    console.warn(`[Reaction Cleanup] ⚠️ Bot lacks 'Manage Messages' permission in server "${guild.name}".`);
  }

  const candidateMessages = [];

  // 1. Check messages from persistent reaction tracker
  const tracked = getUserTrackedReactions(userId);
  for (const item of tracked) {
    if (item.guildId && item.guildId !== guild.id) continue;
    if (scannedMessageIds.has(item.messageId)) continue;
    scannedMessageIds.add(item.messageId);

    try {
      const channel = await guild.channels.fetch(item.channelId).catch(() => null);
      if (channel && channel.isTextBased()) {
        const msg = await channel.messages.fetch(item.messageId).catch(() => null);
        if (msg) candidateMessages.push(msg);
      }
    } catch (_) {}
  }

  // 2. Check tracked nationality messages from config
  if (Array.isArray(config.nationalityMessageIds)) {
    for (const item of config.nationalityMessageIds) {
      const msgId = typeof item === 'object' && item?.messageId ? item.messageId : item;
      const chId = typeof item === 'object' && item?.channelId ? item.channelId : null;
      if (scannedMessageIds.has(msgId)) continue;
      scannedMessageIds.add(msgId);
      const msg = await findMessageAcrossGuild(guild, msgId, chId);
      if (msg) candidateMessages.push(msg);
    }
  }

  // 3. Check configured channels (rules, verify, welcome)
  const channelIdsToCheck = [
    config.rulesChannelId,
    config.verifyChannelId,
    config.welcomeAnnouncementChannelId
  ].filter(Boolean);

  for (const chId of channelIdsToCheck) {
    try {
      const ch = await guild.channels.fetch(chId).catch(() => null);
      if (ch && ch.isTextBased()) {
        const recent = await ch.messages.fetch({ limit: 15 }).catch(() => null);
        if (recent) {
          for (const msg of recent.values()) {
            if (!scannedMessageIds.has(msg.id) && msg.reactions.cache.size > 0) {
              scannedMessageIds.add(msg.id);
              candidateMessages.push(msg);
            }
          }
        }
      }
    } catch (_) {}
  }

  // 4. Scan text channels for nationality reaction cards created by the bot
  const channels = await guild.channels.fetch().catch(() => guild.channels.cache);
  for (const channel of channels.values()) {
    if (!channel || !channel.isTextBased()) continue;
    const perms = channel.permissionsFor(botMember);
    if (!perms || !perms.has(PermissionFlagsBits.ViewChannel)) continue;
    try {
      const recent = await channel.messages.fetch({ limit: 10 }).catch(() => null);
      if (recent) {
        for (const msg of recent.values()) {
          const isRoleCard = msg.author?.id === client.user?.id && (
            msg.embeds?.some(e => e.title && /nationality|regional|choose your/i.test(e.title)) ||
            config.nationalityMessageIds?.some(id => (typeof id === 'object' ? id.messageId : id) === msg.id)
          );
          if (isRoleCard && !scannedMessageIds.has(msg.id)) {
            scannedMessageIds.add(msg.id);
            candidateMessages.push(msg);
          }
        }
      }
    } catch (_) {}
  }

  // 5. Remove user's reactions
  for (const msg of candidateMessages) {
    const channel = msg.channel;
    const botPerms = channel.permissionsFor(botMember);
    if (!botPerms || !botPerms.has(PermissionFlagsBits.ManageMessages)) {
      console.warn(`[Reaction Cleanup] ⚠️ Cannot remove reactions on msg ${msg.id} in #${channel.name}: Missing 'Manage Messages' permission.`);
      continue;
    }

    for (const reaction of msg.reactions.cache.values()) {
      try {
        let after = undefined;
        let hasUserReacted = false;
        while (!hasUserReacted) {
          const users = await reaction.users.fetch({ limit: 100, after });
          if (!users || users.size === 0) break;
          if (users.has(userId)) {
            hasUserReacted = true;
            break;
          }
          if (users.size < 100) break;
          after = users.lastKey();
        }

        if (hasUserReacted) {
          await reaction.users.remove(userId);
          removedCount++;
          console.log(`[Reaction Cleanup] 🗑️ Removed ${reaction.emoji.name} from msg ${msg.id} in #${channel.name} for former member ${userTag || userId}`);
        }
      } catch (rxErr) {
        console.warn(`[Reaction Cleanup] Failed to remove ${reaction.emoji.name} from msg ${msg.id}:`, rxErr.message);
      }
    }
  }

  clearUserTrackedReactions(userId);
  return { removedCount, messagesScanned: candidateMessages.length };
}

/**
 * Purge reactions from former members who already left the server.
 */
export async function purgeGhostReactions(client, guild, targetChannel = null) {
  let totalPurged = 0;
  const purgedMembers = new Map();
  const botMember = guild.members.me;
  const config = configStore.get();
  const messagesToInspect = [];

  if (targetChannel && targetChannel.isTextBased()) {
    const recent = await targetChannel.messages.fetch({ limit: 50 }).catch(() => null);
    if (recent) {
      for (const m of recent.values()) {
        if (m.reactions.cache.size > 0) messagesToInspect.push(m);
      }
    }
  } else {
    if (Array.isArray(config.nationalityMessageIds)) {
      for (const item of config.nationalityMessageIds) {
        const msgId = typeof item === 'object' && item?.messageId ? item.messageId : item;
        const chId = typeof item === 'object' && item?.channelId ? item.channelId : null;
        const msg = await findMessageAcrossGuild(guild, msgId, chId);
        if (msg) messagesToInspect.push(msg);
      }
    }
    const channels = await guild.channels.fetch().catch(() => guild.channels.cache);
    for (const ch of channels.values()) {
      if (!ch || !ch.isTextBased()) continue;
      const perms = ch.permissionsFor(botMember);
      if (!perms || !perms.has(PermissionFlagsBits.ViewChannel)) continue;
      const recent = await ch.messages.fetch({ limit: 15 }).catch(() => null);
      if (recent) {
        for (const m of recent.values()) {
          const isBotCard = m.author?.id === client.user?.id && (
            m.embeds?.some(e => e.title && /nationality|regional|choose your/i.test(e.title)) ||
            config.nationalityMessageIds?.some(id => (typeof id === 'object' ? id.messageId : id) === m.id)
          );
          if (isBotCard && !messagesToInspect.some(existing => existing.id === m.id)) {
            messagesToInspect.push(m);
          }
        }
      }
    }
  }

  await guild.members.fetch().catch(() => null);

  for (const msg of messagesToInspect) {
    const channel = msg.channel;
    const botPerms = channel.permissionsFor(botMember);
    if (!botPerms || !botPerms.has(PermissionFlagsBits.ManageMessages)) {
      console.warn(`[Reaction Purge] ⚠️ Missing 'Manage Messages' permission in #${channel.name}.`);
      continue;
    }

    for (const reaction of msg.reactions.cache.values()) {
      try {
        let after = undefined;
        let done = false;
        while (!done) {
          const users = await reaction.users.fetch({ limit: 100, after });
          if (!users || users.size === 0) break;

          for (const user of users.values()) {
            if (user.bot) continue;

            const isCurrentMember = guild.members.cache.has(user.id);
            if (!isCurrentMember) {
              await reaction.users.remove(user.id).catch(() => null);
              totalPurged++;
              const existing = purgedMembers.get(user.id) || { tag: user.tag || user.username || user.id, count: 0 };
              existing.count++;
              purgedMembers.set(user.id, existing);
              console.log(`[Reaction Purge] 🗑️ Purged ghost reaction ${reaction.emoji.name} from former member ${user.tag} (${user.id})`);
            }
          }

          if (users.size < 100) break;
          after = users.lastKey();
        }
      } catch (err) {
        console.warn(`[Reaction Purge] Error on reaction ${reaction.emoji.name}:`, err.message);
      }
    }
  }

  return {
    totalPurged,
    purgedMembers: Array.from(purgedMembers.values()),
    messagesInspected: messagesToInspect.length
  };
}

