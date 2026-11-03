import { PermissionFlagsBits } from 'discord.js';
import { configStore } from '../../core/storage/config-store.js';
import { getActiveGuild } from '../../shared/discord-resolvers.js';

const AION2_EMOJI_NAMES = [
  'Abyss',
  'Artifact',
  'Asmodian',
  'Assassin',
  'Chanter',
  'Cleric',
  'Elyos',
  'Gladiator',
  'PVP',
  'Ranger',
  'Rift',
  'Sorcerer',
  'Spiritmaster',
  'Templar',
  'WorldBoss'
];

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
        const missingAny = AION2_EMOJI_NAMES.some(
          name => !guild.emojis.cache.some(e => e.name && e.name.toLowerCase() === name.toLowerCase())
        );
        if (missingAny) {
          lastEmojiFetchAt = Date.now();
          await guild.emojis.fetch().catch(() => null);
        }
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

      const aion2NameSet = new Set(AION2_EMOJI_NAMES.map(n => n.toLowerCase()));
      const builtInEmojis = AION2_EMOJI_NAMES.map(name => {
        const liveMatch = guild?.emojis?.cache?.find(e => e.name && e.name.toLowerCase() === name.toLowerCase());
        return {
          id: liveMatch ? liveMatch.id : name,
          name,
          animated: Boolean(liveMatch?.animated),
          identifier: `:${name}:`,
          url: `/emojis/${name}.webp`
        };
      });

      const extraGuildEmojis = guild ? guild.emojis.cache
        .filter(e => e.name && !aion2NameSet.has(e.name.toLowerCase()))
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
        (config.ignRolesToAdd || []).forEach((id, i) => knownRoles.set(id, i === 0 ? 'Unverified' : 'Elyos Fregion'));
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
          position: 10 - idx,
          managed: false
        }));

        channels = [
          { id: config.rulesChannelId || '1559205186088472596', name: 'rules', type: 0 },
          { id: config.verifyChannelId || '1559238059801706648', name: 'identity-verification', type: 0 },
          { id: config.welcomeAnnouncementChannelId || '1559275351396323329', name: 'welcome', type: 0 },
          { id: config.nationalityChannelId || '1559205186088472596', name: 'regional-roles', type: 0 },
          { id: '1563876333623312394', name: 'field-boss-timers', type: 0 },
          { id: '1559205186088472599', name: 'general-chat', type: 0 }
        ];
      }

      res.json({
        online: typeof client.isReady === 'function' ? client.isReady() : false,
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
        verifyChannelId,
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
        reactionPresets
      } = req.body;

      const updated = configStore.save({
        autoJoinRoleIds: Array.isArray(autoJoinRoleIds) ? autoJoinRoleIds : config.autoJoinRoleIds || [],
        serverName: serverName !== undefined ? serverName : config.serverName,
        onboardedRoleId: onboardedRoleId !== undefined ? onboardedRoleId : config.onboardedRoleId,
        ignRolesToAdd: Array.isArray(ignRolesToAdd) ? ignRolesToAdd : config.ignRolesToAdd,
        ignRolesToRemove: Array.isArray(ignRolesToRemove) ? ignRolesToRemove : config.ignRolesToRemove,
        rulesChannelId: rulesChannelId !== undefined ? rulesChannelId : config.rulesChannelId,
        verifyChannelId: verifyChannelId !== undefined ? verifyChannelId : config.verifyChannelId,
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
        reactionPresets: reactionPresets !== undefined ? reactionPresets : config.reactionPresets
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

