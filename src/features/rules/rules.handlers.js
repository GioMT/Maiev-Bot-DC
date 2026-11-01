import { PermissionFlagsBits } from 'discord.js';
import { configStore } from '../../core/storage/config-store.js';
import {
  resolveRole,
  resolveChannel,
  hasCompletedVerification,
  getActiveGuild
} from '../../shared/discord-resolvers.js';
import { createRulesMessage } from './rules.embed.js';

export async function handleAcceptRulesButton(interaction) {
  const { guild, member } = interaction;

  if (!interaction.deferred && !interaction.replied) {
    try {
      await interaction.deferReply({ ephemeral: true });
    } catch (deferErr) {
      if (deferErr.code === 40060) return;
      console.error('[Rules Button] deferReply failed:', deferErr);
      return;
    }
  }

  const botMember = guild.members.me;
  if (!botMember.permissions.has(PermissionFlagsBits.ManageRoles)) {
    await interaction.editReply({
      content: '❌ **Bot Permission Error:** Maiev lacks the **Manage Roles** permission. Please go to **Server Settings > Roles > Maiev > Permissions** and enable **Manage Roles**.'
    });
    return;
  }

  const config = configStore.get();
  let onboardedRole = await resolveRole(guild, config.onboardedRoleId, [
    'Compliant',
    '[Compliant]',
    'Onboarded',
    '[Onboarded]',
    'Rules Acknowledged',
    'Acknowledge Rules'
  ]);

  if (!onboardedRole) {
    const allRoles = await guild.roles.fetch().catch(() => guild.roles.cache);
    onboardedRole = allRoles.find(r => /compliant|onboard/i.test(r.name));
  }

  const verifyChannel = await resolveChannel(guild, config.verifyChannelId, /verif|identity/i);

  if (!onboardedRole) {
    await interaction.editReply({
      content: '⚠️ Could not find a role named **[Onboarded]** (or `Onboarded`) in the server. Please ensure the role exists or configure it in the web dashboard!'
    });
    return;
  }

  if (botMember.roles.highest.position <= onboardedRole.position) {
    await interaction.editReply({
      content: `⚠️ **Role Hierarchy Error:** The **Maiev** role must be dragged **above** the **@${onboardedRole.name}** role in **Server Settings > Roles**.`
    });
    return;
  }

  const targetMember = await guild.members.fetch({ user: interaction.user.id, force: true }).catch(() => member);

  const alreadyVerified = await hasCompletedVerification(guild, targetMember);
  if (alreadyVerified) {
    await interaction.editReply({
      content: '🔒 **Access Already Granted:** You have already acknowledged the rules, completed verification, and have access to the server channels. You cannot acknowledge the rules again.'
    });
    return;
  }

  if (targetMember.roles.cache.has(onboardedRole.id)) {
    await interaction.editReply({
      content: `ℹ️ **Rules Already Acknowledged:** You already have the **@${onboardedRole.name}** role!${verifyChannel ? `\n\n👉 Proceed to <#${verifyChannel.id}> to set your AION 2 IGN with **Maiev**!` : ''}`
    });
    return;
  }

  try {
    await targetMember.roles.add(onboardedRole, 'Acknowledged server rules');
    console.log(`[Rules] Granted @${onboardedRole.name} to ${targetMember.user.tag}`);
    await interaction.editReply({
      content: `✅ **Rules Acknowledged!** You have been granted the **@${onboardedRole.name}** role!${verifyChannel ? `\n\n👉 **Next Step:** Proceed to <#${verifyChannel.id}> to set your AION 2 In-Game Name with **Maiev**!` : ''}`
    });
  } catch (addErr) {
    console.error('[Rules] Failed to add onboarded role:', addErr);
    await interaction.editReply({
      content: `❌ **Failed to assign role:** ${addErr.message}. Please verify bot permissions and role hierarchy in Server Settings.`
    });
  }
}

export async function handlePostRulesCommand(interaction) {
  await interaction.deferReply({ ephemeral: true });
  try {
    const payload = createRulesMessage();
    await interaction.channel.send(payload);
    await interaction.editReply({ content: '✅ Rules card posted successfully in this channel!' });
  } catch (sendErr) {
    await interaction.editReply({ content: `❌ Error: **${sendErr.message}**.` });
  }
}

export async function handlePostRulesApi(req, res, { client }) {
  try {
    const { channelId } = req.body;
    const config = configStore.get();
    const guild = getActiveGuild(client);
    const channel = await guild?.channels.fetch(channelId || config.rulesChannelId).catch(() => null);
    if (!channel || !channel.isTextBased()) {
      return res.status(400).json({ error: 'Invalid or non-text channel specified' });
    }
    const payload = createRulesMessage();
    await channel.send(payload);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

