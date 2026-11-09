import fs from 'node:fs';
import path from 'node:path';
import { PermissionFlagsBits } from 'discord.js';
import { configStore } from '../../core/storage/config-store.js';
import { getActiveGuild } from '../../shared/discord-resolvers.js';

const EMOJIS_DIR = path.join(process.cwd(), 'public/emojis');

function getAvailableLocalEmojiFiles() {
  if (!fs.existsSync(EMOJIS_DIR)) return [];
  try {
    return fs.readdirSync(EMOJIS_DIR)
      .filter(f => /\.(png|webp|jpg|jpeg|gif)$/i.test(f))
      .map(f => {
        const parsed = path.parse(f);
        return {
          name: parsed.name,
          ext: parsed.ext.replace('.', '').toLowerCase(),
          fileName: f
        };
      });
  } catch {
    return [];
  }
}

let lastEmojiFetchAt = 0;

export const statusFeature = {
  id: 'status',
  name: 'Web Control Center Telemetry & Config API',

  registerRoutes(app, { client }) {
    // GET /api/status - Live Bot & Guild Status
    app.get('/api/status', async (req, res) => {
      const config = configStore.get();
      const guild = getActiveGuild(client);
      const botMember = guild?.members.me;

      if (guild && Date.now() - lastEmojiFetchAt > 30000) {
        lastEmojiFetchAt = Date.now();
        await guild.emojis.fetch().catch(() => null);

        if (botMember?.permissions?.has(PermissionFlagsBits.ManageGuildExpressions)) {
          const localEmojiFiles = getAvailableLocalEmojiFiles();
          for (const item of localEmojiFiles) {
            const hasEmoji = guild.emojis.cache.some(
              e => e.name && e.name.toLowerCase() === item.name.toLowerCase()
            );
            if (!hasEmoji) {
              const imgPath = path.join(EMOJIS_DIR, item.fileName);
              if (fs.existsSync(imgPath)) {
                guild.emojis.create({ attachment: imgPath, name: item.name })
                  .then(e => console.log(`[Status] Auto-uploaded server emoji :${e.name}: (${e.id})`))
                  .catch(err => console.warn(`[Status] Could not auto-upload ${item.name} emoji to guild:`, err.message));
              }
            }
          }
        }
      }

      if (guild && guild.roles.cache.size <= 1) {
        await guild.roles.fetch().catch(() => null);
      }
      if (guild && guild.channels.cache.size === 0) {
        await guild.channels.fetch().catch(() => null);
      }

      let roles = guild ? guild.roles.cache.map(r => ({
        id: r.id,
        name: r.name,
        color: r.hexColor,
        position: r.position,
        managed: r.managed
      })) : [];

      let channels = guild ? guild.channels.cache
        .filter(c => c.isTextBased())
        .map(c => ({ id: c.id, name: c.name, type: c.type })) : [];

      const localEmojiFiles = getAvailableLocalEmojiFiles();
      const localNameSet = new Set(localEmojiFiles.map(e => e.name.toLowerCase()));
      const builtInEmojis = localEmojiFiles.map(({ name, ext }) => {
        const liveMatch = guild?.emojis?.cache?.find(e => e.name && e.name.toLowerCase() === name.toLowerCase());
        return {
          id: liveMatch ? liveMatch.id : name,
          name,
          animated: Boolean(liveMatch?.animated || ext === 'gif'),
          identifier: `:${name}:`,
          url: `/emojis/${name}.${ext}`
        };
      });

      const extraGuildEmojis = guild ? guild.emojis.cache
        .filter(e => e.name && !localNameSet.has(e.name.toLowerCase()))
        .map(e => ({
          id: e.id,
          name: e.name,
          animated: e.animated,
          identifier: `:${e.name}:`,
          url: e.imageURL({ size: 64 })
        })) : [];

      const emojis = [...builtInEmojis, ...extraGuildEmojis];

      if (!guild) {
        const knownRoles = new Map();
        if (config.onboardedRoleId) knownRoles.set(config.onboardedRoleId, 'Compliant');
        (config.autoJoinRoleIds || []).forEach((id, i) => {
          if (id && !knownRoles.has(id)) knownRoles.set(id, `Auto-Join Role ${i + 1}`);
        });
        (config.ignRolesToAdd || []).forEach((id, i) => {
          if (id) knownRoles.set(id, i === 0 ? 'Unverified' : 'Elyos Fregion');
        });
        (config.ignRolesToRemove || []).forEach((id) => {
          if (id && !knownRoles.has(id)) knownRoles.set(id, 'Compliant');
        });
        (config.userVerifyReviewerRoleIds || []).forEach((id, i) => {
          if (id && !knownRoles.has(id)) knownRoles.set(id, `Reviewer Role ${i + 1}`);
        });
        (config.userVerifyRolesToAdd || []).forEach((id, i) => {
          if (id && !knownRoles.has(id)) knownRoles.set(id, i === 0 ? 'Verified' : `Verified Role ${i + 1}`);
        });
        (config.userVerifyRolesToRemove || []).forEach((id) => {
          if (id && !knownRoles.has(id)) knownRoles.set(id, 'Unverified');
        });
        (config.nationalityRoles || []).forEach(n => { if (n.roleId) knownRoles.set(n.roleId, n.name); });
        if (knownRoles.size === 0) {
          knownRoles.set('1559242680561569842', 'Compliant');
          knownRoles.set('1559238369089683567', 'Unverified');
          knownRoles.set('1559207325011677186', 'Elyos Fregion');
          knownRoles.set('1559232244088836176', 'Philippines');
          knownRoles.set('1559232319037116546', 'South Korea');
        }
        roles = Array.from(knownRoles.entries()).map(([id, name], idx) => ({
          id,
          name,
          color: '#00d2ff',
          position: 20 - idx,
          managed: false
        }));

        channels = [
          { id: config.rulesChannelId || '1559205186088472596', name: 'rules', type: 0 },
          { id: config.verifyChannelId || '1559238059801706648', name: 'identity-verification', type: 0 },
          { id: config.userVerifyChannelId || '1559238059801706649', name: 'user-verify', type: 0 },
          { id: config.userVerifyStaffChannelId || '1559238059801706650', name: 'verify-reviews', type: 0 },
          { id: config.welcomeAnnouncementChannelId || '1559275351396323329', name: 'welcome', type: 0 },
          { id: config.nationalityChannelId || '1559205186088472596', name: 'regional-roles', type: 0 },
          { id: '1563876333623312394', name: 'field-boss-timers', type: 0 },
          { id: '1559205186088472599', name: 'general-chat', type: 0 }
        ];
      }

      res.json({
        online: typeof client.isReady === 'function' ? client.isReady() : false,
        guildReady: Boolean(guild),
        botName: client.user ? client.user.tag : 'Maiev',
        botId: client.user ? client.user.id : (process.env.CLIENT_ID || 'Maiev'),
        avatar: client.user ? client.user.displayAvatarURL() : 'https://assets-global.website-files.com/6257adef93867e50d84d30e2/636e0a6a49cf127bf92de1e2_icon_clyde_blurple_RGB.png',
        ping: client.ws?.ping && client.ws.ping > 0 ? client.ws.ping : 24,
        config,
        guild: {
          id: guild?.id || (process.env.GUILD_ID || '1559205186088472596'),
          name: config.serverName || guild?.name || 'Asia Fregion',
          icon: guild?.iconURL() || 'https://assets-global.website-files.com/6257adef93867e50d84d30e2/636e0a6a49cf127bf92de1e2_icon_clyde_blurple_RGB.png',
          memberCount: guild?.memberCount || 142,
          roles,
          channels,
          emojis
        },
        permissions: {
          hasManageRoles: botMember ? botMember.permissions.has(PermissionFlagsBits.ManageRoles) : true,
          hasManageNicknames: botMember ? botMember.permissions.has(PermissionFlagsBits.ManageNicknames) : true,
          hasManageMessages: botMember ? botMember.permissions.has(PermissionFlagsBits.ManageMessages) : true,
          hasManageThreads: botMember ? (
            botMember.permissions.has(PermissionFlagsBits.CreatePrivateThreads) &&
            botMember.permissions.has(PermissionFlagsBits.ManageThreads) &&
            botMember.permissions.has(PermissionFlagsBits.SendMessagesInThreads)
          ) : true,
          rolePosition: botMember ? botMember.roles.highest.position : 99
        }
      });
    });

    // POST /api/config - Save Configuration
    app.post('/api/config', (req, res) => {
      const config = configStore.get();
      const {
        autoJoinRoleIds,
        serverName,
        onboardedRoleId,
        ignRolesToAdd,
        ignRolesToRemove,
        rulesChannelId,
        rulesMessageId,
        verifyChannelId,
        verifyMessageId,
        rulesTitle,
        rulesContent,
        rulesFooter,
        verifyTitle,
        verifyContent,
        verifyFooter,
        welcomeTitle,
        welcomeContent,
        welcomeFooter,
        welcomeAnnouncementChannelId,
        enableWelcomeAnnouncement,
        welcomeAnnouncementMessage,
        nationalityChannelId,
        nationalityTitle,
        nationalityContent,
        nationalityFooter,
        nationalityRoles,
        reactionRoleIntent,
        reactionPresets,
        userVerifyChannelId,
        userVerifyStaffChannelId,
        userVerifyReviewerRoleIds,
        userVerifyRolesToAdd,
        userVerifyRolesToRemove,
        userVerifyButtonLabel,
        userVerifyTitle,
        userVerifyContent,
        userVerifyFooter,
        userVerifyVideoUrl,
        userVerifyUploadedVideo,
        userVerifyThreadTitle,
        userVerifyThreadContent
      } = req.body;

      const updated = configStore.save({
        autoJoinRoleIds: Array.isArray(autoJoinRoleIds) ? autoJoinRoleIds : config.autoJoinRoleIds || [],
        serverName: serverName !== undefined ? serverName : config.serverName,
        onboardedRoleId: onboardedRoleId !== undefined ? onboardedRoleId : config.onboardedRoleId,
        ignRolesToAdd: Array.isArray(ignRolesToAdd) ? ignRolesToAdd : config.ignRolesToAdd,
        ignRolesToRemove: Array.isArray(ignRolesToRemove) ? ignRolesToRemove : config.ignRolesToRemove,
        rulesChannelId: rulesChannelId !== undefined ? rulesChannelId : config.rulesChannelId,
        rulesMessageId: rulesMessageId !== undefined ? rulesMessageId : (config.rulesMessageId || ''),
        verifyChannelId: verifyChannelId !== undefined ? verifyChannelId : config.verifyChannelId,
        verifyMessageId: verifyMessageId !== undefined ? verifyMessageId : (config.verifyMessageId || ''),
        rulesTitle: rulesTitle !== undefined ? rulesTitle : config.rulesTitle,
        rulesContent: rulesContent !== undefined ? rulesContent : config.rulesContent,
        rulesFooter: rulesFooter !== undefined ? rulesFooter : config.rulesFooter,
        verifyTitle: verifyTitle !== undefined ? verifyTitle : config.verifyTitle,
        verifyContent: verifyContent !== undefined ? verifyContent : config.verifyContent,
        verifyFooter: verifyFooter !== undefined ? verifyFooter : config.verifyFooter,
        welcomeTitle: welcomeTitle !== undefined ? welcomeTitle : config.welcomeTitle,
        welcomeContent: welcomeContent !== undefined ? welcomeContent : config.welcomeContent,
        welcomeFooter: welcomeFooter !== undefined ? welcomeFooter : config.welcomeFooter,
        welcomeAnnouncementChannelId: welcomeAnnouncementChannelId !== undefined ? welcomeAnnouncementChannelId : config.welcomeAnnouncementChannelId,
        enableWelcomeAnnouncement: enableWelcomeAnnouncement !== undefined ? enableWelcomeAnnouncement : config.enableWelcomeAnnouncement,
        welcomeAnnouncementMessage: welcomeAnnouncementMessage !== undefined ? welcomeAnnouncementMessage : config.welcomeAnnouncementMessage,
        nationalityChannelId: nationalityChannelId !== undefined ? nationalityChannelId : config.nationalityChannelId,
        nationalityTitle: nationalityTitle !== undefined ? nationalityTitle : config.nationalityTitle,
        nationalityContent: nationalityContent !== undefined ? nationalityContent : config.nationalityContent,
        nationalityFooter: nationalityFooter !== undefined ? nationalityFooter : config.nationalityFooter,
        nationalityRoles: Array.isArray(nationalityRoles) ? nationalityRoles : config.nationalityRoles,
        reactionRoleIntent: reactionRoleIntent !== undefined ? reactionRoleIntent : config.reactionRoleIntent,
        reactionPresets: reactionPresets !== undefined ? reactionPresets : config.reactionPresets,
        userVerifyChannelId: userVerifyChannelId !== undefined ? userVerifyChannelId : config.userVerifyChannelId,
        userVerifyStaffChannelId: userVerifyStaffChannelId !== undefined ? userVerifyStaffChannelId : (config.userVerifyStaffChannelId || ''),
        userVerifyReviewerRoleIds: Array.isArray(userVerifyReviewerRoleIds) ? userVerifyReviewerRoleIds : (config.userVerifyReviewerRoleIds || []),
        userVerifyRolesToAdd: Array.isArray(userVerifyRolesToAdd) ? userVerifyRolesToAdd : (config.userVerifyRolesToAdd || []),
        userVerifyRolesToRemove: Array.isArray(userVerifyRolesToRemove) ? userVerifyRolesToRemove : (config.userVerifyRolesToRemove || []),
        userVerifyButtonLabel: userVerifyButtonLabel !== undefined ? userVerifyButtonLabel : config.userVerifyButtonLabel,
        userVerifyTitle: userVerifyTitle !== undefined ? userVerifyTitle : config.userVerifyTitle,
        userVerifyContent: userVerifyContent !== undefined ? userVerifyContent : config.userVerifyContent,
        userVerifyFooter: userVerifyFooter !== undefined ? userVerifyFooter : config.userVerifyFooter,
        userVerifyVideoUrl: userVerifyVideoUrl !== undefined ? userVerifyVideoUrl : config.userVerifyVideoUrl,
        userVerifyUploadedVideo: (typeof userVerifyUploadedVideo === 'string' && userVerifyUploadedVideo.trim() !== '')
          ? userVerifyUploadedVideo.trim()
          : (config.userVerifyUploadedVideo || ''),
        userVerifyThreadTitle: userVerifyThreadTitle !== undefined ? userVerifyThreadTitle : config.userVerifyThreadTitle,
        userVerifyThreadContent: userVerifyThreadContent !== undefined ? userVerifyThreadContent : config.userVerifyThreadContent
      });

      console.log('⚙️ Configuration updated via Web UI.');
      res.json({ success: true, config: updated });
    });

    // GET /api/members - Member Roster
    app.get('/api/members', (req, res) => {
      const guild = getActiveGuild(client);
      if (guild) {
        const members = guild.members.cache
          .filter(m => !m.user.bot)
          .first(25)
          .map(m => ({
            id: m.id,
            username: m.user.tag,
            nickname: m.nickname,
            roles: m.roles.cache.filter(r => r.name !== '@everyone').map(r => r.name)
          }));
        return res.json(members);
      }

      res.json([
        { id: '1', username: 'DaevaPlayer#1001', nickname: 'DaevaLegend', roles: ['Elyos Fregion', 'Compliant', 'Philippines'] },
        { id: '2', username: 'ShadowWing#2002', nickname: 'ShadowWing', roles: ['Elyos Fregion', 'Unverified', 'South Korea'] },
        { id: '3', username: 'LegionMaster#3003', nickname: 'LegionCommander', roles: ['Legion Leader', 'Elyos Fregion', 'Compliant'] }
      ]);
    });
  }
};

