import {
  ActionRowBuilder,
  ModalBuilder,
  PermissionFlagsBits,
  TextInputBuilder,
  TextInputStyle
} from 'discord.js';
import { sendChannelMessage } from './announcer.service.js';

/**
 * Handle `/say` slash command.
 * If `message` is provided, sends immediately. If omitted, opens a multi-line Modal composer.
 */
export async function handleSayCommand(interaction) {
  if (!interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)) {
    await interaction.reply({
      content: 'Administrator permission is required to use `/say`.',
      ephemeral: true
    });
    return;
  }

  const channel = interaction.options.getChannel('channel', true);
  const message = interaction.options.getString('message');
  const title = interaction.options.getString('title') || '';
  const asEmbed = interaction.options.getBoolean('embed') || false;
  const pingRole = interaction.options.getRole('ping');
  const mention = pingRole ? `role:${pingRole.id}` : '';

  if (message && message.trim()) {
    await interaction.deferReply({ ephemeral: true });
    try {
      const result = await sendChannelMessage(interaction.client, {
        channelId: channel.id,
        content: message,
        embedTitle: title,
        asEmbed,
        mention
      });
      await interaction.editReply({
        content: `Message sent to <#${result.channelId}>. [Jump to message](${result.url})`
      });
    } catch (err) {
      await interaction.editReply({
        content: `Failed to send message: ${err.message}`
      });
    }
    return;
  }

  // Open a multi-line modal composer when `message` is omitted
  const modal = new ModalBuilder()
    .setCustomId(`modal_announcer_say:${channel.id}:${asEmbed ? '1' : '0'}:${pingRole ? pingRole.id : ''}`)
    .setTitle(`Send Message to #${channel.name}`.slice(0, 45));

  const titleInput = new TextInputBuilder()
    .setCustomId('announcer_title')
    .setLabel('Embed Title (Optional — leave blank for plain)')
    .setStyle(TextInputStyle.Short)
    .setRequired(false)
    .setMaxLength(256)
    .setValue(title.slice(0, 256));

  const messageInput = new TextInputBuilder()
    .setCustomId('announcer_message')
    .setLabel('Message Content')
    .setStyle(TextInputStyle.Paragraph)
    .setRequired(true)
    .setMaxLength(4000)
    .setPlaceholder('Write the message Maiev should post in this channel...');

  modal.addComponents(
    new ActionRowBuilder().addComponents(titleInput),
    new ActionRowBuilder().addComponents(messageInput)
  );

  await interaction.showModal(modal);
}

/**
 * Handle Modal submission from `/say` when opened without an inline `message`.
 */
export async function handleSayModalSubmit(interaction) {
  if (!interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)) {
    await interaction.reply({
      content: 'Administrator permission is required to send messages as Maiev.',
      ephemeral: true
    });
    return;
  }

  const parts = interaction.customId.split(':');
  const channelId = parts[1];
  const asEmbed = parts[2] === '1';
  const roleId = parts[3] || '';

  const title = interaction.fields.getTextInputValue('announcer_title') || '';
  const message = interaction.fields.getTextInputValue('announcer_message') || '';

  await interaction.deferReply({ ephemeral: true });
  try {
    const result = await sendChannelMessage(interaction.client, {
      channelId,
      content: message,
      embedTitle: title,
      asEmbed,
      mention: roleId ? `role:${roleId}` : ''
    });
    await interaction.editReply({
      content: `Message sent to <#${result.channelId}>. [Jump to message](${result.url})`
    });
  } catch (err) {
    await interaction.editReply({
      content: `Failed to send message: ${err.message}`
    });
  }
}

