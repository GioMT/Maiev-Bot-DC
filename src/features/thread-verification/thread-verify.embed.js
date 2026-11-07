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
 * Creates the Welcome & Status Card posted inside each user's private verification thread.
 * Contains ZERO reviewer buttons so the applicant never sees staff review controls.
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
  embedColor = 0x00d2ff
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
      text: `${serverName} • Case #${caseCode} Private Verification`
    })
    .setTimestamp();

  return {
    embeds: [embed],
    components: []
  };
}

/**
 * Creates the Staff Review Queue & Permanent Audit Card posted automatically
 * in the private Staff Review Channel (e.g. #verify-reviews).
 */
export function createStaffReviewCardPayload({
  guild,
  threadId,
  caseCode = '0001',
  userId,
  userTag,
  displayName,
  status = 'pending',
  claimedBy = null,
  reviewedBy = null,
  grantedRoles = [],
  removedRoles = [],
  lastReason = '',
  lastSubmissionUrl = ''
}) {
  const config = configStore.get();
  const serverName = config.serverName || guild?.name || 'Server';
  const guildId = guild?.id || '@me';
  const threadJumpUrl = `https://discord.com/channels/${guildId}/${threadId}`;
  const userLabel = displayName || userTag || userId;

  // 1. APPROVED — Permanent Green Audit Log Card
  if (status === 'approved') {
    const roleParts = [];
    if (grantedRoles.length > 0) {
      roleParts.push(`Granted: ${grantedRoles.map(r => `\`${r}\``).join(', ')}`);
    }
    if (removedRoles.length > 0) {
      roleParts.push(`Removed: ${removedRoles.map(r => `\`${r}\``).join(', ')}`);
    }

    const embed = new EmbedBuilder()
      .setColor(0x2ecc71)
      .setTitle(`✅ Case #${caseCode} — Verification Approved`)
      .addFields(
        { name: '🔢 Case ID', value: `\`#${caseCode}\``, inline: true },
        { name: '👤 Applicant', value: `<@${userId}> (\`${userLabel}\`)`, inline: true },
        { name: '🛡️ Approved By', value: reviewedBy ? `<@${reviewedBy}>` : 'Staff Reviewer', inline: true },
        {
          name: '🎭 Roles Updated',
          value: roleParts.length > 0 ? roleParts.join(' • ') : 'Verified access unlocked',
          inline: true
        },
        { name: '📋 Final Status', value: '✅ Approved & Thread Archived', inline: true }
      )
      .setFooter({ text: `${serverName} • Case #${caseCode} Approved` })
      .setTimestamp();

    const archiveRow = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setLabel('↗️ View Archived Thread')
        .setStyle(ButtonStyle.Link)
        .setURL(threadJumpUrl)
    );

    return {
      embeds: [embed],
      components: [archiveRow]
    };
  }

  // 2. REJECTED — Permanent Red Audit Log Card
  if (status === 'rejected') {
    const embed = new EmbedBuilder()
      .setColor(0xe74c3c)
      .setTitle(`❌ Case #${caseCode} — Verification Declined`)
      .addFields(
        { name: '🔢 Case ID', value: `\`#${caseCode}\``, inline: true },
        { name: '👤 Applicant', value: `<@${userId}> (\`${userLabel}\`)`, inline: true },
        { name: '🛡️ Declined By', value: reviewedBy ? `<@${reviewedBy}>` : 'Staff Reviewer', inline: true },
        {
          name: '📝 Rejection Reason',
          value: `> ${String(lastReason || 'No reason provided.').slice(0, 900).replace(/\n/g, '\n> ')}`,
          inline: false
        },
        { name: '📋 Final Status', value: '❌ Rejected & Thread Archived', inline: true }
      )
      .setFooter({ text: `${serverName} • Case #${caseCode} Closed` })
      .setTimestamp();

    const archiveRow = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setLabel('↗️ View Archived Thread')
        .setStyle(ButtonStyle.Link)
        .setURL(threadJumpUrl)
    );

    return {
      embeds: [embed],
      components: [archiveRow]
    };
  }

  // 3. CLOSED (APPLICANT LEFT SERVER) — Permanent Slate Audit Log Card
  if (status === 'closed_left') {
    const embed = new EmbedBuilder()
      .setColor(0x95a5a6)
      .setTitle(`⚪ Case #${caseCode} — Closed (Applicant Left)`)
      .addFields(
        { name: '🔢 Case ID', value: `\`#${caseCode}\``, inline: true },
        { name: '👤 Applicant', value: `<@${userId}> (\`${userLabel}\`)`, inline: true },
        { name: '🛡️ Closed By', value: reviewedBy ? `<@${reviewedBy}>` : 'Staff Reviewer', inline: true },
        { name: '📋 Final Status', value: '⚠️ Applicant left the server — Thread archived', inline: false }
      )
      .setFooter({ text: `${serverName} • Case #${caseCode} Closed` })
      .setTimestamp();

    const archiveRow = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setLabel('↗️ View Archived Thread')
        .setStyle(ButtonStyle.Link)
        .setURL(threadJumpUrl)
    );

    return {
      embeds: [embed],
      components: [archiveRow]
    };
  }

  // 4. ACTIVE QUEUE CARD (pending | submitted | reupload_requested)
  let cardColor = 0x00d2ff;
  let queueStatusValue = '⏳ Opened — Waiting for video upload';

  if (status === 'reupload_requested') {
    cardColor = 0xf39c12;
    queueStatusValue = reviewedBy
      ? `🔄 Re-upload Requested by <@${reviewedBy}>`
      : '🔄 Re-upload Requested — Waiting for updated video';
  } else if (status === 'submitted') {
    cardColor = 0x5865F2;
    queueStatusValue = lastSubmissionUrl
      ? `📹 Submission Posted — [Jump to Recording](${lastSubmissionUrl})`
      : '📹 Submission Posted — Ready for Review';
  } else if (claimedBy) {
    cardColor = 0x5865F2;
  }

  const fields = [
    { name: '🔢 Case ID', value: `\`#${caseCode}\``, inline: true },
    { name: '👤 Applicant', value: `<@${userId}> (\`${userLabel}\`)`, inline: true },
    { name: '🧵 Private Thread', value: `<#${threadId}>`, inline: true },
    {
      name: '🙋 Claimed By',
      value: claimedBy ? `🔒 Claimed by <@${claimedBy}>` : '🟢 Unclaimed — Available',
      inline: true
    },
    { name: '📋 Queue Status', value: queueStatusValue, inline: true }
  ];

  if (lastReason && status === 'reupload_requested') {
    fields.push({
      name: '📝 Latest Reviewer Note',
      value: `> ${String(lastReason).slice(0, 900).replace(/\n/g, '\n> ')}`,
      inline: false
    });
  }

  const embed = new EmbedBuilder()
    .setColor(cardColor)
    .setTitle(`🛡️ Case #${caseCode} — Video Verification Queue`)
    .addFields(fields)
    .setFooter({
      text: `${serverName} • Claim a case before reviewing to prevent duplicate actions`
    })
    .setTimestamp();

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`btn_vthread_claim_${threadId}_${userId}`)
      .setLabel(claimedBy ? '🔓 Unclaim' : '🙋 Claim Case')
      .setStyle(claimedBy ? ButtonStyle.Secondary : ButtonStyle.Primary),
    new ButtonBuilder()
      .setCustomId(`btn_vthread_approve_${threadId}_${userId}`)
      .setLabel('✅ Approve')
      .setStyle(ButtonStyle.Success),
    new ButtonBuilder()
      .setCustomId(`btn_vthread_reupload_${threadId}_${userId}`)
      .setLabel('🔄 Request Re-upload')
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId(`btn_vthread_reject_${threadId}_${userId}`)
      .setLabel('❌ Reject & Close')
      .setStyle(ButtonStyle.Danger),
    new ButtonBuilder()
      .setLabel('↗️ Open Thread')
      .setStyle(ButtonStyle.Link)
      .setURL(lastSubmissionUrl || threadJumpUrl)
  );

  return {
    embeds: [embed],
    components: [row]
  };
}

/**
 * Creates the hidden ("Only you can see this") Ephemeral Reviewer Panel
 * summoned inside a verification thread via /review or Right-Click -> Apps -> Review Verification.
 */
export function createEphemeralReviewerPanelPayload({
  threadId,
  caseCode = '0001',
  userId,
  userTag,
  displayName,
  claimedBy = null,
  statusText = '⏳ Pending Review',
  targetMessageUrl = '',
  embedColor = 0x5865F2,
  disableButtons = false
}) {
  const userLabel = displayName || userTag || userId;
  const lines = [
    `**Applicant:** <@${userId}> (\`${userLabel}\`)`,
    `**Claimed By:** ${claimedBy ? `🔒 <@${claimedBy}>` : '🟢 Unclaimed — Available'}`,
    `**Case Status:** ${statusText}`
  ];

  if (targetMessageUrl) {
    lines.push(`**Selected Submission:** [Jump to Message](${targetMessageUrl})`);
  }

  lines.push(
    disableButtons
      ? '\n*This verification case has already been finalized.*'
      : '\n*Choose an action below — these controls are **invisible** to the applicant:*'
  );

  const embed = new EmbedBuilder()
    .setColor(embedColor)
    .setTitle(`🛡️ Reviewer Controls — Case #${caseCode}`)
    .setDescription(lines.join('\n'))
    .setFooter({
      text: `🔒 Hidden Reviewer Panel • Only visible to you`
    })
    .setTimestamp();

  const idSegment = threadId ? `${threadId}_${userId}` : userId;

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`btn_vthread_claim_${idSegment}`)
      .setLabel(claimedBy ? '🔓 Unclaim' : '🙋 Claim Case')
      .setStyle(claimedBy ? ButtonStyle.Secondary : ButtonStyle.Primary)
      .setDisabled(disableButtons),
    new ButtonBuilder()
      .setCustomId(`btn_vthread_approve_${idSegment}`)
      .setLabel('✅ Approve')
      .setStyle(ButtonStyle.Success)
      .setDisabled(disableButtons),
    new ButtonBuilder()
      .setCustomId(`btn_vthread_reupload_${idSegment}`)
      .setLabel('🔄 Request Re-upload')
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(disableButtons),
    new ButtonBuilder()
      .setCustomId(`btn_vthread_reject_${idSegment}`)
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
export function createReviewerReasonModal({ mode, threadId, userId }) {
  const isReupload = mode === 'reupload';
  const idSegment = threadId ? `${threadId}_${userId}` : userId;
  const modal = new ModalBuilder()
    .setCustomId(`modal_vthread_${mode}_${idSegment}`)
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

