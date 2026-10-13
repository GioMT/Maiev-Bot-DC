import {
  Client,
  GatewayIntentBits,
  Partials,
  REST,
  Routes,
  SlashCommandBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  EmbedBuilder,
  PermissionFlagsBits,
  ChannelType
} from 'discord.js';
import dotenv from 'dotenv';
import express from 'express';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const CONFIG_FILE = path.join(__dirname, 'config.json');

const {
  DISCORD_TOKEN,
  CLIENT_ID,
  GUILD_ID
} = process.env;

const PORT = process.env.SERVER_PORT || process.env.PORT || 3000;

// Validate essential environment variables
if (!DISCORD_TOKEN || !CLIENT_ID) {
  console.error('\n❌ ERROR: Missing DISCORD_TOKEN or CLIENT_ID in .env file!');
  process.exit(1);
}

// ──────────────────────────────────────────
// PERSISTENT CONFIGURATION STORAGE
// ──────────────────────────────────────────
let config = {
  onboardedRoleId: process.env.ONBOARDED_ROLE_ID || '',
  ignRolesToAdd: [],
  ignRolesToRemove: [],
  rulesChannelId: process.env.RULES_CHANNEL_ID || '',
  verifyChannelId: process.env.VERIFY_CHANNEL_ID || '',
  rulesTitle: process.env.RULES_TITLE || '📜 Server Rules & Guidelines',
  rulesContent: process.env.RULES_CONTENT || (
    'Welcome to the community! Before proceeding, please review our core server rules:\n\n' +
    '**1. Respect Everyone** — Treat all members with courtesy and kindness. Zero tolerance for harassment, bullying, trolling, or starting unnecessary drama.\n' +
    '**2. No Discrimination or Hate Speech** — Do not use slurs, defamatory, or abusive language. Any discrimination based on race, sex, gender, or identity will lead to an immediate ban.\n' +
    '**3. No Threats or Intimidation** — Do not threaten, blackmail, or intimidate anyone on this server. Personal safety is strictly enforced.\n' +
    '**4. Keep Content Appropriate** — Keep discussions in the relevant channels. No NSFW, sexually explicit, graphic, or offensive content.\n' +
    '**5. No Illegal Content** — Sharing pirated materials, malicious links, malware, or any illegal content is strictly prohibited.\n' +
    '**6. No Advertisements or Spam** — Self-promotion, unsolicited advertising, and referral links are prohibited. Streamers may promote themselves in the designated promotion channel as long as it is related to the game. Offenders will be muted.\n' +
    '**7. Server Language Policy** — Speak in English as much as possible since we have international guild mate for community inclusivity and moderation.\n' +
    '**8. No Political or Religious Debates** — Political and religious discussions or arguments are prohibited on this server.\n' +
    '**9. Follow Game Terms of Service** — Respect game rules at all times. No exploits, account selling, botting, or unapproved third-party software.\n' +
    '**10. Listen to Staff** — Follow moderator instructions at all times and remain respectful to all staff and team members.\n\n' +
    '━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n' +
    '**Next Step:** Click the button below to acknowledge the rules. You will receive the **[Compliant]** role, unlocking the **#identity-verification** channel where you can set your AION 2 In-Game Name with **Maiev**!'
  ),
  rulesFooter: process.env.RULES_FOOTER || 'Acknowledge the rules below to proceed',
  verifyTitle: process.env.VERIFY_TITLE || '🛡️ Maiev — AION 2 IGN Verification',
  verifyContent: process.env.VERIFY_CONTENT || (
    'Welcome to **{server}**!\n\n' +
    'To proceed, please register your **AION 2 In-Game Name (IGN)**:\n\n' +
    '**How it works:**\n' +
    '1. Click the **"🎮 Set AION 2 IGN & Verify"** button below.\n' +
    '2. Enter your exact in-game character name.\n' +
    '3. Maiev will update your server nickname to your IGN, grant you **[Unverified]** and **[Elyos Fregion]**, and remove **[Compliant]** so you can post your screenshot in the verification channel!'
  ),
  verifyFooter: process.env.VERIFY_FOOTER || 'Maiev Verification System • AION 2',
  welcomeTitle: process.env.WELCOME_TITLE || '🎉 Welcome to {server}, {ign}!',
  welcomeContent: process.env.WELCOME_CONTENT || (
    'Your AION 2 IGN has been successfully registered as **{ign}**!\n\n' +
    '• **Roles Granted:** **{roles}**\n' +
    '• **Channel Updated:** **#verify-ign** has been closed\n\n' +
    '📸 **Next Step:** The exclusive community channels are now unlocked! Please post your character screenshot in the verification channel for staff approval.'
  ),
  welcomeFooter: process.env.WELCOME_FOOTER || '{server} • AION 2 Elyos Legion',
  welcomeAnnouncementChannelId: '',
  enableWelcomeAnnouncement: true,
  welcomeAnnouncementMessage: '👋 Welcome to **{server}**, {user}! Registered as **{ign}**. Welcome to the Legion, Daeva!',
  nationalityChannelId: process.env.NATIONALITY_CHANNEL_ID || '',
  nationalityTitle: '🌍 Choose Your Nationality',
  nationalityContent: '',
  nationalityFooter: 'React with a flag emoji below to toggle your role',
  nationalityMessageIds: [],
  nationalityRoles: [
    { code: 'ph', name: 'Philippines', emoji: '🇵🇭', roleId: '' }
  ]
};

// Load config.json if available
try {
  if (fs.existsSync(CONFIG_FILE)) {
    const raw = fs.readFileSync(CONFIG_FILE, 'utf-8');
    config = { ...config, ...JSON.parse(raw) };
  }
} catch (err) {
  console.warn('⚠️ Could not read config.json, using defaults:', err.message);
}

// Active SSE clients for real-time Web UI synchronization
const sseClients = new Set();

function broadcastConfigUpdate() {
  const payload = JSON.stringify({
    type: 'config_updated',
    config,
    timestamp: Date.now()
  });
  for (const clientRes of sseClients) {
    try {
      clientRes.write(`data: ${payload}\n\n`);
    } catch (_) {
      sseClients.delete(clientRes);
    }
  }
}

// Keep-alive heartbeat every 25s
setInterval(() => {
  for (const clientRes of sseClients) {
    try {
      clientRes.write(': keepalive\n\n');
    } catch (_) {
      sseClients.delete(clientRes);
    }
  }
}, 25000);

// Save config helper
function saveConfig(newConfig) {
  config = { ...config, ...newConfig };
  try {
    fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2), 'utf-8');
  } catch (err) {
    console.error('⚠️ Failed to save config.json:', err.message);
  }
  broadcastConfigUpdate();
}

// ──────────────────────────────────────────
// PERSISTENT REACTION TRACKING (FOR LEAVE PURGE)
// ──────────────────────────────────────────
const REACTIONS_FILE = path.join(__dirname, 'reactions-tracker.json');
let trackedReactions = {}; // { [userId]: [ { guildId, channelId, messageId, emoji } ] }

function loadTrackedReactions() {
  try {
    if (fs.existsSync(REACTIONS_FILE)) {
      const raw = fs.readFileSync(REACTIONS_FILE, 'utf-8');
      trackedReactions = JSON.parse(raw);
    }
  } catch (err) {
    console.warn('⚠️ Could not read reactions-tracker.json, initializing empty:', err.message);
    trackedReactions = {};
  }
}
loadTrackedReactions();

let saveReactionsTimeout = null;
function saveTrackedReactionsDebounced() {
  if (saveReactionsTimeout) clearTimeout(saveReactionsTimeout);
  saveReactionsTimeout = setTimeout(() => {
    try {
      fs.writeFileSync(REACTIONS_FILE, JSON.stringify(trackedReactions, null, 2), 'utf-8');
    } catch (err) {
      console.warn('⚠️ Failed to save reactions-tracker.json:', err.message);
    }
  }, 1000);
}

function trackUserReaction(guildId, userId, channelId, messageId, emojiIdentifier) {
  if (!userId || !messageId) return;
  if (!trackedReactions[userId]) trackedReactions[userId] = [];
  const exists = trackedReactions[userId].some(
    r => r.messageId === messageId && r.emoji === emojiIdentifier
  );
  if (!exists) {
    trackedReactions[userId].push({ guildId, channelId, messageId, emoji: emojiIdentifier });
    saveTrackedReactionsDebounced();
  }
}

function untrackUserReaction(guildId, userId, channelId, messageId, emojiIdentifier) {
  if (!userId || !trackedReactions[userId]) return;
  trackedReactions[userId] = trackedReactions[userId].filter(
    r => !(r.messageId === messageId && r.emoji === emojiIdentifier)
  );
  if (trackedReactions[userId].length === 0) {
    delete trackedReactions[userId];
  }
  saveTrackedReactionsDebounced();
}

function getUserTrackedReactions(userId) {
  return trackedReactions[userId] || [];
}

function clearUserTrackedReactions(userId) {
  if (trackedReactions[userId]) {
    delete trackedReactions[userId];
    saveTrackedReactionsDebounced();
  }
}

// Helper: Resolve emoji string, custom <:name:id>, or shortcode (:flag_ph:, :earth_asia:) to a reactable Discord emoji identifier
function resolveEmojiToReactable(emojiStr) {
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

  return s;
}

// Helper: Match emoji (Unicode or Custom) to a configured nationality role
function findNationalityByEmoji(emoji, nationalityRoles = []) {
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

    // 2. Custom Discord emoji ID match <:name:id>
    if (emojiId && n.emoji && n.emoji.includes(emojiId)) return true;

    // 3. Normalized Unicode match
    if (nEmojiResolved && emojiName && (nEmojiResolved.includes(emojiName) || emojiName.includes(nEmojiResolved))) return true;

    // 4. Code match (e.g. emoji "ph" matches code "ph", or flag_ph matches "ph")
    const cleanEmojiName = emojiName.toLowerCase().replace(/^flag_/, '').replace(/:/g, '');
    if (cleanEmojiName && n.code && cleanEmojiName === n.code.toLowerCase()) return true;

    // 5. Country name match
    if (emojiName && n.name && emojiName.toLowerCase() === n.name.toLowerCase()) return true;

    return false;
  }) || null;
}

// Helper: Extract 2-letter ISO country code from Unicode Regional Indicator flag emoji
function extractFlagIsoCode(emoji) {
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

// Helper: Safely react to a message with Unicode or Custom emoji
async function safelyReact(message, emojiStr) {
  if (!emojiStr || !message) return;
  const reactable = resolveEmojiToReactable(emojiStr);
  if (!reactable) return;
  try {
    const alreadyReacted = message.reactions?.cache?.some(r => {
      if (r.me) {
        if (r.emoji.id && r.emoji.id === reactable) return true;
        if (r.emoji.name && (r.emoji.name === reactable || r.emoji.name === emojiStr.trim())) return true;
      }
      return false;
    });
    if (alreadyReacted) return;

    await message.react(reactable);
  } catch (err) {
    console.warn(`[Reaction Roles] Could not auto-react with ${emojiStr}:`, err.message);
  }
}

// Helper: React to a nationality message with all configured flag emojis in order
async function reactToNationalityCard(message) {
  if (!message) return;
  const emojisToReact = [];

  // 1. All configured nationality roles (in configured list order)
  for (const n of (config.nationalityRoles || [])) {
    if (n && n.emoji) {
      const r = resolveEmojiToReactable(n.emoji);
      if (r && !emojisToReact.includes(r)) emojisToReact.push(r);
    }
  }

  // 2. Scan embed description only (not title) for any additional flag emojis or shortcodes
  if (Array.isArray(message.embeds)) {
    for (const emb of message.embeds) {
      const text = emb.description || '';
      // Flag shortcodes
      const scMatches = text.match(/:(flag_[a-z]{2}|earth_asia|earth_americas|earth_africa|globe_with_meridians):/gi) || [];
      for (const sc of scMatches) {
        const r = resolveEmojiToReactable(sc);
        if (r && !emojisToReact.includes(r)) emojisToReact.push(r);
      }
      // Unicode regional indicator flags
      const flagMatches = text.match(/\p{Regional_Indicator}{2}/gu) || [];
      for (const fl of flagMatches) {
        if (!emojisToReact.includes(fl)) emojisToReact.push(fl);
      }
    }
  }

  for (const em of emojisToReact) {
    await safelyReact(message, em);
  }
}

// Helper: Match nationality input to configured nationality entry
function matchNationality(input, nationalityRoles = []) {
  if (!input || !Array.isArray(nationalityRoles) || nationalityRoles.length === 0) return null;
  const cleanInput = input.trim().toLowerCase();

  // 1. Emoji match
  const emojiMatch = nationalityRoles.find(n => n.emoji && input.includes(n.emoji));
  if (emojiMatch) return emojiMatch;

  // 2. Exact code match (e.g. "ph", "jp", "us", "kr")
  const codeMatch = nationalityRoles.find(n => n.code && n.code.toLowerCase() === cleanInput);
  if (codeMatch) return codeMatch;

  // 3. Name match or inclusion (e.g. "philippines", "japan")
  const nameMatch = nationalityRoles.find(n => {
    const cleanName = n.name.toLowerCase();
    return cleanName === cleanInput || cleanInput.includes(cleanName) || cleanName.includes(cleanInput);
  });
  if (nameMatch) return nameMatch;

  // 4. Word tokens match (e.g. "PH Elyos", "USA player")
  const words = cleanInput.split(/[^a-z0-9]/).filter(Boolean);
  const wordCodeMatch = nationalityRoles.find(n => words.includes(n.code.toLowerCase()));
  if (wordCodeMatch) return wordCodeMatch;

  // 5. Globe / Other aliases
  if (['globe', 'world', 'other', 'international', 'none', 'all'].some(alias => cleanInput.includes(alias))) {
    const globalEntry = nationalityRoles.find(n => n.code === 'global' || (n.emoji && n.emoji.includes('🌐')));
    if (globalEntry) return globalEntry;
  }

  return null;
}

// Helper: Generate ActionRows with Nationality Buttons
function createNationalityButtonRows(nationalityRoles = []) {
  const activeNats = (nationalityRoles || []).filter(n => n && n.name);
  const rows = [];
  // Discord limit: Max 5 buttons per ActionRow, max 5 rows per message
  for (let i = 0; i < activeNats.length && i < 25; i += 4) {
    const chunk = activeNats.slice(i, i + 4);
    const row = new ActionRowBuilder();
    for (const item of chunk) {
      row.addComponents(
        new ButtonBuilder()
          .setCustomId(`btn_nat_${item.code}`)
          .setLabel(`${item.emoji || ''} ${item.name}`.trim())
          .setStyle(ButtonStyle.Secondary)
      );
    }
    rows.push(row);
  }
  return rows;
}

// Helper: Build Nationality Reaction Roles Message
function createNationalityMessage(guild) {
  const activeNats = (config.nationalityRoles || []).filter(n => n && n.name);
  const formattedList = activeNats.length > 0
    ? activeNats.map(n => `${n.emoji} **${n.name}** (\`${n.code.toUpperCase()}\`)`).join('\n')
    : '*(No nationality flags configured yet)*';

  const title = config.nationalityTitle || '🌍 Choose Your Nationality';
  const rawDesc = config.nationalityContent || (
    `Welcome to **{server}**!\n\n` +
    `Please select your nationality flag below to unlock access to your regional legion channels:\n\n` +
    `${formattedList}\n\n` +
    `━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
    `👉 **React with your flag emoji below** to receive your nationality role!`
  );
  const description = rawDesc.replace(/{server}/g, guild.name);
  const footer = config.nationalityFooter || 'React with a flag emoji below to toggle your role';

  const embed = new EmbedBuilder()
    .setColor(0x00d2ff)
    .setTitle(title)
    .setDescription(description)
    .setThumbnail(guild.iconURL({ dynamic: true }) || undefined)
    .setFooter({ text: footer });

  return { embeds: [embed] };
}

// ──────────────────────────────────────────
// DISCORD CLIENT INITIALIZATION
// ──────────────────────────────────────────
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.GuildMessageReactions
  ],
  partials: [
    Partials.GuildMember,
    Partials.User,
    Partials.Message,
    Partials.Reaction
  ]
});

// Helper: Resolve or find role by ID or Name
async function resolveRole(guild, roleId, fallbackNames = []) {
  if (roleId) {
    const role = await guild.roles.fetch(roleId).catch(() => null);
    if (role) return role;
  }
  // Ensure all roles are fetched so cache is fully populated
  const roles = await guild.roles.fetch().catch(() => guild.roles.cache);
  return roles.find(r => {
    const cleanRoleName = r.name.replace(/[[\]]/g, '').trim().toLowerCase();
    return fallbackNames.some(name => {
      const cleanTarget = name.replace(/[[\]]/g, '').trim().toLowerCase();
      return cleanRoleName === cleanTarget || cleanRoleName.includes(cleanTarget) || cleanTarget.includes(cleanRoleName);
    });
  }) || null;
}

// Helper: Resolve channel by ID or Name
async function resolveChannel(guild, channelId, fallbackPattern = /verif/i) {
  if (channelId) {
    const ch = await guild.channels.fetch(channelId).catch(() => null);
    if (ch && ch.isTextBased()) return ch;
  }
  const channels = await guild.channels.fetch().catch(() => guild.channels.cache);
  return channels.find(ch => {
    if (!ch || !ch.isTextBased()) return false;
    const n = (ch.name || '').normalize('NFKD');
    return fallbackPattern.test(ch.name) || fallbackPattern.test(n);
  }) || null;
}

// Helper: Check if member already completed verification / has access roles beyond onboarding
async function hasCompletedVerification(guild, member) {
  if (!member || !member.roles) return false;

  // 1. Check configured roles to add on IGN verification (e.g. [Unverified], [Elyos Fregion])
  if (Array.isArray(config.ignRolesToAdd) && config.ignRolesToAdd.length > 0) {
    for (const roleId of config.ignRolesToAdd) {
      if (roleId && member.roles.cache.has(roleId)) return true;
    }
  }

  // 2. Check role names that indicate completed IGN verification or staff access
  const accessKeywords = ['unverified', 'verified', 'elyos fregion', 'legion leader', 'moderator'];
  const hasAccessName = member.roles.cache.some(r => {
    const cleanName = r.name.replace(/[[\]]/g, '').trim().toLowerCase();
    return accessKeywords.some(keyword => cleanName === keyword || cleanName.includes(keyword));
  });
  if (hasAccessName) return true;

  return false;
}

// Helper: Find a message across channels in the guild
async function findMessageAcrossGuild(guild, messageId, hintChannelId = null) {
  if (hintChannelId) {
    const channel = await guild.channels.fetch(hintChannelId).catch(() => null);
    if (channel && channel.isTextBased()) {
      const msg = await channel.messages.fetch(messageId).catch(() => null);
      if (msg) return msg;
    }
  }

  const channels = await guild.channels.fetch().catch(() => guild.channels.cache);
  for (const channel of channels.values()) {
    if (!channel || !channel.isTextBased()) continue;
    const perms = channel.permissionsFor(guild.members.me);
    if (!perms || !perms.has(PermissionFlagsBits.ViewChannel)) continue;
    const msg = await channel.messages.fetch(messageId).catch(() => null);
    if (msg) return msg;
  }
  return null;
}

// Core: Remove all reactions of a user when they leave the server
async function cleanupUserReactionsOnLeave(guild, userId, userTag = '') {
  let removedCount = 0;
  const scannedMessageIds = new Set();
  const botMember = guild.members.me;

  const hasManageMessages = botMember.permissions.has(PermissionFlagsBits.ManageMessages);
  if (!hasManageMessages) {
    console.warn(`[Reaction Cleanup] ⚠️ Bot lacks 'Manage Messages' permission in server "${guild.name}". It must have 'Manage Messages' to delete other users' reactions.`);
  }

  const candidateMessages = [];

  // 1. Check messages from persistent reaction tracker
  const tracked = getUserTrackedReactions(userId);
  for (const item of tracked) {
    if (item.guildId && item.guildId !== guild.id) continue;
    if (scannedMessageIds.has(item.messageId)) continue;
    scannedMessageIds.add(item.messageId);

    try {
      const channel = await guild.channels.fetch(item.channelId).catch(() => null);
      if (channel && channel.isTextBased()) {
        const msg = await channel.messages.fetch(item.messageId).catch(() => null);
        if (msg) candidateMessages.push(msg);
      }
    } catch (_) {}
  }

  // 2. Check tracked nationality messages from config
  if (Array.isArray(config.nationalityMessageIds)) {
    for (const item of config.nationalityMessageIds) {
      const msgId = typeof item === 'object' && item?.messageId ? item.messageId : item;
      const chId = typeof item === 'object' && item?.channelId ? item.channelId : null;
      if (scannedMessageIds.has(msgId)) continue;
      scannedMessageIds.add(msgId);
      const msg = await findMessageAcrossGuild(guild, msgId, chId);
      if (msg) candidateMessages.push(msg);
    }
  }

  // 3. Check configured channels (rules, verify, welcome)
  const channelIdsToCheck = [
    config.rulesChannelId,
    config.verifyChannelId,
    config.welcomeAnnouncementChannelId
  ].filter(Boolean);

  for (const chId of channelIdsToCheck) {
    try {
      const ch = await guild.channels.fetch(chId).catch(() => null);
      if (ch && ch.isTextBased()) {
        const recent = await ch.messages.fetch({ limit: 15 }).catch(() => null);
        if (recent) {
          for (const msg of recent.values()) {
            if (!scannedMessageIds.has(msg.id) && msg.reactions.cache.size > 0) {
              scannedMessageIds.add(msg.id);
              candidateMessages.push(msg);
            }
          }
        }
      }
    } catch (_) {}
  }

  // 4. Scan text channels for nationality reaction cards created by the bot
  const channels = await guild.channels.fetch().catch(() => guild.channels.cache);
  for (const channel of channels.values()) {
    if (!channel || !channel.isTextBased()) continue;
    const perms = channel.permissionsFor(botMember);
    if (!perms || !perms.has(PermissionFlagsBits.ViewChannel)) continue;
    try {
      const recent = await channel.messages.fetch({ limit: 10 }).catch(() => null);
      if (recent) {
        for (const msg of recent.values()) {
          const isRoleCard = msg.author?.id === client.user?.id && (
            msg.embeds?.some(e => e.title && /nationality|regional|choose your/i.test(e.title)) ||
            config.nationalityMessageIds?.some(id => (typeof id === 'object' ? id.messageId : id) === msg.id)
          );
          if (isRoleCard && !scannedMessageIds.has(msg.id)) {
            scannedMessageIds.add(msg.id);
            candidateMessages.push(msg);
          }
        }
      }
    } catch (_) {}
  }

  // 5. Remove user's reactions
  for (const msg of candidateMessages) {
    const channel = msg.channel;
    const botPerms = channel.permissionsFor(botMember);
    if (!botPerms || !botPerms.has(PermissionFlagsBits.ManageMessages)) {
      console.warn(`[Reaction Cleanup] ⚠️ Cannot remove reactions on msg ${msg.id} in #${channel.name}: Missing 'Manage Messages' permission.`);
      continue;
    }

    for (const reaction of msg.reactions.cache.values()) {
      try {
        let after = undefined;
        let hasUserReacted = false;
        while (!hasUserReacted) {
          const users = await reaction.users.fetch({ limit: 100, after });
          if (!users || users.size === 0) break;
          if (users.has(userId)) {
            hasUserReacted = true;
            break;
          }
          if (users.size < 100) break;
          after = users.lastKey();
        }

        if (hasUserReacted) {
          await reaction.users.remove(userId);
          removedCount++;
          console.log(`[Reaction Cleanup] 🗑️ Removed ${reaction.emoji.name} from msg ${msg.id} in #${channel.name} for former member ${userTag || userId}`);
        }
      } catch (rxErr) {
        console.warn(`[Reaction Cleanup] Failed to remove ${reaction.emoji.name} from msg ${msg.id}:`, rxErr.message);
      }
    }
  }

  clearUserTrackedReactions(userId);
  return { removedCount, messagesScanned: candidateMessages.length };
}

// Purge reactions from former members who already left
async function purgeGhostReactions(guild, targetChannel = null) {
  let totalPurged = 0;
  const purgedMembers = new Map();
  const botMember = guild.members.me;

  const messagesToInspect = [];

  if (targetChannel && targetChannel.isTextBased()) {
    const recent = await targetChannel.messages.fetch({ limit: 50 }).catch(() => null);
    if (recent) {
      for (const m of recent.values()) {
        if (m.reactions.cache.size > 0) messagesToInspect.push(m);
      }
    }
  } else {
    if (Array.isArray(config.nationalityMessageIds)) {
      for (const item of config.nationalityMessageIds) {
        const msgId = typeof item === 'object' && item?.messageId ? item.messageId : item;
        const chId = typeof item === 'object' && item?.channelId ? item.channelId : null;
        const msg = await findMessageAcrossGuild(guild, msgId, chId);
        if (msg) messagesToInspect.push(msg);
      }
    }
    const channels = await guild.channels.fetch().catch(() => guild.channels.cache);
    for (const ch of channels.values()) {
      if (!ch || !ch.isTextBased()) continue;
      const perms = ch.permissionsFor(botMember);
      if (!perms || !perms.has(PermissionFlagsBits.ViewChannel)) continue;
      const recent = await ch.messages.fetch({ limit: 15 }).catch(() => null);
      if (recent) {
        for (const m of recent.values()) {
          const isBotCard = m.author?.id === client.user?.id && (
            m.embeds?.some(e => e.title && /nationality|regional|choose your/i.test(e.title)) ||
            config.nationalityMessageIds?.some(id => (typeof id === 'object' ? id.messageId : id) === m.id)
          );
          if (isBotCard && !messagesToInspect.some(existing => existing.id === m.id)) {
            messagesToInspect.push(m);
          }
        }
      }
    }
  }

  // Ensure member cache is loaded
  await guild.members.fetch().catch(() => null);

  for (const msg of messagesToInspect) {
    const channel = msg.channel;
    const botPerms = channel.permissionsFor(botMember);
    if (!botPerms || !botPerms.has(PermissionFlagsBits.ManageMessages)) {
      console.warn(`[Reaction Purge] ⚠️ Missing 'Manage Messages' permission in #${channel.name}.`);
      continue;
    }

    for (const reaction of msg.reactions.cache.values()) {
      try {
        let after = undefined;
        let done = false;
        while (!done) {
          const users = await reaction.users.fetch({ limit: 100, after });
          if (!users || users.size === 0) break;

          for (const user of users.values()) {
            if (user.bot) continue;

            const isCurrentMember = guild.members.cache.has(user.id);
            if (!isCurrentMember) {
              await reaction.users.remove(user.id).catch(() => null);
              totalPurged++;
              const existing = purgedMembers.get(user.id) || { tag: user.tag || user.username || user.id, count: 0 };
              existing.count++;
              purgedMembers.set(user.id, existing);
              console.log(`[Reaction Purge] 🗑️ Purged ghost reaction ${reaction.emoji.name} from former member ${user.tag} (${user.id})`);
            }
          }

          if (users.size < 100) break;
          after = users.lastKey();
        }
      } catch (err) {
        console.warn(`[Reaction Purge] Error on reaction ${reaction.emoji.name}:`, err.message);
      }
    }
  }

  return {
    totalPurged,
    purgedMembers: Array.from(purgedMembers.values()),
    messagesInspected: messagesToInspect.length
  };
}


// Build: Server Rules Embed & Acceptance Button
function createRulesMessage() {
  const embed = new EmbedBuilder()
    .setColor(0x2B2D31)
    .setTitle(config.rulesTitle || '📜 Server Rules & Guidelines')
    .setDescription(
      config.rulesContent ||
      'Welcome to the community! Before proceeding, please review our core server rules:\n\n' +
      '**1. Respect Everyone** — Treat all members with courtesy and kindness. Zero tolerance for harassment, bullying, trolling, or starting unnecessary drama.\n' +
      '**2. No Discrimination or Hate Speech** — Do not use slurs, defamatory, or abusive language. Any discrimination based on race, sex, gender, or identity will lead to an immediate ban.\n' +
      '**3. No Threats or Intimidation** — Do not threaten, blackmail, or intimidate anyone on this server. Personal safety is strictly enforced.\n' +
      '**4. Keep Content Appropriate** — Keep discussions in the relevant channels. No NSFW, sexually explicit, graphic, or offensive content.\n' +
      '**5. No Illegal Content** — Sharing pirated materials, malicious links, malware, or any illegal content is strictly prohibited.\n' +
      '**6. No Advertisements or Spam** — Self-promotion, unsolicited advertising, and referral links are prohibited. Streamers may promote themselves in the designated promotion channel as long as it is related to the game. Offenders will be muted.\n' +
      '**7. Server Language Policy** — Speak in English as much as possible since we have international guild mate for community inclusivity and moderation.\n' +
      '**8. No Political or Religious Debates** — Political and religious discussions or arguments are prohibited on this server.\n' +
      '**9. Follow Game Terms of Service** — Respect game rules at all times. No exploits, account selling, botting, or unapproved third-party software.\n' +
      '**10. Listen to Staff** — Follow moderator instructions at all times and remain respectful to all staff and team members.\n\n' +
      '━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n' +
      '**Next Step:** Click the button below to acknowledge the rules. You will receive the **[Compliant]** role, unlocking the **#identity-verification** channel where you can set your AION 2 In-Game Name with **Maiev**!'
    )
    .setFooter({ text: config.rulesFooter || 'Acknowledge the rules below to proceed' });

  const button = new ButtonBuilder()
    .setCustomId('btn_accept_rules')
    .setLabel('✅ I Have Read & Agree to the Rules')
    .setStyle(ButtonStyle.Success);

  return { embeds: [embed], components: [new ActionRowBuilder().addComponents(button)] };
}

// Build: Maiev AION 2 Verification Card
function createVerifyMessage(guild) {
  const title = config.verifyTitle || '🛡️ Maiev — AION 2 IGN Verification';
  const rawDescription = config.verifyContent || (
    'Welcome to **{server}**!\n\n' +
    'To proceed, please register your **AION 2 In-Game Name (IGN)**:\n\n' +
    '**How it works:**\n' +
    '1. Click the **"🎮 Set AION 2 IGN & Verify"** button below.\n' +
    '2. Enter your exact in-game character name.\n' +
    '3. Maiev will update your server nickname to your IGN, grant you **[Unverified]** and **[Elyos Fregion]**, and remove **[Compliant]** so you can post your screenshot in the verification channel!'
  );
  const description = rawDescription.replace(/{server}/g, guild.name);
  const footer = config.verifyFooter || 'Maiev Verification System • AION 2';

  const embed = new EmbedBuilder()
    .setColor(0x5865F2)
    .setTitle(title)
    .setDescription(description)
    .setThumbnail(guild.iconURL({ dynamic: true }) || undefined)
    .setFooter({ text: footer });

  const button = new ButtonBuilder()
    .setCustomId('btn_open_ign_modal')
    .setLabel('🎮 Set AION 2 IGN & Verify')
    .setStyle(ButtonStyle.Primary);

  return { embeds: [embed], components: [new ActionRowBuilder().addComponents(button)] };
}

// Slash Commands Definition
const slashCommands = [
  new SlashCommandBuilder()
    .setName('post-rules')
    .setDescription('Post the server rules card with the acknowledgment button (Admin only)')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  new SlashCommandBuilder()
    .setName('post-verify')
    .setDescription('Post Maiev’s AION 2 verification card with the IGN button (Admin only)')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  new SlashCommandBuilder()
    .setName('post-nationality')
    .setDescription('Post or update nationality role card with flag emoji reactions (Admin only)')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addBooleanOption(option =>
      option
        .setName('force_new')
        .setDescription('Create a brand-new message instead of updating the existing one')
        .setRequired(false)
    ),

  new SlashCommandBuilder()
    .setName('post-nationality-roles')
    .setDescription('Post or update nationality role card with flag emoji reactions (Admin only)')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addBooleanOption(option =>
      option
        .setName('force_new')
        .setDescription('Create a brand-new message instead of updating the existing one')
        .setRequired(false)
    ),

  new SlashCommandBuilder()
    .setName('add-flag-role')
    .setDescription('Link a flag emoji to a server role for nationality channels (Admin only)')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addStringOption(option =>
      option
        .setName('flag')
        .setDescription('The flag emoji (e.g. 🇺🇸, 🇰🇷, 🇩🇪, 🇧🇷)')
        .setRequired(true)
    )
    .addRoleOption(option =>
      option
        .setName('role')
        .setDescription('The server role to grant when reacting to this flag')
        .setRequired(true)
    )
    .addStringOption(option =>
      option
        .setName('country')
        .setDescription('Country name (e.g. South Korea, United States, Japan)')
        .setRequired(false)
    )
    .addStringOption(option =>
      option
        .setName('short_code')
        .setDescription('Short country code (e.g. kr, ph, us) — auto-detected from flag if omitted')
        .setRequired(false)
    ),

  new SlashCommandBuilder()
    .setName('remove-flag-role')
    .setDescription('Remove a flag emoji from nationality roles (Admin only)')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addStringOption(option =>
      option
        .setName('flag')
        .setDescription('The flag emoji or country code to remove')
        .setRequired(true)
    ),

  new SlashCommandBuilder()
    .setName('configure-verification')
    .setDescription('Configure roles and channel for the onboarding flow (Admin only)')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addRoleOption(option =>
      option
        .setName('onboarded_role')
        .setDescription('Role given after accepting rules (e.g. [Onboarded])')
        .setRequired(false)
    )
    .addRoleOption(option =>
      option
        .setName('unverified_role')
        .setDescription('Role given after setting IGN (e.g. [Unverified])')
        .setRequired(false)
    )
    .addRoleOption(option =>
      option
        .setName('elyos_fregion_role')
        .setDescription('Role given after setting IGN (e.g. [Elyos Fregion])')
        .setRequired(false)
    )
    .addChannelOption(option =>
      option
        .setName('verify_channel')
        .setDescription('The #verify-ign text channel')
        .setRequired(false)
    ),

  new SlashCommandBuilder()
    .setName('setnickname')
    .setDescription('Change your nickname on this server')
    .addStringOption(option =>
      option
        .setName('nickname')
        .setDescription('The new nickname (max 32 characters)')
        .setRequired(false)
        .setMaxLength(32)
    ),

  new SlashCommandBuilder()
    .setName('clean-reactions')
    .setDescription('Purge ghost reactions on messages from members who left the server (Admin only)')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addChannelOption(option =>
      option
        .setName('channel')
        .setDescription('Specific channel to clean (defaults to all reaction cards)')
        .setRequired(false)
    )
];

// Register Slash Commands
async function registerSlashCommands() {
  const rest = new REST({ version: '10' }).setToken(DISCORD_TOKEN);
  try {
    const commandsJson = slashCommands.map(cmd => cmd.toJSON());
    if (GUILD_ID) {
      await rest.put(Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID), { body: commandsJson });
      console.log(`✅ Guild slash commands registered for Guild ID: ${GUILD_ID}`);
    }
    await rest.put(Routes.applicationCommands(CLIENT_ID), { body: commandsJson });
    console.log('✅ Global slash commands registered successfully!');
  } catch (error) {
    console.error('⚠️ Warning: Failed to register slash commands:', error.message);
  }
}

// Update any existing tracked nationality messages in Discord to match latest config
async function updateTrackedNationalityMessages() {
  if (!Array.isArray(config.nationalityMessageIds) || config.nationalityMessageIds.length === 0) return;
  for (const guild of client.guilds.cache.values()) {
    try {
      const payload = createNationalityMessage(guild);
      for (const item of config.nationalityMessageIds) {
        const msgId = typeof item === 'object' && item?.messageId ? item.messageId : item;
        const chId = typeof item === 'object' && item?.channelId ? item.channelId : null;
        const msg = await findMessageAcrossGuild(guild, msgId, chId);
        if (msg && msg.author?.id === client.user?.id) {
          await msg.edit({ embeds: payload.embeds, components: [] }).catch(() => null);
          await reactToNationalityCard(msg);
        }
      }
    } catch (_) {}
  }
}

// Client Ready Event
client.once('ready', async () => {
  console.log(`🤖 Maiev Bot logged in as ${client.user.tag}!`);
  console.log(`📡 Connected to ${client.guilds.cache.size} guild(s).`);
  await registerSlashCommands();
  await updateTrackedNationalityMessages();
});

// ──────────────────────────────────────────
// INTERACTION HANDLERS (BUTTONS, MODALS, COMMANDS)
// ──────────────────────────────────────────
client.on('interactionCreate', async (interaction) => {
  try {
    const guild = interaction.guild;
    const member = interaction.member;
    if (!guild || !member) return;

    // 1. BUTTONS
    if (interaction.isButton()) {
      // Step A: Member clicks "I Agree to Rules"
      if (interaction.customId === 'btn_accept_rules') {
        // Defer ephemeral reply immediately so Discord interaction never times out
        if (!interaction.deferred && !interaction.replied) {
          try {
            await interaction.deferReply({ ephemeral: true });
          } catch (deferErr) {
            if (deferErr.code === 40060) return; // Already acknowledged
            console.error('[Rules Button] deferReply failed:', deferErr);
            return;
          }
        }

        const botMember = guild.members.me;

        if (!botMember.permissions.has(PermissionFlagsBits.ManageRoles)) {
          await interaction.editReply({
            content: '❌ **Bot Permission Error:** Maiev lacks the **Manage Roles** permission. Please go to **Server Settings > Roles > Maiev > Permissions** and enable **Manage Roles**.'
          });
          return;
        }

        let onboardedRole = await resolveRole(guild, config.onboardedRoleId, [
          'Compliant',
          '[Compliant]',
          'Onboarded',
          '[Onboarded]',
          'Rules Acknowledged',
          'Acknowledge Rules'
        ]);

        if (!onboardedRole) {
          // Additional fallback check for any role containing 'compliant' or 'onboard'
          const allRoles = await guild.roles.fetch().catch(() => guild.roles.cache);
          onboardedRole = allRoles.find(r => /compliant|onboard/i.test(r.name));
        }

        const verifyChannel = await resolveChannel(guild, config.verifyChannelId, /verif|identity/i);

        if (!onboardedRole) {
          await interaction.editReply({
            content: '⚠️ Could not find a role named **[Onboarded]** (or `Onboarded`) in the server. Please ensure the role exists or configure it in the web dashboard!'
          });
          return;
        }

        if (botMember.roles.highest.position <= onboardedRole.position) {
          await interaction.editReply({
            content: `⚠️ **Role Hierarchy Error:** The **Maiev** role must be dragged **above** the **@${onboardedRole.name}** role in **Server Settings > Roles**.`
          });
          return;
        }

        const targetMember = await guild.members.fetch({ user: interaction.user.id, force: true }).catch(() => member);

        // Guardrail 1: Check if user already completed verification and has server channel access
        const alreadyVerified = await hasCompletedVerification(guild, targetMember);
        if (alreadyVerified) {
          await interaction.editReply({
            content: '🔒 **Access Already Granted:** You have already acknowledged the rules, completed verification, and have access to the server channels. You cannot acknowledge the rules again.'
          });
          return;
        }

        // Guardrail 2: Check if user already has the [Onboarded] role (pending IGN verification)
        if (targetMember.roles.cache.has(onboardedRole.id)) {
          await interaction.editReply({
            content: `ℹ️ **Rules Already Acknowledged:** You already have the **@${onboardedRole.name}** role!${verifyChannel ? `\n\n👉 Proceed to <#${verifyChannel.id}> to set your AION 2 IGN with **Maiev**!` : ''}`
          });
          return;
        }

        try {
          await targetMember.roles.add(onboardedRole, 'Acknowledged server rules');
          console.log(`[Rules] Granted @${onboardedRole.name} to ${targetMember.user.tag}`);
          await interaction.editReply({
            content: `✅ **Rules Acknowledged!** You have been granted the **@${onboardedRole.name}** role!${verifyChannel ? `\n\n👉 **Next Step:** Proceed to <#${verifyChannel.id}> to set your AION 2 In-Game Name with **Maiev**!` : ''}`
          });
        } catch (addErr) {
          console.error('[Rules] Failed to add onboarded role:', addErr);
          await interaction.editReply({
            content: `❌ **Failed to assign role:** ${addErr.message}. Please verify bot permissions and role hierarchy in Server Settings.`
          });
        }
        return;
      }

      // Step B: Member clicks "Set AION 2 IGN & Verify"
      if (interaction.customId === 'btn_open_ign_modal') {
        const modal = new ModalBuilder()
          .setCustomId('modal_aion2_verify')
          .setTitle('AION 2 IGN Verification');

        const ignInput = new TextInputBuilder()
          .setCustomId('input_aion_ign')
          .setLabel('Enter your AION 2 Character Name (IGN)')
          .setStyle(TextInputStyle.Short)
          .setPlaceholder('e.g. DaevaLegend, ShadowWing, etc.')
          .setMinLength(2)
          .setMaxLength(32)
          .setRequired(true);

        modal.addComponents(new ActionRowBuilder().addComponents(ignInput));

        try {
          await interaction.showModal(modal);
        } catch (modalErr) {
          console.error('Failed to show modal:', modalErr);
          if (!interaction.replied && !interaction.deferred) {
            await interaction.reply({
              content: `⚠️ Failed to open verification modal: ${modalErr.message}`,
              ephemeral: true
            }).catch(() => null);
          }
        }
        return;
      }

      // Step C: Member clicks any Nationality Flag Reaction Role Button
      if (interaction.customId.startsWith('btn_nat_')) {
        const code = interaction.customId.replace('btn_nat_', '');
        const natConfig = (config.nationalityRoles || []).find(n => n.code.toLowerCase() === code.toLowerCase());
        if (!natConfig) {
          await interaction.reply({ content: '⚠️ Nationality option not found.', ephemeral: true });
          return;
        }

        const targetRole = await resolveRole(guild, natConfig.roleId, [natConfig.name, `${natConfig.emoji} ${natConfig.name}`, natConfig.code.toUpperCase()]);
        if (!targetRole) {
          await interaction.reply({
            content: `⚠️ The role for ${natConfig.emoji} **${natConfig.name}** hasn't been configured in the Web Dashboard yet. Please ask an admin to link this role!`,
            ephemeral: true
          });
          return;
        }

        const botMember = guild.members.me;
        if (!botMember.permissions.has(PermissionFlagsBits.ManageRoles) || botMember.roles.highest.position <= targetRole.position) {
          await interaction.reply({
            content: `⚠️ Maiev lacks permission or hierarchy to assign **@${targetRole.name}**. Ensure Maiev's role is higher in Server Settings > Roles!`,
            ephemeral: true
          });
          return;
        }

        if (member.roles.cache.has(targetRole.id)) {
          await member.roles.remove(targetRole, 'Nationality reaction role toggled off');
          await interaction.reply({
            content: `❌ Removed role **@${targetRole.name}** (${natConfig.emoji}).`,
            ephemeral: true
          });
        } else {
          await member.roles.add(targetRole, 'Nationality reaction role assigned');
          await interaction.reply({
            content: `✅ You received **@${targetRole.name}** ${natConfig.emoji} **${natConfig.name}**! Access to your nationality channel is now unlocked.`,
            ephemeral: true
          });
        }
        return;
      }
    }

    // 2. MODAL SUBMISSION
    if (interaction.isModalSubmit()) {
      if (interaction.customId === 'modal_aion2_verify') {
        const ign = interaction.fields.getTextInputValue('input_aion_ign').trim();
        const botMember = guild.members.me;

        if (!botMember.permissions.has(PermissionFlagsBits.ManageNicknames)) {
          await interaction.reply({ content: '❌ Maiev lacks the **Manage Nicknames** permission.', ephemeral: true });
          return;
        }
        if (!botMember.permissions.has(PermissionFlagsBits.ManageRoles)) {
          await interaction.reply({ content: '❌ Maiev lacks the **Manage Roles** permission.', ephemeral: true });
          return;
        }
        if (guild.ownerId === member.id) {
          await interaction.reply({ content: '⚠️ Discord prevents bots from changing the Server Owner nickname.', ephemeral: true });
          return;
        }
        if (member.roles.highest.position >= botMember.roles.highest.position) {
          await interaction.reply({ content: '⚠️ Maiev\'s role must sit **above** your highest role in Server Settings > Roles.', ephemeral: true });
          return;
        }

        // Update nickname
        await member.setNickname(ign, 'AION 2 IGN Registration via Maiev');

        // Resolve roles to ADD
        let rolesToAdd = [];
        if (config.ignRolesToAdd && config.ignRolesToAdd.length > 0) {
          for (const roleId of config.ignRolesToAdd) {
            const r = await guild.roles.fetch(roleId).catch(() => null);
            if (r) rolesToAdd.push(r);
          }
        } else {
          // Fallback defaults
          const unverified = await resolveRole(guild, '', ['Unverified']);
          const fregion = await resolveRole(guild, '', ['Elyos Fregion', 'Fregion']);
          if (unverified) rolesToAdd.push(unverified);
          if (fregion) rolesToAdd.push(fregion);
        }

        // Add roles
        const addedNames = [];
        for (const role of rolesToAdd) {
          if (botMember.roles.highest.position > role.position) {
            await member.roles.add(role, 'AION 2 IGN registered');
            addedNames.push(`@${role.name}`);
          }
        }

        // Resolve roles to REMOVE
        let rolesToRemove = [];
        if (config.ignRolesToRemove && config.ignRolesToRemove.length > 0) {
          for (const roleId of config.ignRolesToRemove) {
            const r = await guild.roles.fetch(roleId).catch(() => null);
            if (r) rolesToRemove.push(r);
          }
        } else {
          // Fallback default
          const onboarded = await resolveRole(guild, config.onboardedRoleId, ['Compliant', '[Compliant]', 'Onboarded', 'Rules Acknowledged']);
          if (onboarded) rolesToRemove.push(onboarded);
        }

        // Remove roles
        for (const role of rolesToRemove) {
          if (member.roles.cache.has(role.id) && botMember.roles.highest.position > role.position) {
            await member.roles.remove(role, 'AION 2 IGN set; removing onboarding role').catch(() => null);
          }
        }

        const rolesText = addedNames.length > 0 ? addedNames.join(' and ') : 'your verified roles';
        
        // Build rich welcome popup embed with server profile and name
        const serverName = guild.name;
        const serverIcon = guild.iconURL({ dynamic: true, size: 256 }) || undefined;

        const welcomeTitle = (config.welcomeTitle || '🎉 Welcome to {server}, {ign}!')
          .replace(/{server}/g, serverName)
          .replace(/{ign}/g, ign);

        const welcomeDescription = (config.welcomeContent || (
          'Your AION 2 IGN has been successfully registered as **{ign}**!\n\n' +
          '• **Roles Granted:** **{roles}**\n' +
          '• **Channel Updated:** **#verify-ign** has been closed\n\n' +
          '📸 **Next Step:** The exclusive community channels are now unlocked! Please post your character screenshot in the verification channel for staff approval.'
        ))
          .replace(/{server}/g, serverName)
          .replace(/{ign}/g, ign)
          .replace(/{roles}/g, rolesText)
          .replace(/{user}/g, `<@${member.id}>`);

        const welcomeFooterText = (config.welcomeFooter || '{server} • AION 2 Elyos Legion')
          .replace(/{server}/g, serverName)
          .replace(/{ign}/g, ign);

        const welcomeEmbed = new EmbedBuilder()
          .setColor(0x00d2ff) // Radiant AION Elyos cyan
          .setAuthor({ name: serverName, iconURL: serverIcon })
          .setTitle(welcomeTitle)
          .setDescription(welcomeDescription)
          .setThumbnail(serverIcon)
          .setFooter({ text: welcomeFooterText, iconURL: serverIcon })
          .setTimestamp();

        await interaction.reply({
          embeds: [welcomeEmbed],
          ephemeral: true
        });

        console.log(`[Verification] ${member.user.tag} set IGN to "${ign}". Granted: ${addedNames.join(', ')}`);

        // Send PUBLIC Welcome Announcement in designated welcome channel
        if (config.enableWelcomeAnnouncement !== false) {
          try {
            const welcomeChan = await resolveChannel(guild, config.welcomeAnnouncementChannelId, /welcome/i);
            if (welcomeChan && welcomeChan.isTextBased()) {
              const chanPerms = welcomeChan.permissionsFor(guild.members.me);
              if (!chanPerms || !chanPerms.has(PermissionFlagsBits.SendMessages)) {
                console.warn(`[Welcome Announcement] ⚠️ Cannot post welcome message to #${welcomeChan.name}: Maiev lacks 'Send Messages' permission in this channel. Please grant Maiev permission in Channel Settings > Permissions.`);
              } else {
                const defaultPublicTemplate = "👋 Welcome to **{server}**, {user}! Registered as **{ign}**. Welcome to the Legion, Daeva!";
                const rawPublicTemplate = config.welcomeAnnouncementMessage || defaultPublicTemplate;
                const publicMessage = rawPublicTemplate
                  .replace(/{user}/g, `<@${member.id}>`)
                  .replace(/{ign}/g, ign)
                  .replace(/{server}/g, guild.name)
                  .replace(/{roles}/g, rolesText);

                const publicEmbed = new EmbedBuilder()
                  .setColor(0x00d2ff)
                  .setAuthor({ name: `${guild.name} • New Daeva Arrival`, iconURL: serverIcon })
                  .setDescription(publicMessage)
                  .setThumbnail(member.user.displayAvatarURL({ dynamic: true, size: 256 }))
                  .setFooter({ text: `AION 2 Elyos Legion • Member #${guild.memberCount}`, iconURL: serverIcon })
                  .setTimestamp();

                await welcomeChan.send({
                  content: `<@${member.id}>`,
                  embeds: [publicEmbed]
                });
                console.log(`[Welcome Announcement] Sent public welcome for ${member.user.tag} to #${welcomeChan.name}`);
              }
            } else {
              console.warn('[Welcome Announcement] Could not resolve a text-based welcome channel.');
            }
          } catch (pubErr) {
            console.warn('[Welcome Announcement] Failed to post to welcome channel:', pubErr.message);
          }
        }

        return;
      }
    }


    // 3. SLASH COMMANDS
    if (interaction.isChatInputCommand()) {
      const { commandName } = interaction;

      if (commandName === 'post-rules') {
        await interaction.deferReply({ ephemeral: true });
        try {
          const payload = createRulesMessage();
          await interaction.channel.send(payload);
          await interaction.editReply({ content: '✅ Rules card posted successfully in this channel!' });
        } catch (sendErr) {
          await interaction.editReply({ content: `❌ Error: **${sendErr.message}**.` });
        }
        return;
      }

      if (commandName === 'post-verify') {
        await interaction.deferReply({ ephemeral: true });
        try {
          const payload = createVerifyMessage(guild);
          await interaction.channel.send(payload);
          await interaction.editReply({ content: '✅ Maiev AION 2 verification card posted successfully!' });
        } catch (sendErr) {
          await interaction.editReply({ content: `❌ Error: **${sendErr.message}**.` });
        }
        return;
      }

      if (commandName === 'post-nationality' || commandName === 'post-nationality-roles') {
        try {
          if (!interaction.deferred && !interaction.replied) {
            await interaction.deferReply({ ephemeral: true }).catch(() => null);
          }

          const forceNew = interaction.options.getBoolean('force_new') || false;
          const payload = createNationalityMessage(guild);

          let targetMsg = null;

          if (!forceNew) {
            // 1. Try to find an existing nationality message in this channel by stored IDs
            if (Array.isArray(config.nationalityMessageIds) && config.nationalityMessageIds.length > 0) {
              for (const item of config.nationalityMessageIds) {
                const msgId = typeof item === 'object' && item?.messageId ? item.messageId : item;
                const chId = typeof item === 'object' && item?.channelId ? item.channelId : null;
                if (!chId || chId === interaction.channelId) {
                  try {
                    const fetched = await interaction.channel.messages.fetch(msgId);
                    if (fetched && fetched.author?.id === client.user?.id) {
                      targetMsg = fetched;
                      break;
                    }
                  } catch (_) {}
                }
              }
            }

            // 2. Fallback: Search recent 25 messages in channel for Maiev's nationality card
            if (!targetMsg) {
              try {
                const recent = await interaction.channel.messages.fetch({ limit: 25 });
                targetMsg = recent.find(m =>
                  m.author?.id === client.user?.id && (
                    m.embeds?.some(e => e.title && /nationality|regional|choose your/i.test(e.title)) ||
                    m.components?.some(row => row.components?.some(c => c.customId && c.customId.startsWith('btn_nat_')))
                  )
                );
              } catch (_) {}
            }
          }

          let wasUpdated = false;
          if (targetMsg) {
            await targetMsg.edit({ embeds: payload.embeds, components: [] });
            wasUpdated = true;
          } else {
            targetMsg = await interaction.channel.send(payload);
          }

          // Ensure message ID is tracked with channelId
          if (!Array.isArray(config.nationalityMessageIds)) config.nationalityMessageIds = [];
          const alreadyTracked = config.nationalityMessageIds.some(item => (typeof item === 'object' ? item.messageId : item) === targetMsg.id);
          if (!alreadyTracked) {
            config.nationalityMessageIds.push({ messageId: targetMsg.id, channelId: interaction.channelId });
            saveConfig(config);
          }

          // Automatically react with configured flag emojis (skips already reacted ones)
          await reactToNationalityCard(targetMsg);

          const responseText = wasUpdated
            ? '✅ Existing nationality card updated in-place! **All previous user reactions and roles are preserved**, old text buttons were removed, and any new flag emojis were added.'
            : '✅ Nationality role card posted successfully! Flag emoji reactions are now active in this channel.';

          if (interaction.deferred || interaction.replied) {
            await interaction.editReply({ content: responseText }).catch(() => null);
          } else {
            await interaction.reply({ content: responseText, ephemeral: true }).catch(() => null);
          }
        } catch (sendErr) {
          console.error('Error executing /post-nationality:', sendErr);
          if (interaction.deferred || interaction.replied) {
            await interaction.editReply({ content: `❌ Error: **${sendErr.message}**.` }).catch(() => null);
          }
        }
        return;
      }

      if (commandName === 'add-flag-role') {
        await interaction.deferReply({ ephemeral: true });
        const emoji = interaction.options.getString('flag').trim();
        const targetRole = interaction.options.getRole('role');
        const country = interaction.options.getString('country')?.trim() || targetRole.name.replace(/[[\]]/g, '').trim();
        const rawInputCode = (interaction.options.getString('short_code') || interaction.options.getString('code'))?.trim();
        const autoIso = extractFlagIsoCode(emoji);
        const code = (
          rawInputCode ||
          autoIso ||
          (country.length <= 4 ? country : targetRole.name.replace(/[[\]]/g, '').trim().length <= 4 ? targetRole.name.replace(/[[\]]/g, '').trim() : country.slice(0, 5))
        ).toLowerCase().replace(/[^a-z0-9]/g, '') || 'role';

        if (!Array.isArray(config.nationalityRoles)) config.nationalityRoles = [];

        const existingIndex = config.nationalityRoles.findIndex(n => 
          n.emoji === emoji || 
          n.roleId === targetRole.id ||
          (n.code && n.code.toLowerCase() === code)
        );

        if (existingIndex >= 0) {
          config.nationalityRoles[existingIndex] = {
            ...config.nationalityRoles[existingIndex],
            emoji,
            name: country,
            code,
            roleId: targetRole.id
          };
        } else {
          config.nationalityRoles.push({
            code,
            name: country,
            emoji,
            roleId: targetRole.id
          });
        }

        saveConfig(config);

        // Auto-update any existing nationality card in this channel so the new flag appears and is reacted immediately
        let cardUpdated = false;
        try {
          if (interaction.channel) {
            const recent = await interaction.channel.messages.fetch({ limit: 25 }).catch(() => null);
            const activeMsg = recent?.find(m =>
              m.author?.id === client.user?.id && (
                config.nationalityMessageIds?.includes(m.id) ||
                m.embeds?.some(e => e.title && /nationality|regional|choose your/i.test(e.title))
              )
            );
            if (activeMsg) {
              const updatedPayload = createNationalityMessage(guild);
              await activeMsg.edit({ embeds: updatedPayload.embeds, components: [] }).catch(() => null);
              await reactToNationalityCard(activeMsg);
              cardUpdated = true;
            }
          }
        } catch (_) {}

        const updateNote = cardUpdated
          ? `\n\n• The nationality card in this channel was **automatically updated** and reacted with ${emoji} (all previous reactions preserved)!`
          : `\n\n• Run \`/post-nationality\` to post or update the card in this channel.`;

        await interaction.editReply({
          content: `✅ Successfully linked ${emoji} **${country}** (\`${code.toUpperCase()}\`) to role **@${targetRole.name}**!${updateNote}`
        });
        return;
      }

      if (commandName === 'remove-flag-role') {
        await interaction.deferReply({ ephemeral: true });
        const query = interaction.options.getString('flag').trim().toLowerCase();
        if (!Array.isArray(config.nationalityRoles)) config.nationalityRoles = [];

        const initialLength = config.nationalityRoles.length;
        config.nationalityRoles = config.nationalityRoles.filter(n => 
          n.emoji !== query && 
          n.code.toLowerCase() !== query &&
          n.name.toLowerCase() !== query
        );

        if (config.nationalityRoles.length < initialLength) {
          saveConfig(config);

          // Auto-update active card in this channel if present
          try {
            if (interaction.channel) {
              const recent = await interaction.channel.messages.fetch({ limit: 25 }).catch(() => null);
              const activeMsg = recent?.find(m =>
                m.author?.id === client.user?.id && (
                  config.nationalityMessageIds?.includes(m.id) ||
                  m.embeds?.some(e => e.title && /nationality|regional|choose your/i.test(e.title))
                )
              );
              if (activeMsg) {
                const updatedPayload = createNationalityMessage(guild);
                await activeMsg.edit({ embeds: updatedPayload.embeds, components: [] }).catch(() => null);
              }
            }
          } catch (_) {}

          await interaction.editReply({ content: `✅ Removed flag option \`${query}\`. The nationality card has been updated.` });
        } else {
          await interaction.editReply({ content: `⚠️ Could not find a configured flag matching \`${query}\`.` });
        }
        return;
      }

      if (commandName === 'configure-verification') {
        const onboardedRole = interaction.options.getRole('onboarded_role');
        const unverifiedRole = interaction.options.getRole('unverified_role');
        const fregionRole = interaction.options.getRole('elyos_fregion_role');
        const verifyChannel = interaction.options.getChannel('verify_channel');

        if (onboardedRole) config.onboardedRoleId = onboardedRole.id;
        if (unverifiedRole && !config.ignRolesToAdd.includes(unverifiedRole.id)) config.ignRolesToAdd.push(unverifiedRole.id);
        if (fregionRole && !config.ignRolesToAdd.includes(fregionRole.id)) config.ignRolesToAdd.push(fregionRole.id);
        if (verifyChannel) config.verifyChannelId = verifyChannel.id;

        saveConfig(config);
        await interaction.reply({ content: '⚙️ **Pipeline Configuration Updated & Saved!**', ephemeral: true });
        return;
      }

      if (commandName === 'setnickname') {
        const directNickname = interaction.options.getString('nickname');
        const botMember = guild.members.me;

        if (directNickname) {
          if (!botMember.permissions.has(PermissionFlagsBits.ManageNicknames)) {
            await interaction.reply({ content: '❌ Bot lacks Manage Nicknames permission.', ephemeral: true });
            return;
          }
          if (guild.ownerId === member.id) {
            await interaction.reply({ content: '⚠️ Bots cannot change Server Owner nickname.', ephemeral: true });
            return;
          }
          if (member.roles.highest.position >= botMember.roles.highest.position) {
            await interaction.reply({ content: '⚠️ Bot role must be higher than your role in Server Settings.', ephemeral: true });
            return;
          }
          await member.setNickname(directNickname, 'Changed via /setnickname');
          await interaction.reply({ content: `✅ Nickname changed to **${directNickname}**!`, ephemeral: true });
        } else {
          const modal = new ModalBuilder()
            .setCustomId('modal_aion2_verify')
            .setTitle('AION 2 IGN Verification');
          const ignInput = new TextInputBuilder()
            .setCustomId('input_aion_ign')
            .setLabel('Desired AION 2 In-Game Name')
            .setStyle(TextInputStyle.Short)
            .setPlaceholder('Enter your character name')
            .setMinLength(2)
            .setMaxLength(32)
            .setRequired(true);

          modal.addComponents(new ActionRowBuilder().addComponents(ignInput));

          try {
            await interaction.showModal(modal);
          } catch (modalErr) {
            console.error('Failed to show modal:', modalErr);
            if (!interaction.replied && !interaction.deferred) {
              await interaction.reply({
                content: `⚠️ Failed to open modal: ${modalErr.message}`,
                ephemeral: true
              }).catch(() => null);
            }
          }
        }
        return;
      }

      if (commandName === 'clean-reactions') {
        await interaction.deferReply({ ephemeral: true });
        const targetChannel = interaction.options.getChannel('channel');

        const botMember = guild.members.me;
        if (!botMember.permissions.has(PermissionFlagsBits.ManageMessages)) {
          await interaction.editReply({
            content: '⚠️ **Missing Permission:** Maiev needs the **Manage Messages** permission to remove reactions of former members. Please grant **Manage Messages** in Server Settings or Channel Permissions.'
          });
          return;
        }

        const result = await purgeGhostReactions(guild, targetChannel);

        if (result.totalPurged === 0) {
          await interaction.editReply({
            content: `✨ **All clean!** Inspected ${result.messagesInspected} message(s) and found 0 ghost reactions from former members.`
          });
        } else {
          const memberList = result.purgedMembers.slice(0, 5).map(m => `• **${m.tag}** (${m.count} reaction${m.count > 1 ? 's' : ''})`).join('\n');
          const moreText = result.purgedMembers.length > 5 ? `\n...and ${result.purgedMembers.length - 5} more.` : '';

          await interaction.editReply({
            content: `🧹 **Reaction Purge Complete!**\n\nRemoved **${result.totalPurged}** ghost reaction(s) across **${result.messagesInspected}** message(s) from **${result.purgedMembers.length}** former member(s) who left the server:\n\n${memberList}${moreText}`
          });
        }
        return;
      }
    }
  } catch (err) {
    console.error('Unhandled interaction error:', err);
  }
});

// ──────────────────────────────────────────
// AUTOMATIC ATTACHMENT ON CARD POST (messageCreate)
// ──────────────────────────────────────────
client.on('messageCreate', async (message) => {
  try {
    if (message.author?.id !== client.user?.id) return;
    const isNationalityCard = message.embeds?.some(e => e.title && /nationality|regional|choose your/i.test(e.title));
    if (isNationalityCard) {
      if (!Array.isArray(config.nationalityMessageIds)) config.nationalityMessageIds = [];
      const alreadyTracked = config.nationalityMessageIds.some(item => (typeof item === 'object' ? item.messageId : item) === message.id);
      if (!alreadyTracked) {
        config.nationalityMessageIds.push({ messageId: message.id, channelId: message.channelId });
        saveConfig(config);
      }
      await reactToNationalityCard(message);
    }
  } catch (err) {
    console.error('Error auto-reacting on messageCreate:', err);
  }
});

// ──────────────────────────────────────────
// REACTION ROLES HANDLERS (EMOJI REACTIONS)
// ──────────────────────────────────────────
client.on('messageReactionAdd', async (reaction, user) => {
  try {
    if (user.bot) return;

    if (reaction.partial) {
      try {
        await reaction.fetch();
      } catch (err) {
        return;
      }
    }

    if (reaction.message.partial) {
      try {
        await reaction.message.fetch();
      } catch (err) {
        return;
      }
    }

    const { message, emoji } = reaction;
    const guild = message.guild;
    if (!guild) return;

    // Track user reaction for automatic cleanup if they leave the server
    trackUserReaction(guild.id, user.id, message.channelId, message.id, emoji.identifier || emoji.name);

    // Check if this message is a nationality message
    const isNatMessage =
      (Array.isArray(config.nationalityMessageIds) && config.nationalityMessageIds.some(item => (typeof item === 'object' ? item.messageId : item) === message.id)) ||
      (message.author?.id === client.user?.id && (
        message.embeds?.some(e => e.title && /nationality|regional|choose your/i.test(e.title)) ||
        message.components?.some(row => row.components?.some(c => c.customId && c.customId.startsWith('btn_nat_')))
      ));

    if (isNatMessage) {
      // Auto-save this message ID into config if not already tracked
      if (!Array.isArray(config.nationalityMessageIds)) config.nationalityMessageIds = [];
      const alreadyTracked = config.nationalityMessageIds.some(item => (typeof item === 'object' ? item.messageId : item) === message.id);
      if (!alreadyTracked) {
        config.nationalityMessageIds.push({ messageId: message.id, channelId: message.channelId });
        saveConfig(config);
      }
    }

    if (!isNatMessage) return;

    const natConfig = findNationalityByEmoji(emoji, config.nationalityRoles);
    if (!natConfig) return;

    const targetRole = await resolveRole(guild, natConfig.roleId, [
      natConfig.name,
      `${natConfig.emoji} ${natConfig.name}`,
      natConfig.code.toUpperCase()
    ]);
    if (!targetRole) {
      console.warn(`[Reaction Role] Role for ${natConfig.name} not found in guild.`);
      return;
    }

    const member = await guild.members.fetch(user.id).catch(() => null);
    if (!member) return;

    const botMember = guild.members.me;
    if (!botMember.permissions.has(PermissionFlagsBits.ManageRoles) || botMember.roles.highest.position <= targetRole.position) {
      console.warn(`[Reaction Role] Bot cannot assign role @${targetRole.name} (permissions or hierarchy).`);
      return;
    }

    if (!member.roles.cache.has(targetRole.id)) {
      await member.roles.add(targetRole, `Nationality reaction role: ${emoji.name}`);
      console.log(`[Reaction Role] Added role @${targetRole.name} to ${member.user.tag} (reacted ${emoji.name})`);
    }
  } catch (err) {
    console.error('[Reaction Role] Error handling messageReactionAdd:', err);
  }
});

client.on('messageReactionRemove', async (reaction, user) => {
  try {
    if (user.bot) return;

    if (reaction.partial) {
      try {
        await reaction.fetch();
      } catch (err) {
        return;
      }
    }

    if (reaction.message.partial) {
      try {
        await reaction.message.fetch();
      } catch (err) {
        return;
      }
    }

    const { message, emoji } = reaction;
    const guild = message.guild;
    if (!guild) return;

    // Untrack user reaction
    untrackUserReaction(guild.id, user.id, message.channelId, message.id, emoji.identifier || emoji.name);

    const isNatMessage =
      (Array.isArray(config.nationalityMessageIds) && config.nationalityMessageIds.some(item => (typeof item === 'object' ? item.messageId : item) === message.id)) ||
      (message.author?.id === client.user?.id && (
        message.embeds?.some(e => e.title && /nationality|regional|choose your/i.test(e.title)) ||
        message.components?.some(row => row.components?.some(c => c.customId && c.customId.startsWith('btn_nat_')))
      ));

    if (!isNatMessage) return;

    const natConfig = findNationalityByEmoji(emoji, config.nationalityRoles);
    if (!natConfig) return;

    const targetRole = await resolveRole(guild, natConfig.roleId, [
      natConfig.name,
      `${natConfig.emoji} ${natConfig.name}`,
      natConfig.code.toUpperCase()
    ]);
    if (!targetRole) return;

    const member = await guild.members.fetch(user.id).catch(() => null);
    if (!member) return;

    const botMember = guild.members.me;
    if (!botMember.permissions.has(PermissionFlagsBits.ManageRoles) || botMember.roles.highest.position <= targetRole.position) {
      return;
    }

    if (member.roles.cache.has(targetRole.id)) {
      await member.roles.remove(targetRole, `Nationality reaction role removed: ${emoji.name}`);
      console.log(`[Reaction Role] Removed role @${targetRole.name} from ${member.user.tag} (unreacted ${emoji.name})`);
    }
  } catch (err) {
    console.error('[Reaction Role] Error handling messageReactionRemove:', err);
  }
});

// ──────────────────────────────────────────
// MEMBER LEAVE EVENT (REACTION PURGE & CACHE EVICTION)
// ──────────────────────────────────────────
client.on('guildMemberRemove', async (member) => {
  try {
    const guild = member.guild;
    if (!guild) return;
    const userId = member.id;
    const userTag = member.user?.tag || member.user?.username || userId;

    console.log(`[Member Leave] 🚪 ${userTag} (${userId}) has left ${guild.name}. Cleaning up their reactions and cache...`);
    const result = await cleanupUserReactionsOnLeave(guild, userId, userTag);
    console.log(`[Member Leave] ✅ Cleaned up ${result.removedCount} reaction(s) across ${result.messagesScanned} message(s) for ${userTag}.`);

    // Evict from guild member cache so if they rejoin, they start with a completely fresh state
    guild.members.cache.delete(userId);
  } catch (err) {
    console.error('[Member Leave] Error handling guildMemberRemove:', err);
  }
});

// ──────────────────────────────────────────
// MEMBER JOIN EVENT (FRESH ONBOARDING)
// ──────────────────────────────────────────
client.on('guildMemberAdd', async (member) => {
  try {
    const userTag = member.user?.tag || member.user?.username || member.id;
    console.log(`[Member Join] 👋 ${userTag} (${member.id}) joined ${member.guild.name}. Must complete rules acknowledgement and IGN verification.`);
    // Ensure no stale roles are cached for this user
    member.roles.cache.clear();
  } catch (err) {
    console.error('[Member Join] Error handling guildMemberAdd:', err);
  }
});

// ──────────────────────────────────────────
// WEB CONTROL CENTER (EXPRESS REST API & DASHBOARD)
// ──────────────────────────────────────────
const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// API: Live Bot & Guild Status
app.get('/api/status', (req, res) => {
  const guild = client.guilds.cache.get(GUILD_ID) || client.guilds.cache.first();
  const botMember = guild?.members.me;

  const roles = guild ? guild.roles.cache.map(r => ({
    id: r.id,
    name: r.name,
    color: r.hexColor,
    position: r.position,
    managed: r.managed
  })) : [];

  const channels = guild ? guild.channels.cache
    .filter(c => c.isTextBased())
    .map(c => ({ id: c.id, name: c.name, type: c.type })) : [];

  res.json({
    online: client.isReady(),
    botName: client.user ? client.user.tag : 'Maiev',
    botId: client.user ? client.user.id : CLIENT_ID,
    avatar: client.user ? client.user.displayAvatarURL() : '',
    ping: client.ws.ping,
    config,
    guild: guild ? {
      id: guild.id,
      name: guild.name,
      icon: guild.iconURL(),
      memberCount: guild.memberCount,
      roles,
      channels
    } : null,
    permissions: botMember ? {
      hasManageRoles: botMember.permissions.has(PermissionFlagsBits.ManageRoles),
      hasManageNicknames: botMember.permissions.has(PermissionFlagsBits.ManageNicknames),
      hasManageMessages: botMember.permissions.has(PermissionFlagsBits.ManageMessages),
      rolePosition: botMember.roles.highest.position
    } : null
  });
});

// API: Save Configuration
app.post('/api/config', (req, res) => {
  const {
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
    nationalityRoles
  } = req.body;

  saveConfig({
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
    nationalityRoles: Array.isArray(nationalityRoles) ? nationalityRoles : config.nationalityRoles
  });
  console.log('⚙️ Configuration updated via Web UI:', config);
  res.json({ success: true, config });
});

// API: Trigger Post Rules Embed
app.post('/api/post-rules', async (req, res) => {
  try {
    const { channelId } = req.body;
    const guild = client.guilds.cache.get(GUILD_ID) || client.guilds.cache.first();
    const channel = await guild?.channels.fetch(channelId || config.rulesChannelId).catch(() => null);
    if (!channel || !channel.isTextBased()) {
      return res.status(400).json({ error: 'Invalid or non-text channel specified' });
    }
    const payload = createRulesMessage();
    await channel.send(payload);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// API: Trigger Post Verification Embed
app.post('/api/post-verify', async (req, res) => {
  try {
    const { channelId } = req.body;
    const guild = client.guilds.cache.get(GUILD_ID) || client.guilds.cache.first();
    const channel = await guild?.channels.fetch(channelId || config.verifyChannelId).catch(() => null);
    if (!channel || !channel.isTextBased()) {
      return res.status(400).json({ error: 'Invalid or non-text channel specified' });
    }
    const payload = createVerifyMessage(guild);
    await channel.send(payload);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// API: Server-Sent Events stream for real-time Web UI synchronization
app.get('/api/events', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders?.();

  res.write(`data: ${JSON.stringify({ type: 'connected', config, timestamp: Date.now() })}\n\n`);
  sseClients.add(res);

  req.on('close', () => {
    sseClients.delete(res);
  });
});

// API: Instantly Save Nationality Roles from Web UI (add/remove/reorder/bind role)
app.post('/api/nationality-roles', (req, res) => {
  try {
    const { nationalityRoles } = req.body;
    if (!Array.isArray(nationalityRoles)) {
      return res.status(400).json({ error: 'nationalityRoles must be an array' });
    }
    config.nationalityRoles = nationalityRoles;
    saveConfig(config);
    res.json({ success: true, count: config.nationalityRoles.length });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// API: Trigger Post Nationality Roles Embed (posts fresh embed or updates in-place if forceNew=false)
app.post('/api/post-nationality-roles', async (req, res) => {
  try {
    const {
      channelId,
      nationalityRoles,
      nationalityTitle,
      nationalityContent,
      nationalityFooter,
      forceNew = true
    } = req.body;

    const guild = client.guilds.cache.get(GUILD_ID) || client.guilds.cache.first();
    const channel = await guild?.channels.fetch(channelId).catch(() => null);
    if (!channel || !channel.isTextBased()) {
      return res.status(400).json({ error: 'Invalid or non-text channel specified' });
    }

    // Persist any updated nationality parameters passed from Web UI
    if (Array.isArray(nationalityRoles)) {
      config.nationalityRoles = nationalityRoles;
    }
    if (nationalityTitle !== undefined && nationalityTitle !== null) config.nationalityTitle = nationalityTitle;
    if (nationalityContent !== undefined && nationalityContent !== null) config.nationalityContent = nationalityContent;
    if (nationalityFooter !== undefined && nationalityFooter !== null) config.nationalityFooter = nationalityFooter;
    config.nationalityChannelId = channel.id;
    saveConfig(config);

    const payload = createNationalityMessage(guild);

    let targetMsg = null;
    let wasUpdated = false;

    if (!forceNew) {
      // Look for existing nationality card in this channel to edit in-place
      if (Array.isArray(config.nationalityMessageIds) && config.nationalityMessageIds.length > 0) {
        for (const item of config.nationalityMessageIds) {
          const msgId = typeof item === 'object' && item?.messageId ? item.messageId : item;
          const chId = typeof item === 'object' && item?.channelId ? item.channelId : null;
          if (!chId || chId === channel.id) {
            const m = await channel.messages.fetch(msgId).catch(() => null);
            if (m && m.author?.id === client.user?.id) {
              targetMsg = m;
              break;
            }
          }
        }
      }

      if (!targetMsg) {
        const recent = await channel.messages.fetch({ limit: 15 }).catch(() => null);
        targetMsg = recent?.find(m =>
          m.author?.id === client.user?.id && (
            m.embeds?.some(e => e.title && /nationality|regional|choose your/i.test(e.title)) ||
            config.nationalityMessageIds?.some(id => (typeof id === 'object' ? id.messageId : id) === m.id)
          )
        );
      }
    }

    if (targetMsg) {
      await targetMsg.edit({ embeds: payload.embeds, components: [] });
      wasUpdated = true;
    } else {
      targetMsg = await channel.send(payload);
    }

    // Ensure message ID is tracked with channelId
    if (!Array.isArray(config.nationalityMessageIds)) config.nationalityMessageIds = [];
    const alreadyTracked = config.nationalityMessageIds.some(item => (typeof item === 'object' ? item.messageId : item) === targetMsg.id);
    if (!alreadyTracked) {
      config.nationalityMessageIds.push({ messageId: targetMsg.id, channelId: channel.id });
      saveConfig(config);
    }

    // Auto-react with all configured & embed flag emojis
    await reactToNationalityCard(targetMsg);

    res.json({
      success: true,
      updated: wasUpdated,
      posted: !wasUpdated,
      messageId: targetMsg.id,
      channelName: channel.name
    });
  } catch (err) {
    console.error('Error in /api/post-nationality-roles:', err);
    res.status(500).json({ error: err.message });
  }
});

// API: Send Test Public Welcome Announcement
app.post('/api/test-welcome', async (req, res) => {
  try {
    const { channelId, message } = req.body;
    const guild = client.guilds.cache.get(GUILD_ID) || client.guilds.cache.first();
    const channel = await guild?.channels.fetch(channelId || config.welcomeAnnouncementChannelId).catch(() => null);
    if (!channel || !channel.isTextBased()) {
      return res.status(400).json({ error: 'Invalid or non-text channel specified' });
    }
    const serverName = guild?.name || 'AION 2 Server';
    const serverIcon = guild?.iconURL({ dynamic: true, size: 256 }) || undefined;
    const template = message || config.welcomeAnnouncementMessage || "👋 Welcome to **{server}**, {user}! Registered as **{ign}**. Welcome to the Legion, Daeva!";
    
    const formatted = template
      .replace(/{user}/g, client.user ? `<@${client.user.id}>` : '@NewPlayer')
      .replace(/{ign}/g, 'DaevaLegend')
      .replace(/{server}/g, serverName)
      .replace(/{flag}/g, '🇵🇭')
      .replace(/{nationality}/g, 'Philippines')
      .replace(/{roles}/g, '@Unverified, @Elyos Fregion');

    const embed = new EmbedBuilder()
      .setColor(0x00d2ff)
      .setAuthor({ name: `${serverName} • New Daeva Arrival (Test)`, iconURL: serverIcon })
      .setDescription(formatted)
      .setThumbnail(serverIcon)
      .setFooter({ text: `Maiev Verification Test • Member Count: ${guild?.memberCount || 1}`, iconURL: serverIcon })
      .setTimestamp();

    await channel.send({ content: client.user ? `<@${client.user.id}>` : undefined, embeds: [embed] });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// API: Trigger Ghost Reaction Purge for Former Members
app.post('/api/clean-reactions', async (req, res) => {
  try {
    const guild = client.guilds.cache.get(GUILD_ID) || client.guilds.cache.first();
    if (!guild) return res.status(404).json({ error: 'Guild not found' });
    const result = await purgeGhostReactions(guild);
    res.json({ success: true, ...result });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// API: Member Roster
app.get('/api/members', (req, res) => {
  const guild = client.guilds.cache.get(GUILD_ID) || client.guilds.cache.first();
  if (!guild) return res.json([]);
  const members = guild.members.cache
    .filter(m => !m.user.bot)
    .first(25)
    .map(m => ({
      id: m.id,
      username: m.user.tag,
      nickname: m.nickname,
      roles: m.roles.cache.filter(r => r.name !== '@everyone').map(r => r.name)
    }));
  res.json(members);
});

// Start Express Server
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🌐 Web Control Center listening on 0.0.0.0:${PORT}`);
  console.log(`👉 Ready for connections!`);
});

// Start Discord Bot
client.login(DISCORD_TOKEN);
