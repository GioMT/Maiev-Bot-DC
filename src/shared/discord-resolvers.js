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

const PERMISSION_LABELS = new Map([
  [PermissionFlagsBits.ViewChannel, 'View Channel'],
  [PermissionFlagsBits.SendMessages, 'Send Messages'],
  [PermissionFlagsBits.EmbedLinks, 'Embed Links'],
  [PermissionFlagsBits.AttachFiles, 'Attach Files'],
  [PermissionFlagsBits.ReadMessageHistory, 'Read Message History'],
  [PermissionFlagsBits.AddReactions, 'Add Reactions'],
  [PermissionFlagsBits.UseExternalEmojis, 'Use External Emojis'],
  [PermissionFlagsBits.ManageMessages, 'Manage Messages'],
  [PermissionFlagsBits.CreatePrivateThreads, 'Create Private Threads'],
  [PermissionFlagsBits.ManageThreads, 'Manage Threads'],
  [PermissionFlagsBits.SendMessagesInThreads, 'Send Messages in Threads']
]);

/**
 * Checks whether Maiev has the required permissions in a specific target channel.
 * Detects when a channel-level permission override (like @everyone ❌) blocks Maiev's server role permissions.
 */
export function diagnoseChannelPermissions(channel, requiredFlags = []) {
  const guild = channel?.guild;
  const botMember = guild?.members?.me;
  if (!channel || !botMember) {
    return { ok: true, missing: [], blockedByChannelOverride: false, message: '' };
  }

  if (botMember.permissions.has(PermissionFlagsBits.Administrator)) {
    return { ok: true, missing: [], blockedByChannelOverride: false, message: '' };
  }

  const channelPerms = channel.permissionsFor(botMember);
  if (!channelPerms) {
    return { ok: true, missing: [], blockedByChannelOverride: false, message: '' };
  }

  const missing = [];
  let blockedByChannelOverride = false;

  for (const flag of requiredFlags) {
    if (!channelPerms.has(flag)) {
      const label = PERMISSION_LABELS.get(flag) || String(flag);
      missing.push(label);
      if (botMember.permissions.has(flag)) {
        blockedByChannelOverride = true;
      }
    }
  }

  if (missing.length === 0) {
    return { ok: true, missing: [], blockedByChannelOverride: false, message: '' };
  }

  const chName = `#${channel.name || 'channel'}`;
  const overrideExplanation = blockedByChannelOverride
    ? `Maiev has these permissions in Server Settings → Roles, but a Channel Permission Override in ${chName} (such as @everyone ❌) is blocking them.`
    : `Maiev is missing these permissions in ${chName}.`;

  const message =
    `Missing Permission(s) in ${chName}: ${missing.join(', ')}. ${overrideExplanation} ` +
    `Fix: Enable "Administrator" on Maiev's role in Server Settings → Roles (recommended so you never have to configure individual channels), OR grant Maiev green ✅ overrides in ${chName} → Edit Channel → Permissions.`;

  return {
    ok: false,
    missing,
    blockedByChannelOverride,
    message
  };
}

/**
 * Formats a Discord API error (including 50013 Missing Permissions) with actionable channel-override guidance.
 */
export function formatChannelPermissionError(channel, err, requiredFlags = []) {
  const diag = diagnoseChannelPermissions(channel, requiredFlags);
  if (!diag.ok) {
    return diag.message;
  }
  if (err?.code === 50013 || /Missing Permissions|Missing Access/i.test(err?.message || '')) {
    const chName = channel?.name ? `#${channel.name}` : 'the target channel';
    return (
      `Missing Permissions in ${chName}. Even if Maiev's role has permissions enabled in Server Settings → Roles, ` +
      `a channel-level override in ${chName} (like @everyone ❌) will block the bot unless Maiev has "Administrator" enabled in Server Settings → Roles ` +
      `or is explicitly granted View Channel, Send Messages, Embed Links, Attach Files, and Read Message History in ${chName} → Edit Channel → Permissions.`
    );
  }
  return err?.message || 'Unknown Discord API error';
}

/**
 * Finds an active card message authored by the bot in a channel by savedMessageId or by scanning recent messages.
 */
export async function findBotCardMessage(channel, savedMessageId, matcherFn) {
  if (!channel || !channel.isTextBased()) return null;
  const botId = channel.client?.user?.id || channel.guild?.members?.me?.id;

  if (savedMessageId) {
    const msg = await channel.messages.fetch(savedMessageId).catch(() => null);
    if (msg && (!botId || msg.author?.id === botId)) {
      return msg;
    }
  }

  if (typeof matcherFn === 'function') {
    const recent = await channel.messages.fetch({ limit: 30 }).catch(() => null);
    if (recent) {
      for (const msg of recent.values()) {
        if ((!botId || msg.author?.id === botId) && matcherFn(msg)) {
          return msg;
        }
      }
    }
  }

  return null;
}

