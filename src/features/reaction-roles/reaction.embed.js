import {
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  PermissionFlagsBits
} from 'discord.js';
import { configStore } from '../../core/storage/config-store.js';
import {
  resolveEmojiToReactable,
  resolveCustomEmojiShortcodes,
  safelyReact,
  ensureGuildEmojisLoaded
} from '../../shared/emoji-utils.js';
import { findMessageAcrossGuild } from '../../shared/discord-resolvers.js';

export function getPresetForMessage(message, config = null) {
  if (!message) return null;
  const cfg = config || configStore.get();
  const presets = cfg.reactionPresets || {};

  // 1. Direct messageId match in presets
  for (const [id, preset] of Object.entries(presets)) {
    if (preset && preset.messageId && preset.messageId === message.id) {
      return { id, ...preset };
    }
  }

  // 2. Tracked item in nationalityMessageIds with presetId
  if (Array.isArray(cfg.nationalityMessageIds)) {
    const item = cfg.nationalityMessageIds.find(t => (typeof t === 'object' ? t.messageId : t) === message.id);
    if (item && typeof item === 'object' && item.presetId && presets[item.presetId]) {
      return { id: item.presetId, ...presets[item.presetId] };
    }
  }

  // 3. Match by embed title
  if (Array.isArray(message.embeds) && message.embeds.length > 0) {
    const title = (message.embeds[0].title || '').toLowerCase().trim();
    for (const [id, preset] of Object.entries(presets)) {
      if (preset && preset.title) {
        const cleanPresetTitle = preset.title.toLowerCase().replace(/<a?:.+?:\d+>|:[a-zA-Z0-9_]+:/g, '').trim();
        const cleanMsgTitle = title.replace(/<a?:.+?:\d+>|:[a-zA-Z0-9_]+:/g, '').trim();
        if (cleanPresetTitle && cleanMsgTitle && (cleanPresetTitle === cleanMsgTitle || cleanMsgTitle.includes(cleanPresetTitle) || cleanPresetTitle.includes(cleanMsgTitle))) {
          return { id, ...preset };
        }
      }
    }
  }

  // 4. Match by matching roles found in embed description
  if (Array.isArray(message.embeds) && message.embeds.length > 0) {
    const desc = (message.embeds[0].description || '').toLowerCase();
    let bestMatch = null;
    let maxMatchCount = 0;
    for (const [id, preset] of Object.entries(presets)) {
      if (preset && Array.isArray(preset.roles)) {
        let matchCount = 0;
        for (const role of preset.roles) {
          if (role && role.name && desc.includes(role.name.toLowerCase())) {
            matchCount++;
          }
        }
        if (matchCount > maxMatchCount) {
          maxMatchCount = matchCount;
          bestMatch = { id, ...preset };
        }
      }
    }
    if (maxMatchCount > 0) return bestMatch;
  }

  return null;
}

export function createNationalityButtonRows(nationalityRoles = []) {
  const activeNats = (nationalityRoles || []).filter(n => n && n.name);
  const rows = [];
  for (let i = 0; i < activeNats.length && i < 25; i += 4) {
    const chunk = activeNats.slice(i, i + 4);
    const row = new ActionRowBuilder();
    for (const item of chunk) {
      row.addComponents(
        new ButtonBuilder()
          .setCustomId(`btn_nat_${item.code}`)
          .setLabel(`${item.emoji || ''} ${item.name}`.trim())
          .setStyle(ButtonStyle.Secondary)
      );
    }
    rows.push(row);
  }
  return rows;
}

export function createNationalityMessage(guild, options = {}) {
  const config = configStore.get();
  const activeRoles = Array.isArray(options.roles)
    ? options.roles.filter(n => n && n.name)
    : (config.nationalityRoles || []).filter(n => n && n.name);

  const categories = {};
  activeRoles.forEach(role => {
    const cat = role.category || role.group || '';
    if (!categories[cat]) categories[cat] = [];
    categories[cat].push(role);
  });

  const categoryKeys = Object.keys(categories);
  const hasMultipleCategories = categoryKeys.length > 1;

  let formattedList = '';
  if (activeRoles.length === 0) {
    formattedList = '*(No reaction roles configured yet)*';
  } else if (hasMultipleCategories) {
    formattedList = categoryKeys.map(cat => {
      const catHeader = cat ? `### ${cat}` : '### Other Roles';
      const items = categories[cat].map(n => {
        return `${n.emoji} **${n.name}**`;
      }).join('\n');
      return `${catHeader}\n${items}`;
    }).join('\n\n');
  } else {
    formattedList = activeRoles.map(n => {
      return `${n.emoji} **${n.name}**`;
    }).join('\n');
  }

  const rawTitle = options.title || config.nationalityTitle || '✨ Reaction Roles — Choose Your Roles';
  const title = resolveCustomEmojiShortcodes(rawTitle, guild);
  const rawDesc = options.content || config.nationalityContent || formattedList;
  const description = resolveCustomEmojiShortcodes(rawDesc.replace(/{server}/g, guild.name), guild);
  const footer = options.footer || config.nationalityFooter || 'React with an emoji below to toggle your role';

  const embed = new EmbedBuilder()
    .setColor(0x00d2ff)
    .setTitle(title)
    .setDescription(description)
    .setThumbnail(guild.iconURL({ dynamic: true }) || undefined)
    .setFooter({ text: footer });

  return { embeds: [embed] };
}

export async function reactToNationalityCard(message, specificRoles = null) {
  if (!message) return;
  const config = configStore.get();

  // 1. Determine roles allowed specifically on this card
  let rolesList = Array.isArray(specificRoles) && specificRoles.length > 0 ? specificRoles : null;
  if (!rolesList) {
    const preset = getPresetForMessage(message, config);
    if (preset && Array.isArray(preset.roles) && preset.roles.length > 0) {
      rolesList = preset.roles;
    }
  }

  // Fallback to roles explicitly mentioned in the embed description
  if (!rolesList && Array.isArray(message.embeds) && message.embeds.length > 0) {
    const desc = (message.embeds[0].description || '').toLowerCase();
    rolesList = (config.nationalityRoles || []).filter(r => r && r.name && desc.includes(r.name.toLowerCase()));
  }

  if (!rolesList || rolesList.length === 0) return;

  if (message.guild) {
    await ensureGuildEmojisLoaded(message.guild);
  }

  // 2. Resolve reactable strings and match keys
  const allowedReactables = [];
  const allowedEmojiKeys = new Set();

  for (const n of rolesList) {
    if (n && n.emoji) {
      const r = resolveEmojiToReactable(n.emoji, message.guild);
      if (r) {
        if (!allowedReactables.includes(r)) allowedReactables.push(r);

        const key = String(n.emoji).replace(/^<a?:|:(\d+)>$|^:|:$/g, '').toLowerCase();
        allowedEmojiKeys.add(key);
        allowedEmojiKeys.add(n.emoji);
        allowedEmojiKeys.add(r.toLowerCase());

        const customIdMatch = r.match(/:(\d+)>?$/);
        if (customIdMatch) allowedEmojiKeys.add(customIdMatch[1]);
        const shortcodeMatch = String(n.emoji).match(/^:([a-zA-Z0-9_]+):$/);
        if (shortcodeMatch) allowedEmojiKeys.add(shortcodeMatch[1].toLowerCase());
      }
    }
  }

  // 3. Purge foreign / unwanted reactions that do NOT belong to this card
  try {
    const freshMsg = await message.fetch().catch(() => message);
    const botMember = freshMsg.guild?.members?.me;
    const canManageMessages = botMember?.permissions?.has(PermissionFlagsBits.ManageMessages);

    for (const reaction of freshMsg.reactions.cache.values()) {
      const rxName = (reaction.emoji.name || '').toLowerCase();
      const rxId = reaction.emoji.id || '';
      const rxIdent = (reaction.emoji.identifier || '').toLowerCase();

      const isAllowed =
        allowedEmojiKeys.has(rxName) ||
        (rxId && allowedEmojiKeys.has(rxId)) ||
        allowedEmojiKeys.has(rxIdent) ||
        allowedReactables.some(ar => {
          const arLower = ar.toLowerCase();
          return arLower.includes(rxName) || (rxId && ar.includes(rxId));
        });

      if (!isAllowed) {
        if (canManageMessages) {
          await reaction.remove().catch(() => null);
        } else if (reaction.me) {
          await reaction.users.remove(message.client.user.id).catch(() => null);
        }
      }
    }
  } catch (err) {
    console.warn('[Reaction Card] Warning during reaction cleanup:', err.message);
  }

  // 4. React with allowed emojis in specified order
  for (const em of allowedReactables) {
    const existing = message.reactions.cache.find(rx => {
      const rxName = (rx.emoji.name || '').toLowerCase();
      const rxId = rx.emoji.id || '';
      return em.toLowerCase().includes(rxName) || (rxId && em.includes(rxId));
    });

    if (!existing || !existing.me) {
      await safelyReact(message, em);
    }
  }
}

export async function updateTrackedNationalityMessages(client) {
  const config = configStore.get();
  if (!Array.isArray(config.nationalityMessageIds) || config.nationalityMessageIds.length === 0) return;
  for (const guild of client.guilds.cache.values()) {
    try {
      await ensureGuildEmojisLoaded(guild);
      for (const item of config.nationalityMessageIds) {
        const msgId = typeof item === 'object' && item?.messageId ? item.messageId : item;
        const chId = typeof item === 'object' && item?.channelId ? item.channelId : null;
        const msg = await findMessageAcrossGuild(guild, msgId, chId);
        if (msg && msg.author?.id === client.user?.id) {
          const preset = getPresetForMessage(msg, config);
          if (preset && Array.isArray(preset.roles) && preset.roles.length > 0) {
            const payload = createNationalityMessage(guild, {
              roles: preset.roles,
              title: preset.title,
              content: preset.content,
              footer: preset.footer
            });
            await msg.edit({ embeds: payload.embeds, components: [] }).catch(() => null);
            await reactToNationalityCard(msg, preset.roles);
          }
        }
      }
    } catch (_) {}
  }
}

