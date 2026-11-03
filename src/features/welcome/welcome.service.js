import { EmbedBuilder, PermissionFlagsBits } from 'discord.js';
import { configStore } from '../../core/storage/config-store.js';
import { resolveChannel, getActiveGuild } from '../../shared/discord-resolvers.js';
import { ensureGuildEmojisLoaded, resolveCustomEmojiShortcodes } from '../../shared/emoji-utils.js';

export async function sendPublicWelcomeAnnouncement({ guild, member, ign, rolesText }) {
  const config = configStore.get();
  if (config.enableWelcomeAnnouncement === false) return;

  try {
    const welcomeChan = await resolveChannel(guild, config.welcomeAnnouncementChannelId, /welcome/i);
    if (!welcomeChan || !welcomeChan.isTextBased()) {
      console.warn('[Welcome Announcement] Could not resolve a text-based welcome channel.');
      return;
    }

    const chanPerms = welcomeChan.permissionsFor(guild.members.me);
    if (!chanPerms || !chanPerms.has(PermissionFlagsBits.SendMessages)) {
      console.warn(`[Welcome Announcement] ⚠️ Cannot post welcome message to #${welcomeChan.name}: Maiev lacks 'Send Messages' permission in this channel.`);
      return;
    }

    const freshGuild = await guild.fetch().catch(() => guild);
    const memberCount = freshGuild?.memberCount || guild.memberCount || 1;

    const serverIcon = guild.iconURL({ dynamic: true, size: 256 }) || undefined;
    const defaultPublicTemplate = 'Welcome to **{server}**, {user}! Glad to have you here, Daeva!';
    const rawPublicTemplate = config.welcomeAnnouncementMessage || defaultPublicTemplate;
    await ensureGuildEmojisLoaded(guild);
    const publicMessage = resolveCustomEmojiShortcodes(
      rawPublicTemplate
        .replace(/{user}/g, `<@${member.id}>`)
        .replace(/{ign}/g, ign)
        .replace(/{server}/g, guild.name)
        .replace(/{roles}/g, rolesText),
      guild
    );

    const sName = config.serverName || guild?.name || 'Asia Fregion';
    const footerText = `${sName} • ${memberCount} 👤 • Welcome Channel`;

    const publicEmbed = new EmbedBuilder()
      .setColor(0x00d2ff)
      .setAuthor({ name: `${guild.name} • New Daeva Arrival`, iconURL: serverIcon })
      .setDescription(publicMessage)
      .setThumbnail(member.user.displayAvatarURL({ dynamic: true, size: 256 }))
      .setFooter({ text: footerText, iconURL: serverIcon })
      .setTimestamp();

    await welcomeChan.send({
      content: `<@${member.id}>`,
      embeds: [publicEmbed]
    });
    console.log(`[Welcome Announcement] Sent public welcome for ${member.user.tag} to #${welcomeChan.name}`);
  } catch (pubErr) {
    console.warn('[Welcome Announcement] Failed to post to welcome channel:', pubErr.message);
  }
}

export async function handleTestWelcomeApi(req, res, { client }) {
  try {
    const { channelId, message } = req.body;
    const config = configStore.get();
    const guild = getActiveGuild(client);
    const channel = await guild?.channels.fetch(channelId || config.welcomeAnnouncementChannelId).catch(() => null);
    if (!channel || !channel.isTextBased()) {
      return res.status(400).json({ error: 'Invalid or non-text channel specified' });
    }

    const serverName = config.serverName || guild?.name || 'Asia Fregion';
    const serverIcon = guild?.iconURL({ dynamic: true, size: 256 }) || undefined;
    const template = message || config.welcomeAnnouncementMessage || 'Welcome to **{server}**, {user}! Glad to have you here, Daeva!';

    await ensureGuildEmojisLoaded(guild);
    const formatted = resolveCustomEmojiShortcodes(
      template
        .replace(/{user}/g, client.user ? `<@${client.user.id}>` : '@NewPlayer')
        .replace(/{ign}/g, 'DaevaLegend')
        .replace(/{server}/g, serverName)
        .replace(/{flag}/g, '🇵🇭')
        .replace(/{nationality}/g, 'Philippines')
        .replace(/{roles}/g, '@Unverified, @Elyos Fregion'),
      guild
    );

    const freshGuild = guild ? await guild.fetch().catch(() => guild) : null;
    const memberCount = freshGuild?.memberCount || guild?.memberCount || 1;

    const embed = new EmbedBuilder()
      .setColor(0x00d2ff)
      .setAuthor({ name: `${serverName} • New Daeva Arrival (Test)`, iconURL: serverIcon })
      .setDescription(formatted)
      .setThumbnail(serverIcon)
      .setFooter({ text: `${serverName} • ${memberCount} 👤 • Welcome Channel (Test)`, iconURL: serverIcon })
      .setTimestamp();

    await channel.send({ content: client.user ? `<@${client.user.id}>` : undefined, embeds: [embed] });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

