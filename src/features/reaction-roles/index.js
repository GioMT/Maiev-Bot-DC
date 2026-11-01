import { SlashCommandBuilder, PermissionFlagsBits } from 'discord.js';
import { updateTrackedNationalityMessages } from './reaction.embed.js';
import {
  handleNationalityButton,
  handlePostNationalityCommand,
  handleAddFlagRoleCommand,
  handleRemoveFlagRoleCommand,
  handleCleanReactionsCommand,
  handleMessageCreate,
  handleReactionAdd,
  handleReactionRemove,
  handleMemberLeave,
  handleSaveReactionRolesApi,
  handlePostReactionRolesApi,
  handleCleanReactionsApi
} from './reaction.handlers.js';

export const reactionRolesFeature = {
  id: 'reaction-roles',
  name: 'Reaction & Nationality Roles',

  commands: [
    new SlashCommandBuilder()
      .setName('post-nationality')
      .setDescription('Post or update nationality role card with flag emoji reactions (Admin only)')
      .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
      .addBooleanOption(option =>
        option
          .setName('force_new')
          .setDescription('Create a brand-new message instead of updating the existing one')
          .setRequired(false)
      ),

    new SlashCommandBuilder()
      .setName('post-nationality-roles')
      .setDescription('Post or update nationality role card with flag emoji reactions (Admin only)')
      .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
      .addBooleanOption(option =>
        option
          .setName('force_new')
          .setDescription('Create a brand-new message instead of updating the existing one')
          .setRequired(false)
      ),

    new SlashCommandBuilder()
      .setName('add-flag-role')
      .setDescription('Link a flag emoji to a server role for nationality channels (Admin only)')
      .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
      .addStringOption(option =>
        option
          .setName('flag')
          .setDescription('The flag emoji (e.g. 🇺🇸, 🇰🇷, 🇩🇪, 🇧🇷)')
          .setRequired(true)
      )
      .addRoleOption(option =>
        option
          .setName('role')
          .setDescription('The server role to grant when reacting to this flag')
          .setRequired(true)
      )
      .addStringOption(option =>
        option
          .setName('country')
          .setDescription('Country name (e.g. South Korea, United States, Japan)')
          .setRequired(false)
      )
      .addStringOption(option =>
        option
          .setName('short_code')
          .setDescription('Short country code (e.g. kr, ph, us) — auto-detected from flag if omitted')
          .setRequired(false)
      ),

    new SlashCommandBuilder()
      .setName('remove-flag-role')
      .setDescription('Remove a flag emoji from nationality roles (Admin only)')
      .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
      .addStringOption(option =>
        option
          .setName('flag')
          .setDescription('The flag emoji or country code to remove')
          .setRequired(true)
      ),

    new SlashCommandBuilder()
      .setName('clean-reactions')
      .setDescription('Purge ghost reactions on messages from members who left the server (Admin only)')
      .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
      .addChannelOption(option =>
        option
          .setName('channel')
          .setDescription('Specific channel to clean (defaults to all reaction cards)')
          .setRequired(false)
      )
  ],

  commandHandlers: {
    'post-nationality': handlePostNationalityCommand,
    'post-nationality-roles': handlePostNationalityCommand,
    'add-flag-role': handleAddFlagRoleCommand,
    'remove-flag-role': handleRemoveFlagRoleCommand,
    'clean-reactions': handleCleanReactionsCommand
  },

  buttonPrefixes: {
    'btn_nat_': handleNationalityButton
  },

  registerEvents({ client }) {
    client.once('ready', async () => {
      await updateTrackedNationalityMessages(client);
    });

    client.on('messageCreate', (msg) => handleMessageCreate(msg, client));
    client.on('messageReactionAdd', (reaction, user) => handleReactionAdd(reaction, user, client));
    client.on('messageReactionRemove', (reaction, user) => handleReactionRemove(reaction, user, client));
    client.on('guildMemberRemove', (member) => handleMemberLeave(member, client));
  },

  registerRoutes(app, context) {
    app.post(['/api/reaction-roles', '/api/nationality-roles'], handleSaveReactionRolesApi);
    app.post(['/api/post-reaction-roles', '/api/post-nationality-roles'], (req, res) => handlePostReactionRolesApi(req, res, context));
    app.post('/api/clean-reactions', (req, res) => handleCleanReactionsApi(req, res, context));
  }
};

