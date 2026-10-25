import { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
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
export const UPDATE_INTERVAL_MS = 3 * 60 * 1000; // 3 minutes
// Questlog's live (second-by-second) timer page, linked from the embed
export const QUESTLOG_PAGE_URL = 'https://questlog.gg/aion-2/en/field-bosses';

// High-value major bosses highlighted with a star ⭐
export const MAJOR_BOSSES = new Set([
  'Watcher Kaira',
  'Argo, the Spirit King',
  'Guardian Lord Nahma',
  'Eternal Gartua',
  'High Commander Lagta',
  'Soul Ruler Kashapa',
  'Silent Dartan'
]);

// Persistence storage path for retaining message ID across bot restarts on bot-hosting.net
const CONFIG_FILE = path.join(__dirname, 'bossTimerConfig.json');

// MESSAGE_ID variable (initially null).
// You can manually assign a message ID string here or pass via BOSS_TIMER_MESSAGE_ID in .env.
export let MESSAGE_ID = process.env.BOSS_TIMER_MESSAGE_ID || null;

// Concurrency guard to prevent overlapping fetch/edit calls
let isUpdating = false;

// ============================================================================
// 2. HELPER FUNCTIONS: PERSISTENCE
// ============================================================================

/**
 * Loads the persisted MESSAGE_ID from bossTimerConfig.json if not already in memory.
 */
function loadPersistedMessageId() {
  if (MESSAGE_ID) return MESSAGE_ID;
  try {
    if (fs.existsSync(CONFIG_FILE)) {
      const data = JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf-8'));
      if (data && data.messageId) {
        MESSAGE_ID = data.messageId;
        console.log(`[BossTimer] Loaded persisted MESSAGE_ID: ${MESSAGE_ID}`);
      }
    }
  } catch (err) {
    console.warn('[BossTimer] Could not read bossTimerConfig.json:', err.message);
  }
  return MESSAGE_ID;
}

/**
 * Saves the active MESSAGE_ID to disk for survival across bot reboots.
 */
function persistMessageId(id) {
  MESSAGE_ID = id;
  try {
    fs.writeFileSync(
      CONFIG_FILE,
      JSON.stringify({ messageId: id, updatedAt: new Date().toISOString() }, null, 2),
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
 * and caps at 25 fields per embed.
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

  // Cap at a maximum of 25 fields per embed
  return unique.slice(0, 25);
}

// ============================================================================
// 4. EMBED BUILDER
// ============================================================================

/**
 * Builds a styled Discord EmbedBuilder for a boss category.
 *
 * @param {Object} options
 * @param {string} options.title - Embed title
 * @param {number} options.color - Hex color code
 * @param {string} options.description - Last sync description
 * @param {Array<Object>} options.bosses - Processed boss array
 * @returns {EmbedBuilder}
 */
export function createBossEmbed({ title, color, description, bosses }) {
  const embed = new EmbedBuilder()
    .setTitle(title)
    .setColor(color)
    .setDescription(description)
    .setTimestamp();

  if (!bosses || bosses.length === 0) {
    embed.addFields({
      name: 'Status',
      value: 'No boss data currently available.',
      inline: false
    });
    return embed;
  }

  for (const boss of bosses) {
    const isMajor = MAJOR_BOSSES.has(boss.name);
    const name = isMajor ? `⭐ ${boss.name}` : boss.name;
    const ts = Math.floor(boss.time / 1000);

    // Format status & timestamps according to specification:
    // If alive is true: 🟢 **ALIVE NOW**\nSince <t:TIMESTAMP:R>
    // If alive is false: ⏳ <t:TIMESTAMP:R>\n(<t:TIMESTAMP:t>)
    const value = boss.alive
      ? `🟢 **ALIVE NOW**\nSince <t:${ts}:R>`
      : `⏳ <t:${ts}:R>\n(<t:${ts}:t>)`;

    embed.addFields({ name, value, inline: true });
  }

  return embed;
}

// ============================================================================
// 5. API FETCHING & MAIN UPDATE CYCLE
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
 * Performs a single fetch, parse, and Discord message send/edit update.
 *
 * @param {import('discord.js').Client} client - The Discord Client instance
 */
export async function updateBossTimers(client) {
  if (isUpdating) {
    console.log('[BossTimer] Update already in progress, skipping cycle.');
    return;
  }
  isUpdating = true;

  try {
    loadPersistedMessageId();

    const channel = await client.channels.fetch(CHANNEL_ID).catch((err) => {
      console.error(`[BossTimer] Failed to fetch channel ${CHANNEL_ID}:`, err.message);
      return null;
    });

    if (!channel || !channel.isTextBased()) {
      console.error(`[BossTimer] Channel ${CHANNEL_ID} not found or is not a text channel.`);
      return;
    }

    // 1. Fetch raw data from API
    const rawBosses = await fetchBossData();

    // 2. Filter boss categories
    // - Abyss / Reshanta Bosses: id < 10000
    // - Elyos Overland Bosses: id >= 100000 && id < 110000
    // - Asmodian Bosses (id >= 110000) are excluded
    const abyssRaw = rawBosses.filter((b) => b.id < 10000);
    const elyosRaw = rawBosses.filter((b) => b.id >= 100000 && b.id < 110000);

    // 3. Deduplicate, sort, and cap at 25 fields
    const abyssBosses = processBossList(abyssRaw);
    const elyosBosses = processBossList(elyosRaw);

    // 4. Calculate latest map sync timestamp for description
    const elyosSeenTimes = elyosRaw.map((b) => b.seenAt).filter((t) => typeof t === 'number' && t > 0);
    const latestElyosSeen = elyosSeenTimes.length > 0
      ? Math.floor(Math.max(...elyosSeenTimes) / 1000)
      : Math.floor(Date.now() / 1000);

    const abyssSeenTimes = abyssRaw.map((b) => b.seenAt).filter((t) => typeof t === 'number' && t > 0);
    const latestAbyssSeen = abyssSeenTimes.length > 0
      ? Math.floor(Math.max(...abyssSeenTimes) / 1000)
      : latestElyosSeen;

    // 5. Construct the two Discord EmbedBuilder instances
    // - Abyss Embed: Red color (0xe74c3c), title 🔥 Fregion — Reshanta / Abyss Bosses
    const abyssEmbed = createBossEmbed({
      title: '🔥 Fregion — Reshanta / Abyss Bosses',
      color: 0xe74c3c,
      description: `📡 Fregion Abyss data last synced: <t:${latestAbyssSeen}:R>`,
      bosses: abyssBosses
    });

    // - Elyos Embed: Blue color (0x3498db), title 🪽 Fregion — Elyos Overland Field Bosses
    const elyosEmbed = createBossEmbed({
      title: '🪽 Fregion — Elyos Overland Field Bosses',
      color: 0x3498db,
      description: `📡 Fregion Elyos data last synced: <t:${latestElyosSeen}:R>`,
      bosses: elyosBosses
    });

    // Link button: opens Questlog in the browser. Link buttons never trigger
    // interactionCreate, so they can't interfere with the nickname system.
    const linkRow = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setStyle(ButtonStyle.Link)
        .setLabel('View live timers on Questlog')
        .setEmoji('⏱️')
        .setURL(QUESTLOG_PAGE_URL)
    );
    const payload = { embeds: [abyssEmbed, elyosEmbed], components: [linkRow] };

    // 6. Handle Discord message posting or editing
    if (!MESSAGE_ID) {
      // First run: post a new message containing both embeds
      const message = await channel.send(payload);
      MESSAGE_ID = message.id;
      persistMessageId(MESSAGE_ID);

      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log('🎯 [BossTimer] New boss timer message posted successfully!');
      console.log(`📌 Generated MESSAGE_ID: ${MESSAGE_ID}`);
      console.log(`📡 Channel ID: ${CHANNEL_ID}`);
      console.log('ℹ️ Saved to bossTimerConfig.json. Future runs will edit this message in-place.');
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    } else {
      // Subsequent runs: update existing message in-place
      try {
        const message = await channel.messages.fetch(MESSAGE_ID);
        await message.edit(payload);
        console.log(`[BossTimer] ✅ Updated boss timer message (${MESSAGE_ID}) at ${new Date().toLocaleTimeString()}`);
      } catch (err) {
        console.error(`[BossTimer] ❌ Failed to edit message (${MESSAGE_ID}):`, err.message);
        // If the message was deleted from Discord (DiscordAPIError 10008), recreate it
        if (err.code === 10008) {
          console.warn('[BossTimer] ⚠️ Previous message was deleted in Discord. Sending a fresh message...');
          const newMessage = await channel.send(payload);
          MESSAGE_ID = newMessage.id;
          persistMessageId(MESSAGE_ID);
          console.log(`[BossTimer] 📌 New replacement MESSAGE_ID: ${MESSAGE_ID}`);
        }
      }
    }
  } catch (err) {
    console.error('[BossTimer] ❌ Error in update cycle:', err.message);
  } finally {
    isUpdating = false;
  }
}

// ============================================================================
// 6. MODULE INITIALIZATION
// ============================================================================

/**
 * Initializes the Boss Timer tracker:
 * Runs immediately on call and establishes a 3-minute recurring interval.
 *
 * @param {import('discord.js').Client} client - The Discord Client instance
 * @returns {NodeJS.Timeout} The timer interval reference
 */
export function initBossTimer(client) {
  console.log('⏰ [BossTimer] Initializing Aion 2 Field Boss Tracker (3-minute update interval)...');
  console.log(
    process.env.BOSS_TIMER_API_URL
      ? `🔁 [BossTimer] Using relay: ${API_URL.replace(/key=[^&]+/, 'key=***')}`
      : '🌐 [BossTimer] Using Questlog directly (BOSS_TIMER_API_URL not set)'
  );

  // Initial immediate run upon startup
  updateBossTimers(client).catch((err) => {
    console.error('[BossTimer] Initial timer run error:', err.message);
  });

  // Re-fetch and update every 3 minutes
  const intervalId = setInterval(() => {
    updateBossTimers(client).catch((err) => {
      console.error('[BossTimer] Scheduled timer run error:', err.message);
    });
  }, UPDATE_INTERVAL_MS);

  return intervalId;
}
