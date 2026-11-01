import { SlashCommandBuilder, PermissionFlagsBits } from 'discord.js';
import {
  handleOpenIgnModalButton,
  handleVerifyModalSubmit,
  handlePostVerifyCommand,
  handleConfigureVerificationCommand,
  handleSetNicknameCommand,
  handlePostVerifyApi
} from './verify.handlers.js';

export const verificationFeature = {
  id: 'verification',
  name: 'AION 2 IGN Verification',

  commands: [
    new SlashCommandBuilder()
      .setName('post-verify')
      .setDescription('Post Maiev’s AION 2 verification card with the IGN button (Admin only)')
      .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

    new SlashCommandBuilder()
      .setName('configure-verification')
      .setDescription('Configure roles and channel for the onboarding flow (Admin only)')
      .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
      .addRoleOption(option =>
        option
          .setName('onboarded_role')
          .setDescription('Role given after accepting rules (e.g. [Onboarded])')
          .setRequired(false)
      )
      .addRoleOption(option =>
        option
          .setName('unverified_role')
          .setDescription('Role given after setting IGN (e.g. [Unverified])')
          .setRequired(false)
      )
      .addRoleOption(option =>
        option
          .setName('elyos_fregion_role')
          .setDescription('Role given after setting IGN (e.g. [Elyos Fregion])')
          .setRequired(false)
      )
      .addChannelOption(option =>
        option
          .setName('verify_channel')
          .setDescription('The #verify-ign text channel')
          .setRequired(false)
      ),

    new SlashCommandBuilder()
      .setName('setnickname')
      .setDescription('Change your nickname on this server')
      .addStringOption(option =>
        option
          .setName('nickname')
          .setDescription('The new nickname (max 32 characters)')
          .setRequired(false)
          .setMaxLength(32)
      )
  ],

  commandHandlers: {
    'post-verify': handlePostVerifyCommand,
    'configure-verification': handleConfigureVerificationCommand,
    'setnickname': handleSetNicknameCommand
  },

  buttons: {
    'btn_open_ign_modal': handleOpenIgnModalButton
  },

  modals: {
    'modal_aion2_verify': handleVerifyModalSubmit
  },

  registerEvents({ client }) {
    client.on('guildMemberAdd', async (member) => {
      try {
        const userTag = member.user?.tag || member.user?.username || member.id;
        console.log(`[Member Join] 👋 ${userTag} (${member.id}) joined ${member.guild.name}. Must complete rules acknowledgement and IGN verification.`);
        member.roles.cache.clear();
      } catch (err) {
        console.error('[Member Join] Error handling guildMemberAdd:', err);
      }
    });
  },

  registerRoutes(app, context) {
    app.post('/api/post-verify', (req, res) => handlePostVerifyApi(req, res, context));
  }
};

