import { EmbedBuilder } from 'discord.js';
import {
  initBossTimer,
  getBossTimerState,
  getBossTimerConfig,
  saveBossTimerConfig,
  updateBossTimers,
  renderBossTimers
} from './boss.scheduler.js';
import { DEFAULT_MAJOR_BOSSES } from './questlog.api.js';
import { ensureGuildEmojisLoaded, resolveCustomEmojiShortcodes } from '../../shared/emoji-utils.js';

export const bossTimerFeature = {
  id: 'boss-timer',
  name: 'Aion 2 Field Boss & Abyss Tracker',

  registerEvents({ client }) {
    client.once('ready', () => {
      initBossTimer(client);
    });
  },

  registerRoutes(app, { client }) {
    // GET /api/boss-timer - Get live boss timer config, cached bosses, and formatted tables
    app.get('/api/boss-timer', (req, res) => {
      try {
        const state = getBossTimerState();
        res.json({
          success: true,
          defaultMajorBosses: DEFAULT_MAJOR_BOSSES,
          ...state
        });
      } catch (err) {
        res.status(500).json({ error: err.message });
      }
    });

    // POST /api/boss-timer/config - Save Boss Timer configuration
    app.post('/api/boss-timer/config', async (req, res) => {
      try {
        const {
          serverId,
          channelId,
          alertChannelId,
          enableAlerts,
          autoDeleteAlerts,
          abyssTitle,
          elyosTitle,
          footerText,
          majorBosses
        } = req.body;

        const current = getBossTimerConfig();
        const updated = saveBossTimerConfig({
          serverId: serverId !== undefined ? Number(serverId) || 1507 : current.serverId,
          channelId: channelId !== undefined ? channelId : current.channelId,
          alertChannelId: alertChannelId !== undefined ? alertChannelId : current.alertChannelId,
          enableAlerts: enableAlerts !== undefined ? Boolean(enableAlerts) : current.enableAlerts,
          autoDeleteAlerts: autoDeleteAlerts !== undefined ? Boolean(autoDeleteAlerts) : current.autoDeleteAlerts,
          abyssTitle: abyssTitle !== undefined ? abyssTitle : current.abyssTitle,
          elyosTitle: elyosTitle !== undefined ? elyosTitle : current.elyosTitle,
          footerText: footerText !== undefined ? footerText : current.footerText,
          majorBosses: Array.isArray(majorBosses) ? majorBosses : current.majorBosses
        });

        if (client && typeof client.isReady === 'function' && client.isReady() && updated.messageId) {
          await renderBossTimers(client).catch(() => null);
        }

        res.json({
          success: true,
          ...getBossTimerState()
        });
      } catch (err) {
        res.status(500).json({ error: err.message });
      }
    });

    // POST /api/boss-timer/sync - Force fetch fresh data from Questlog API
    app.post('/api/boss-timer/sync', async (req, res) => {
      try {
        await updateBossTimers(client);
        res.json({
          success: true,
          ...getBossTimerState()
        });
      } catch (err) {
        res.status(500).json({ error: err.message });
      }
    });

    // POST /api/boss-timer/post - Post or Update Boss Timer Embeds in Discord
    app.post('/api/boss-timer/post', async (req, res) => {
      try {
        const { channelId, forceNew = false } = req.body;
        if (channelId) {
          saveBossTimerConfig({ channelId });
        }

        if (!client || typeof client.isReady !== 'function' || !client.isReady()) {
          return res.status(400).json({ error: 'Discord bot is not connected to Gateway (check DISCORD_TOKEN).' });
        }

        await updateBossTimers(client);
        const result = await renderBossTimers(client, {
          channelId,
          forceNew: Boolean(forceNew),
          allowFallback: true
        });

        if (!result) {
          return res.status(400).json({ error: 'Could not post or update Boss Timer message in target channel.' });
        }

        res.json({
          success: true,
          ...result,
          ...getBossTimerState()
        });
      } catch (err) {
        res.status(500).json({ error: err.message });
      }
    });

    // POST /api/boss-timer/test-alert - Send a test 10-minute Major Boss @here alert
    app.post('/api/boss-timer/test-alert', async (req, res) => {
      try {
        const cfg = getBossTimerConfig();
        const targetAlertChannelId = req.body.alertChannelId || cfg.alertChannelId;
        const bossName = req.body.bossName || (cfg.majorBosses && cfg.majorBosses[0]) || 'Watcher Kaira';

        if (!targetAlertChannelId) {
          return res.status(400).json({ error: 'Please select a 10-Minute Alert Channel first.' });
        }

        if (!client || typeof client.isReady !== 'function' || !client.isReady()) {
          return res.status(400).json({ error: 'Discord bot is not connected to Gateway.' });
        }

        const alertChannel = await client.channels.fetch(targetAlertChannelId).catch(() => null);
        if (!alertChannel || !alertChannel.isTextBased()) {
          return res.status(400).json({ error: 'Invalid or non-text alert channel specified.' });
        }

        await ensureGuildEmojisLoaded(alertChannel.guild);
        const ts = Math.floor((Date.now() + 10 * 60 * 1000) / 1000);
        const rawAlertDesc = `**Major Boss Spawning Soon: ${bossName}** <t:${ts}:R> (<t:${ts}:t>)`;
        const alertEmbed = new EmbedBuilder()
          .setColor(0xe67e22)
          .setDescription(resolveCustomEmojiShortcodes(rawAlertDesc, alertChannel.guild))
          .setFooter({ text: 'Aion 2 Major Boss Alert (Test)' })
          .setTimestamp();

        await alertChannel.send({ content: '@here', embeds: [alertEmbed] });
        res.json({ success: true, channelName: alertChannel.name, bossName });
      } catch (err) {
        res.status(500).json({ error: err.message });
      }
    });
  }
};
