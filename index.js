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

dotenv.config();

const {
  DISCORD_TOKEN,
  CLIENT_ID,
  GUILD_ID
} = process.env;

// Runtime state for roles & channels (configurable via .env or /configure-verification)
let config = {
  rulesRoleId: process.env.RULES_ROLE_ID || '',
  verifiedRoleId: process.env.VERIFIED_ROLE_ID || '',
  verifyChannelId: process.env.VERIFY_CHANNEL_ID || ''
};

// Validate essential environment variables
if (!DISCORD_TOKEN || !CLIENT_ID) {
  console.error('\n❌ ERROR: Missing DISCORD_TOKEN or CLIENT_ID in .env file!');
  process.exit(1);
}

// Initialize Discord Client
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers, // Required to read & modify member roles and nicknames
    GatewayIntentBits.GuildMessages
  ],
  partials: [Partials.GuildMember, Partials.User]
});

// Helper: Resolve or find a role by ID or Name
async function resolveRole(guild, roleId, fallbackNames = []) {
  if (roleId) {
    const role = await guild.roles.fetch(roleId).catch(() => null);
    if (role) return role;
  }
  return guild.roles.cache.find(r => 
    fallbackNames.some(name => r.name.toLowerCase().includes(name.toLowerCase()))
  ) || null;
}

// Helper: Resolve or find the #verify-ign channel
async function resolveVerifyChannel(guild) {
  if (config.verifyChannelId) {
    const ch = await guild.channels.fetch(config.verifyChannelId).catch(() => null);
    if (ch && ch.isTextBased()) return ch;
  }
  return guild.channels.cache.find(ch => 
    ch.type === ChannelType.GuildText && 
    /verify|verify-ign|ign|verification/i.test(ch.name)
  ) || null;
}

// Build: Server Rules Embed & Acceptance Button
function createRulesMessage() {
  const embed = new EmbedBuilder()
    .setColor(0x2B2D31) // Sleek dark theme
    .setTitle('📜 Server Rules & Guidelines')
    .setDescription(
      'Welcome to the community! Before proceeding, please review our core server rules:\n\n' +
      '**1. Respect Everyone** — Treat all members with courtesy and kindness. Zero tolerance for harassment, racism, or toxicity.\n' +
      '**2. Keep Content Appropriate** — Keep discussions in the relevant channels. No NSFW or offensive content.\n' +
      '**3. Follow Game Terms of Service** — No exploits, account selling, or unapproved third-party software.\n' +
      '**4. Listen to Staff** — Follow the instructions of moderators and administrators at all times.\n\n' +
      '━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n' +
      '**Next Step:** Click the button below to acknowledge the rules. This will unlock the **#verify-ign** channel so you can register your AION 2 In-Game Name with **Maiev**!'
    )
    .setFooter({ text: 'Acknowledge the rules below to proceed' });

  const button = new ButtonBuilder()
    .setCustomId('btn_accept_rules')
    .setLabel('✅ I Have Read & Agree to the Rules')
    .setStyle(ButtonStyle.Success);

  const row = new ActionRowBuilder().addComponents(button);
  return { embeds: [embed], components: [row] };
}

// Build: Maiev AION 2 Verification Card
function createVerifyMessage(guild) {
  const embed = new EmbedBuilder()
    .setColor(0x5865F2) // Discord Blurple
    .setTitle(`🛡️ Maiev — AION 2 IGN Verification`)
    .setDescription(
      `Welcome to **${guild.name}**!\n\n` +
      `To complete your membership and gain full access to the server channels, please register your **AION 2 In-Game Name (IGN)**.\n\n` +
      `**How it works:**\n` +
      `1. Click the **"🎮 Set AION 2 IGN"** button below.\n` +
      `2. Enter your exact AION 2 character name in the popup.\n` +
      `3. Maiev will set your server nickname and assign your verified member role automatically!`
    )
    .setThumbnail(guild.iconURL({ dynamic: true }) || undefined)
    .setFooter({ text: 'Maiev Verification System • AION 2' });

  const button = new ButtonBuilder()
    .setCustomId('btn_open_ign_modal')
    .setLabel('🎮 Set AION 2 IGN & Verify')
    .setStyle(ButtonStyle.Primary);

  const row = new ActionRowBuilder().addComponents(button);
  return { embeds: [embed], components: [row] };
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
    .setDescription('Configure roles and channel for the AION 2 verification flow (Admin only)')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addRoleOption(option =>
      option
        .setName('rules_role')
        .setDescription('Role given after accepting rules (to view #verify-ign)')
        .setRequired(false)
    )
    .addRoleOption(option =>
      option
        .setName('verified_role')
        .setDescription('Final role given after setting AION 2 IGN')
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
  console.log(`\n======================================================`);
  console.log(`🤖 Maiev is ONLINE as: ${client.user.tag}`);
  console.log(`📡 Serving ${client.guilds.cache.size} server(s)`);
  console.log(`🛡️ AION 2 Nickname & Role Verification Ready`);
  console.log(`======================================================\n`);
  await registerSlashCommands();
});

// Interaction Handling (Buttons, Modals, Slash Commands)
client.on('interactionCreate', async (interaction) => {
  try {
    const guild = interaction.guild;
    const member = interaction.member;

    // ──────────────────────────────────────────
    // 1. BUTTON INTERACTIONS
    // ──────────────────────────────────────────
    if (interaction.isButton()) {
      // Step A: Member clicks "I Agree to Rules"
      if (interaction.customId === 'btn_accept_rules') {
        const rulesRole = await resolveRole(guild, config.rulesRoleId, ['Rules Acknowledged', 'Rules Accepted', 'Unverified']);
        const verifyChannel = await resolveVerifyChannel(guild);

        if (rulesRole) {
          // Check if bot can manage roles
          if (!guild.members.me.permissions.has(PermissionFlagsBits.ManageRoles)) {
            await interaction.reply({
              content: '❌ **Bot Permission Error:** Maiev lacks the **Manage Roles** permission. Please ask an admin to fix role permissions.',
              ephemeral: true
            });
            return;
          }

          if (guild.members.me.roles.highest.position <= rulesRole.position) {
            await interaction.reply({
              content: `⚠️ **Role Hierarchy Error:** The bot's role must be placed **above** the **@${rulesRole.name}** role in **Server Settings > Roles**.`,
              ephemeral: true
            });
            return;
          }

          await member.roles.add(rulesRole, 'Accepted server rules');
        }

        const channelMention = verifyChannel ? `<#${verifyChannel.id}>` : '**#verify-ign**';
        await interaction.reply({
          content: `✅ **Rules Acknowledged!** Thank you!\n\n👉 Please head over to ${channelMention} to set your **AION 2 IGN** with Maiev and unlock the rest of the server!`,
          ephemeral: true
        });
        return;
      }

      // Step B: Member clicks "Set AION 2 IGN & Verify"
      if (interaction.customId === 'btn_open_ign_modal') {
        const modal = new ModalBuilder()
          .setCustomId('modal_aion2_verify')
          .setTitle('AION 2 IGN Verification');

        const ignInput = new TextInputBuilder()
          .setCustomId('input_aion_ign')
          .setLabel('Enter your AION 2 In-Game Name (IGN)')
          .setStyle(TextInputStyle.Short)
          .setPlaceholder('e.g. DaevaLegend, ShadowWing, etc.')
          .setMinLength(2)
          .setMaxLength(32)
          .setRequired(true);

        const row = new ActionRowBuilder().addComponents(ignInput);
        modal.addComponents(row);

        await interaction.showModal(modal);
        return;
      }
    }

    // ──────────────────────────────────────────
    // 2. MODAL SUBMISSIONS
    // ──────────────────────────────────────────
    if (interaction.isModalSubmit()) {
      if (interaction.customId === 'modal_aion2_verify') {
        const ign = interaction.fields.getTextInputValue('input_aion_ign').trim();
        const botMember = guild.members.me;

        // Permissions check
        if (!botMember.permissions.has(PermissionFlagsBits.ManageNicknames)) {
          await interaction.reply({
            content: '❌ **Permission Error:** Maiev lacks the **Manage Nicknames** permission. Please notify an administrator.',
            ephemeral: true
          });
          return;
        }

        // Role hierarchy check
        if (guild.ownerId === member.id) {
          await interaction.reply({
            content: `⚠️ **Server Owner Notice:** Discord prevents bots from changing the server owner's nickname. You can change it manually in server settings!`,
            ephemeral: true
          });
          return;
        }

        if (member.roles.highest.position >= botMember.roles.highest.position) {
          await interaction.reply({
            content: `⚠️ **Role Hierarchy Notice:** Maiev's role must be dragged **above** your highest role in **Server Settings > Roles** to change your nickname.`,
            ephemeral: true
          });
          return;
        }

        // 1. Update Nickname
        await member.setNickname(ign, 'AION 2 IGN Verification via Maiev');

        // 2. Assign Verified Role & Remove Temporary Rules Role
        const verifiedRole = await resolveRole(guild, config.verifiedRoleId, ['Verified', 'Member', 'AION 2', 'Legionnaire']);
        const rulesRole = await resolveRole(guild, config.rulesRoleId, ['Rules Acknowledged', 'Rules Accepted', 'Unverified']);

        if (verifiedRole && botMember.permissions.has(PermissionFlagsBits.ManageRoles)) {
          if (botMember.roles.highest.position > verifiedRole.position) {
            await member.roles.add(verifiedRole, 'Verified AION 2 IGN');
          }
        }

        if (rulesRole && botMember.permissions.has(PermissionFlagsBits.ManageRoles)) {
          if (botMember.roles.highest.position > rulesRole.position) {
            await member.roles.remove(rulesRole, 'Completed verification').catch(() => null);
          }
        }

        // Send confirmation
        const roleText = verifiedRole ? ` and granted the **@${verifiedRole.name}** role` : '';
        await interaction.reply({
          content: `🎉 **Verification Complete!**\n\nYour nickname is now set to **${ign}**${roleText}!\nWelcome to the community, Daeva!`,
          ephemeral: true
        });

        // Public announcement in channel
        await interaction.channel.send({
          content: `⚔️ **${member}** has verified their AION 2 IGN as **${ign}** and joined the server!`
        }).catch(() => null);

        console.log(`[Verification] Verified ${member.user.tag} as "${ign}" in ${guild.name}`);
        return;
      }
    }

    // ──────────────────────────────────────────
    // 3. SLASH COMMANDS
    // ──────────────────────────────────────────
    if (interaction.isChatInputCommand()) {
      const { commandName } = interaction;

      // /post-rules (Admin)
      if (commandName === 'post-rules') {
        const payload = createRulesMessage();
        await interaction.channel.send(payload);
        await interaction.reply({ content: '✅ Rules card posted successfully!', ephemeral: true });
        return;
      }

      // /post-verify (Admin)
      if (commandName === 'post-verify') {
        const payload = createVerifyMessage(guild);
        await interaction.channel.send(payload);
        await interaction.reply({ content: '✅ Maiev AION 2 verification card posted successfully!', ephemeral: true });
        return;
      }

      // /configure-verification (Admin)
      if (commandName === 'configure-verification') {
        const rulesRole = interaction.options.getRole('rules_role');
        const verifiedRole = interaction.options.getRole('verified_role');
        const verifyChannel = interaction.options.getChannel('verify_channel');

        if (rulesRole) config.rulesRoleId = rulesRole.id;
        if (verifiedRole) config.verifiedRoleId = verifiedRole.id;
        if (verifyChannel) config.verifyChannelId = verifyChannel.id;

        const summary = [
          `**Rules Role:** ${config.rulesRoleId ? `<@&${config.rulesRoleId}>` : '*Auto-detecting "Rules Acknowledged" / "Unverified"*'}`,
          `**Verified Role:** ${config.verifiedRoleId ? `<@&${config.verifiedRoleId}>` : '*Auto-detecting "Member" / "Verified" / "AION 2"*'}`,
          `**Verify Channel:** ${config.verifyChannelId ? `<#${config.verifyChannelId}>` : '*Auto-detecting #verify-ign*'}`
        ].join('\n');

        await interaction.reply({
          content: `⚙️ **Verification Configuration Updated:**\n\n${summary}`,
          ephemeral: true
        });
        return;
      }

      // /setnickname (Anyone)
      if (commandName === 'setnickname') {
        const directNickname = interaction.options.getString('nickname');
        if (directNickname) {
          const botMember = guild.members.me;
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
          // Open Modal
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
    if (interaction.isRepliable() && !interaction.replied && !interaction.deferred) {
      await interaction.reply({
        content: '⚠️ An unexpected error occurred while processing your request.',
        ephemeral: true
      }).catch(() => null);
    }
  }
});

// Start Client
client.login(DISCORD_TOKEN);
