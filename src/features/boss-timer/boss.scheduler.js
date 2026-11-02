import 'dotenv/config';
import { EmbedBuilder } from 'discord.js';
import path from 'node:path';
import { JsonStore } from '../../core/storage/json-store.js';
import { ROOT_DIR } from '../../core/storage/config-store.js';
import {
  DEFAULT_SERVER_ID,
  DEFAULT_CHANNEL_ID,
  DEFAULT_MAJOR_BOSSES,
  API_URL,
  UPDATE_INTERVAL_MS,
  COUNTDOWN_INTERVAL_MS,
  MAJOR_BOSSES,
  fetchBossData,
  getFallbackBossData
} from './questlog.api.js';
import {
  buildPayload,
  processBossList,
  buildBossTable
} from './boss.embed.js';
import { getActiveGuild } from '../../shared/discord-resolvers.js';
import { ensureGuildEmojisLoaded, resolveCustomEmojiShortcodes } from '../../shared/emoji-utils.js';

const BOSS_CONFIG_FILE = path.join(ROOT_DIR, 'bossTimerConfig.json');

export const DEFAULT_BOSS_CONFIG = {
  serverId: DEFAULT_SERVER_ID,
  channelId: process.env.BOSS_TIMER_CHANNEL_ID || DEFAULT_CHANNEL_ID,
  messageId: process.env.BOSS_TIMER_MESSAGE_ID || null,
  alertChannelId: process.env.BOSS_ALERT_CHANNEL_ID || null,
  enableAlerts: true,
  autoDeleteAlerts: true,
  abyssTitle: '🔥 Fregion — Reshanta / Abyss Bosses',
  elyosTitle: '🪽 Fregion — Verteron Field Bosses',
  footerText: '● Alive  ○ Respawning (00d 00h 00m)  ★ Major boss  •  Updates every 1m',
  majorBosses: [...DEFAULT_MAJOR_BOSSES],
  pendingAlertDeletions: [],
  updatedAt: null
};

export const bossStore = new JsonStore(BOSS_CONFIG_FILE, DEFAULT_BOSS_CONFIG);

// Sync MAJOR_BOSSES Set from stored config on startup
const initialStored = bossStore.get();
if (Array.isArray(initialStored.majorBosses) && initialStored.majorBosses.length > 0) {
  MAJOR_BOSSES.clear();
  initialStored.majorBosses.forEach(name => MAJOR_BOSSES.add(name));
}

export let ALERT_CHANNEL_ID = initialStored.alertChannelId || process.env.BOSS_ALERT_CHANNEL_ID || null;
export let MESSAGE_ID = initialStored.messageId || process.env.BOSS_TIMER_MESSAGE_ID || null;
export const ALERT_DELETE_AFTER_SPAWN_MS = 10 * 60 * 1000;

const ALERT_WINDOW_MAX_MS = 10 * 60 * 1000;
const ALERT_WINDOW_MIN_MS = 8.5 * 60 * 1000;
const SAME_CYCLE_TOLERANCE_MS = 30 * 60 * 1000;

let isUpdating = false;
let isRendering = false;
let cachedBosses = null;
let lastSyncedAt = null;
let lastSyncError = null;
let trackedMessage = null;
let warnedNoAlertChannel = false;
const sentAlerts = new Map();

export function getBossTimerConfig() {
  const cfg = bossStore.get();
  return {
    ...DEFAULT_BOSS_CONFIG,
    ...cfg,
    channelId: cfg.channelId || DEFAULT_CHANNEL_ID,
    alertChannelId: cfg.alertChannelId || ALERT_CHANNEL_ID || '',
    messageId: cfg.messageId || MESSAGE_ID || null,
    majorBosses: Array.isArray(cfg.majorBosses) ? cfg.majorBosses : [...DEFAULT_MAJOR_BOSSES]
  };
}

export function saveBossTimerConfig(partial) {
  const prev = getBossTimerConfig();
  const channelChanged = partial.channelId && partial.channelId !== prev.channelId;

  const updated = bossStore.update({
    ...partial,
    ...(channelChanged ? { messageId: null } : {}),
    updatedAt: new Date().toISOString()
  });

  if (channelChanged) {
    trackedMessage = null;
    MESSAGE_ID = null;
  } else if (partial.messageId !== undefined) {
    MESSAGE_ID = partial.messageId;
  }

  if (partial.alertChannelId !== undefined) {
    ALERT_CHANNEL_ID = partial.alertChannelId || null;
  }

  if (Array.isArray(updated.majorBosses)) {
    MAJOR_BOSSES.clear();
    updated.majorBosses.forEach(name => MAJOR_BOSSES.add(name));
  }

  return getBossTimerConfig();
}

export function getBossTimerState() {
  const cfg = getBossTimerConfig();
  const now = Date.now();
  const activeBosses = cachedBosses || getFallbackBossData(now);
  const isFallback = !cachedBosses;

  const abyssRaw = activeBosses.filter((b) => b.id < 10000);
  const elyosRaw = activeBosses.filter((b) => b.id >= 100000 && b.id < 110000);
  const abyssList = processBossList(abyssRaw);
  const elyosList = processBossList(elyosRaw);

  return {
    config: cfg,
    lastSyncedAt,
    lastSyncError,
    isFallback,
    usingRelay: Boolean(process.env.BOSS_TIMER_API_URL),
    abyssBosses: abyssList,
    elyosBosses: elyosList,
    abyssTable: buildBossTable(abyssList, now, MAJOR_BOSSES),
    elyosTable: buildBossTable(elyosList, now, MAJOR_BOSSES)
  };
}

function loadPersistedMessageId() {
  const data = bossStore.load();
  if (data && data.messageId && !MESSAGE_ID) {
    MESSAGE_ID = data.messageId;
    console.log(`[BossTimer] Loaded persisted MESSAGE_ID: ${MESSAGE_ID}`);
  }
  if (data && data.alertChannelId && !ALERT_CHANNEL_ID) {
    ALERT_CHANNEL_ID = data.alertChannelId;
    console.log(`[BossTimer] Loaded persisted ALERT_CHANNEL_ID: ${ALERT_CHANNEL_ID}`);
  }
  return MESSAGE_ID;
}

function persistMessageId(id, channelId) {
  MESSAGE_ID = id;
  const cfg = getBossTimerConfig();
  bossStore.update({
    messageId: id,
    channelId: channelId || cfg.channelId,
    alertChannelId: ALERT_CHANNEL_ID,
    updatedAt: new Date().toISOString()
  });
}

function isBossTimerEmbedMessage(msg, clientUserId) {
  if (!msg || !clientUserId || msg.author?.id !== clientUserId) return false;
  if (!Array.isArray(msg.embeds) || msg.embeds.length === 0) return false;
  return msg.embeds.some(
    (e) =>
      /Reshanta|Verteron|Abyss Bosses|Field Bosses/i.test(e.title || '') ||
      /Data last synced:/i.test(e.description || '')
  );
}

/**
 * Scans recent channel messages for existing Boss Timer embeds authored by Maiev.
 * - If deleteAll is true (used when forceNew=true), deletes all previous Boss Timer embeds.
 * - Otherwise, keeps the newest Boss Timer message and deletes any older duplicates.
 */
async function findAndCleanupExistingBossMessages(channel, clientUserId, { deleteAll = false, keepMessageId = null } = {}) {
  try {
    const recent = await channel.messages.fetch({ limit: 20 });
    const matches = [...recent.values()]
      .filter((m) => isBossTimerEmbedMessage(m, clientUserId))
      .sort((a, b) => b.createdTimestamp - a.createdTimestamp); // newest first

    if (matches.length === 0) return null;

    if (deleteAll) {
      for (const oldMsg of matches) {
        await oldMsg.delete().catch(() => null);
      }
      console.log(`[BossTimer] 🧹 Deleted ${matches.length} previous Boss Timer message(s) before posting fresh embed.`);
      return null;
    }

    const keeper = (keepMessageId && matches.find((m) => m.id === keepMessageId)) || matches[0];
    const duplicates = matches.filter((m) => m.id !== keeper.id);

    for (const dup of duplicates) {
      await dup.delete().catch(() => null);
      console.log(`[BossTimer] 🧹 Removed duplicate Boss Timer message ${dup.id} in #${channel.name}`);
    }

    return keeper;
  } catch (err) {
    console.warn('[BossTimer] Could not scan recent messages for duplicates:', err.message);
    return null;
  }
}

async function sendNewMessage(channel, payload, clientUserId) {
  if (clientUserId) {
    await findAndCleanupExistingBossMessages(channel, clientUserId, { deleteAll: true });
  }
  const message = await channel.send(payload);
  trackedMessage = message;
  persistMessageId(message.id, channel.id);

  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('🎯 [BossTimer] New boss timer message posted successfully!');
  console.log(`📌 Generated MESSAGE_ID: ${MESSAGE_ID}`);
  console.log(`📡 Channel ID: ${channel.id}`);
  return message;
}

function readPendingDeletions() {
  const data = bossStore.get();
  return Array.isArray(data?.pendingAlertDeletions) ? data.pendingAlertDeletions : [];
}

function writePendingDeletions(list) {
  bossStore.update({ pendingAlertDeletions: list });
}

function scheduleAlertDeletion(client, channelId, messageId, deleteAt, persist = true) {
  if (persist) {
    const list = readPendingDeletions().filter((d) => d.messageId !== messageId);
    list.push({ channelId, messageId, deleteAt });
    writePendingDeletions(list);
  }

  const delay = Math.max(0, deleteAt - Date.now());
  setTimeout(async () => {
    try {
      const channel = await client.channels.fetch(channelId);
      const msg = await channel.messages.fetch(messageId);
      await msg.delete();
      console.log(`[BossTimer] 🗑️ Deleted expired boss alert message ${messageId}`);
    } catch (err) {
      if (err.code !== 10008) {
        console.error(`[BossTimer] Failed to delete alert message ${messageId}:`, err.message);
      }
    } finally {
      writePendingDeletions(readPendingDeletions().filter((d) => d.messageId !== messageId));
    }
  }, delay);
}

function restorePendingDeletions(client) {
  const list = readPendingDeletions();
  for (const d of list) {
    if (d?.channelId && d?.messageId && typeof d.deleteAt === 'number') {
      scheduleAlertDeletion(client, d.channelId, d.messageId, d.deleteAt, false);
    }
  }
  if (list.length > 0) {
    console.log(`[BossTimer] ♻️ Restored ${list.length} pending boss alert deletion(s).`);
  }
}

async function checkMajorBossAlerts(client, bosses) {
  const cfg = getBossTimerConfig();
  if (cfg.enableAlerts === false) return;

  const targetAlertChannelId = cfg.alertChannelId || ALERT_CHANNEL_ID;
  if (!targetAlertChannelId) {
    if (!warnedNoAlertChannel) {
      console.warn('[BossTimer] ⚠️ BOSS_ALERT_CHANNEL_ID is not set — major boss @here alerts are DISABLED.');
      warnedNoAlertChannel = true;
    }
    return;
  }
  if (!Array.isArray(bosses)) return;
  const now = Date.now();

  const due = [];
  for (const boss of bosses) {
    if (!MAJOR_BOSSES.has(boss.name)) continue;
    if (boss.alive) continue;
    if (boss.id >= 110000) continue;

    const remainingMs = boss.time - now;
    if (remainingMs <= ALERT_WINDOW_MIN_MS || remainingMs > ALERT_WINDOW_MAX_MS) continue;

    const lastAlerted = sentAlerts.get(boss.name);
    if (lastAlerted && Math.abs(lastAlerted - boss.time) < SAME_CYCLE_TOLERANCE_MS) continue;

    sentAlerts.set(boss.name, boss.time);
    due.push(boss);
  }

  if (due.length > 0) {
    const alertChannel = await client.channels.fetch(targetAlertChannelId).catch((err) => {
      console.error(`[BossTimer] Could not fetch alert channel ${targetAlertChannelId}:`, err.message);
      return null;
    });

    if (alertChannel && alertChannel.isTextBased()) {
      await ensureGuildEmojisLoaded(alertChannel.guild);
      for (const boss of due) {
        const ts = Math.floor(boss.time / 1000);
        const rawAlertDesc = `**Major Boss Spawning Soon: ${boss.name}** <t:${ts}:R> (<t:${ts}:t>)`;
        const alertEmbed = new EmbedBuilder()
          .setColor(0xe67e22)
          .setDescription(resolveCustomEmojiShortcodes(rawAlertDesc, alertChannel.guild))
          .setFooter({ text: 'Aion 2 Major Boss Alert' })
          .setTimestamp();

        try {
          const alertMsg = await alertChannel.send({ content: '@here', embeds: [alertEmbed] });
          console.log(`[BossTimer] 🔔 Sent 10-minute alert for ${boss.name} in channel ${targetAlertChannelId}`);
          if (cfg.autoDeleteAlerts !== false) {
            scheduleAlertDeletion(client, alertChannel.id, alertMsg.id, boss.time + ALERT_DELETE_AFTER_SPAWN_MS);
          }
        } catch (err) {
          console.error(`[BossTimer] Failed to send alert for ${boss.name}:`, err.message);
        }
      }
    }
  }

  for (const [name, spawnTime] of sentAlerts) {
    if (spawnTime < now - 2 * 3600 * 1000) {
      sentAlerts.delete(name);
    }
  }
}

export async function renderBossTimers(client, options = {}) {
  const activeBosses = cachedBosses || (options.allowFallback ? getFallbackBossData() : null);
  if (!activeBosses || isRendering) return null;
  isRendering = true;

  try {
    const cfg = getBossTimerConfig();
    const targetChannelId = options.channelId || cfg.channelId;
    const guild = getActiveGuild(client);
    await ensureGuildEmojisLoaded(guild);
    const payload = buildPayload(activeBosses, Date.now(), {
      majorBossSet: MAJOR_BOSSES,
      abyssTitle: cfg.abyssTitle,
      elyosTitle: cfg.elyosTitle,
      footerText: cfg.footerText,
      guild
    });

    if (options.forceNew) {
      trackedMessage = null;
      MESSAGE_ID = null;
    }

    if (!trackedMessage) {
      loadPersistedMessageId();
      const channel = await client.channels.fetch(targetChannelId).catch((err) => {
        console.error(`[BossTimer] Failed to fetch channel ${targetChannelId}:`, err.message);
        return null;
      });
      if (!channel || !channel.isTextBased()) {
        console.error(`[BossTimer] Channel ${targetChannelId} not found or is not a text channel.`);
        return null;
      }

      if (options.forceNew) {
        const msg = await sendNewMessage(channel, payload, client.user?.id);
        return { messageId: msg.id, channelName: channel.name, posted: true, updated: false };
      }

      // Scan channel for existing Boss Timer message(s) and automatically clean up duplicates
      const discovered = await findAndCleanupExistingBossMessages(channel, client.user?.id, {
        deleteAll: false,
        keepMessageId: MESSAGE_ID
      });

      if (discovered) {
        trackedMessage = discovered;
        if (MESSAGE_ID !== discovered.id) {
          persistMessageId(discovered.id, channel.id);
          console.log(`[BossTimer] 📌 Adopted existing Boss Timer message in #${channel.name}: ${discovered.id}`);
        }
      } else if (MESSAGE_ID) {
        trackedMessage = await channel.messages.fetch(MESSAGE_ID).catch((err) => {
          if (err.code !== 10008) throw err;
          console.warn('[BossTimer] ⚠️ Previous message was deleted in Discord. Sending a fresh message...');
          return null;
        });
      }

      if (!trackedMessage) {
        const msg = await sendNewMessage(channel, payload, client.user?.id);
        return { messageId: msg.id, channelName: channel.name, posted: true, updated: false };
      }
    }

    try {
      await trackedMessage.edit(payload);
      return { messageId: trackedMessage.id, channelName: trackedMessage.channel?.name || 'channel', posted: false, updated: true };
    } catch (err) {
      if (err.code === 10008) {
        console.warn('[BossTimer] ⚠️ Timer message was deleted. It will be re-posted on the next tick.');
        trackedMessage = null;
        MESSAGE_ID = null;
      } else {
        throw err;
      }
    }
  } catch (err) {
    console.error('[BossTimer] ❌ Error updating Discord message:', err.message);
  } finally {
    isRendering = false;
  }

  if (cachedBosses) {
    await checkMajorBossAlerts(client, cachedBosses).catch((err) => {
      console.error('[BossTimer] ❌ Error checking major boss alerts:', err.message);
    });
  }
  return null;
}

export async function updateBossTimers(client) {
  if (isUpdating) {
    console.log('[BossTimer] Update already in progress, skipping cycle.');
    return;
  }
  isUpdating = true;

  try {
    const cfg = getBossTimerConfig();
    cachedBosses = await fetchBossData(cfg.serverId);
    lastSyncedAt = Date.now();
    lastSyncError = null;
    console.log(`[BossTimer] ✅ Boss data refreshed (${cachedBosses.length} bosses) at ${new Date().toLocaleTimeString()}`);
  } catch (err) {
    lastSyncError = err.message;
    console.error('[BossTimer] ❌ Error in update cycle:', err.message);
  } finally {
    isUpdating = false;
  }

  if (client && typeof client.isReady === 'function' && client.isReady()) {
    await renderBossTimers(client);
  }
}

export function initBossTimer(client) {
  console.log('⏰ [BossTimer] Initializing Aion 2 Field Boss Tracker (data every 3 min, countdown every 1m)...');
  console.log(
    process.env.BOSS_TIMER_API_URL
      ? `🔁 [BossTimer] Using relay: ${API_URL.replace(/key=[^&]+/, 'key=***')}`
      : '🌐 [BossTimer] Using Questlog directly (BOSS_TIMER_API_URL not set)'
  );

  restorePendingDeletions(client);

  updateBossTimers(client).catch((err) => {
    console.error('[BossTimer] Initial timer run error:', err.message);
  });

  const dataInterval = setInterval(() => {
    updateBossTimers(client).catch((err) => {
      console.error('[BossTimer] Scheduled timer run error:', err.message);
    });
  }, UPDATE_INTERVAL_MS);

  const countdownInterval = setInterval(() => {
    renderBossTimers(client).catch((err) => {
      console.error('[BossTimer] Countdown tick error:', err.message);
    });
  }, COUNTDOWN_INTERVAL_MS);

  return { dataInterval, countdownInterval };
}
