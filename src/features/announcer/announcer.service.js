import { EmbedBuilder, PermissionFlagsBits } from 'discord.js';
import {
  getActiveGuild,
  diagnoseChannelPermissions,
  formatChannelPermissionError
} from '../../shared/discord-resolvers.js';
import {
  ensureGuildEmojisLoaded,
  resolveCustomEmojiShortcodes
} from '../../shared/emoji-utils.js';

/**
 * Resolve a mention option ('', 'everyone', 'here', or 'role:<id>') into a Discord ping string.
 */
function buildMentionPrefix(mention) {
  const m = String(mention || '').trim();
  if (!m) return '';
  if (m === 'everyone') return '@everyone';
  if (m === 'here') return '@here';
  if (m.startsWith('role:')) {
    const roleId = m.slice(5).trim();
    return roleId ? `<@&${roleId}>` : '';
  }
  if (/^\d+$/.test(m)) return `<@&${m}>`;
  return '';
}

/**
 * Normalize hex color string for EmbedBuilder.setColor.
 */
function normalizeEmbedColor(color) {
  const raw = String(color || '').trim();
  if (/^#[0-9a-fA-F]{6}$/.test(raw)) return raw;
  return '#00d2ff';
}

/**
 * Send a custom message or embed as Maiev to a specific Discord channel.
 */
export async function sendChannelMessage(client, {
  channelId,
  content = '',
  embedTitle = '',
  embedColor = '#00d2ff',
  asEmbed = false,
  mention = ''
} = {}) {
  if (!client?.isReady?.()) {
    throw new Error('Maiev is not connected to Discord Gateway yet.');
  }

  const guild = getActiveGuild(client);
  if (!guild) {
    throw new Error('Active Discord server could not be resolved.');
  }

  if (!channelId) {
    throw new Error('Please select a target Discord channel.');
  }

  const channel = await guild.channels.fetch(channelId).catch(() => null);
  if (!channel || !channel.isTextBased()) {
    throw new Error('Selected channel was not found or cannot receive text messages.');
  }

  const cleanContent = String(content || '').trim();
  const cleanTitle = String(embedTitle || '').trim();
  const useEmbed = Boolean(asEmbed || cleanTitle);

  if (!cleanContent && !cleanTitle) {
    throw new Error('Please enter a message or embed title before sending.');
  }

  const requiredPerms = [
    PermissionFlagsBits.ViewChannel,
    PermissionFlagsBits.SendMessages,
    ...(useEmbed ? [PermissionFlagsBits.EmbedLinks] : [])
  ];
  const permCheck = diagnoseChannelPermissions(channel, requiredPerms);
  if (!permCheck.ok) {
    throw new Error(permCheck.message);
  }

  await ensureGuildEmojisLoaded(guild);
  const resolvedContent = resolveCustomEmojiShortcodes(cleanContent, guild);
  const resolvedTitle = resolveCustomEmojiShortcodes(cleanTitle, guild);
  const mentionPrefix = buildMentionPrefix(mention);

  const payload = {};
  if (useEmbed) {
    const embed = new EmbedBuilder().setColor(normalizeEmbedColor(embedColor));
    if (resolvedTitle) {
      embed.setTitle(resolvedTitle.slice(0, 256));
    }
    if (resolvedContent) {
      embed.setDescription(resolvedContent.slice(0, 4096));
    }
    payload.embeds = [embed];
    if (mentionPrefix) {
      payload.content = mentionPrefix;
    }
  } else {
    const combined = [mentionPrefix, resolvedContent].filter(Boolean).join('\n');
    payload.content = combined.slice(0, 2000);
  }

  try {
    const sent = await channel.send(payload);
    return {
      messageId: sent.id,
      channelId: channel.id,
      channelName: channel.name,
      url: sent.url
    };
  } catch (err) {
    throw new Error(formatChannelPermissionError(channel, err, requiredPerms));
  }
}

