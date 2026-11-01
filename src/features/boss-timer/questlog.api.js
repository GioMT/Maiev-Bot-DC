import 'dotenv/config';

export const DEFAULT_SERVER_ID = 1507; // Fregion
export const DEFAULT_CHANNEL_ID = '1563876333623312394';

export const DEFAULT_MAJOR_BOSSES = [
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
];

export const MAJOR_BOSSES = new Set(DEFAULT_MAJOR_BOSSES);

// Fallback sample data when Questlog is unreachable or in local standalone mode
export function getFallbackBossData(now = Date.now()) {
  const seenAt = now - 45 * 1000;
  return [
    // Reshanta / Abyss (id < 10000: IDs 2001..2008)
    { id: 2002, name: 'Watcher Kaira', alive: true, time: now, seenAt },
    { id: 2001, name: 'Argo, the Spirit King', alive: false, time: now + 10 * 60 * 1000, seenAt },
    { id: 2003, name: 'Guardian Lord Nahma', alive: false, time: now + 42 * 60 * 1000, seenAt },
    { id: 2006, name: 'Executor Tamasa', alive: false, time: now + (1 * 3600 + 18 * 60) * 1000, seenAt },
    { id: 2007, name: 'Executor Argo', alive: false, time: now + (3 * 3600 + 45 * 60) * 1000, seenAt },
    { id: 2008, name: 'Executor Kaira', alive: false, time: now + (6 * 3600 + 5 * 60) * 1000, seenAt },
    // Verteron Field Bosses (100000 <= id < 110000: IDs 101001..101024)
    { id: 101023, name: 'Soul Ruler Kashapa', alive: true, time: now, seenAt },
    { id: 101022, name: 'Silent Dartan', alive: false, time: now + 24 * 60 * 1000, seenAt },
    { id: 101021, name: 'Eternal Gartua', alive: false, time: now + (2 * 3600 + 15 * 60) * 1000, seenAt },
    { id: 101024, name: 'High Commander Lagta', alive: false, time: now + (5 * 3600 + 30 * 60) * 1000, seenAt },
    { id: 101003, name: 'Kernon of the West', alive: false, time: now + (6 * 3600 + 10 * 60) * 1000, seenAt },
    { id: 101001, name: 'Neikel of the East', alive: false, time: now + (7 * 3600 + 25 * 60) * 1000, seenAt },
    { id: 101013, name: 'Centurion Demiros', alive: false, time: now + (8 * 3600 + 12 * 60) * 1000, seenAt },
    { id: 101002, name: 'Rotten Kutar', alive: false, time: now + (9 * 3600 + 40 * 60) * 1000, seenAt },
    { id: 101016, name: 'Sentinel K\'nash', alive: false, time: now + (10 * 3600 + 15 * 60) * 1000, seenAt },
    { id: 101006, name: 'Bodyguard Teegant', alive: false, time: now + (11 * 3600 + 50 * 60) * 1000, seenAt },
    { id: 101004, name: 'Kusan the Mad Gladiator', alive: false, time: now + (13 * 3600 + 5 * 60) * 1000, seenAt },
    { id: 101005, name: 'Ritualist Garshim', alive: false, time: now + (15 * 3600 + 20 * 60) * 1000, seenAt },
    { id: 101007, name: 'Blooming Korin', alive: false, time: now + (7 * 3600 + 30 * 60) * 1000, seenAt },
    { id: 101017, name: 'Scholar Aulla', alive: false, time: now + (8 * 3600 + 50 * 60) * 1000, seenAt },
    { id: 101019, name: 'Chaser Taulo', alive: false, time: now + (9 * 3600 + 15 * 60) * 1000, seenAt },
    { id: 101008, name: 'Furious Saursus', alive: false, time: now + (10 * 3600 + 40 * 60) * 1000, seenAt },
    { id: 101009, name: 'Bloodfang Pnyn', alive: false, time: now + (11 * 3600 + 20 * 60) * 1000, seenAt },
    { id: 101020, name: 'Researcher Setram', alive: false, time: now + (12 * 3600 + 10 * 60) * 1000, seenAt },
    { id: 101010, name: 'Heretic Layla', alive: false, time: now + (13 * 3600 + 35 * 60) * 1000, seenAt },
    { id: 101015, name: 'Harvest Manager Moshav', alive: false, time: now + (14 * 3600 + 50 * 60) * 1000, seenAt },
    { id: 101014, name: 'Divine Ansas', alive: false, time: now + (16 * 3600 + 15 * 60) * 1000, seenAt },
    { id: 101012, name: 'Phantasm Kasia', alive: false, time: now + (17 * 3600 + 45 * 60) * 1000, seenAt },
    { id: 101018, name: 'Forest Warrior Aullamu', alive: false, time: now + (19 * 3600 + 10 * 60) * 1000, seenAt },
    { id: 101011, name: 'Black Tentacle Lawa', alive: false, time: now + (21 * 3600 + 25 * 60) * 1000, seenAt }
  ];
}

export function getQuestlogApiUrl(serverId = DEFAULT_SERVER_ID) {
  return process.env.BOSS_TIMER_API_URL ||
    `https://questlog.gg/aion-2/api/trpc/fieldBoss.timers?input=${encodeURIComponent(
      JSON.stringify({ server: Number(serverId) || DEFAULT_SERVER_ID, language: 'en' })
    )}`;
}

export const SERVER_ID = DEFAULT_SERVER_ID;
export const CHANNEL_ID = DEFAULT_CHANNEL_ID;
export const API_URL = getQuestlogApiUrl(DEFAULT_SERVER_ID);

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
export const COUNTDOWN_INTERVAL_MS = 60 * 1000; // 1 minute
export const QUESTLOG_PAGE_URL = `https://questlog.gg/aion-2/en/field-bosses?server=${SERVER_ID}`;

/**
 * Fetches boss timers from Questlog API or configured Cloudflare Worker relay.
 * @param {number} [serverId=DEFAULT_SERVER_ID]
 * @returns {Promise<Array<Object>>}
 */
export async function fetchBossData(serverId = DEFAULT_SERVER_ID) {
  const url = getQuestlogApiUrl(serverId);
  const response = await fetch(url, { headers: HEADERS });
  if (!response.ok) {
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
