import { SlashCommandBuilder, PermissionFlagsBits } from 'discord.js';
import {
  handleAcceptRulesButton,
  handlePostRulesCommand,
  handlePostRulesApi
} from './rules.handlers.js';

export const rulesFeature = {
  id: 'rules',
  name: 'Server Rules & Onboarding',

  commands: [
    new SlashCommandBuilder()
      .setName('post-rules')
      .setDescription('Post the server rules card with the acknowledgment button (Admin only)')
      .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
  ],

  commandHandlers: {
    'post-rules': handlePostRulesCommand
  },

  buttons: {
    'btn_accept_rules': handleAcceptRulesButton
  },

  registerRoutes(app, context) {
    app.post('/api/post-rules', (req, res) => handlePostRulesApi(req, res, context));
  }
};

