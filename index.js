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
  verifyFooter: process.env.VERIFY_FOOTER || 'Maiev Verification System • AION 2'
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

// ──────────────────────────────────────────
// DISCORD CLIENT INITIALIZATION
// ──────────────────────────────────────────
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages
  ],
  partials: [Partials.GuildMember, Partials.User]
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
        await interaction.showModal(modal);
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
        await interaction.reply({
          content: `🎉 **AION 2 IGN Registered!**\n\n` +
            `• **Nickname:** Changed to **${ign}**\n` +
            `• **Roles Given:** **${rolesText}**\n\n` +
            `📸 **Next Step:** Please submit your character screenshot in the verification channel for staff approval!`,
          ephemeral: true
        });

        console.log(`[Verification] ${member.user.tag} set IGN to "${ign}". Granted: ${addedNames.join(', ')}`);
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
          await interaction.showModal(modal);
        }
        return;
      }
    }
  } catch (err) {
    console.error('Unhandled interaction error:', err);
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
    verifyFooter
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
    verifyFooter: verifyFooter !== undefined ? verifyFooter : config.verifyFooter
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
