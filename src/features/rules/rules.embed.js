import {
  EmbedBuilder,
  ButtonBuilder,
  ButtonStyle,
  ActionRowBuilder
} from 'discord.js';
import { configStore, DEFAULT_CONFIG } from '../../core/storage/config-store.js';

export function createRulesMessage() {
  const config = configStore.get();
  const embed = new EmbedBuilder()
    .setColor(0x2B2D31)
    .setTitle(config.rulesTitle || DEFAULT_CONFIG.rulesTitle)
    .setDescription(config.rulesContent || DEFAULT_CONFIG.rulesContent)
    .setFooter({ text: config.rulesFooter || DEFAULT_CONFIG.rulesFooter });

  const button = new ButtonBuilder()
    .setCustomId('btn_accept_rules')
    .setLabel('✅ I Have Read & Agree to the Rules')
    .setStyle(ButtonStyle.Success);

  return { embeds: [embed], components: [new ActionRowBuilder().addComponents(button)] };
}

