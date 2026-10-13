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
    '**1. Respect Everyone** — Treat all members with courtesy and kindness. Zero tolerance for harassment, racism, or toxicity.\n' +
    '**2. Keep Content Appropriate** — Keep discussions in the relevant channels. No NSFW or offensive content.\n' +
    '**3. Follow Game Terms of Service** — No exploits, account selling, or unapproved third-party software.\n' +
    '**4. Listen to Staff** — Follow moderator instructions at all times.\n\n' +
    '━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n' +
    '**Next Step:** Click the button below to acknowledge the rules. You will receive the **[Onboarded]** role, unlocking the **#verify-ign** channel where you can set your AION 2 In-Game Name with **Maiev**!'
  ),
  rulesFooter: process.env.RULES_FOOTER || 'Acknowledge the rules below to proceed',
  verifyTitle: process.env.VERIFY_TITLE || '🛡️ Maiev — AION 2 IGN Verification',
  verifyContent: process.env.VERIFY_CONTENT || (
    'Welcome to **{server}**!\n\n' +
    'To proceed, please register your **AION 2 In-Game Name (IGN)**:\n\n' +
    '**How it works:**\n' +
    '1. Click the **"🎮 Set AION 2 IGN & Verify"** button below.\n' +
    '2. Enter your exact in-game character name.\n' +
    '3. Maiev will update your server nickname to your IGN, grant you **[Unverified]** and **[Elyos Fregion]**, and remove **[Onboarded]** so you can post your screenshot in the verification channel!'
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
  nationalityTitle: '🌍 Choose Your Nationality',
  nationalityContent: '',
  nationalityFooter: 'React with a flag emoji below to toggle your role',
  nationalityMessageIds: [],
  nationalityRoles: [
    { code: 'ph', name: 'Philippines', emoji: '🇵🇭', roleId: '' },
    { code: 'jp', name: 'Japan', emoji: '🇯🇵', roleId: '' },
    { code: 'global', name: 'Global / Other', emoji: '🌐', roleId: '' }
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

// Save config helper
function saveConfig(newConfig) {
  config = { ...config, ...newConfig };
  try {
    fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2), 'utf-8');
  } catch (err) {
    console.error('⚠️ Failed to save config.json:', err.message);
  }
}

// Helper: Match emoji (Unicode or Custom) to a configured nationality role
function findNationalityByEmoji(emoji, nationalityRoles = []) {
  if (!emoji || !Array.isArray(nationalityRoles)) return null;
  const emojiName = emoji.name ? emoji.name.trim() : '';
  const emojiId = emoji.id || '';
  const emojiString = emoji.toString ? emoji.toString() : '';

  return nationalityRoles.find(n => {
    if (!n) return false;
    // 1. Exact emoji string match (e.g. "🇵🇭" === "🇵🇭")
    if (n.emoji && (n.emoji === emojiName || n.emoji === emojiString)) return true;

    // 2. Custom Discord emoji ID match <:name:id>
    if (emojiId && n.emoji && n.emoji.includes(emojiId)) return true;

    // 3. Normalized Unicode match (flags composed of regional indicators)
    if (n.emoji && emojiName && (n.emoji.includes(emojiName) || emojiName.includes(n.emoji))) return true;

    // 4. Code match (e.g. emoji "ph" matches code "ph")
    if (emojiName && n.code && emojiName.toLowerCase() === n.code.toLowerCase()) return true;

    // 5. Country name match (e.g. emoji "philippines" matches name "philippines")
    if (emojiName && n.name && emojiName.toLowerCase() === n.name.toLowerCase()) return true;

    return false;
  }) || null;
}

// Helper: Safely react to a message with Unicode or Custom emoji
async function safelyReact(message, emojiStr) {
  if (!emojiStr || !message) return;
  try {
    const customMatch = emojiStr.match(/:(\d+)>$/);
    if (customMatch) {
      await message.react(customMatch[1]);
    } else {
      await message.react(emojiStr.trim());
    }
  } catch (err) {
    console.warn(`[Reaction Roles] Could not auto-react with ${emojiStr}:`, err.message);
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
    : '🇵🇭 **Philippines** (`PH`)\n🇯🇵 **Japan** (`JP`)\n🌐 **Global / Other** (`GLOBAL`)';

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
  return guild.roles.cache.find(r => {
    const cleanRoleName = r.name.replace(/[[\]]/g, '').trim().toLowerCase();
    return fallbackNames.some(name => {
      const cleanTarget = name.replace(/[[\]]/g, '').trim().toLowerCase();
      return cleanRoleName === cleanTarget || cleanRoleName.includes(cleanTarget);
    });
  }) || null;
}

// Helper: Resolve channel by ID or Name
async function resolveChannel(guild, channelId, fallbackPattern = /verify/i) {
  if (channelId) {
    const ch = await guild.channels.fetch(channelId).catch(() => null);
    if (ch && ch.isTextBased()) return ch;
  }
  return guild.channels.cache.find(ch => 
    ch.type === ChannelType.GuildText && 
    fallbackPattern.test(ch.name)
  ) || null;
}

// Build: Server Rules Embed & Acceptance Button
function createRulesMessage() {
  const embed = new EmbedBuilder()
    .setColor(0x2B2D31)
    .setTitle(config.rulesTitle || '📜 Server Rules & Guidelines')
    .setDescription(
      config.rulesContent ||
      'Welcome to the community! Before proceeding, please review our core server rules:\n\n' +
      '**1. Respect Everyone** — Treat all members with courtesy and kindness. Zero tolerance for harassment, racism, or toxicity.\n' +
      '**2. Keep Content Appropriate** — Keep discussions in the relevant channels. No NSFW or offensive content.\n' +
      '**3. Follow Game Terms of Service** — No exploits, account selling, or unapproved third-party software.\n' +
      '**4. Listen to Staff** — Follow moderator instructions at all times.\n\n' +
      '━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n' +
      '**Next Step:** Click the button below to acknowledge the rules. You will receive the **[Onboarded]** role, unlocking the **#verify-ign** channel where you can set your AION 2 In-Game Name with **Maiev**!'
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
    '3. Maiev will update your server nickname to your IGN, grant you **[Unverified]** and **[Elyos Fregion]**, and remove **[Onboarded]** so you can post your screenshot in the verification channel!'
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
        .setDescription('Country name (e.g. United States, Korea)')
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

// Client Ready Event
client.once('ready', async () => {
  console.log(`🤖 Maiev Bot logged in as ${client.user.tag}!`);
  console.log(`📡 Connected to ${client.guilds.cache.size} guild(s).`);
  await registerSlashCommands();
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
        const botMember = guild.members.me;

        if (!botMember.permissions.has(PermissionFlagsBits.ManageRoles)) {
          await interaction.reply({
            content: '❌ **Bot Permission Error:** Maiev lacks the **Manage Roles** permission. Please go to **Server Settings > Roles > Maiev > Permissions** and enable **Manage Roles**.',
            ephemeral: true
          });
          return;
        }

        const onboardedRole = await resolveRole(guild, config.onboardedRoleId, ['Onboarded', 'Rules Acknowledged']);
        const verifyChannel = await resolveChannel(guild, config.verifyChannelId, /verify/i);

        if (!onboardedRole) {
          await interaction.reply({
            content: '⚠️ Could not find a role named **Onboarded** (or `[Onboarded]`). Please create it or configure it in the web dashboard!',
            ephemeral: true
          });
          return;
        }

        if (botMember.roles.highest.position <= onboardedRole.position) {
          await interaction.reply({
            content: `⚠️ **Role Hierarchy Error:** The **Maiev** role must be dragged **above** the **@${onboardedRole.name}** role in **Server Settings > Roles**.`,
            ephemeral: true
          });
          return;
        }

        await member.roles.add(onboardedRole, 'Acknowledged server rules');

        // Acknowledge the interaction silently without sending ANY message to the channel
        await interaction.deferUpdate();
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
          const onboarded = await resolveRole(guild, config.onboardedRoleId, ['Onboarded', 'Rules Acknowledged']);
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
            const welcomeChan = await resolveChannel(guild, config.welcomeAnnouncementChannelId, /welcome|announcement|general/i);
            if (welcomeChan && welcomeChan.isTextBased()) {
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
        await interaction.deferReply({ ephemeral: true });
        try {
          const forceNew = interaction.options.getBoolean('force_new') || false;
          const payload = createNationalityMessage(guild);

          let targetMsg = null;

          if (!forceNew) {
            // 1. Try to find an existing nationality message in this channel by stored IDs
            if (Array.isArray(config.nationalityMessageIds) && config.nationalityMessageIds.length > 0) {
              for (const msgId of config.nationalityMessageIds) {
                try {
                  const fetched = await interaction.channel.messages.fetch(msgId);
                  if (fetched && fetched.author?.id === client.user?.id) {
                    targetMsg = fetched;
                    break;
                  }
                } catch (_) {
                  // Message not in this channel or deleted
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
            // Edit the existing message in-place: removes text buttons, updates embed, and KEEPS all existing user reactions intact!
            await targetMsg.edit({ embeds: payload.embeds, components: [] });
            wasUpdated = true;
          } else {
            targetMsg = await interaction.channel.send(payload);
          }

          // Ensure message ID is tracked
          if (!Array.isArray(config.nationalityMessageIds)) config.nationalityMessageIds = [];
          if (!config.nationalityMessageIds.includes(targetMsg.id)) {
            config.nationalityMessageIds.push(targetMsg.id);
            saveConfig(config);
          }

          // Automatically react with configured flag emojis (skips already reacted ones)
          const activeNats = (config.nationalityRoles || []).filter(n => n && n.emoji);
          for (const item of activeNats) {
            await safelyReact(targetMsg, item.emoji);
          }

          const responseText = wasUpdated
            ? '✅ Existing nationality card updated in-place! **All previous user reactions and roles are preserved**, old text buttons were removed, and any new flag emojis were added.'
            : '✅ Nationality role card posted successfully! Flag emoji reactions are now active in this channel.';

          await interaction.editReply({ content: responseText });
        } catch (sendErr) {
          await interaction.editReply({ content: `❌ Error: **${sendErr.message}**.` });
        }
        return;
      }

      if (commandName === 'add-flag-role') {
        const emoji = interaction.options.getString('flag').trim();
        const targetRole = interaction.options.getRole('role');
        const country = interaction.options.getString('country')?.trim() || targetRole.name.replace(/[[\]]/g, '').trim();
        const code = country.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 5) || 'role';

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
              await safelyReact(activeMsg, emoji);
              cardUpdated = true;
            }
          }
        } catch (_) {}

        const updateNote = cardUpdated
          ? `\n\n• The nationality card in this channel was **automatically updated** and reacted with ${emoji} (all previous reactions preserved)!`
          : `\n\n• Run \`/post-nationality\` to post or update the card in this channel.`;

        await interaction.reply({
          content: `✅ Successfully linked ${emoji} **${country}** to role **@${targetRole.name}**!${updateNote}`,
          ephemeral: true
        });
        return;
      }

      if (commandName === 'remove-flag-role') {
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

          await interaction.reply({ content: `✅ Removed flag option \`${query}\`. The nationality card has been updated.`, ephemeral: true });
        } else {
          await interaction.reply({ content: `⚠️ Could not find a configured flag matching \`${query}\`.`, ephemeral: true });
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
    }
  } catch (err) {
    console.error('Unhandled interaction error:', err);
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

    // Check if this message is a nationality message
    const isNatMessage =
      (Array.isArray(config.nationalityMessageIds) && config.nationalityMessageIds.includes(message.id)) ||
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

    const isNatMessage =
      (Array.isArray(config.nationalityMessageIds) && config.nationalityMessageIds.includes(message.id)) ||
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

// API: Trigger Post Nationality Roles Embed
app.post('/api/post-nationality-roles', async (req, res) => {
  try {
    const { channelId } = req.body;
    const guild = client.guilds.cache.get(GUILD_ID) || client.guilds.cache.first();
    const channel = await guild?.channels.fetch(channelId).catch(() => null);
    if (!channel || !channel.isTextBased()) {
      return res.status(400).json({ error: 'Invalid or non-text channel specified' });
    }
    const payload = createNationalityMessage(guild);
    const sentMsg = await channel.send(payload);

    // Auto-react with configured flag emojis
    const activeNats = (config.nationalityRoles || []).filter(n => n && n.emoji);
    for (const item of activeNats) {
      await safelyReact(sentMsg, item.emoji);
    }

    if (!Array.isArray(config.nationalityMessageIds)) config.nationalityMessageIds = [];
    if (!config.nationalityMessageIds.includes(sentMsg.id)) {
      config.nationalityMessageIds.push(sentMsg.id);
      saveConfig(config);
    }

    res.json({ success: true });
  } catch (err) {
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
