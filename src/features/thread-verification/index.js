import { SlashCommandBuilder, PermissionFlagsBits } from 'discord.js';
import {
  handleStartVideoVerifyButton,
  handleReviewerActionButton,
  handleReviewerReasonModal,
  handlePostUserVerifyCommand,
  handleUploadVerifyVideoApi,
  handleDeleteVerifyVideoApi,
  handlePostUserVerifyApi
} from './thread-verify.handlers.js';

export const threadVerificationFeature = {
  id: 'thread-verification',
  name: 'Private Thread Video Verification',

  commands: [
    new SlashCommandBuilder()
      .setName('post-user-verify')
      .setDescription('Post the Private Thread Video Verification panel in this channel (Admin only)')
      .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
  ],

  commandHandlers: {
    'post-user-verify': handlePostUserVerifyCommand
  },

  buttons: {
    'btn_start_video_verify': handleStartVideoVerifyButton
  },

  buttonPrefixes: {
    'btn_vthread_': handleReviewerActionButton
  },

  modalPrefixes: {
    'modal_vthread_': handleReviewerReasonModal
  },

  registerRoutes(app, context) {
    app.post('/api/upload-verify-video', handleUploadVerifyVideoApi);
    app.delete('/api/upload-verify-video', handleDeleteVerifyVideoApi);
    app.post('/api/post-user-verify', (req, res) => handlePostUserVerifyApi(req, res, context));
  }
};

