import path from 'node:path';
import { EmbedBuilder } from 'discord.js';
import { JsonStore } from '../../core/storage/json-store.js';
import { ROOT_DIR, configStore } from '../../core/storage/config-store.js';
import { resolveCustomEmojiShortcodes } from '../../shared/emoji-utils.js';

const ALERTS_CONFIG_FILE = path.join(ROOT_DIR, 'alertsConfig.json');

export const DEFAULT_PRESET_ALERTS = [
  {
    id: 'abyss-farming',
    code: 'abyss-farming',
    name: 'Abyss Group Farming',
    emoji: '🌌',
    isCustom: false,
    enabled: true,
    channelId: '',
    pingType: 'preset_role',
    roleId: '',
    embedColor: '#9b59b6',
    embedTitle: '🌌 Abyss Group Farming Alert',
    embedDescription: '**Abyss Group Farming Session in {countdown}, please gear up and gather in Reshanta!**',
    embedFooter: 'Aion 2 Abyss Farming Alert',
    includeTimestamp: false,
    eventTime: '02:00',
    eventTimes: ['02:00', '05:00', '08:00', '11:00', '14:00', '17:00', '20:00', '23:00'],
    alertOffsets: [10, 1],
    scheduleMode: 'daily',
    daysOfWeek: [0, 1, 2, 3, 4, 5, 6],
    times: [
      '01:50', '01:59',
      '04:50', '04:59',
      '07:50', '07:59',
      '10:50', '10:59',
      '13:50', '13:59',
      '16:50', '16:59',
      '19:50', '19:59',
      '22:50', '22:59'
    ],
    autoDelete: true,
    deleteAfterMinutes: 10
  },
  {
    id: 'spacetime-rift',
    code: 'spacetime-rift',
    name: 'Spacetime Rift',
    emoji: '🌀',
    isCustom: false,
    enabled: true,
    channelId: '',
    pingType: 'preset_role',
    roleId: '',
    embedColor: '#337fd5',
    embedTitle: '🌀 Spacetime Rift Alert',
    embedDescription: '**Spacetime Rift opens {countdown} ({event_time}), prepare for dimensional rift infiltration!**',
    embedFooter: 'Aion 2 Spacetime Rift Alert',
    includeTimestamp: false,
    eventTime: '01:00',
    eventTimes: ['01:00', '04:00', '07:00', '10:00', '13:00', '16:00', '19:00', '22:00'],
    alertOffsets: [10, 1],
    scheduleMode: 'daily',
    daysOfWeek: [0, 1, 2, 3, 4, 5, 6],
    times: [
      '00:50', '00:59',
      '03:50', '03:59',
      '06:50', '06:59',
      '09:50', '09:59',
      '12:50', '12:59',
      '15:50', '15:59',
      '18:50', '18:59',
      '21:50', '21:59'
    ],
    autoDelete: true,
    deleteAfterMinutes: 10
  },
  {
    id: 'artifact-siege',
    code: 'artifact-siege',
    name: 'Artifact Siege',
    emoji: '⚔️',
    isCustom: true,
    enabled: true,
    channelId: '',
    pingType: 'none',
    roleId: '',
    embedColor: '#e67e22',
    embedTitle: '',
    embedDescription: '**Abyss Artifact Siege in {countdown}, please gear up and gather in Reshanta**',
    embedFooter: 'Aion 2 Artifact Siege Alert',
    includeTimestamp: false,
    eventTime: '20:00',
    eventTimes: ['20:00'],
    alertOffsets: [60, 30],
    scheduleMode: 'days',
    daysOfWeek: [1, 4, 6],
    times: ['19:00', '19:30'],
    autoDelete: true,
    deleteAfterMinutes: 15
  }
];

export const DEFAULT_ALERTS_CONFIG = {
  alerts: structuredClone(DEFAULT_PRESET_ALERTS),
  pendingDeletions: [],
  updatedAt: null
};

export const alertsStore = new JsonStore(ALERTS_CONFIG_FILE, DEFAULT_ALERTS_CONFIG);

const triggeredSlots = new Map();
let schedulerInterval = null;

/**
 * Format minutes difference into clean human text (e.g. "in 10 minutes", "in 1 minute")
 */
export function formatMinutesDiffText(diffMinutes) {
  if (diffMinutes <= 0) return 'now';
  const hrs = Math.floor(diffMinutes / 60);
  const mins = diffMinutes % 60;
  const parts = [];
  if (hrs > 0) parts.push(`${hrs} hour${hrs === 1 ? '' : 's'}`);
  if (mins > 0) parts.push(`${mins} minute${mins === 1 ? '' : 's'}`);
  return `in ${parts.join(' ')}`;
}

/**
 * Compute the nearest upcoming Event Unix Timestamp (seconds) across one or more daily eventTimes
 */
export function computeNextEventTargetTime(alert, referenceDate = new Date()) {
  const rawList = Array.isArray(alert?.eventTimes) && alert.eventTimes.length > 0
    ? alert.eventTimes
    : (alert?.eventTime ? [alert.eventTime] : ['20:00']);

  const validTimes = rawList.filter(t => /^\d{2}:\d{2}$/.test(String(t || '').trim()));
  if (validTimes.length === 0) {
    const fallbackSec = Math.floor(referenceDate.getTime() / 1000);
    return { eventUnixSec: fallbackSec, diffMinutes: 0, countdownText: 'now', matchedEventHHMM: '20:00' };
  }

  let bestTargetMs = null;
  let bestHHMM = validTimes[0];

  for (const hhmm of validTimes) {
    const [evH, evM] = hhmm.split(':').map(Number);
    const candidate = new Date(referenceDate);
    candidate.setHours(evH, evM, 0, 0);

    // If candidate is more than 1 minute in the past relative to referenceDate, roll to tomorrow
    if (candidate.getTime() < referenceDate.getTime() - 60 * 1000) {
      candidate.setDate(candidate.getDate() + 1);
    }

    if (bestTargetMs === null || candidate.getTime() < bestTargetMs) {
      bestTargetMs = candidate.getTime();
      bestHHMM = hhmm;
    }
  }

  const diffMs = Math.max(0, bestTargetMs - referenceDate.getTime());
  const diffMinutes = Math.round(diffMs / 60000);
  const eventUnixSec = Math.floor(bestTargetMs / 1000);

  return {
    eventUnixSec,
    diffMinutes,
    countdownText: formatMinutesDiffText(diffMinutes),
    matchedEventHHMM: bestHHMM
  };
}

const LINKED_PRESET_ALERT_IDS = new Set(['abyss-farming', 'spacetime-rift']);

/**
 * Return configured alert profiles without re-adding deleted profiles
 */
export function getAlertsConfig() {
  const raw = alertsStore.get();
  const storedAlerts = Array.isArray(raw.alerts) && raw.alerts.length > 0
    ? raw.alerts.filter(a => a.id !== 'announcements' && a.id !== 'events')
    : structuredClone(DEFAULT_PRESET_ALERTS);

  const normalized = storedAlerts.map(item => {
    const presetMatch = DEFAULT_PRESET_ALERTS.find(p => p.id === item.id);
    const isLinkedPreset = LINKED_PRESET_ALERT_IDS.has(item.id);
    const isCustom = !isLinkedPreset;
    const evTimes = Array.isArray(item.eventTimes) && item.eventTimes.length > 0
      ? item.eventTimes
      : [item.eventTime || presetMatch?.eventTime || '20:00'];

    let resolvedPingType = item.pingType || (presetMatch ? presetMatch.pingType : 'none');
    if (isCustom && resolvedPingType === 'preset_role') {
      resolvedPingType = 'none';
    }

    const normalizedEmoji = String(item.emoji || presetMatch?.emoji || '🔔')
      .trim()
      .replace(/^<a?:([a-zA-Z0-9_]+):\d+>$/, ':$1:');

    return {
      enabled: true,
      channelId: '',
      pingType: resolvedPingType,
      roleId: '',
      embedColor: presetMatch?.embedColor || '#e67e22',
      embedTitle: presetMatch?.embedTitle ?? '',
      embedDescription: presetMatch?.embedDescription || '**{name} in {countdown}, please gear up and gather in Reshanta**',
      embedFooter: presetMatch?.embedFooter || 'Aion 2 Scheduled Alert',
      includeTimestamp: false,
      scheduleMode: presetMatch?.scheduleMode || 'days',
      daysOfWeek: [1, 4, 6],
      times: ['19:00', '19:30'],
      autoDelete: true,
      deleteAfterMinutes: 15,
      ...item,
      emoji: normalizedEmoji,
      pingType: resolvedPingType,
      isCustom,
      eventTime: evTimes[0] || '20:00',
      eventTimes: evTimes,
      alertOffsets: Array.isArray(item.alertOffsets) ? item.alertOffsets : (presetMatch?.alertOffsets || [60, 30]),
      daysOfWeek: Array.isArray(item.daysOfWeek) ? item.daysOfWeek : (presetMatch?.daysOfWeek || [1, 4, 6]),
      times: Array.isArray(item.times) ? item.times : (presetMatch?.times || ['19:00', '19:30'])
    };
  });

  return {
    alerts: normalized.length > 0 ? normalized : structuredClone(DEFAULT_PRESET_ALERTS),
    pendingDeletions: Array.isArray(raw.pendingDeletions) ? raw.pendingDeletions : [],
    updatedAt: raw.updatedAt || null
  };
}

export function saveAlertsConfig(alertsArray) {
  const sanitized = (Array.isArray(alertsArray) ? alertsArray : []).map(a => {
    const cleanEventTimes = Array.isArray(a.eventTimes)
      ? [...new Set(a.eventTimes.map(t => String(t).trim()).filter(t => /^\d{2}:\d{2}$/.test(t)))].sort()
      : (/^\d{2}:\d{2}$/.test(String(a.eventTime || '').trim()) ? [String(a.eventTime).trim()] : ['20:00']);

    if (cleanEventTimes.length === 0) cleanEventTimes.push('20:00');

    const cleanOffsets = Array.isArray(a.alertOffsets)
      ? [...new Set(a.alertOffsets.map(Number).filter(n => n >= 0 && n <= 720))].sort((x, y) => y - x)
      : [60, 30];

    const idStr = String(a.id || `custom-${Date.now()}`);
    const isCustom = !LINKED_PRESET_ALERT_IDS.has(idStr);
    let pingType = String(a.pingType || 'none');
    if (isCustom && pingType === 'preset_role') {
      pingType = 'none';
    }

    return {
      id: idStr,
      code: String(a.code || idStr),
      name: String(a.name || 'Custom Alert').trim(),
      emoji: String(a.emoji || '🔔').trim().replace(/^<a?:([a-zA-Z0-9_]+):\d+>$/, ':$1:'),
      isCustom,
      enabled: Boolean(a.enabled),
      channelId: String(a.channelId || ''),
      pingType,
      roleId: String(a.roleId || ''),
      embedColor: String(a.embedColor || '#e67e22'),
      embedTitle: String(a.embedTitle ?? ''),
      embedDescription: String(a.embedDescription ?? ''),
      embedFooter: String(a.embedFooter ?? 'Aion 2 Scheduled Alert'),
      includeTimestamp: Boolean(a.includeTimestamp),
      eventTime: cleanEventTimes[0],
      eventTimes: cleanEventTimes,
      alertOffsets: cleanOffsets,
      scheduleMode: a.scheduleMode === 'days' ? 'days' : 'daily',
      daysOfWeek: Array.isArray(a.daysOfWeek)
        ? a.daysOfWeek.map(Number).filter(n => n >= 0 && n <= 6)
        : [0, 1, 2, 3, 4, 5, 6],
      times: Array.isArray(a.times)
        ? [...new Set(a.times.map(t => String(t).trim()).filter(t => /^\d{2}:\d{2}$/.test(t)))].sort()
        : [],
      autoDelete: Boolean(a.autoDelete),
      deleteAfterMinutes: Math.max(1, Math.min(1440, Number(a.deleteAfterMinutes) || 15))
    };
  });

  alertsStore.update({
    alerts: sanitized,
    updatedAt: new Date().toISOString()
  });

  return getAlertsConfig();
}

/**
 * Resolve the linked role ID if pingType === 'preset_role' from main config.json
 */
export function resolveAlertRoleId(alert) {
  if (alert.pingType === 'role' && alert.roleId) {
    return alert.roleId;
  }
  if (alert.pingType === 'preset_role' && !alert.isCustom) {
    if (alert.roleId) return alert.roleId;
    const mainCfg = configStore.get() || {};
    const notifPresetRoles = mainCfg.reactionPresets?.notifications?.roles || [];
    const match = notifPresetRoles.find(
      r =>
        (r.code && (r.code === alert.code || r.code === alert.id)) ||
        (r.name && r.name.toLowerCase() === (alert.name || '').toLowerCase())
    );
    if (match && match.roleId) return match.roleId;
  }
  return '';
}

export function buildAlertDiscordPayload(alert, options = {}) {
  const now = new Date();
  const scheduledTimeStr = options.scheduledTime || now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const mainCfg = configStore.get() || {};
  const serverName = mainCfg.serverName || 'Asia Fregion';

  const { eventUnixSec, countdownText } = computeNextEventTargetTime(alert, now);
  const discordCountdownTag = `<t:${eventUnixSec}:R>`;
  const discordEventTimeTag = `<t:${eventUnixSec}:t>`;

  const replaceVars = (str) =>
    String(str || '')
      .replace(/\{countdown\}/gi, discordCountdownTag)
      .replace(/\{countdown_text\}/gi, countdownText)
      .replace(/\{event_time\}/gi, discordEventTimeTag)
      .replace(/\{name\}/gi, alert.name || 'Alert')
      .replace(/\{server\}/gi, serverName)
      .replace(/\{time\}/gi, scheduledTimeStr)
      .replace(/\{deleteAfter\}/gi, String(alert.deleteAfterMinutes || 15));

  const rawDesc = alert.embedDescription || `**${alert.name || 'Scheduled Alert'} in {countdown}, please gear up!**`;
  const hasExplicitCountdown = /\{countdown\}|\{event_time\}/i.test(rawDesc);
  let description = resolveCustomEmojiShortcodes(replaceVars(rawDesc), options.guild);

  if (alert.includeTimestamp && !hasExplicitCountdown) {
    description += ` <t:${eventUnixSec}:R> (<t:${eventUnixSec}:t>)`;
  }

  let colorInt = 0xe67e22;
  if (typeof alert.embedColor === 'string' && /^#?[0-9a-fA-F]{6}$/.test(alert.embedColor.trim())) {
    colorInt = parseInt(alert.embedColor.trim().replace('#', ''), 16);
  }

  const embed = new EmbedBuilder()
    .setColor(colorInt)
    .setDescription(description)
    .setTimestamp();

  const titleText = resolveCustomEmojiShortcodes(replaceVars(alert.embedTitle || '').trim(), options.guild);
  if (titleText) {
    embed.setTitle(titleText);
  }

  let footerText = replaceVars(alert.embedFooter || 'Aion 2 Scheduled Alert').trim();
  if (alert.autoDelete && alert.deleteAfterMinutes > 0 && !footerText.toLowerCase().includes('delete')) {
    footerText += ` • Auto-deletes in ${alert.deleteAfterMinutes}m`;
  }
  if (options.isManualTest) {
    footerText += ' (Manual Dispatch)';
  }
  if (footerText) {
    embed.setFooter({ text: footerText });
  }

  let content = '';
  if (alert.pingType === 'here') {
    content = '@here';
  } else if (alert.pingType === 'everyone') {
    content = '@everyone';
  } else if (alert.pingType === 'role' || alert.pingType === 'preset_role') {
    const resolvedRoleId = resolveAlertRoleId(alert);
    if (resolvedRoleId) {
      content = `<@&${resolvedRoleId}>`;
    }
  }

  return {
    ...(content ? { content } : {}),
    embeds: [embed]
  };
}

function readPendingDeletions() {
  const data = alertsStore.get();
  return Array.isArray(data?.pendingDeletions) ? data.pendingDeletions : [];
}

function writePendingDeletions(list) {
  alertsStore.update({ pendingDeletions: list });
}

export function scheduleAlertMessageDeletion(client, channelId, messageId, deleteAt, persist = true) {
  if (persist) {
    const list = readPendingDeletions().filter(d => d.messageId !== messageId);
    list.push({ channelId, messageId, deleteAt });
    writePendingDeletions(list);
  }

  const delay = Math.max(0, deleteAt - Date.now());
  setTimeout(async () => {
    try {
      const channel = await client.channels.fetch(channelId);
      if (channel && channel.isTextBased()) {
        const msg = await channel.messages.fetch(messageId);
        await msg.delete();
        console.log(`[ScheduledAlerts] 🗑️ Auto-deleted expired alert message ${messageId}`);
      }
    } catch (err) {
      if (err.code !== 10008) {
        console.error(`[ScheduledAlerts] Failed to delete alert message ${messageId}:`, err.message);
      }
    } finally {
      writePendingDeletions(readPendingDeletions().filter(d => d.messageId !== messageId));
    }
  }, delay);
}

function restorePendingAlertDeletions(client) {
  const list = readPendingDeletions();
  for (const d of list) {
    if (d?.channelId && d?.messageId && typeof d.deleteAt === 'number') {
      scheduleAlertMessageDeletion(client, d.channelId, d.messageId, d.deleteAt, false);
    }
  }
  if (list.length > 0) {
    console.log(`[ScheduledAlerts] ♻️ Restored ${list.length} pending alert message deletion(s).`);
  }
}

export async function dispatchAlertMessage(client, alert, options = {}) {
  const targetChannelId = options.channelId || alert.channelId;
  if (!targetChannelId) {
    throw new Error(`No target channel configured for "${alert.name}".`);
  }

  if (!client || typeof client.isReady !== 'function' || !client.isReady()) {
    throw new Error('Discord bot is not connected to Gateway.');
  }

  const channel = await client.channels.fetch(targetChannelId).catch(() => null);
  if (!channel || !channel.isTextBased()) {
    throw new Error('Selected channel was not found or is not a text channel.');
  }

  const payload = buildAlertDiscordPayload(alert, { ...options, guild: channel.guild });
  const sentMsg = await channel.send(payload);

  if (alert.autoDelete && Number(alert.deleteAfterMinutes) > 0) {
    const deleteAt = Date.now() + Number(alert.deleteAfterMinutes) * 60 * 1000;
    scheduleAlertMessageDeletion(client, channel.id, sentMsg.id, deleteAt, true);
  }

  return {
    messageId: sentMsg.id,
    channelId: channel.id,
    channelName: channel.name
  };
}

async function checkScheduledAlertsTick(client) {
  if (!client || typeof client.isReady !== 'function' || !client.isReady()) return;

  const now = new Date();
  const dayOfWeek = now.getDay(); // 0 (Sun) - 6 (Sat)
  const hh = String(now.getHours()).padStart(2, '0');
  const mm = String(now.getMinutes()).padStart(2, '0');
  const currentHHMM = `${hh}:${mm}`;
  const dateKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

  const { alerts } = getAlertsConfig();

  for (const alert of alerts) {
    if (!alert.enabled) continue;
    if (!alert.channelId) continue;
    if (!Array.isArray(alert.times) || alert.times.length === 0) continue;

    if (alert.scheduleMode === 'days') {
      const days = Array.isArray(alert.daysOfWeek) ? alert.daysOfWeek.map(Number) : [];
      if (!days.includes(dayOfWeek)) continue;
    }

    if (!alert.times.includes(currentHHMM)) continue;

    const slotKey = `${alert.id}:${dateKey}:${currentHHMM}`;
    if (triggeredSlots.has(slotKey)) continue;
    triggeredSlots.set(slotKey, Date.now());

    try {
      await dispatchAlertMessage(client, alert, { scheduledTime: currentHHMM });
      console.log(`[ScheduledAlerts] 🔔 Dispatched scheduled alert "${alert.name}" at ${currentHHMM} to channel ${alert.channelId}`);
    } catch (err) {
      console.error(`[ScheduledAlerts] ❌ Failed to dispatch scheduled alert "${alert.name}":`, err.message);
    }
  }

  // Cleanup old slot keys older than 36 hours
  const cutoff = Date.now() - 36 * 3600 * 1000;
  for (const [k, ts] of triggeredSlots.entries()) {
    if (ts < cutoff) triggeredSlots.delete(k);
  }
}

export function initScheduledAlerts(client) {
  console.log('🔔 [ScheduledAlerts] Initializing Multi-Schedule Alert Engine (checking every 20s)...');
  restorePendingAlertDeletions(client);

  if (schedulerInterval) clearInterval(schedulerInterval);
  schedulerInterval = setInterval(() => {
    checkScheduledAlertsTick(client).catch(err => {
      console.error('[ScheduledAlerts] Scheduler tick error:', err.message);
    });
  }, 20 * 1000);

  return schedulerInterval;
}
