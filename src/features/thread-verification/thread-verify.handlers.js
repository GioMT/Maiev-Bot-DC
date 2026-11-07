import fs from 'node:fs';
import path from 'node:path';
import {
  ChannelType,
  EmbedBuilder,
  PermissionFlagsBits,
  ThreadAutoArchiveDuration
} from 'discord.js';
import { configStore, ROOT_DIR } from '../../core/storage/config-store.js';
import { eventBus } from '../../core/event-bus.js';
import { getActiveGuild, resolveRole } from '../../shared/discord-resolvers.js';
import { ensureGuildEmojisLoaded } from '../../shared/emoji-utils.js';
import { threadVerifyStore } from './thread-verify.store.js';
import {
  createUserVerifyPanelPayload,
  createThreadControlPayload,
  createReviewerReasonModal,
  resolveUploadedVideoDiskPath
} from './thread-verify.embed.js';

const MAX_UPLOAD_BYTES = 50 * 1024 * 1024; // 50 MB
const ALLOWED_VIDEO_EXTS = new Set(['.mp4', '.mov', '.webm', '.m4v']);

/**
 * Checks whether a guild member is authorized to review verifications
 * (Server Owner, Administrator, or holds any configured Reviewer role).
 */
export function isAuthorizedReviewer(member, guild, config) {
  if (!member || !guild) return false;
  if (guild.ownerId === member.id) return true;
  if (member.permissions.has(PermissionFlagsBits.Administrator)) return true;

  const reviewerRoleIds = Array.isArray(config.userVerifyReviewerRoleIds)
    ? config.userVerifyReviewerRoleIds
    : [];
  return reviewerRoleIds.some(roleId => roleId && member.roles.cache.has(roleId));
}

function getValidReviewerRoleIds(guild, config) {
  const raw = Array.isArray(config.userVerifyReviewerRoleIds) ? config.userVerifyReviewerRoleIds : [];
  return raw.filter(id => id && guild.roles.cache.has(id));
}

function formatReviewerMentions(guild, config) {
  const validIds = getValidReviewerRoleIds(guild, config);
  if (validIds.length === 0) return 'Server Administrators';
  return validIds.map(id => `<@&${id}>`).join(' ');
}

/**
 * Button Handler: User clicks "Start Video Verification" in #user-verify
 */
export async function handleStartVideoVerifyButton(interaction) {
  await interaction.deferReply({ ephemeral: true });

  const { guild, member, channel } = interaction;
  const config = configStore.get();

  if (!channel || channel.isThread() || channel.type !== ChannelType.GuildText) {
    await interaction.editReply({
      content: '⚠️ Video verification threads can only be started from a standard text channel.'
    });
    return;
  }

  // Allow Admins/Reviewers to test freely; prevent already-verified regular members from opening extra threads
  const isStaff = isAuthorizedReviewer(member, guild, config);
  const configuredAddRoles = Array.isArray(config.userVerifyRolesToAdd)
    ? config.userVerifyRolesToAdd.filter(Boolean)
    : [];

  if (!isStaff && configuredAddRoles.length > 0) {
    const hasAllVerifiedRoles = configuredAddRoles.every(roleId => member.roles.cache.has(roleId));
    if (hasAllVerifiedRoles) {
      await interaction.editReply({
        content: '✅ You have already completed video verification and hold your verified role!'
      });
      return;
    }
  }

  // Check bot permissions in this channel
  const botMember = guild.members.me;
  const chPerms = channel.permissionsFor(botMember);
  if (
    !chPerms ||
    !chPerms.has(PermissionFlagsBits.CreatePrivateThreads) ||
    !chPerms.has(PermissionFlagsBits.SendMessagesInThreads) ||
    !chPerms.has(PermissionFlagsBits.ManageThreads)
  ) {
    await interaction.editReply({
      content: '❌ Maiev needs **Create Private Threads**, **Send Messages in Threads**, and **Manage Threads** permissions in this channel. Please ask an Administrator to enable them!'
    });
    return;
  }

  // Check if user already has an open active thread in this channel
  try {
    const activeThreads = await channel.threads.fetchActive().catch(() => null);
    const trackedRecords = threadVerifyStore.findActiveThreadsForUser(member.id, channel.id);

    for (const rec of trackedRecords) {
      const liveThread =
        activeThreads?.threads?.get(rec.threadId) ||
        (await channel.threads.fetch(rec.threadId).catch(() => null));

      if (liveThread && !liveThread.archived && !liveThread.locked) {
        await liveThread.members.add(member.id).catch(() => null);
        const existingCase = rec.caseCode ? ` (**Case #${rec.caseCode}**)` : '';
        await interaction.editReply({
          content: `⚠️ You already have an open verification thread${existingCase} here: <#${liveThread.id}>\nPlease upload your screen recording inside that thread!`
        });
        return;
      }
    }
  } catch (_) {}

  // Allocate auto-incrementing Case Number (e.g. #0001) and create private thread
  const { caseNumber, caseCode } = threadVerifyStore.allocateNextCaseNumber();
  const rawName = member.displayName || member.user.username || 'member';
  const safeSlug = rawName
    .replace(/[^a-zA-Z0-9_-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 68) || member.id;
  const threadName = `verify-${caseCode}-${safeSlug}`;

  let thread;
  try {
    thread = await channel.threads.create({
      name: threadName,
      autoArchiveDuration: ThreadAutoArchiveDuration.OneWeek,
      type: ChannelType.PrivateThread,
      invitable: false,
      reason: `Case #${caseCode} private video verification requested by ${member.user.tag} (${member.id})`
    });
  } catch (createErr) {
    // Fallback to OneDay auto-archive if server rejects OneWeek
    try {
      thread = await channel.threads.create({
        name: threadName,
        autoArchiveDuration: ThreadAutoArchiveDuration.OneDay,
        type: ChannelType.PrivateThread,
        invitable: false,
        reason: `Case #${caseCode} private video verification requested by ${member.user.tag} (${member.id})`
      });
    } catch (fallbackErr) {
      console.error('[Video Verify] Failed to create private thread:', fallbackErr);
      await interaction.editReply({
        content: `❌ Could not create private thread: **${fallbackErr.message}**`
      });
      return;
    }
  }

  // Add the applicant directly to the private thread
  await thread.members.add(member.id).catch(() => null);

  await ensureGuildEmojisLoaded(guild);
  const validReviewerRoleIds = getValidReviewerRoleIds(guild, config);
  const reviewerMentionsText = formatReviewerMentions(guild, config);

  const controlPayload = createThreadControlPayload({
    guild,
    caseCode,
    userId: member.id,
    userTag: member.user.tag,
    displayName: member.displayName,
    parentChannelName: channel.name,
    reviewerMentionsText
  });

  // Mentioning applicant + Reviewer roles inside the message automatically adds those role members to the Private Thread
  const mentionHeader = validReviewerRoleIds.length > 0
    ? `<@${member.id}> • Reviewers: ${validReviewerRoleIds.map(id => `<@&${id}>`).join(' ')}`
    : `<@${member.id}>`;

  const controlMsg = await thread.send({
    content: mentionHeader,
    embeds: controlPayload.embeds,
    components: controlPayload.components,
    allowedMentions: {
      users: [member.id],
      roles: validReviewerRoleIds
    }
  });

  threadVerifyStore.saveThread(thread.id, {
    caseNumber,
    caseCode,
    userId: member.id,
    userTag: member.user.tag,
    displayName: member.displayName,
    channelId: channel.id,
    controlMessageId: controlMsg.id,
    status: 'pending',
    createdAt: new Date().toISOString()
  });

  console.log(`[Video Verify] 📹 Created Case #${caseCode} private thread #${thread.name} (${thread.id}) for ${member.user.tag}`);

  await interaction.editReply({
    content: `✅ Your private verification thread (**Case #${caseCode}**) has been created!\n👉 Click here to open it and upload your screen recording: <#${thread.id}>`
  });
}

/**
 * Prefix Button Handler ('btn_vthread_'):
 * Handles Approve, Request Re-upload, and Reject & Close clicks inside private threads.
 */
export async function handleReviewerActionButton(interaction) {
  const { guild, member, channel } = interaction;
  const config = configStore.get();

  if (!isAuthorizedReviewer(member, guild, config)) {
    await interaction.reply({
      content: '❌ **Access Denied:** Only Server Administrators or appointed Verification Reviewers can use these review buttons.',
      ephemeral: true
    });
    return;
  }

  const parts = interaction.customId.replace('btn_vthread_', '').split('_');
  const action = parts[0]; // 'approve' | 'reupload' | 'reject'
  const userId = parts[1];

  if (!action || !userId) return;

  // Option C — Re-upload or Reject opens a modal to prompt the reviewer for a reason
  if (action === 'reupload' || action === 'reject') {
    const modal = createReviewerReasonModal({
      mode: action,
      userId,
      controlMessageId: interaction.message.id
    });
    try {
      await interaction.showModal(modal);
    } catch (err) {
      console.error('[Video Verify] Error opening reason modal:', err);
      if (!interaction.replied && !interaction.deferred) {
        await interaction.reply({
          content: `⚠️ Could not open reason prompt: ${err.message}`,
          ephemeral: true
        }).catch(() => null);
      }
    }
    return;
  }

  // Option C — Approve immediately grants roles, updates card, notifies user, and locks + archives thread
  if (action === 'approve') {
    const botMember = guild.members.me;
    if (!botMember.permissions.has(PermissionFlagsBits.ManageRoles)) {
      await interaction.reply({
        content: '❌ Maiev lacks the **Manage Roles** permission in Server Settings > Roles.',
        ephemeral: true
      });
      return;
    }

    await interaction.deferUpdate();
    const caseCode = threadVerifyStore.resolveCaseCode(channel);

    const targetMember = await guild.members.fetch(userId).catch(() => null);
    if (!targetMember) {
      const leftPayload = createThreadControlPayload({
        guild,
        caseCode,
        userId,
        displayName: 'Former Member',
        parentChannelName: channel?.parent?.name || 'user-verify',
        reviewerMentionsText: formatReviewerMentions(guild, config),
        statusText: `⚠️ Applicant left the server (Closed by <@${member.id}>)`,
        embedColor: 0x95a5a6,
        disableButtons: true
      });
      await interaction.message.edit({
        embeds: leftPayload.embeds,
        components: leftPayload.components
      }).catch(() => null);

      threadVerifyStore.saveThread(channel.id, { status: 'closed_left', reviewedBy: member.id });
      if (channel?.isThread()) {
        await channel.setLocked(true, 'Applicant left the server').catch(() => null);
        await channel.setArchived(true, 'Applicant left the server').catch(() => null);
      }
      return;
    }

    // 1. Resolve Roles to ADD (Trusted / Verified)
    const rolesToAdd = [];
    const configuredAdd = Array.isArray(config.userVerifyRolesToAdd) ? config.userVerifyRolesToAdd : [];
    if (configuredAdd.length > 0) {
      for (const roleId of configuredAdd) {
        const r = await guild.roles.fetch(roleId).catch(() => null);
        if (r) rolesToAdd.push(r);
      }
    } else {
      const fallbackRole = await resolveRole(guild, '', ['Verified', 'Trusted', '[Verified]', '[Trusted]']);
      if (fallbackRole) rolesToAdd.push(fallbackRole);
    }

    const grantedNames = [];
    const hierarchyWarnings = [];
    for (const role of rolesToAdd) {
      if (botMember.roles.highest.position > role.position) {
        await targetMember.roles.add(role, `Video verification approved by ${member.user.tag}`);
        grantedNames.push(`@${role.name}`);
      } else {
        hierarchyWarnings.push(`@${role.name}`);
      }
    }

    // 2. Resolve Roles to REMOVE (e.g. Unverified)
    const rolesToRemove = [];
    const configuredRemove = Array.isArray(config.userVerifyRolesToRemove) ? config.userVerifyRolesToRemove : [];
    for (const roleId of configuredRemove) {
      const r = await guild.roles.fetch(roleId).catch(() => null);
      if (r) rolesToRemove.push(r);
    }

    const removedNames = [];
    for (const role of rolesToRemove) {
      if (targetMember.roles.cache.has(role.id) && botMember.roles.highest.position > role.position) {
        await targetMember.roles.remove(role, `Video verification approved by ${member.user.tag}`).catch(() => null);
        removedNames.push(`@${role.name}`);
      }
    }

    await ensureGuildEmojisLoaded(guild);

    // 3. Update Reviewer Control Card in-place with disabled buttons
    const approvedControl = createThreadControlPayload({
      guild,
      caseCode,
      userId: targetMember.id,
      userTag: targetMember.user.tag,
      displayName: targetMember.displayName,
      parentChannelName: channel?.parent?.name || 'user-verify',
      reviewerMentionsText: formatReviewerMentions(guild, config),
      statusText: `✅ Approved by <@${member.id}>`,
      embedColor: 0x2ecc71,
      disableButtons: true
    });

    await interaction.message.edit({
      embeds: approvedControl.embeds,
      components: approvedControl.components
    }).catch(() => null);

    // 4. Send celebratory confirmation message inside the thread BEFORE archiving
    const serverName = config.serverName || guild.name;
    const summaryLines = [
      `Congratulations <@${targetMember.id}>! Your screen recording verification (**Case #${caseCode}**) has been **approved** by <@${member.id}>.`
    ];
    if (grantedNames.length > 0) {
      summaryLines.push(`\n**Role(s) Granted:** ${grantedNames.map(n => `\`${n}\``).join(', ')}`);
    }
    if (removedNames.length > 0) {
      summaryLines.push(`**Role(s) Removed:** ${removedNames.map(n => `\`${n}\``).join(', ')}`);
    }
    if (hierarchyWarnings.length > 0) {
      summaryLines.push(`\n⚠️ *Note to Staff: Could not assign ${hierarchyWarnings.join(', ')} because it sits at or above Maiev's role in Server Settings > Roles.*`);
    }
    summaryLines.push('\n🔒 *This private verification thread is now complete and has been archived.*');

    const approvedEmbed = new EmbedBuilder()
      .setColor(0x2ecc71)
      .setTitle(`✅ Verification Complete — Case #${caseCode}`)
      .setDescription(summaryLines.join('\n'))
      .setFooter({ text: `${serverName} • Case #${caseCode} Verified` })
      .setTimestamp();

    await channel.send({
      content: `<@${targetMember.id}>`,
      embeds: [approvedEmbed],
      allowedMentions: { users: [targetMember.id] }
    }).catch(() => null);

    // 5. Polite DM notification (silent fallback if DMs disabled)
    await targetMember.send({
      embeds: [
        new EmbedBuilder()
          .setColor(0x2ecc71)
          .setTitle(`✅ You are now Verified in ${serverName}!`)
          .setDescription(
            `Your video verification (**Case #${caseCode}**) was approved by **${member.displayName}**.\n` +
            (grantedNames.length > 0 ? `**Granted Role(s):** ${grantedNames.join(', ')}` : 'Your trusted access is now unlocked!')
          )
          .setTimestamp()
      ]
    }).catch(() => null);

    threadVerifyStore.saveThread(channel.id, {
      status: 'approved',
      reviewedBy: member.id,
      reviewedByTag: member.user.tag
    });

    eventBus.emit('member:video_verified', {
      guild,
      member: targetMember,
      reviewer: member,
      grantedNames
    });

    console.log(`[Video Verify] ✅ ${targetMember.user.tag} approved by ${member.user.tag}. Granted: ${grantedNames.join(', ') || 'none'}`);

    // 6. Lock & Archive thread LAST so Discord does not re-open it
    if (channel?.isThread()) {
      await channel.setLocked(true, `Verification approved by ${member.user.tag}`).catch(() => null);
      await channel.setArchived(true, `Verification approved by ${member.user.tag}`).catch(() => null);
    }
  }
}

/**
 * Prefix Modal Submit Handler ('modal_vthread_'):
 * Processes reviewer reason submissions for "Request Re-upload" and "Reject & Close".
 */
export async function handleReviewerReasonModal(interaction) {
  const { guild, member, channel } = interaction;
  const config = configStore.get();

  if (!isAuthorizedReviewer(member, guild, config)) {
    await interaction.reply({
      content: '❌ **Access Denied:** Only Administrators or appointed Reviewers can submit review decisions.',
      ephemeral: true
    });
    return;
  }

  // Format: modal_vthread_<mode>_<userId>_<controlMessageId>
  const stripped = interaction.customId.replace('modal_vthread_', '');
  const [mode, userId, controlMessageId] = stripped.split('_');
  const reason = interaction.fields.getTextInputValue('input_vthread_reason').trim();

  if (!mode || !userId || !reason) return;

  await interaction.deferReply({ ephemeral: true });
  await ensureGuildEmojisLoaded(guild);

  const caseCode = threadVerifyStore.resolveCaseCode(channel);
  const targetMember = await guild.members.fetch(userId).catch(() => null);
  const displayName = targetMember?.displayName || 'Applicant';
  const userTag = targetMember?.user?.tag || userId;
  const serverName = config.serverName || guild.name;

  // Fetch the Reviewer Control Card message so we can update its status badge
  const controlMsg = controlMessageId && channel
    ? await channel.messages.fetch(controlMessageId).catch(() => null)
    : null;

  // CASE 1: Request Re-upload — Keep private thread OPEN and buttons ACTIVE!
  if (mode === 'reupload') {
    if (controlMsg) {
      const updatedControl = createThreadControlPayload({
        guild,
        caseCode,
        userId,
        userTag,
        displayName,
        parentChannelName: channel?.parent?.name || 'user-verify',
        reviewerMentionsText: formatReviewerMentions(guild, config),
        statusText: `🔄 Re-upload Requested by <@${member.id}>`,
        embedColor: 0xf39c12,
        disableButtons: false
      });
      await controlMsg.edit({
        embeds: updatedControl.embeds,
        components: updatedControl.components
      }).catch(() => null);
    }

    const reuploadEmbed = new EmbedBuilder()
      .setColor(0xf39c12)
      .setTitle(`🔄 Action Required (Case #${caseCode}) — Submit Updated Recording`)
      .setDescription(
        `Hello <@${userId}>, <@${member.id}> reviewed **Case #${caseCode}** and requested an adjustment before approving:\n\n` +
        `**Reviewer Note / Reason:**\n> ${reason.replace(/\n/g, '\n> ')}\n\n` +
        `📹 **What to do next:** Please upload your new recording or required details directly below in this thread!`
      )
      .setFooter({ text: `${serverName} • Case #${caseCode} remains open for your response` })
      .setTimestamp();

    await channel.send({
      content: `<@${userId}>`,
      embeds: [reuploadEmbed],
      allowedMentions: { users: [userId] }
    });

    threadVerifyStore.saveThread(channel.id, {
      status: 'reupload_requested',
      reviewedBy: member.id,
      lastReason: reason
    });

    console.log(`[Video Verify] 🔄 Case #${caseCode} re-upload requested for ${userTag} by ${member.user.tag}: "${reason}"`);

    await interaction.editReply({
      content: `✅ Re-upload request posted to **Case #${caseCode}**! This private thread remains **open** so the user can submit a new recording.`
    });
    return;
  }

  // CASE 2: Reject & Close — Post reason, DM user, disable buttons, then Lock & Archive thread!
  if (mode === 'reject') {
    if (controlMsg) {
      const rejectedControl = createThreadControlPayload({
        guild,
        caseCode,
        userId,
        userTag,
        displayName,
        parentChannelName: channel?.parent?.name || 'user-verify',
        reviewerMentionsText: formatReviewerMentions(guild, config),
        statusText: `❌ Rejected & Closed by <@${member.id}>`,
        embedColor: 0xe74c3c,
        disableButtons: true
      });
      await controlMsg.edit({
        embeds: rejectedControl.embeds,
        components: rejectedControl.components
      }).catch(() => null);
    }

    const rejectEmbed = new EmbedBuilder()
      .setColor(0xe74c3c)
      .setTitle(`❌ Verification Declined — Case #${caseCode}`)
      .setDescription(
        `Hello <@${userId}>, your verification submission (**Case #${caseCode}**) was declined by <@${member.id}>.\n\n` +
        `**Reason:**\n> ${reason.replace(/\n/g, '\n> ')}\n\n` +
        `🔒 *This private verification thread has been closed and archived. If you are ready to submit a valid recording later, you may open a new verification thread in <#${channel?.parentId || config.userVerifyChannelId}>.*`
      )
      .setFooter({ text: `${serverName} • Case #${caseCode} Closed` })
      .setTimestamp();

    await channel.send({
      content: `<@${userId}>`,
      embeds: [rejectEmbed],
      allowedMentions: { users: [userId] }
    }).catch(() => null);

    if (targetMember) {
      await targetMember.send({
        embeds: [
          new EmbedBuilder()
            .setColor(0xe74c3c)
            .setTitle(`❌ Verification Update (Case #${caseCode}) — ${serverName}`)
            .setDescription(
              `Your video verification submission (**Case #${caseCode}**) in **${serverName}** was declined by a reviewer.\n\n` +
              `**Reason:**\n> ${reason.replace(/\n/g, '\n> ')}`
            )
            .setTimestamp()
        ]
      }).catch(() => null);
    }

    threadVerifyStore.saveThread(channel.id, {
      status: 'rejected',
      reviewedBy: member.id,
      lastReason: reason
    });

    console.log(`[Video Verify] ❌ Rejected & closed Case #${caseCode} for ${userTag} by ${member.user.tag}: "${reason}"`);

    // Complete interaction reply BEFORE archiving the thread so Discord keeps it archived
    await interaction.editReply({
      content: '✅ Verification rejected and thread will now be locked & archived.'
    });

    if (channel?.isThread()) {
      await channel.setLocked(true, `Verification rejected by ${member.user.tag}`).catch(() => null);
      await channel.setArchived(true, `Verification rejected by ${member.user.tag}`).catch(() => null);
    }
  }
}

/**
 * Slash Command Handler: /post-user-verify
 */
export async function handlePostUserVerifyCommand(interaction) {
  await interaction.deferReply({ ephemeral: true });
  try {
    await ensureGuildEmojisLoaded(interaction.guild);
    const payload = createUserVerifyPanelPayload(interaction.guild);
    const sentMsg = await interaction.channel.send(payload);

    configStore.save({
      userVerifyChannelId: interaction.channelId,
      userVerifyMessageId: sentMsg.id
    });

    await interaction.editReply({
      content: '✅ Private Thread Video Verification panel posted successfully in this channel!'
    });
  } catch (err) {
    console.error('[Video Verify] Failed to post verification panel:', err);
    await interaction.editReply({
      content: `❌ Error posting verification panel: **${err.message}**`
    });
  }
}

/**
 * Express API: POST /api/upload-verify-video
 * Streams raw binary video file to public/uploads/ without external dependencies.
 */
export function handleUploadVerifyVideoApi(req, res) {
  try {
    const rawFileName = decodeURIComponent(req.headers['x-file-name'] || 'reference-video.mp4');
    const ext = path.extname(rawFileName).toLowerCase() || '.mp4';

    if (!ALLOWED_VIDEO_EXTS.has(ext)) {
      res.status(400).json({
        error: `Unsupported video format "${ext}". Please upload .mp4, .mov, .webm, or .m4v.`
      });
      req.resume();
      return;
    }

    const uploadsDir = path.join(ROOT_DIR, 'public', 'uploads');
    fs.mkdirSync(uploadsDir, { recursive: true });

    const baseSafe = path
      .basename(rawFileName, ext)
      .replace(/[^a-zA-Z0-9_-]/g, '-')
      .replace(/-+/g, '-')
      .slice(0, 40) || 'verify-reference';
    const finalFileName = `${baseSafe}-${Date.now()}${ext}`;
    const destPath = path.join(uploadsDir, finalFileName);

    let receivedBytes = 0;
    let aborted = false;
    const writeStream = fs.createWriteStream(destPath);

    req.on('data', (chunk) => {
      receivedBytes += chunk.length;
      if (receivedBytes > MAX_UPLOAD_BYTES && !aborted) {
        aborted = true;
        writeStream.destroy();
        fs.unlink(destPath, () => {});
        res.status(413).json({
          error: 'Video file exceeds 50 MB limit. Please compress the clip or use a Video URL.'
        });
        req.destroy();
      }
    });

    req.pipe(writeStream);

    writeStream.on('finish', () => {
      if (aborted) return;

      // Remove old uploaded reference file to save disk space
      const prevConfig = configStore.get();
      if (prevConfig.userVerifyUploadedVideo) {
        const oldDisk = resolveUploadedVideoDiskPath(prevConfig.userVerifyUploadedVideo);
        if (oldDisk && oldDisk !== destPath) {
          fs.unlink(oldDisk, () => {});
        }
      }

      const publicVideoPath = `/uploads/${finalFileName}`;
      configStore.save({ userVerifyUploadedVideo: publicVideoPath });

      console.log(`[Video Verify] 📤 Reference video uploaded: ${finalFileName} (${(receivedBytes / (1024 * 1024)).toFixed(2)} MB)`);
      res.json({
        success: true,
        videoPath: publicVideoPath,
        fileName: finalFileName,
        size: receivedBytes
      });
    });

    writeStream.on('error', (err) => {
      if (aborted) return;
      aborted = true;
      fs.unlink(destPath, () => {});
      res.status(500).json({ error: `Failed to write video file: ${err.message}` });
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

/**
 * Express API: DELETE /api/upload-verify-video
 */
export function handleDeleteVerifyVideoApi(req, res) {
  try {
    const config = configStore.get();
    if (config.userVerifyUploadedVideo) {
      const oldDisk = resolveUploadedVideoDiskPath(config.userVerifyUploadedVideo);
      if (oldDisk) {
        fs.unlink(oldDisk, () => {});
      }
    }
    configStore.save({ userVerifyUploadedVideo: '' });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

/**
 * Express API: POST /api/post-user-verify
 * Posts a fresh verification embed (with video!) or updates the existing card in-place.
 */
export async function handlePostUserVerifyApi(req, res, { client }) {
  try {
    const {
      channelId,
      forceNew = true,
      userVerifyTitle,
      userVerifyContent,
      userVerifyFooter,
      userVerifyButtonLabel,
      userVerifyVideoUrl,
      userVerifyThreadTitle,
      userVerifyThreadContent,
      userVerifyReviewerRoleIds,
      userVerifyRolesToAdd,
      userVerifyRolesToRemove
    } = req.body;

    const currentConfig = configStore.get();

    // Persist latest editor values before posting
    const savedConfig = configStore.save({
      userVerifyChannelId: channelId || currentConfig.userVerifyChannelId,
      ...(userVerifyTitle !== undefined ? { userVerifyTitle } : {}),
      ...(userVerifyContent !== undefined ? { userVerifyContent } : {}),
      ...(userVerifyFooter !== undefined ? { userVerifyFooter } : {}),
      ...(userVerifyButtonLabel !== undefined ? { userVerifyButtonLabel } : {}),
      ...(userVerifyVideoUrl !== undefined ? { userVerifyVideoUrl } : {}),
      ...(userVerifyThreadTitle !== undefined ? { userVerifyThreadTitle } : {}),
      ...(userVerifyThreadContent !== undefined ? { userVerifyThreadContent } : {}),
      ...(Array.isArray(userVerifyReviewerRoleIds) ? { userVerifyReviewerRoleIds } : {}),
      ...(Array.isArray(userVerifyRolesToAdd) ? { userVerifyRolesToAdd } : {}),
      ...(Array.isArray(userVerifyRolesToRemove) ? { userVerifyRolesToRemove } : {})
    });

    const guild = getActiveGuild(client);
    const targetChannelId = channelId || savedConfig.userVerifyChannelId;
    const channel = await guild?.channels.fetch(targetChannelId).catch(() => null);

    if (!channel || !channel.isTextBased() || channel.isThread()) {
      return res.status(400).json({
        error: 'Please select a valid standard text channel (e.g. #user-verify) and ensure Maiev is online.'
      });
    }

    await ensureGuildEmojisLoaded(guild);
    const payload = createUserVerifyPanelPayload(guild);

    let targetMsg = null;
    let wasUpdated = false;

    if (!forceNew && savedConfig.userVerifyMessageId) {
      targetMsg = await channel.messages.fetch(savedConfig.userVerifyMessageId).catch(() => null);
    }

    if (targetMsg) {
      await targetMsg.edit(payload);
      wasUpdated = true;
    } else {
      targetMsg = await channel.send(payload);
      configStore.save({
        userVerifyChannelId: channel.id,
        userVerifyMessageId: targetMsg.id
      });
    }

    res.json({
      success: true,
      updated: wasUpdated,
      posted: !wasUpdated,
      messageId: targetMsg.id,
      channelName: channel.name
    });
  } catch (err) {
    console.error('[Video Verify] Error in /api/post-user-verify:', err);
    res.status(500).json({ error: err.message });
  }
}

