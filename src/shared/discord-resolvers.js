import { PermissionFlagsBits } from 'discord.js';
import { configStore } from '../core/storage/config-store.js';

/**
 * Resolve or find a role in the guild by ID or fallback names.
 */
export async function resolveRole(guild, roleId, fallbackNames = []) {
  if (roleId) {
    const role = await guild.roles.fetch(roleId).catch(() => null);
    if (role) return role;
  }
  const roles = await guild.roles.fetch().catch(() => guild.roles.cache);
  return roles.find(r => {
    const cleanRoleName = r.name.replace(/[[\]]/g, '').trim().toLowerCase();
    return fallbackNames.some(name => {
      const cleanTarget = name.replace(/[[\]]/g, '').trim().toLowerCase();
      return cleanRoleName === cleanTarget || cleanRoleName.includes(cleanTarget) || cleanTarget.includes(cleanRoleName);
    });
  }) || null;
}

/**
 * Resolve a text-based channel in the guild by ID or regex pattern.
 */
export async function resolveChannel(guild, channelId, fallbackPattern = /verif/i) {
  if (channelId) {
    const ch = await guild.channels.fetch(channelId).catch(() => null);
    if (ch && ch.isTextBased()) return ch;
  }
  const channels = await guild.channels.fetch().catch(() => guild.channels.cache);
  return channels.find(ch => {
    if (!ch || !ch.isTextBased()) return false;
    const n = (ch.name || '').normalize('NFKD');
    return fallbackPattern.test(ch.name) || fallbackPattern.test(n);
  }) || null;
}

/**
 * Find a message by ID across channels in the guild.
 */
export async function findMessageAcrossGuild(guild, messageId, hintChannelId = null) {
  if (hintChannelId) {
    const channel = await guild.channels.fetch(hintChannelId).catch(() => null);
    if (channel && channel.isTextBased()) {
      const msg = await channel.messages.fetch(messageId).catch(() => null);
      if (msg) return msg;
    }
  }

  const channels = await guild.channels.fetch().catch(() => guild.channels.cache);
  for (const channel of channels.values()) {
    if (!channel || !channel.isTextBased()) continue;
    const perms = channel.permissionsFor(guild.members.me);
    if (!perms || !perms.has(PermissionFlagsBits.ViewChannel)) continue;
    const msg = await channel.messages.fetch(messageId).catch(() => null);
    if (msg) return msg;
  }
  return null;
}

/**
 * Check if member already completed verification / has access roles beyond onboarding.
 */
export async function hasCompletedVerification(guild, member) {
  if (!member || !member.roles) return false;
  const config = configStore.get();

  // 1. Check configured roles to add on IGN verification
  if (Array.isArray(config.ignRolesToAdd) && config.ignRolesToAdd.length > 0) {
    for (const roleId of config.ignRolesToAdd) {
      if (roleId && member.roles.cache.has(roleId)) return true;
    }
  }

  // 2. Check role names that indicate completed IGN verification or staff access
  const accessKeywords = ['unverified', 'verified', 'elyos fregion', 'legion leader', 'moderator'];
  return member.roles.cache.some(r => {
    const cleanName = r.name.replace(/[[\]]/g, '').trim().toLowerCase();
    return accessKeywords.some(keyword => cleanName === keyword || cleanName.includes(keyword));
  });
}

/**
 * Resolve the primary guild from cache using GUILD_ID or fallback to first cached guild.
 */
export function getActiveGuild(client) {
  const guildId = process.env.GUILD_ID;
  return (guildId && client.guilds.cache.get(guildId)) || client.guilds.cache.first() || null;
}

