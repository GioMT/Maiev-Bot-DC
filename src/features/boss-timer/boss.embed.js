import { EmbedBuilder } from 'discord.js';
import { MAJOR_BOSSES } from './questlog.api.js';
import { resolveCustomEmojiShortcodes } from '../../shared/emoji-utils.js';

/**
 * Filters, deduplicates by name, sorts (alive first, then soonest respawn),
 * and caps at 25 entries per embed.
 */
export function processBossList(bossList) {
  if (!Array.isArray(bossList)) return [];

  const sorted = [...bossList].sort((a, b) => {
    if (a.alive && !b.alive) return -1;
    if (!a.alive && b.alive) return 1;
    return a.time - b.time;
  });

  const unique = [];
  const seenNames = new Set();
  for (const boss of sorted) {
    if (!seenNames.has(boss.name)) {
      seenNames.add(boss.name);
      unique.push(boss);
    }
  }

  return unique.slice(0, 50);
}

/**
 * Formats remaining milliseconds:
 * - If >= 1 day: 00d 00h 00m
 * - If < 1 day: 00h 00m
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

export function bossStatus(boss, now) {
  if (boss.alive) return 'Alive';
  const remaining = boss.time - now;
  if (remaining <= 0) return 'Spawning';
  return formatCountdown(remaining);
}

export function buildBossTable(bosses, now, majorBossSet = MAJOR_BOSSES) {
  if (!bosses || bosses.length === 0) return '```\nNo boss data currently available.\n```';

  const nameWidth = Math.max(4, ...bosses.map((b) => b.name.length));
  const entries = bosses.map((b) => ({
    boss: b,
    status: bossStatus(b, now),
    alive: b.alive || b.time - now <= 0
  }));
  const statusWidth = Math.max(6, ...entries.map((e) => e.status.length + 2));
  const header = `${'Boss'.padEnd(nameWidth)}  Status`;
  const divider = `${'─'.repeat(nameWidth)}  ${'─'.repeat(statusWidth)}`;

  const rows = entries.map(({ boss: b, status, alive }) => {
    const dot = alive ? '●' : '○';
    const isMajor = majorBossSet instanceof Set ? majorBossSet.has(b.name) : Array.isArray(majorBossSet) && majorBossSet.includes(b.name);
    const star = isMajor ? '  ★' : '';
    return `${b.name.padEnd(nameWidth)}  ${dot} ${status.padEnd(statusWidth - 2)}${star}`.trimEnd();
  });

  return '```\n' + [header, divider, ...rows].join('\n') + '\n```';
}

export function createBossEmbed({ title, color, bosses, latestSeen, now, majorBossSet = MAJOR_BOSSES }) {
  return new EmbedBuilder()
    .setTitle(title)
    .setColor(color)
    .setDescription(
      `📡 Data last synced: <t:${latestSeen}:R>\n` + buildBossTable(bosses, now, majorBossSet)
    );
}

export function latestSeenSeconds(list) {
  const times = list.map((b) => b.seenAt).filter((t) => typeof t === 'number' && t > 0);
  return times.length > 0 ? Math.floor(Math.max(...times) / 1000) : Math.floor(Date.now() / 1000);
}

export function buildPayload(rawBosses, now = Date.now(), options = {}) {
  const abyssRaw = rawBosses.filter((b) => b.id < 10000);
  const elyosRaw = rawBosses.filter((b) => b.id >= 100000 && b.id < 110000);
  const majorBossSet = options.majorBossSet || MAJOR_BOSSES;
  const guild = options.guild || null;
  const abyssTitle = resolveCustomEmojiShortcodes(
    options.abyssTitle || '🔥 Fregion — Reshanta Bosses',
    guild
  );
  const elyosTitle = resolveCustomEmojiShortcodes(
    options.elyosTitle || '🪽 Fregion — Verteron Field Bosses',
    guild
  );
  const footerText = options.footerText || '● Alive  ○ Respawning (00d 00h 00m)  ★ Major boss  •  Updates every 1m';

  const abyssEmbed = createBossEmbed({
    title: abyssTitle,
    color: 0xe74c3c,
    bosses: processBossList(abyssRaw),
    latestSeen: latestSeenSeconds(abyssRaw),
    now,
    majorBossSet
  });

  const elyosEmbed = createBossEmbed({
    title: elyosTitle,
    color: 0x3498db,
    bosses: processBossList(elyosRaw),
    latestSeen: latestSeenSeconds(elyosRaw),
    now,
    majorBossSet
  }).setFooter({ text: footerText });

  return { embeds: [abyssEmbed, elyosEmbed], components: [] };
}
