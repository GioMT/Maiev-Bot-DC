import {
  EmbedBuilder,
  ButtonBuilder,
  ButtonStyle,
  ActionRowBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle
} from 'discord.js';
import { configStore, DEFAULT_CONFIG } from '../../core/storage/config-store.js';
import { resolveCustomEmojiShortcodes } from '../../shared/emoji-utils.js';

export function createVerifyMessage(guild) {
  const config = configStore.get();
  const rawTitle = (config.verifyTitle || DEFAULT_CONFIG.verifyTitle).replace(/{server}/g, guild.name);
  const rawDescription = config.verifyContent || DEFAULT_CONFIG.verifyContent;
  const title = resolveCustomEmojiShortcodes(rawTitle, guild);
  const description = resolveCustomEmojiShortcodes(rawDescription.replace(/{server}/g, guild.name), guild);
  const footer = (config.verifyFooter || DEFAULT_CONFIG.verifyFooter).replace(/{server}/g, guild.name);

  const embed = new EmbedBuilder()
    .setColor(0x5865F2)
    .setTitle(title)
    .setDescription(description)
    .setThumbnail(guild.iconURL({ dynamic: true }) || undefined)
    .setFooter({ text: footer });

  const button = new ButtonBuilder()
    .setCustomId('btn_open_ign_modal')
    .setLabel('Set AION 2 IGN')
    .setStyle(ButtonStyle.Primary);

  return { embeds: [embed], components: [new ActionRowBuilder().addComponents(button)] };
}

export function createVerifyModal(label = 'Enter your AION 2 Character Name (IGN)', placeholder = 'e.g. DaevaLegend, ShadowWing, etc.') {
  const modal = new ModalBuilder()
    .setCustomId('modal_aion2_verify')
    .setTitle('AION 2 IGN Verification');

  const ignInput = new TextInputBuilder()
    .setCustomId('input_aion_ign')
    .setLabel(label)
    .setStyle(TextInputStyle.Short)
    .setPlaceholder(placeholder)
    .setMinLength(2)
    .setMaxLength(32)
    .setRequired(true);

  modal.addComponents(new ActionRowBuilder().addComponents(ignInput));
  return modal;
}

export function createWelcomePopupEmbed({ guild, member, ign, rolesText }) {
  const config = configStore.get();
  const serverName = guild.name;
  const serverIcon = guild.iconURL({ dynamic: true, size: 256 }) || undefined;

  const welcomeTitle = resolveCustomEmojiShortcodes(
    (config.welcomeTitle || '🎉 Welcome to {server}, {ign}!')
      .replace(/{server}/g, serverName)
      .replace(/{ign}/g, ign),
    guild
  );

  const welcomeDescription = resolveCustomEmojiShortcodes(
    (config.welcomeContent || DEFAULT_CONFIG.welcomeContent)
      .replace(/{server}/g, serverName)
      .replace(/{ign}/g, ign)
      .replace(/{roles}/g, rolesText)
      .replace(/{user}/g, `<@${member.id}>`),
    guild
  );

  const welcomeFooterText = (config.welcomeFooter || '{server} • AION 2')
    .replace(/{server}/g, serverName)
    .replace(/{ign}/g, ign);

  return new EmbedBuilder()
    .setColor(0x00d2ff)
    .setAuthor({ name: serverName, iconURL: serverIcon })
    .setTitle(welcomeTitle)
    .setDescription(welcomeDescription)
    .setThumbnail(serverIcon)
    .setFooter({ text: welcomeFooterText, iconURL: serverIcon })
    .setTimestamp();
}

