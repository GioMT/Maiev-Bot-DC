// Load .env here: ES module imports are hoisted, so index.js's dotenv.config()
// would otherwise run AFTER this module reads process.env below.
import 'dotenv/config';
import { EmbedBuilder } from 'discord.js';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ============================================================================
// 1. CONFIGURATION & CONSTANTS
// ============================================================================
export const SERVER_ID = 1507; // Fregion
export const CHANNEL_ID = '1563876333623312394';
// BOSS_TIMER_API_URL lets you point at a relay/proxy if Questlog blocks the host's IP.
export const API_URL = process.env.BOSS_TIMER_API_URL ||
  `https://questlog.gg/aion-2/api/trpc/fieldBoss.timers?input=${encodeURIComponent(
    JSON.stringify({ server: SERVER_ID, language: 'en' })
  )}`;
// Questlog is behind Cloudflare: a bare "Mozilla/5.0" UA gets 403'd from datacenter IPs,
// so send a full, realistic browser header set.
export const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36',
  'Accept': 'application/json, text/plain, */*',
  'Accept-Language': 'en-US,en;q=0.9',
  'Referer': 'https://questlog.gg/aion-2/',
  'Origin': 'https://questlog.gg',
  'Sec-Fetch-Dest': 'empty',
  'Sec-Fetch-Mode': 'cors',
  'Sec-Fetch-Site': 'same-origin'
};
// How often boss data is re-fetched from Questlog
export const UPDATE_INTERVAL_MS = 3 * 60 * 1000; // 3 minutes
// How often the countdown text is recalculated and the Discord message edited.
// Updates every 1 minute (60s) to keep timers accurate while avoiding Discord rate limits.
export const COUNTDOWN_INTERVAL_MS = 60 * 1000; // 1 minute
// Questlog's live (second-by-second) timer page for Fregion, linked from the embed
export const QUESTLOG_PAGE_URL = `https://questlog.gg/aion-2/en/field-bosses?server=${SERVER_ID}`;

// High-value major bosses highlighted with a star ⭐
export const MAJOR_BOSSES = new Set([
  'Watcher Kaira',
  'Argo, the Spirit King',
  'Guardian Lord Nahma',
  'Eternal Gartua',
  'High Commander Lagta',
  'Soul Ruler Kashapa',
  'Silent Dartan',
  'Executor Tamasa',
  'Executor Argo',
  'Executor Kaira'
]);

// Channel ID for 10-minute @here Major Boss respawn alert pings in General Chat.
// Configure via BOSS_ALERT_CHANNEL_ID in .env or the bot-hosting panel.
export let ALERT_CHANNEL_ID = process.env.BOSS_ALERT_CHANNEL_ID || null;

// Persistence storage path for retaining message ID across bot restarts on bot-hosting.net
const CONFIG_FILE = path.join(__dirname, 'bossTimerConfig.json');

// MESSAGE_ID variable (initially null).
// You can manually assign a message ID string here or pass via BOSS_TIMER_MESSAGE_ID in .env.
export let MESSAGE_ID = process.env.BOSS_TIMER_MESSAGE_ID || null;

// Concurrency guards to prevent overlapping fetch / edit calls
let isUpdating = false;   // data fetch in progress
let isRendering = false;  // Discord edit in progress

// Latest boss data from Questlog (refreshed every UPDATE_INTERVAL_MS)
let cachedBosses = null;
// Cached Discord message so we don't re-fetch it on every 5-second tick
let trackedMessage = null;

// ============================================================================
// 2. HELPER FUNCTIONS: PERSISTENCE
// ============================================================================

/**
 * Loads the persisted MESSAGE_ID and ALERT_CHANNEL_ID from bossTimerConfig.json if not already in memory.
 */
function loadPersistedMessageId() {
  try {
    if (fs.existsSync(CONFIG_FILE)) {
      const data = JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf-8'));
      if (data && data.messageId && !MESSAGE_ID) {
        MESSAGE_ID = data.messageId;
        console.log(`[BossTimer] Loaded persisted MESSAGE_ID: ${MESSAGE_ID}`);
      }
      if (data && data.alertChannelId && !ALERT_CHANNEL_ID) {
        ALERT_CHANNEL_ID = data.alertChannelId;
        console.log(`[BossTimer] Loaded persisted ALERT_CHANNEL_ID: ${ALERT_CHANNEL_ID}`);
      }
    }
  } catch (err) {
    console.warn('[BossTimer] Could not read bossTimerConfig.json:', err.message);
  }
  return MESSAGE_ID;
}

/**
 * Saves the active MESSAGE_ID and ALERT_CHANNEL_ID to disk for survival across bot reboots.
 */
function persistMessageId(id) {
  MESSAGE_ID = id;
  try {
    const prev = fs.existsSync(CONFIG_FILE) ? JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf-8')) : {};
    fs.writeFileSync(
      CONFIG_FILE,
      JSON.stringify(
        {
          ...prev,
          messageId: id,
          alertChannelId: ALERT_CHANNEL_ID,
          updatedAt: new Date().toISOString()
        },
        null,
        2
      ),
      'utf-8'
    );
  } catch (err) {
    console.warn('[BossTimer] Could not persist message ID to bossTimerConfig.json:', err.message);
  }
}

// ============================================================================
// 3. DATA PROCESSING & SORTING
// ============================================================================

/**
 * Filters, deduplicates by name, sorts (alive first, then soonest respawn),
 * and caps at 25 entries per embed.
 *
 * @param {Array<Object>} bossList - Array of boss objects from the API
 * @returns {Array<Object>} Processed boss list
 */
export function processBossList(bossList) {
  if (!Array.isArray(bossList)) return [];

  // Sort: active/alive bosses appear first, followed by soonest upcoming respawn times
  const sorted = [...bossList].sort((a, b) => {
    if (a.alive && !b.alive) return -1;
    if (!a.alive && b.alive) return 1;
    return a.time - b.time;
  });

  // Deduplicate by name (preserves the first/best entry from sorted list)
  const unique = [];
  const seenNames = new Set();
  for (const boss of sorted) {
    if (!seenNames.has(boss.name)) {
      seenNames.add(boss.name);
      unique.push(boss);
    }
  }

  // Cap at a maximum of 25 entries per embed
  return unique.slice(0, 25);
}

/**
 * Formats remaining milliseconds:
 * - If >= 1 day: 00d 00h 00m (e.g. 04d 22h 45m)
 * - If < 1 day: 00h 00m (e.g. 23h 15m, 00h 04m)
 */
export function formatCountdown(ms) {
  const total = Math.max(0, Math.floor(ms / 1000));
  const d = Math.floor(total / 86400);
  const h = Math.floor((total % 86400) / 3600);
  const m = Math.floor((total % 3600) / 60);
  const pad = (n) => String(n).padStart(2, '0');

  if (d > 0) {
    return `${pad(d)}d ${pad(h)}h ${pad(m)}m`;
  }
  return `${pad(h)}h ${pad(m)}m`;
}

/**
 * Status text for one boss at time `now`, matching Questlog's Status column.
 */
function bossStatus(boss, now) {
  if (boss.alive) return 'Alive';
  const remaining = boss.time - now;
  // Timer ran out but Questlog hasn't confirmed the spawn yet (next data refresh will)
  if (remaining <= 0) return 'Spawning';
  return formatCountdown(remaining);
}

// ============================================================================
// 4. EMBED BUILDER
// ============================================================================

/**
 * Builds a two-column "Boss | Status" table (like Questlog) inside a code block,
 * so the columns stay aligned on both desktop and mobile.
 */
function buildBossTable(bosses, now) {
  if (!bosses || bosses.length === 0) return '```\nNo boss data currently available.\n```';

  const nameWidth = Math.max(4, ...bosses.map((b) => b.name.length));
  const entries = bosses.map((b) => ({
    boss: b,
    status: bossStatus(b, now),
    alive: b.alive || b.time - now <= 0
  }));
  // "● " prefix + longest status text, so the ★ column lines up
  const statusWidth = Math.max(6, ...entries.map((e) => e.status.length + 2));
  const header = `${'Boss'.padEnd(nameWidth)}  Status`;
  const divider = `${'─'.repeat(nameWidth)}  ${'─'.repeat(statusWidth)}`;

  const rows = entries.map(({ boss: b, status, alive }) => {
    const dot = alive ? '●' : '○';
    // Star goes at the end of the line so it can't break column alignment
    const star = MAJOR_BOSSES.has(b.name) ? '  ★' : '';
    return `${b.name.padEnd(nameWidth)}  ${dot} ${status.padEnd(statusWidth - 2)}${star}`.trimEnd();
  });

  return '```\n' + [header, divider, ...rows].join('\n') + '\n```';
}

/**
 * Builds one region embed.
 */
export function createBossEmbed({ title, color, bosses, latestSeen, now }) {
  return new EmbedBuilder()
    .setTitle(title)
    .setColor(color)
    .setDescription(
      `📡 Data last synced: <t:${latestSeen}:R>\n` + buildBossTable(bosses, now)
    );
}

/**
 * Latest `seenAt` (in seconds) of a boss list, for the "last synced" line.
 */
function latestSeenSeconds(list) {
  const times = list.map((b) => b.seenAt).filter((t) => typeof t === 'number' && t > 0);
  return times.length > 0 ? Math.floor(Math.max(...times) / 1000) : Math.floor(Date.now() / 1000);
}

/**
 * Builds the full message payload (both embeds + Questlog button) from cached data.
 */
function buildPayload(rawBosses, now = Date.now()) {
  // Filter boss categories
  // - Abyss / Reshanta Bosses: id < 10000
  // - Elyos Overland Bosses: id >= 100000 && id < 110000
  // - Asmodian Bosses (id >= 110000) are excluded
  const abyssRaw = rawBosses.filter((b) => b.id < 10000);
  const elyosRaw = rawBosses.filter((b) => b.id >= 100000 && b.id < 110000);

  // Re-sorted on every tick so bosses move up as their timers run out
  const abyssEmbed = createBossEmbed({
    title: '🔥 Fregion — Reshanta / Abyss Bosses',
    color: 0xe74c3c,
    bosses: processBossList(abyssRaw),
    latestSeen: latestSeenSeconds(abyssRaw),
    now
  });

  const elyosEmbed = createBossEmbed({
    title: '🪽 Fregion — Elyos Overland Field Bosses',
    color: 0x3498db,
    bosses: processBossList(elyosRaw),
    latestSeen: latestSeenSeconds(elyosRaw),
    now
  }).setFooter({ text: '● Alive  ○ Respawning (00d 00h 00m)  ★ Major boss  •  Updates every 1m' });

  return { embeds: [abyssEmbed, elyosEmbed], components: [] };
}

// ============================================================================
// 5. API FETCHING, DISCORD MESSAGE & UPDATE CYCLES
// ============================================================================

/**
 * Fetches boss timers from Questlog API.
 * @returns {Promise<Array<Object>>}
 */
export async function fetchBossData() {
  const response = await fetch(API_URL, { headers: HEADERS });
  if (!response.ok) {
    // Diagnostics: tells us whether Cloudflare is challenging or hard-blocking this host
    const cfMitigated = response.headers.get('cf-mitigated') || 'none';
    const cfRay = response.headers.get('cf-ray') || 'n/a';
    const bodySnippet = (await response.text().catch(() => '')).replace(/\s+/g, ' ').slice(0, 200);
    throw new Error(
      `Questlog API error: ${response.status} ${response.statusText} ` +
      `(cf-mitigated: ${cfMitigated}, cf-ray: ${cfRay}) body: ${bodySnippet}`
    );
  }
  const json = await response.json();
  const rawBosses = json.result?.data;
  if (!Array.isArray(rawBosses)) {
    throw new Error('Malformed Questlog response: result.data is not an array');
  }
  return rawBosses;
}

/**
 * Sends a brand-new timer message and remembers its ID.
 */
async function sendNewMessage(channel, payload) {
  const message = await channel.send(payload);
  trackedMessage = message;
  persistMessageId(message.id);

  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('🎯 [BossTimer] New boss timer message posted successfully!');
  console.log(`📌 Generated MESSAGE_ID: ${MESSAGE_ID}`);
  console.log(`📡 Channel ID: ${CHANNEL_ID}`);
  return message;
}

// Tracks the last alerted spawn time per boss name (prevents duplicate pings).
// Keyed by name only: Questlog can shift `time` by a few seconds between refreshes
// and can list the same boss more than once, both of which caused double alerts.
const sentAlerts = new Map(); // bossName -> spawn time (ms) that was alerted

// Alert window: fire only when ~10 minutes remain. The window is 90s wide so a
// 60s countdown tick (plus interval drift) always lands inside it exactly once.
const ALERT_WINDOW_MAX_MS = 10 * 60 * 1000;
const ALERT_WINDOW_MIN_MS = 8.5 * 60 * 1000;
// Two spawn times closer than this are treated as the same respawn cycle
const SAME_CYCLE_TOLERANCE_MS = 30 * 60 * 1000;

// How long after the boss spawns the alert message is automatically deleted
export const ALERT_DELETE_AFTER_SPAWN_MS = 10 * 60 * 1000; // 10 minutes

/**
 * Reads the pending alert deletions list from bossTimerConfig.json.
 * @returns {Array<{ channelId: string, messageId: string, deleteAt: number }>}
 */
function readPendingDeletions() {
  try {
    if (fs.existsSync(CONFIG_FILE)) {
      const data = JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf-8'));
      if (Array.isArray(data?.pendingAlertDeletions)) return data.pendingAlertDeletions;
    }
  } catch (err) {
    console.warn('[BossTimer] Could not read pending alert deletions:', err.message);
  }
  return [];
}

/**
 * Writes the pending alert deletions list to bossTimerConfig.json (keeps other keys intact).
 */
function writePendingDeletions(list) {
  try {
    const prev = fs.existsSync(CONFIG_FILE) ? JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf-8')) : {};
    fs.writeFileSync(
      CONFIG_FILE,
      JSON.stringify({ ...prev, pendingAlertDeletions: list }, null, 2),
      'utf-8'
    );
  } catch (err) {
    console.warn('[BossTimer] Could not persist pending alert deletions:', err.message);
  }
}

/**
 * Schedules an alert message to be deleted at `deleteAt` (ms epoch).
 * If `persist` is true, the job is saved to disk so it survives bot restarts.
 */
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
      // 10008 = Unknown Message (already deleted manually) — safe to ignore
      if (err.code !== 10008) {
        console.error(`[BossTimer] Failed to delete alert message ${messageId}:`, err.message);
      }
    } finally {
      writePendingDeletions(readPendingDeletions().filter((d) => d.messageId !== messageId));
    }
  }, delay);
}

/**
 * Re-schedules any alert deletions that were pending before the bot restarted.
 * Overdue ones are deleted immediately.
 */
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

/**
 * Checks if any major boss is ~10 minutes from respawning and sends an @here notification
 * to the configured General Chat (ALERT_CHANNEL_ID).
 * Pings only once per boss respawn cycle.
 */
let warnedNoAlertChannel = false;
async function checkMajorBossAlerts(client, bosses) {
  if (!ALERT_CHANNEL_ID) {
    if (!warnedNoAlertChannel) {
      console.warn('[BossTimer] ⚠️ BOSS_ALERT_CHANNEL_ID is not set — major boss @here alerts are DISABLED.');
      warnedNoAlertChannel = true;
    }
    return;
  }
  if (!Array.isArray(bosses)) return;
  const now = Date.now();

  // Collect due bosses first so we only fetch the channel when there is something to send
  const due = [];
  for (const boss of bosses) {
    if (!MAJOR_BOSSES.has(boss.name)) continue;
    if (boss.alive) continue;
    if (boss.id >= 110000) continue; // Asmodian entries are excluded, same as the tracker embed

    const remainingMs = boss.time - now;
    if (remainingMs <= ALERT_WINDOW_MIN_MS || remainingMs > ALERT_WINDOW_MAX_MS) continue;

    const lastAlerted = sentAlerts.get(boss.name);
    if (lastAlerted && Math.abs(lastAlerted - boss.time) < SAME_CYCLE_TOLERANCE_MS) continue;

    // Mark immediately (before any await) so overlapping calls can't double-send
    sentAlerts.set(boss.name, boss.time);
    due.push(boss);
  }

  if (due.length > 0) {
    const alertChannel = await client.channels.fetch(ALERT_CHANNEL_ID).catch((err) => {
      console.error(`[BossTimer] Could not fetch alert channel ${ALERT_CHANNEL_ID}:`, err.message);
      return null;
    });

    if (alertChannel && alertChannel.isTextBased()) {
      for (const boss of due) {
        const ts = Math.floor(boss.time / 1000);

        // Single line in the description: embed titles can't render <t:...> timestamps
        const alertEmbed = new EmbedBuilder()
          .setColor(0xe67e22)
          .setDescription(`**Major Boss Spawning Soon: ${boss.name}** <t:${ts}:R> (<t:${ts}:t>)`)
          .setFooter({ text: 'Aion 2 Major Boss Alert' })
          .setTimestamp();

        try {
          const alertMsg = await alertChannel.send({ content: '@here', embeds: [alertEmbed] });
          console.log(`[BossTimer] 🔔 Sent 10-minute alert for ${boss.name} in channel ${ALERT_CHANNEL_ID}`);

          // Auto-delete the alert 10 minutes after the boss spawns
          scheduleAlertDeletion(client, alertChannel.id, alertMsg.id, boss.time + ALERT_DELETE_AFTER_SPAWN_MS);
        } catch (err) {
          console.error(`[BossTimer] Failed to send alert for ${boss.name}:`, err.message);
        }
      }
    }
  }

  // Prune alert records older than 2 hours to keep memory tidy
  for (const [name, spawnTime] of sentAlerts) {
    if (spawnTime < now - 2 * 3600 * 1000) {
      sentAlerts.delete(name);
    }
  }
}

/**
 * Re-renders the countdown from cached data and edits the Discord message.
 * Runs every COUNTDOWN_INTERVAL_MS. No Questlog request is made here.
 *
 * @param {import('discord.js').Client} client
 */
export async function renderBossTimers(client) {
  if (!cachedBosses || isRendering) return; // no data yet, or previous edit still running
  isRendering = true;

  try {
    const payload = buildPayload(cachedBosses);

    if (!trackedMessage) {
      loadPersistedMessageId();
      const channel = await client.channels.fetch(CHANNEL_ID).catch((err) => {
        console.error(`[BossTimer] Failed to fetch channel ${CHANNEL_ID}:`, err.message);
        return null;
      });
      if (!channel || !channel.isTextBased()) {
        console.error(`[BossTimer] Channel ${CHANNEL_ID} not found or is not a text channel.`);
        return;
      }

      if (MESSAGE_ID) {
        trackedMessage = await channel.messages.fetch(MESSAGE_ID).catch((err) => {
          if (err.code !== 10008) throw err;
          console.warn('[BossTimer] ⚠️ Previous message was deleted in Discord. Sending a fresh message...');
          return null;
        });
      }
      if (!trackedMessage) {
        await sendNewMessage(channel, payload);
        return;
      }
    }

    try {
      await trackedMessage.edit(payload);
    } catch (err) {
      if (err.code === 10008) {
        // Message deleted while running: recreate on the next tick
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

  // Alerts run independently so a failed embed edit never suppresses a ping
  await checkMajorBossAlerts(client, cachedBosses).catch((err) => {
    console.error('[BossTimer] ❌ Error checking major boss alerts:', err.message);
  });
}

/**
 * Fetches fresh boss data from Questlog (every UPDATE_INTERVAL_MS), then re-renders.
 * On failure, the last good data is kept so the countdown keeps running.
 *
 * @param {import('discord.js').Client} client
 */
export async function updateBossTimers(client) {
  if (isUpdating) {
    console.log('[BossTimer] Update already in progress, skipping cycle.');
    return;
  }
  isUpdating = true;

  try {
    cachedBosses = await fetchBossData();
    console.log(`[BossTimer] ✅ Boss data refreshed (${cachedBosses.length} bosses) at ${new Date().toLocaleTimeString()}`);
  } catch (err) {
    console.error('[BossTimer] ❌ Error in update cycle:', err.message);
  } finally {
    isUpdating = false;
  }

  await renderBossTimers(client);
}

// ============================================================================
// 6. MODULE INITIALIZATION
// ============================================================================

/**
 * Initializes the Boss Timer tracker:
 * - fetches Questlog data now and every 3 minutes
 * - recalculates the countdown and edits the message every 5 seconds
 *
 * @param {import('discord.js').Client} client - The Discord Client instance
 * @returns {{ dataInterval: NodeJS.Timeout, countdownInterval: NodeJS.Timeout }}
 */
export function initBossTimer(client) {
  console.log('⏰ [BossTimer] Initializing Aion 2 Field Boss Tracker (data every 3 min, countdown every 1m)...');
  console.log(
    process.env.BOSS_TIMER_API_URL
      ? `🔁 [BossTimer] Using relay: ${API_URL.replace(/key=[^&]+/, 'key=***')}`
      : '🌐 [BossTimer] Using Questlog directly (BOSS_TIMER_API_URL not set)'
  );

  // Resume any alert auto-deletions that were pending before a restart
  restorePendingDeletions(client);

  // Initial immediate run upon startup
  updateBossTimers(client).catch((err) => {
    console.error('[BossTimer] Initial timer run error:', err.message);
  });

  // Re-fetch boss data every 3 minutes
  const dataInterval = setInterval(() => {
    updateBossTimers(client).catch((err) => {
      console.error('[BossTimer] Scheduled timer run error:', err.message);
    });
  }, UPDATE_INTERVAL_MS);

  // Tick the countdown every 5 seconds (uses cached data, no Questlog request)
  const countdownInterval = setInterval(() => {
    renderBossTimers(client).catch((err) => {
      console.error('[BossTimer] Countdown tick error:', err.message);
    });
  }, COUNTDOWN_INTERVAL_MS);

  return { dataInterval, countdownInterval };
}
