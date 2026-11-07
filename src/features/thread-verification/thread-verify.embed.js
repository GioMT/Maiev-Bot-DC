import fs from 'node:fs';
import path from 'node:path';
import {
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  AttachmentBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle
} from 'discord.js';
import { configStore, DEFAULT_CONFIG, ROOT_DIR } from '../../core/storage/config-store.js';
import { resolveCustomEmojiShortcodes } from '../../shared/emoji-utils.js';

/**
 * Resolves the absolute path on disk for an uploaded reference video if it exists.
 */
export function resolveUploadedVideoDiskPath(uploadedRelPath) {
  if (!uploadedRelPath || typeof uploadedRelPath !== 'string') return null;
  const cleanRel = uploadedRelPath.replace(/^\/+/, '');
  if (!cleanRel.startsWith('uploads/')) return null;
  const fullPath = path.resolve(ROOT_DIR, 'public', cleanRel);
  const uploadsRoot = path.resolve(ROOT_DIR, 'public', 'uploads');
  if (!fullPath.startsWith(uploadsRoot)) return null;
  if (!fs.existsSync(fullPath)) return null;
  return fullPath;
}

/**
 * Creates the #user-verify channel message payload containing:
 * - Playable reference video attachment (if uploaded)
 * - Customizable instruction embed
 * - Start Video Verification button (+ optional Watch Reference Video link button)
 */
export function createUserVerifyPanelPayload(guild, overrides = {}) {
  const config = configStore.get();
  const serverName = config.serverName || guild?.name || 'Server';

  const rawTitle = overrides.title ?? config.userVerifyTitle ?? DEFAULT_CONFIG.userVerifyTitle;
  const rawContent = overrides.content ?? config.userVerifyContent ?? DEFAULT_CONFIG.userVerifyContent;
  const rawFooter = overrides.footer ?? config.userVerifyFooter ?? DEFAULT_CONFIG.userVerifyFooter;
  const rawBtnLabel = overrides.buttonLabel ?? config.userVerifyButtonLabel ?? DEFAULT_CONFIG.userVerifyButtonLabel;
  const uploadedVideo = overrides.uploadedVideo ?? config.userVerifyUploadedVideo ?? '';
  const videoUrl = (overrides.videoUrl ?? config.userVerifyVideoUrl ?? '').trim();

  const title = resolveCustomEmojiShortcodes(rawTitle.replace(/{server}/g, serverName), guild);
  const description = resolveCustomEmojiShortcodes(rawContent.replace(/{server}/g, serverName), guild);
  const footer = rawFooter.replace(/{server}/g, serverName);

  const embed = new EmbedBuilder()
    .setColor(0x5865F2)
    .setTitle(title)
    .setDescription(description)
    .setThumbnail(guild?.iconURL({ dynamic: true }) || null)
    .setFooter({ text: footer });

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('btn_start_video_verify')
      .setLabel((rawBtnLabel || '📹 Start Video Verification').slice(0, 80))
      .setStyle(ButtonStyle.Success)
  );

  if (videoUrl && /^https?:\/\//i.test(videoUrl)) {
    row.addComponents(
      new ButtonBuilder()
        .setLabel('▶️ Watch Reference Video')
        .setStyle(ButtonStyle.Link)
        .setURL(videoUrl)
    );
  }

  const files = [];
  const diskVideoPath = resolveUploadedVideoDiskPath(uploadedVideo);
  if (diskVideoPath) {
    const fileName = path.basename(diskVideoPath);
    files.push(new AttachmentBuilder(diskVideoPath, { name: fileName }));
  }

  const payload = {
    embeds: [embed],
    components: [row]
  };

  if (files.length > 0) {
    payload.files = files;
  }

  return payload;
}

/**
 * Creates the Reviewer Control Card posted inside each user's private verification thread.
 */
export function createThreadControlPayload({
  guild,
  caseCode = '0001',
  userId,
  userTag,
  displayName,
  parentChannelName = 'user-verify',
  reviewerMentionsText = 'Administrators',
  statusText = '⏳ Pending — Waiting for recording & reviewer check',
  embedColor = 0x00d2ff,
  disableButtons = false
}) {
  const config = configStore.get();
  const serverName = config.serverName || guild?.name || 'Server';

  const rawTitle = config.userVerifyThreadTitle || DEFAULT_CONFIG.userVerifyThreadTitle;
  const rawBody = config.userVerifyThreadContent || DEFAULT_CONFIG.userVerifyThreadContent;

  const userLabel = displayName || userTag || 'Member';
  const title = resolveCustomEmojiShortcodes(
    rawTitle
      .replace(/{case}/g, caseCode)
      .replace(/{user}/g, userLabel)
      .replace(/{server}/g, serverName)
      .replace(/{channel}/g, parentChannelName),
    guild
  );

  const description = resolveCustomEmojiShortcodes(
    rawBody
      .replace(/{case}/g, `#${caseCode}`)
      .replace(/{user}/g, `<@${userId}>`)
      .replace(/{server}/g, serverName)
      .replace(/{channel}/g, parentChannelName)
      .replace(/{reviewers}/g, reviewerMentionsText),
    guild
  );

  const embed = new EmbedBuilder()
    .setColor(embedColor)
    .setTitle(title)
    .setDescription(description)
    .addFields(
      { name: '🔢 Case ID', value: `\`#${caseCode}\``, inline: true },
      { name: '👤 Applicant', value: `<@${userId}> (\`${userLabel}\`)`, inline: true },
      { name: '📋 Verification Status', value: statusText, inline: true }
    )
    .setFooter({
      text: `Case #${caseCode} • Only Administrators & appointed Reviewers can approve or reject`
    })
    .setTimestamp();

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`btn_vthread_approve_${userId}`)
      .setLabel('✅ Approve')
      .setStyle(ButtonStyle.Success)
      .setDisabled(disableButtons),
    new ButtonBuilder()
      .setCustomId(`btn_vthread_reupload_${userId}`)
      .setLabel('🔄 Request Re-upload')
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(disableButtons),
    new ButtonBuilder()
      .setCustomId(`btn_vthread_reject_${userId}`)
      .setLabel('❌ Reject & Close')
      .setStyle(ButtonStyle.Danger)
      .setDisabled(disableButtons)
  );

  return {
    embeds: [embed],
    components: [row]
  };
}

/**
 * Builds the Reviewer reason prompt modal for either "Request Re-upload" or "Reject & Close".
 */
export function createReviewerReasonModal({ mode, userId, controlMessageId }) {
  const isReupload = mode === 'reupload';
  const modal = new ModalBuilder()
    .setCustomId(`modal_vthread_${mode}_${userId}_${controlMessageId}`)
    .setTitle(isReupload ? 'Request New Recording' : 'Reject & Close Verification');

  const reasonInput = new TextInputBuilder()
    .setCustomId('input_vthread_reason')
    .setLabel(
      isReupload
        ? 'What should the user fix or re-record?'
        : 'Reason for rejecting this verification'
    )
    .setPlaceholder(
      isReupload
        ? 'e.g., Please clearly show your character select screen and server name in the recording.'
        : 'e.g., Recording does not match server/character requirements.'
    )
    .setStyle(TextInputStyle.Paragraph)
    .setMinLength(3)
    .setMaxLength(800)
    .setRequired(true);

  modal.addComponents(new ActionRowBuilder().addComponents(reasonInput));
  return modal;
}

