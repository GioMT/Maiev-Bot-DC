import { PermissionFlagsBits } from 'discord.js';
import { configStore } from '../../core/storage/config-store.js';
import { eventBus } from '../../core/event-bus.js';
import {
  resolveRole,
  getActiveGuild,
  diagnoseChannelPermissions,
  formatChannelPermissionError,
  findBotCardMessage
} from '../../shared/discord-resolvers.js';
import {
  createVerifyMessage,
  createVerifyModal,
  createWelcomePopupEmbed
} from './verify.embed.js';
import { ensureGuildEmojisLoaded } from '../../shared/emoji-utils.js';

export async function handleOpenIgnModalButton(interaction) {
  const modal = createVerifyModal();
  try {
    await interaction.showModal(modal);
  } catch (modalErr) {
    console.error('Failed to show modal:', modalErr);
    if (!interaction.replied && !interaction.deferred) {
      await interaction.reply({
        content: `⚠️ Failed to open verification modal: ${modalErr.message}`,
        ephemeral: true
      }).catch(() => null);
    }
  }
}

export async function handleVerifyModalSubmit(interaction) {
  const { guild, member } = interaction;
  const ign = interaction.fields.getTextInputValue('input_aion_ign').trim();
  const botMember = guild.members.me;

  if (!botMember.permissions.has(PermissionFlagsBits.ManageNicknames)) {
    await interaction.reply({ content: '❌ Maiev lacks the **Manage Nicknames** permission.', ephemeral: true });
    return;
  }
  if (!botMember.permissions.has(PermissionFlagsBits.ManageRoles)) {
    await interaction.reply({ content: '❌ Maiev lacks the **Manage Roles** permission.', ephemeral: true });
    return;
  }
  if (guild.ownerId === member.id) {
    await interaction.reply({ content: '⚠️ Discord prevents bots from changing the Server Owner nickname.', ephemeral: true });
    return;
  }
  if (member.roles.highest.position >= botMember.roles.highest.position) {
    await interaction.reply({ content: '⚠️ Maiev\'s role must sit **above** your highest role in Server Settings > Roles.', ephemeral: true });
    return;
  }

  await member.setNickname(ign, 'AION 2 IGN Registration via Maiev');

  const config = configStore.get();

  // Resolve roles to ADD
  const rolesToAdd = [];
  if (config.ignRolesToAdd && config.ignRolesToAdd.length > 0) {
    for (const roleId of config.ignRolesToAdd) {
      const r = await guild.roles.fetch(roleId).catch(() => null);
      if (r) rolesToAdd.push(r);
    }
  } else {
    const unverified = await resolveRole(guild, '', ['Unverified']);
    const fregion = await resolveRole(guild, '', ['Elyos Fregion', 'Fregion']);
    if (unverified) rolesToAdd.push(unverified);
    if (fregion) rolesToAdd.push(fregion);
  }

  const addedNames = [];
  for (const role of rolesToAdd) {
    if (botMember.roles.highest.position > role.position) {
      await member.roles.add(role, 'AION 2 IGN registered');
      addedNames.push(`@${role.name}`);
    }
  }

  // Resolve roles to REMOVE
  const rolesToRemove = [];
  if (config.ignRolesToRemove && config.ignRolesToRemove.length > 0) {
    for (const roleId of config.ignRolesToRemove) {
      const r = await guild.roles.fetch(roleId).catch(() => null);
      if (r) rolesToRemove.push(r);
    }
  } else {
    const onboarded = await resolveRole(guild, config.onboardedRoleId, [
      'Compliant',
      '[Compliant]',
      'Onboarded',
      'Rules Acknowledged'
    ]);
    if (onboarded) rolesToRemove.push(onboarded);
  }

  for (const role of rolesToRemove) {
    if (member.roles.cache.has(role.id) && botMember.roles.highest.position > role.position) {
      await member.roles.remove(role, 'AION 2 IGN set; removing onboarding role').catch(() => null);
    }
  }

  const rolesText = addedNames.length > 0 ? addedNames.join(' and ') : 'your verified roles';
  await ensureGuildEmojisLoaded(guild);
  const welcomeEmbed = createWelcomePopupEmbed({ guild, member, ign, rolesText });

  await interaction.reply({
    embeds: [welcomeEmbed],
    ephemeral: true
  });

  console.log(`[Verification] ${member.user.tag} set IGN to "${ign}". Granted: ${addedNames.join(', ')}`);

  // Notify decoupled listeners (e.g. Public Welcome Announcement plugin)
  eventBus.emit('member:verified', { guild, member, ign, rolesText });
}

export async function handlePostVerifyCommand(interaction) {
  await interaction.deferReply({ ephemeral: true });
  try {
    await ensureGuildEmojisLoaded(interaction.guild);
    const payload = createVerifyMessage(interaction.guild);
    const sentMsg = await interaction.channel.send(payload);
    configStore.save({
      verifyChannelId: interaction.channelId,
      verifyMessageId: sentMsg.id
    });
    await interaction.editReply({ content: '✅ Maiev AION 2 verification card posted successfully!' });
  } catch (sendErr) {
    await interaction.editReply({ content: `❌ Error: **${sendErr.message}**.` });
  }
}

export async function handleConfigureVerificationCommand(interaction) {
  const onboardedRole = interaction.options.getRole('onboarded_role');
  const unverifiedRole = interaction.options.getRole('unverified_role');
  const fregionRole = interaction.options.getRole('elyos_fregion_role');
  const verifyChannel = interaction.options.getChannel('verify_channel');

  const config = configStore.get();
  const ignRolesToAdd = [...(config.ignRolesToAdd || [])];

  if (unverifiedRole && !ignRolesToAdd.includes(unverifiedRole.id)) ignRolesToAdd.push(unverifiedRole.id);
  if (fregionRole && !ignRolesToAdd.includes(fregionRole.id)) ignRolesToAdd.push(fregionRole.id);

  configStore.save({
    onboardedRoleId: onboardedRole ? onboardedRole.id : config.onboardedRoleId,
    ignRolesToAdd,
    verifyChannelId: verifyChannel ? verifyChannel.id : config.verifyChannelId
  });

  await interaction.reply({ content: '⚙️ **Pipeline Configuration Updated & Saved!**', ephemeral: true });
}

export async function handleSetNicknameCommand(interaction) {
  const { guild, member } = interaction;
  const directNickname = interaction.options.getString('nickname');
  const botMember = guild.members.me;

  if (directNickname) {
    if (!botMember.permissions.has(PermissionFlagsBits.ManageNicknames)) {
      await interaction.reply({ content: '❌ Bot lacks Manage Nicknames permission.', ephemeral: true });
      return;
    }
    if (guild.ownerId === member.id) {
      await interaction.reply({ content: '⚠️ Bots cannot change Server Owner nickname.', ephemeral: true });
      return;
    }
    if (member.roles.highest.position >= botMember.roles.highest.position) {
      await interaction.reply({ content: '⚠️ Bot role must be higher than your role in Server Settings.', ephemeral: true });
      return;
    }
    await member.setNickname(directNickname, 'Changed via /setnickname');
    await interaction.reply({ content: `✅ Nickname changed to **${directNickname}**!`, ephemeral: true });
  } else {
    const modal = createVerifyModal('Desired AION 2 In-Game Name', 'Enter your character name');
    try {
      await interaction.showModal(modal);
    } catch (modalErr) {
      console.error('Failed to show modal:', modalErr);
      if (!interaction.replied && !interaction.deferred) {
        await interaction.reply({
          content: `⚠️ Failed to open modal: ${modalErr.message}`,
          ephemeral: true
        }).catch(() => null);
      }
    }
  }
}

export async function handlePostVerifyApi(req, res, { client }) {
  let channel = null;
  const requiredPerms = [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.EmbedLinks];
  try {
    const {
      channelId,
      forceNew = true,
      verifyTitle,
      verifyContent,
      verifyFooter,
      welcomeTitle,
      welcomeContent,
      welcomeFooter
    } = req.body;

    const currentConfig = configStore.get();
    const savedConfig = configStore.save({
      verifyChannelId: channelId || currentConfig.verifyChannelId,
      ...(verifyTitle !== undefined ? { verifyTitle } : {}),
      ...(verifyContent !== undefined ? { verifyContent } : {}),
      ...(verifyFooter !== undefined ? { verifyFooter } : {}),
      ...(welcomeTitle !== undefined ? { welcomeTitle } : {}),
      ...(welcomeContent !== undefined ? { welcomeContent } : {}),
      ...(welcomeFooter !== undefined ? { welcomeFooter } : {})
    });

    const guild = getActiveGuild(client);
    const targetChannelId = channelId || savedConfig.verifyChannelId;
    channel = await guild?.channels.fetch(targetChannelId).catch(() => null);
    if (!channel || !channel.isTextBased()) {
      return res.status(400).json({ error: 'Invalid or non-text channel specified' });
    }

    await ensureGuildEmojisLoaded(guild);
    const payload = createVerifyMessage(guild);

    let targetMsg = null;
    let wasUpdated = false;

    if (!forceNew) {
      targetMsg = await findBotCardMessage(
        channel,
        savedConfig.verifyMessageId,
        (msg) =>
          msg.components?.some(r => r.components?.some(c => c.customId === 'btn_open_ign_modal')) ||
          msg.embeds?.some(e => e.title && /ign setup|verification/i.test(e.title))
      );
    }

    if (!targetMsg) {
      requiredPerms.push(PermissionFlagsBits.SendMessages);
    }

    const permDiag = diagnoseChannelPermissions(channel, requiredPerms);
    if (!permDiag.ok) {
      return res.status(403).json({ error: permDiag.message });
    }

    if (targetMsg) {
      await targetMsg.edit(payload);
      wasUpdated = true;
    } else {
      targetMsg = await channel.send(payload);
    }

    const finalConfig = configStore.save({
      verifyChannelId: channel.id,
      verifyMessageId: targetMsg.id
    });

    res.json({
      success: true,
      updated: wasUpdated,
      posted: !wasUpdated,
      messageId: targetMsg.id,
      channelName: channel.name,
      config: finalConfig
    });
  } catch (err) {
    res.status(500).json({ error: formatChannelPermissionError(channel, err, requiredPerms) });
  }
}

