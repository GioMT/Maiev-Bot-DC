import { ChannelType, PermissionFlagsBits, SlashCommandBuilder } from 'discord.js';
import { handleSayCommand, handleSayModalSubmit } from './announcer.handlers.js';
import { sendChannelMessage } from './announcer.service.js';

export const announcerFeature = {
  id: 'announcer',
  name: 'Send Message',

  commands: [
    new SlashCommandBuilder()
      .setName('say')
      .setDescription('Send a message or embed as Maiev to a specific channel (Admin only)')
      .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
      .addChannelOption(opt =>
        opt
          .setName('channel')
          .setDescription('Target channel where Maiev will post the message')
          .addChannelTypes(
            ChannelType.GuildText,
            ChannelType.GuildAnnouncement,
            ChannelType.PublicThread,
            ChannelType.PrivateThread
          )
          .setRequired(true)
      )
      .addStringOption(opt =>
        opt
          .setName('message')
          .setDescription('Message text (leave blank to open a multi-line composer)')
          .setRequired(false)
      )
      .addStringOption(opt =>
        opt
          .setName('title')
          .setDescription('Optional embed title (turns the message into an embed)')
          .setRequired(false)
      )
      .addBooleanOption(opt =>
        opt
          .setName('embed')
          .setDescription('Send as a styled embed even without a title')
          .setRequired(false)
      )
      .addRoleOption(opt =>
        opt
          .setName('ping')
          .setDescription('Optional role to mention with the message')
          .setRequired(false)
      )
  ],

  commandHandlers: {
    say: handleSayCommand
  },

  modalPrefixes: {
    'modal_announcer_say:': handleSayModalSubmit
  },

  registerRoutes(app, { client }) {
    app.post('/api/announcer/send', async (req, res) => {
      try {
        const {
          channelId,
          content,
          embedTitle,
          embedColor,
          asEmbed,
          mention
        } = req.body || {};

        const result = await sendChannelMessage(client, {
          channelId,
          content,
          embedTitle,
          embedColor,
          asEmbed,
          mention
        });

        res.json({ success: true, ...result });
      } catch (err) {
        res.status(400).json({ error: err.message });
      }
    });
  }
};

