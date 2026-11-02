/**
 * Resolve emoji string, custom <:name:id>, or shortcode (:flag_ph:, :earth_asia:, :Cleric:)
 * to a reactable Discord emoji identifier.
 */
export function resolveEmojiToReactable(emojiStr, guild = null) {
  if (!emojiStr) return null;
  const s = emojiStr.trim();

  // Custom Discord emoji: <:name:12345> or <a:name:12345> -> extract ID
  const customMatch = s.match(/:(\d+)>$/);
  if (customMatch) return customMatch[1];

  // Raw numeric custom emoji ID
  if (/^\d+$/.test(s)) return s;

  // Flag shortcode: :flag_xx: (e.g. :flag_ph:, :flag_kr:, :flag_jp:, etc.)
  const flagMatch = s.match(/^:flag_([a-z]{2}):$/i);
  if (flagMatch) {
    const code = flagMatch[1].toUpperCase();
    const c1 = 0x1F1E6 + code.charCodeAt(0) - 65;
    const c2 = 0x1F1E6 + code.charCodeAt(1) - 65;
    return String.fromCodePoint(c1, c2);
  }

  // Common named shortcodes
  const shortcodeMap = {
    ':earth_asia:': '🌏',
    ':earth_americas:': '🌎',
    ':earth_africa:': '🌍',
    ':globe_with_meridians:': '🌐'
  };
  if (shortcodeMap[s.toLowerCase()]) {
    return shortcodeMap[s.toLowerCase()];
  }

  // Custom guild emoji shortcode: :Cleric:, :Abyss:, :WorldBoss:, etc.
  const customShortcodeMatch = s.match(/^:([a-zA-Z0-9_]+):$/);
  if (customShortcodeMatch && guild?.emojis?.cache) {
    const targetName = customShortcodeMatch[1].toLowerCase();
    const cleanTarget = targetName.replace(/[^a-z0-9]/g, '');
    const guildEmoji = guild.emojis.cache.find(e =>
      e.name && (e.name.toLowerCase() === targetName || e.name.toLowerCase().replace(/[^a-z0-9]/g, '') === cleanTarget)
    );
    if (guildEmoji) return guildEmoji.id;
  }

  return s;
}

let lastEmojiFetchAt = 0;

/**
 * Ensure guild emojis are loaded into guild.emojis.cache so custom shortcodes resolve reliably.
 */
export async function ensureGuildEmojisLoaded(guild) {
  if (!guild?.emojis) return;
  const now = Date.now();
  if (guild.emojis.cache.size === 0 || now - lastEmojiFetchAt > 60_000) {
    lastEmojiFetchAt = now;
    await guild.emojis.fetch().catch(() => null);
  }
}

/**
 * Replace :Shortcode: in text with <:Shortcode:ID> from guild.emojis.cache so Discord renders custom server emojis in embeds/messages.
 */
export function resolveCustomEmojiShortcodes(text, guild) {
  if (!text || !guild?.emojis?.cache) return text;
  return String(text).replace(/(?<![<a]):([a-zA-Z0-9_]+):(?!\d+>)/g, (full, name) => {
    const cleanTarget = name.toLowerCase().replace(/[^a-z0-9]/g, '');
    const guildEmoji = guild.emojis.cache.find(e =>
      e.name && (e.name.toLowerCase() === name.toLowerCase() || e.name.toLowerCase().replace(/[^a-z0-9]/g, '') === cleanTarget)
    );
    return guildEmoji ? `<${guildEmoji.animated ? 'a' : ''}:${guildEmoji.name}:${guildEmoji.id}>` : full;
  });
}

/**
 * Match emoji (Unicode or Custom) to a configured nationality/reaction role.
 */
export function findNationalityByEmoji(emoji, nationalityRoles = []) {
  if (!emoji || !Array.isArray(nationalityRoles)) return null;
  const emojiName = emoji.name ? emoji.name.trim() : '';
  const emojiId = emoji.id || '';
  const emojiString = emoji.toString ? emoji.toString() : '';

  return nationalityRoles.find(n => {
    if (!n) return false;
    const nEmojiResolved = resolveEmojiToReactable(n.emoji) || n.emoji;

    // 1. Exact emoji string match
    if (nEmojiResolved && (nEmojiResolved === emojiName || nEmojiResolved === emojiString)) return true;
    if (n.emoji && (n.emoji === emojiName || n.emoji === emojiString)) return true;

    // 2. Custom Discord emoji ID or :Shortcode: name match
    if (emojiId && n.emoji && n.emoji.includes(emojiId)) return true;
    const strippedConfigEmoji = String(n.emoji || '').replace(/^<a?:|:(\d+)>$|^:|:$/g, '').toLowerCase();
    if (strippedConfigEmoji && emojiName && strippedConfigEmoji === emojiName.toLowerCase()) return true;

    // 3. Normalized Unicode match
    if (nEmojiResolved && emojiName && (nEmojiResolved.includes(emojiName) || emojiName.includes(nEmojiResolved))) return true;

    // 4. Code match (e.g. emoji "ph" matches code "ph", or flag_ph matches "ph")
    const cleanEmojiName = emojiName.toLowerCase().replace(/^flag_/, '').replace(/:/g, '');
    if (cleanEmojiName && n.code && cleanEmojiName === n.code.toLowerCase()) return true;

    // 5. Country / Role name match
    if (emojiName && n.name && emojiName.toLowerCase() === n.name.toLowerCase()) return true;

    return false;
  }) || null;
}

/**
 * Extract 2-letter ISO country code from Unicode Regional Indicator flag emoji.
 */
export function extractFlagIsoCode(emoji) {
  if (!emoji) return null;
  try {
    const chars = [...emoji.trim()];
    if (chars.length === 2) {
      const cp1 = chars[0].codePointAt(0);
      const cp2 = chars[1].codePointAt(0);
      if (cp1 >= 0x1F1E6 && cp1 <= 0x1F1FF && cp2 >= 0x1F1E6 && cp2 <= 0x1F1FF) {
        return String.fromCharCode(cp1 - 0x1F1E6 + 65, cp2 - 0x1F1E6 + 65).toLowerCase();
      }
    }
  } catch (_) {}
  return null;
}

/**
 * Safely react to a message with Unicode or Custom emoji.
 */
export async function safelyReact(message, emojiStr) {
  if (!emojiStr || !message) return;
  let reactable = resolveEmojiToReactable(emojiStr, message.guild);
  if (reactable && /^:[a-zA-Z0-9_]+:$/.test(reactable) && message.guild?.emojis) {
    await message.guild.emojis.fetch().catch(() => null);
    reactable = resolveEmojiToReactable(emojiStr, message.guild);
  }
  if (!reactable) return;
  try {
    const cleanInputName = String(emojiStr).trim().replace(/^:|:$/g, '').toLowerCase();
    const alreadyReacted = message.reactions?.cache?.some(r => {
      if (r.me) {
        if (r.emoji.id && r.emoji.id === reactable) return true;
        if (r.emoji.name && (r.emoji.name === reactable || r.emoji.name === emojiStr.trim() || r.emoji.name.toLowerCase() === cleanInputName)) return true;
      }
      return false;
    });
    if (alreadyReacted) return;

    await message.react(reactable);
  } catch (err) {
    console.warn(`[Reaction Roles] Could not auto-react with ${emojiStr}:`, err.message);
  }
}

/**
 * Match nationality input to configured nationality entry.
 */
export function matchNationality(input, nationalityRoles = []) {
  if (!input || !Array.isArray(nationalityRoles) || nationalityRoles.length === 0) return null;
  const cleanInput = input.trim().toLowerCase();

  const emojiMatch = nationalityRoles.find(n => n.emoji && input.includes(n.emoji));
  if (emojiMatch) return emojiMatch;

  const codeMatch = nationalityRoles.find(n => n.code && n.code.toLowerCase() === cleanInput);
  if (codeMatch) return codeMatch;

  const nameMatch = nationalityRoles.find(n => {
    const cleanName = n.name.toLowerCase();
    return cleanName === cleanInput || cleanInput.includes(cleanName) || cleanName.includes(cleanInput);
  });
  if (nameMatch) return nameMatch;

  const words = cleanInput.split(/[^a-z0-9]/).filter(Boolean);
  const wordCodeMatch = nationalityRoles.find(n => words.includes(n.code.toLowerCase()));
  if (wordCodeMatch) return wordCodeMatch;

  if (['globe', 'world', 'other', 'international', 'none', 'all'].some(alias => cleanInput.includes(alias))) {
    const globalEntry = nationalityRoles.find(n => n.code === 'global' || (n.emoji && n.emoji.includes('🌐')));
    if (globalEntry) return globalEntry;
  }

  return null;
}

