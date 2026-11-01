import {
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle
} from 'discord.js';
import { configStore } from '../../core/storage/config-store.js';
import { resolveEmojiToReactable, safelyReact } from '../../shared/emoji-utils.js';
import { findMessageAcrossGuild } from '../../shared/discord-resolvers.js';

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
        const codePart = n.code ? ` (\`${n.code.toUpperCase()}\`)` : '';
        const intentPart = n.intent && n.intent !== 'toggle' ? ` [${n.intent}]` : '';
        return `${n.emoji} **${n.name}**${codePart}${intentPart}`;
      }).join('\n');
      return `${catHeader}\n${items}`;
    }).join('\n\n');
  } else {
    formattedList = activeRoles.map(n => {
      const codePart = n.code ? ` (\`${n.code.toUpperCase()}\`)` : '';
      const intentPart = n.intent && n.intent !== 'toggle' ? ` [${n.intent}]` : '';
      return `${n.emoji} **${n.name}**${codePart}${intentPart}`;
    }).join('\n');
  }

  const title = options.title || config.nationalityTitle || '✨ Reaction Roles — Choose Your Roles';
  const rawDesc = options.content || config.nationalityContent || formattedList;
  const description = rawDesc.replace(/{server}/g, guild.name);
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
  const emojisToReact = [];
  const rolesList = Array.isArray(specificRoles) && specificRoles.length > 0
    ? specificRoles
    : (config.nationalityRoles || []);

  for (const n of rolesList) {
    if (n && n.emoji) {
      const r = resolveEmojiToReactable(n.emoji);
      if (r && !emojisToReact.includes(r)) emojisToReact.push(r);
    }
  }

  if (Array.isArray(message.embeds)) {
    for (const emb of message.embeds) {
      const text = emb.description || '';
      for (const n of rolesList) {
        if (n && n.emoji && text.includes(n.emoji)) {
          const r = resolveEmojiToReactable(n.emoji);
          if (r && !emojisToReact.includes(r)) emojisToReact.push(r);
        }
      }
    }
  }

  for (const em of emojisToReact) {
    await safelyReact(message, em);
  }
}

export async function updateTrackedNationalityMessages(client) {
  const config = configStore.get();
  if (!Array.isArray(config.nationalityMessageIds) || config.nationalityMessageIds.length === 0) return;
  for (const guild of client.guilds.cache.values()) {
    try {
      const payload = createNationalityMessage(guild);
      for (const item of config.nationalityMessageIds) {
        const msgId = typeof item === 'object' && item?.messageId ? item.messageId : item;
        const chId = typeof item === 'object' && item?.channelId ? item.channelId : null;
        const msg = await findMessageAcrossGuild(guild, msgId, chId);
        if (msg && msg.author?.id === client.user?.id) {
          await msg.edit({ embeds: payload.embeds, components: [] }).catch(() => null);
          await reactToNationalityCard(msg);
        }
      }
    } catch (_) {}
  }
}

