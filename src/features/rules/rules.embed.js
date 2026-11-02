import {
  EmbedBuilder,
  ButtonBuilder,
  ButtonStyle,
  ActionRowBuilder
} from 'discord.js';
import { configStore, DEFAULT_CONFIG } from '../../core/storage/config-store.js';
import { resolveCustomEmojiShortcodes } from '../../shared/emoji-utils.js';

export function createRulesMessage(guild = null) {
  const config = configStore.get();
  const rawTitle = config.rulesTitle || DEFAULT_CONFIG.rulesTitle;
  const rawDesc = config.rulesContent || DEFAULT_CONFIG.rulesContent;
  const embed = new EmbedBuilder()
    .setColor(0x2B2D31)
    .setTitle(resolveCustomEmojiShortcodes(rawTitle, guild))
    .setDescription(resolveCustomEmojiShortcodes(rawDesc, guild))
    .setFooter({ text: config.rulesFooter || DEFAULT_CONFIG.rulesFooter });

  const button = new ButtonBuilder()
    .setCustomId('btn_accept_rules')
    .setLabel('✅ I Have Read & Agree to the Rules')
    .setStyle(ButtonStyle.Success);

  return { embeds: [embed], components: [new ActionRowBuilder().addComponents(button)] };
}

