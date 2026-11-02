import { PermissionFlagsBits } from 'discord.js';
import { configStore } from '../../core/storage/config-store.js';
import { resolveRole, getActiveGuild } from '../../shared/discord-resolvers.js';
import {
  findNationalityByEmoji,
  extractFlagIsoCode,
  ensureGuildEmojisLoaded
} from '../../shared/emoji-utils.js';
import {
  trackUserReaction,
  untrackUserReaction,
  cleanupUserReactionsOnLeave,
  purgeGhostReactions
} from './reaction.tracker.js';
import {
  createNationalityMessage,
  reactToNationalityCard
} from './reaction.embed.js';

export async function handleNationalityButton(interaction) {
  const { guild, member } = interaction;
  const config = configStore.get();
  const code = interaction.customId.replace('btn_nat_', '');
  const natConfig = (config.nationalityRoles || []).find(n => n.code.toLowerCase() === code.toLowerCase());
  if (!natConfig) {
    await interaction.reply({ content: '⚠️ Nationality option not found.', ephemeral: true });
    return;
  }

  const targetRole = await resolveRole(guild, natConfig.roleId, [
    natConfig.name,
    `${natConfig.emoji} ${natConfig.name}`,
    natConfig.code.toUpperCase()
  ]);
  if (!targetRole) {
    await interaction.reply({
      content: `⚠️ The role for ${natConfig.emoji} **${natConfig.name}** hasn't been configured in the Web Dashboard yet. Please ask an admin to link this role!`,
      ephemeral: true
    });
    return;
  }

  const botMember = guild.members.me;
  if (!botMember.permissions.has(PermissionFlagsBits.ManageRoles) || botMember.roles.highest.position <= targetRole.position) {
    await interaction.reply({
      content: `⚠️ Maiev lacks permission or hierarchy to assign **@${targetRole.name}**. Ensure Maiev's role is higher in Server Settings > Roles!`,
      ephemeral: true
    });
    return;
  }

  if (member.roles.cache.has(targetRole.id)) {
    await member.roles.remove(targetRole, 'Nationality reaction role toggled off');
    await interaction.reply({
      content: `❌ Removed role **@${targetRole.name}** (${natConfig.emoji}).`,
      ephemeral: true
    });
  } else {
    await member.roles.add(targetRole, 'Nationality reaction role assigned');
    await interaction.reply({
      content: `✅ You received **@${targetRole.name}** ${natConfig.emoji} **${natConfig.name}**! Access to your nationality channel is now unlocked.`,
      ephemeral: true
    });
  }
}

export async function handlePostNationalityCommand(interaction, { client }) {
  try {
    if (!interaction.deferred && !interaction.replied) {
      await interaction.deferReply({ ephemeral: true }).catch(() => null);
    }

    const config = configStore.get();
    const forceNew = interaction.options.getBoolean('force_new') || false;
    await ensureGuildEmojisLoaded(interaction.guild);
    const payload = createNationalityMessage(interaction.guild);

    let targetMsg = null;

    if (!forceNew) {
      if (Array.isArray(config.nationalityMessageIds) && config.nationalityMessageIds.length > 0) {
        for (const item of config.nationalityMessageIds) {
          const msgId = typeof item === 'object' && item?.messageId ? item.messageId : item;
          const chId = typeof item === 'object' && item?.channelId ? item.channelId : null;
          if (!chId || chId === interaction.channelId) {
            try {
              const fetched = await interaction.channel.messages.fetch(msgId);
              if (fetched && fetched.author?.id === client.user?.id) {
                targetMsg = fetched;
                break;
              }
            } catch (_) {}
          }
        }
      }

      if (!targetMsg) {
        try {
          const recent = await interaction.channel.messages.fetch({ limit: 25 });
          targetMsg = recent.find(m =>
            m.author?.id === client.user?.id && (
              m.embeds?.some(e => e.title && /nationality|regional|choose your/i.test(e.title)) ||
              m.components?.some(row => row.components?.some(c => c.customId && c.customId.startsWith('btn_nat_')))
            )
          );
        } catch (_) {}
      }
    }

    let wasUpdated = false;
    if (targetMsg) {
      await targetMsg.edit({ embeds: payload.embeds, components: [] });
      wasUpdated = true;
    } else {
      targetMsg = await interaction.channel.send(payload);
    }

    const nationalityMessageIds = Array.isArray(config.nationalityMessageIds) ? [...config.nationalityMessageIds] : [];
    const alreadyTracked = nationalityMessageIds.some(item => (typeof item === 'object' ? item.messageId : item) === targetMsg.id);
    if (!alreadyTracked) {
      nationalityMessageIds.push({ messageId: targetMsg.id, channelId: interaction.channelId });
      configStore.save({ nationalityMessageIds });
    }

    await reactToNationalityCard(targetMsg);

    const responseText = wasUpdated
      ? '✅ Existing nationality card updated in-place! **All previous user reactions and roles are preserved**, old text buttons were removed, and any new flag emojis were added.'
      : '✅ Nationality role card posted successfully! Flag emoji reactions are now active in this channel.';

    if (interaction.deferred || interaction.replied) {
      await interaction.editReply({ content: responseText }).catch(() => null);
    } else {
      await interaction.reply({ content: responseText, ephemeral: true }).catch(() => null);
    }
  } catch (sendErr) {
    console.error('Error executing /post-nationality:', sendErr);
    if (interaction.deferred || interaction.replied) {
      await interaction.editReply({ content: `❌ Error: **${sendErr.message}**.` }).catch(() => null);
    }
  }
}

export async function handleAddFlagRoleCommand(interaction, { client }) {
  await interaction.deferReply({ ephemeral: true });
  const config = configStore.get();
  const emoji = interaction.options.getString('flag').trim();
  const targetRole = interaction.options.getRole('role');
  const country = interaction.options.getString('country')?.trim() || targetRole.name.replace(/[[\]]/g, '').trim();
  const rawInputCode = (interaction.options.getString('short_code') || interaction.options.getString('code'))?.trim();
  const autoIso = extractFlagIsoCode(emoji);
  const code = (
    rawInputCode ||
    autoIso ||
    (country.length <= 4 ? country : targetRole.name.replace(/[[\]]/g, '').trim().length <= 4 ? targetRole.name.replace(/[[\]]/g, '').trim() : country.slice(0, 5))
  ).toLowerCase().replace(/[^a-z0-9]/g, '') || 'role';

  const nationalityRoles = Array.isArray(config.nationalityRoles) ? [...config.nationalityRoles] : [];

  const existingIndex = nationalityRoles.findIndex(n =>
    n.emoji === emoji ||
    n.roleId === targetRole.id ||
    (n.code && n.code.toLowerCase() === code)
  );

  if (existingIndex >= 0) {
    nationalityRoles[existingIndex] = {
      ...nationalityRoles[existingIndex],
      emoji,
      name: country,
      code,
      roleId: targetRole.id
    };
  } else {
    nationalityRoles.push({
      code,
      name: country,
      emoji,
      roleId: targetRole.id
    });
  }

  configStore.save({ nationalityRoles });

  let cardUpdated = false;
  try {
    if (interaction.channel) {
      const recent = await interaction.channel.messages.fetch({ limit: 25 }).catch(() => null);
      const activeMsg = recent?.find(m =>
        m.author?.id === client.user?.id && (
          config.nationalityMessageIds?.includes(m.id) ||
          m.embeds?.some(e => e.title && /nationality|regional|choose your/i.test(e.title))
        )
      );
      if (activeMsg) {
        const updatedPayload = createNationalityMessage(interaction.guild);
        await activeMsg.edit({ embeds: updatedPayload.embeds, components: [] }).catch(() => null);
        await reactToNationalityCard(activeMsg);
        cardUpdated = true;
      }
    }
  } catch (_) {}

  const updateNote = cardUpdated
    ? `\n\n• The nationality card in this channel was **automatically updated** and reacted with ${emoji} (all previous reactions preserved)!`
    : `\n\n• Run \`/post-nationality\` to post or update the card in this channel.`;

  await interaction.editReply({
    content: `✅ Successfully linked ${emoji} **${country}** (\`${code.toUpperCase()}\`) to role **@${targetRole.name}**!${updateNote}`
  });
}

export async function handleRemoveFlagRoleCommand(interaction, { client }) {
  await interaction.deferReply({ ephemeral: true });
  const config = configStore.get();
  const query = interaction.options.getString('flag').trim().toLowerCase();
  const currentRoles = Array.isArray(config.nationalityRoles) ? [...config.nationalityRoles] : [];

  const filteredRoles = currentRoles.filter(n =>
    n.emoji !== query &&
    n.code.toLowerCase() !== query &&
    n.name.toLowerCase() !== query
  );

  if (filteredRoles.length < currentRoles.length) {
    configStore.save({ nationalityRoles: filteredRoles });

    try {
      if (interaction.channel) {
        const recent = await interaction.channel.messages.fetch({ limit: 25 }).catch(() => null);
        const activeMsg = recent?.find(m =>
          m.author?.id === client.user?.id && (
            config.nationalityMessageIds?.includes(m.id) ||
            m.embeds?.some(e => e.title && /nationality|regional|choose your/i.test(e.title))
          )
        );
        if (activeMsg) {
          const updatedPayload = createNationalityMessage(interaction.guild);
          await activeMsg.edit({ embeds: updatedPayload.embeds, components: [] }).catch(() => null);
        }
      }
    } catch (_) {}

    await interaction.editReply({ content: `✅ Removed flag option \`${query}\`. The nationality card has been updated.` });
  } else {
    await interaction.editReply({ content: `⚠️ Could not find a configured flag matching \`${query}\`.` });
  }
}

export async function handleCleanReactionsCommand(interaction, { client }) {
  await interaction.deferReply({ ephemeral: true });
  const targetChannel = interaction.options.getChannel('channel');
  const { guild } = interaction;

  const botMember = guild.members.me;
  if (!botMember.permissions.has(PermissionFlagsBits.ManageMessages)) {
    await interaction.editReply({
      content: '⚠️ **Missing Permission:** Maiev needs the **Manage Messages** permission to remove reactions of former members. Please grant **Manage Messages** in Server Settings or Channel Permissions.'
    });
    return;
  }

  const result = await purgeGhostReactions(client, guild, targetChannel);

  if (result.totalPurged === 0) {
    await interaction.editReply({
      content: `✨ **All clean!** Inspected ${result.messagesInspected} message(s) and found 0 ghost reactions from former members.`
    });
  } else {
    const memberList = result.purgedMembers.slice(0, 5).map(m => `• **${m.tag}** (${m.count} reaction${m.count > 1 ? 's' : ''})`).join('\n');
    const moreText = result.purgedMembers.length > 5 ? `\n...and ${result.purgedMembers.length - 5} more.` : '';

    await interaction.editReply({
      content: `🧹 **Reaction Purge Complete!**\n\nRemoved **${result.totalPurged}** ghost reaction(s) across **${result.messagesInspected}** message(s) from **${result.purgedMembers.length}** former member(s) who left the server:\n\n${memberList}${moreText}`
    });
  }
}

export async function handleMessageCreate(message, client) {
  try {
    if (message.author?.id !== client.user?.id) return;
    const isNationalityCard = message.embeds?.some(e => e.title && /nationality|regional|choose your/i.test(e.title));
    if (isNationalityCard) {
      const config = configStore.get();
      const nationalityMessageIds = Array.isArray(config.nationalityMessageIds) ? [...config.nationalityMessageIds] : [];
      const alreadyTracked = nationalityMessageIds.some(item => (typeof item === 'object' ? item.messageId : item) === message.id);
      if (!alreadyTracked) {
        nationalityMessageIds.push({ messageId: message.id, channelId: message.channelId });
        configStore.save({ nationalityMessageIds });
      }
      await reactToNationalityCard(message);
    }
  } catch (err) {
    console.error('Error auto-reacting on messageCreate:', err);
  }
}

export async function handleReactionAdd(reaction, user, client) {
  try {
    if (user.bot) return;

    if (reaction.partial) {
      try {
        await reaction.fetch();
      } catch (_) {
        return;
      }
    }

    if (reaction.message.partial) {
      try {
        await reaction.message.fetch();
      } catch (_) {
        return;
      }
    }

    const { message, emoji } = reaction;
    const guild = message.guild;
    if (!guild) return;

    trackUserReaction(guild.id, user.id, message.channelId, message.id, emoji.identifier || emoji.name);

    const config = configStore.get();
    const isReactionMessage =
      (Array.isArray(config.nationalityMessageIds) && config.nationalityMessageIds.some(item => (typeof item === 'object' ? item.messageId : item) === message.id)) ||
      (message.author?.id === client.user?.id && (
        message.embeds?.some(e => e.title && /nationality|regional|choose your|reaction role|roles|assign your role/i.test(e.title)) ||
        message.components?.some(row => row.components?.some(c => c.customId && c.customId.startsWith('btn_nat_')))
      ));

    if (!isReactionMessage) return;

    const nationalityMessageIds = Array.isArray(config.nationalityMessageIds) ? [...config.nationalityMessageIds] : [];
    const alreadyTracked = nationalityMessageIds.some(item => (typeof item === 'object' ? item.messageId : item) === message.id);
    if (!alreadyTracked) {
      nationalityMessageIds.push({ messageId: message.id, channelId: message.channelId });
      configStore.save({ nationalityMessageIds });
    }

    const natConfig = findNationalityByEmoji(emoji, config.nationalityRoles);
    if (!natConfig) return;

    const targetRole = await resolveRole(guild, natConfig.roleId, [
      natConfig.name,
      `${natConfig.emoji} ${natConfig.name}`,
      natConfig.code ? natConfig.code.toUpperCase() : ''
    ]);
    if (!targetRole) {
      console.warn(`[Reaction Role] Role for ${natConfig.name} not found in guild.`);
      return;
    }

    const member = await guild.members.fetch(user.id).catch(() => null);
    if (!member) return;

    const botMember = guild.members.me;
    if (!botMember.permissions.has(PermissionFlagsBits.ManageRoles) || botMember.roles.highest.position <= targetRole.position) {
      console.warn(`[Reaction Role] Bot cannot assign role @${targetRole.name} (permissions or hierarchy).`);
      return;
    }

    const intent = (natConfig.intent || config.reactionRoleIntent || 'toggle').toLowerCase();

    if (intent === 'remove_only') {
      if (member.roles.cache.has(targetRole.id)) {
        await member.roles.remove(targetRole, `Reaction role (remove-only): ${emoji.name}`);
        console.log(`[Reaction Role] Removed role @${targetRole.name} from ${member.user.tag} (remove-only)`);
      }
      return;
    }

    if (intent === 'unique') {
      const targetCategory = natConfig.category || natConfig.group || null;
      const otherRoleIds = (config.nationalityRoles || [])
        .filter(n => n && n.roleId && n.roleId !== targetRole.id && (!targetCategory || n.category === targetCategory || n.group === targetCategory))
        .map(n => n.roleId);
      for (const otherId of otherRoleIds) {
        if (member.roles.cache.has(otherId)) {
          await member.roles.remove(otherId, `Reaction role unique switch in ${targetCategory || 'group'} to @${targetRole.name}`).catch(() => null);
        }
      }
    }

    if (!member.roles.cache.has(targetRole.id)) {
      await member.roles.add(targetRole, `Reaction role (${intent}): ${emoji.name}`);
      console.log(`[Reaction Role] Added role @${targetRole.name} to ${member.user.tag} (intent: ${intent})`);
    }
  } catch (err) {
    console.error('[Reaction Role] Error handling messageReactionAdd:', err);
  }
}

export async function handleReactionRemove(reaction, user, client) {
  try {
    if (user.bot) return;

    if (reaction.partial) {
      try {
        await reaction.fetch();
      } catch (_) {
        return;
      }
    }

    if (reaction.message.partial) {
      try {
        await reaction.message.fetch();
      } catch (_) {
        return;
      }
    }

    const { message, emoji } = reaction;
    const guild = message.guild;
    if (!guild) return;

    untrackUserReaction(guild.id, user.id, message.channelId, message.id, emoji.identifier || emoji.name);

    const config = configStore.get();
    const isReactionMessage =
      (Array.isArray(config.nationalityMessageIds) && config.nationalityMessageIds.some(item => (typeof item === 'object' ? item.messageId : item) === message.id)) ||
      (message.author?.id === client.user?.id && (
        message.embeds?.some(e => e.title && /nationality|regional|choose your|reaction role|roles|assign your role/i.test(e.title)) ||
        message.components?.some(row => row.components?.some(c => c.customId && c.customId.startsWith('btn_nat_')))
      ));

    if (!isReactionMessage) return;

    const natConfig = findNationalityByEmoji(emoji, config.nationalityRoles);
    if (!natConfig) return;

    const intent = (natConfig.intent || config.reactionRoleIntent || 'toggle').toLowerCase();
    if (intent === 'give_only' || intent === 'remove_only') return;

    const targetRole = await resolveRole(guild, natConfig.roleId, [
      natConfig.name,
      `${natConfig.emoji} ${natConfig.name}`,
      natConfig.code ? natConfig.code.toUpperCase() : ''
    ]);
    if (!targetRole) return;

    const member = await guild.members.fetch(user.id).catch(() => null);
    if (!member) return;

    const botMember = guild.members.me;
    if (!botMember.permissions.has(PermissionFlagsBits.ManageRoles) || botMember.roles.highest.position <= targetRole.position) {
      return;
    }

    if (member.roles.cache.has(targetRole.id)) {
      await member.roles.remove(targetRole, `Reaction role removed: ${emoji.name}`);
      console.log(`[Reaction Role] Removed role @${targetRole.name} from ${member.user.tag} (unreacted ${emoji.name})`);
    }
  } catch (err) {
    console.error('[Reaction Role] Error handling messageReactionRemove:', err);
  }
}

export async function handleMemberLeave(member, client) {
  try {
    const guild = member.guild;
    if (!guild) return;
    const userId = member.id;
    const userTag = member.user?.tag || member.user?.username || userId;

    console.log(`[Member Leave] 🚪 ${userTag} (${userId}) has left ${guild.name}. Cleaning up their reactions and cache...`);
    const result = await cleanupUserReactionsOnLeave(client, guild, userId, userTag);
    console.log(`[Member Leave] ✅ Cleaned up ${result.removedCount} reaction(s) across ${result.messagesScanned} message(s) for ${userTag}.`);

    guild.members.cache.delete(userId);
  } catch (err) {
    console.error('[Member Leave] Error handling guildMemberRemove:', err);
  }
}

export function handleSaveReactionRolesApi(req, res) {
  try {
    const roles = req.body.reactionRoles || req.body.nationalityRoles;
    if (!Array.isArray(roles)) {
      return res.status(400).json({ error: 'Roles must be an array' });
    }
    const updates = { nationalityRoles: roles };
    if (req.body.intent) {
      updates.reactionRoleIntent = req.body.intent;
    }
    if (req.body.reactionPresets !== undefined) {
      updates.reactionPresets = req.body.reactionPresets;
    }
    const updated = configStore.save(updates);
    res.json({ success: true, count: updated.nationalityRoles.length });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

export async function handlePostReactionRolesApi(req, res, { client }) {
  try {
    const {
      channelId,
      presetId,
      messageId,
      nationalityRoles,
      reactionRoles,
      roles,
      nationalityTitle,
      reactionTitle,
      nationalityContent,
      reactionContent,
      nationalityFooter,
      reactionFooter,
      intent,
      forceNew = true
    } = req.body;

    const config = configStore.get();
    const guild = getActiveGuild(client);
    const channel = await guild?.channels.fetch(channelId).catch(() => null);
    if (!channel || !channel.isTextBased()) {
      return res.status(400).json({ error: 'Invalid or non-text channel specified' });
    }

    const rolesToPost = roles || reactionRoles || nationalityRoles || [];
    const finalTitle = reactionTitle !== undefined ? reactionTitle : (nationalityTitle || config.nationalityTitle);
    const finalContent = reactionContent !== undefined ? reactionContent : (nationalityContent || config.nationalityContent);
    const finalFooter = reactionFooter !== undefined ? reactionFooter : (nationalityFooter || config.nationalityFooter);

    await ensureGuildEmojisLoaded(guild);
    const payload = createNationalityMessage(guild, {
      roles: rolesToPost,
      title: finalTitle,
      content: finalContent,
      footer: finalFooter
    });

    let targetMsg = null;
    let wasUpdated = false;

    if (!forceNew) {
      if (messageId) {
        targetMsg = await channel.messages.fetch(messageId).catch(() => null);
      }

      if (!targetMsg && presetId && config.reactionPresets?.[presetId]?.messageId) {
        targetMsg = await channel.messages.fetch(config.reactionPresets[presetId].messageId).catch(() => null);
      }

      if (!targetMsg && Array.isArray(config.nationalityMessageIds) && config.nationalityMessageIds.length > 0) {
        for (const item of config.nationalityMessageIds) {
          const mId = typeof item === 'object' && item?.messageId ? item.messageId : item;
          const chId = typeof item === 'object' && item?.channelId ? item.channelId : null;
          const pId = typeof item === 'object' && item?.presetId ? item.presetId : null;
          if ((!chId || chId === channel.id) && (!presetId || !pId || pId === presetId)) {
            const m = await channel.messages.fetch(mId).catch(() => null);
            if (m && m.author?.id === client.user?.id) {
              targetMsg = m;
              break;
            }
          }
        }
      }
    }

    if (targetMsg) {
      await targetMsg.edit({ embeds: payload.embeds, components: [] });
      wasUpdated = true;
    } else {
      targetMsg = await channel.send(payload);
    }

    const nationalityMessageIds = Array.isArray(config.nationalityMessageIds) ? [...config.nationalityMessageIds] : [];
    const existingTrackingIdx = nationalityMessageIds.findIndex(item => (typeof item === 'object' ? item.messageId : item) === targetMsg.id);
    if (existingTrackingIdx !== -1) {
      nationalityMessageIds[existingTrackingIdx] = { messageId: targetMsg.id, channelId: channel.id, presetId: presetId || null };
    } else {
      nationalityMessageIds.push({ messageId: targetMsg.id, channelId: channel.id, presetId: presetId || null });
    }

    const reactionPresets = config.reactionPresets ? { ...config.reactionPresets } : {};
    if (presetId) {
      reactionPresets[presetId] = {
        ...(reactionPresets[presetId] || {}),
        messageId: targetMsg.id,
        channelId: channel.id,
        title: finalTitle,
        content: finalContent,
        footer: finalFooter,
        roles: rolesToPost,
        ...(intent ? { intent } : {})
      };
    }

    const currentGlobalRoles = Array.isArray(config.nationalityRoles) ? [...config.nationalityRoles] : [];
    rolesToPost.forEach(r => {
      const existingIdx = currentGlobalRoles.findIndex(e => e && ((e.code && e.code === r.code) || (e.name && e.name === r.name)));
      if (existingIdx !== -1) {
        currentGlobalRoles[existingIdx] = { ...currentGlobalRoles[existingIdx], ...r };
      } else {
        currentGlobalRoles.push(r);
      }
    });

    configStore.save({
      nationalityMessageIds,
      reactionPresets,
      nationalityRoles: currentGlobalRoles,
      ...(intent ? { reactionRoleIntent: intent } : {})
    });

    await reactToNationalityCard(targetMsg, rolesToPost);

    res.json({
      success: true,
      updated: wasUpdated,
      posted: !wasUpdated,
      messageId: targetMsg.id,
      channelName: channel.name
    });
  } catch (err) {
    console.error('Error in /api/post-nationality-roles:', err);
    res.status(500).json({ error: err.message });
  }
}

export async function handleCleanReactionsApi(req, res, { client }) {
  try {
    const guild = getActiveGuild(client);
    if (!guild) return res.status(404).json({ error: 'Guild not found' });
    const result = await purgeGhostReactions(client, guild);
    res.json({ success: true, ...result });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

