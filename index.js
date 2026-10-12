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
  GUILD_ID,
  WELCOME_CHANNEL_ID
} = process.env;

// Validate essential environment variables
if (!DISCORD_TOKEN || !CLIENT_ID) {
  console.error('\n❌ ERROR: Missing DISCORD_TOKEN or CLIENT_ID in .env file!');
  console.log('👉 Please edit the .env file in this directory:');
  console.log('   1. Go to https://discord.com/developers/applications');
  console.log('   2. Select your application and copy "Application ID" into CLIENT_ID');
  console.log('   3. Go to the "Bot" tab, reset/copy the token into DISCORD_TOKEN');
  console.log('   4. Enable "SERVER MEMBERS INTENT" under Privileged Gateway Intents\n');
  process.exit(1);
}

// Initialize the Discord Client
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers, // Required to detect when new members join
    GatewayIntentBits.GuildMessages
  ],
  partials: [Partials.GuildMember, Partials.User]
});

// Helper: Find appropriate channel to send the welcome message
async function resolveWelcomeChannel(guild) {
  // 1. Configured channel from .env
  if (WELCOME_CHANNEL_ID) {
    const channel = await guild.channels.fetch(WELCOME_CHANNEL_ID).catch(() => null);
    if (channel && channel.isTextBased()) return channel;
  }

  // 2. Server's default system channel
  if (guild.systemChannel && guild.systemChannel.permissionsFor(guild.members.me)?.has(PermissionFlagsBits.SendMessages)) {
    return guild.systemChannel;
  }

  // 3. Channel named 'welcome', 'joins', or 'general'
  const matchingChannel = guild.channels.cache.find(ch => 
    ch.type === ChannelType.GuildText &&
    /welcome|joins|general/i.test(ch.name) &&
    ch.permissionsFor(guild.members.me)?.has(PermissionFlagsBits.SendMessages)
  );
  if (matchingChannel) return matchingChannel;

  // 4. First available text channel the bot can speak in
  return guild.channels.cache.find(ch => 
    ch.type === ChannelType.GuildText &&
    ch.permissionsFor(guild.members.me)?.has(PermissionFlagsBits.SendMessages)
  ) || null;
}

// Build the Welcome & Nickname Prompt Message
function createWelcomeMessage(member) {
  const embed = new EmbedBuilder()
    .setColor(0x5865F2) // Discord Blurple
    .setTitle(`👋 Welcome to ${member.guild.name}!`)
    .setDescription(
      `Hello ${member}! To help everyone get to know you and keep our server organized, **please set your server nickname** (e.g. your real name, game tag, or handle).\n\n` +
      `Click the button below to type in your nickname:`
    )
    .setThumbnail(member.user.displayAvatarURL({ dynamic: true, size: 256 }))
    .setFooter({
      text: `${member.guild.name} • Member #${member.guild.memberCount}`,
      iconURL: member.guild.iconURL({ dynamic: true }) || undefined
    })
    .setTimestamp();

  const button = new ButtonBuilder()
    .setCustomId(`btn_set_nickname_${member.id}`)
    .setLabel('✏️ Set My Nickname')
    .setStyle(ButtonStyle.Primary);

  const row = new ActionRowBuilder().addComponents(button);

  return { embeds: [embed], components: [row] };
}

// Define Slash Commands
const slashCommands = [
  new SlashCommandBuilder()
    .setName('setnickname')
    .setDescription('Change your nickname on this server')
    .addStringOption(option =>
      option
        .setName('nickname')
        .setDescription('The new nickname you want (max 32 characters)')
        .setRequired(false)
        .setMaxLength(32)
    ),

  new SlashCommandBuilder()
    .setName('prompt-nickname')
    .setDescription('Manually post the nickname setup prompt for a member (Admin only)')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addUserOption(option =>
      option
        .setName('target')
        .setDescription('The member to send the prompt for (optional)')
        .setRequired(false)
    )
];

// Register Slash Commands with Discord REST API
async function registerSlashCommands() {
  const rest = new REST({ version: '10' }).setToken(DISCORD_TOKEN);
  try {
    console.log('🔄 Registering slash commands...');
    const commandsJson = slashCommands.map(cmd => cmd.toJSON());

    // If GUILD_ID is provided, register directly to guild for immediate access
    if (GUILD_ID) {
      await rest.put(
        Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID),
        { body: commandsJson }
      );
      console.log(`✅ Guild slash commands registered instantly for Guild ID: ${GUILD_ID}`);
    }

    // Register globally so it works in all guilds
    await rest.put(
      Routes.applicationCommands(CLIENT_ID),
      { body: commandsJson }
    );
    console.log('✅ Global slash commands registered successfully!');
  } catch (error) {
    console.error('⚠️ Warning: Failed to register slash commands:', error.message);
  }
}

// Event: Client Ready
client.once('ready', async () => {
  console.log(`\n======================================================`);
  console.log(`🤖 Logged in as: ${client.user.tag}`);
  console.log(`📡 Connected to ${client.guilds.cache.size} server(s)`);
  console.log(`======================================================`);

  // Calculate Bot Invite Link with proper permissions
  const inviteUrl = `https://discord.com/oauth2/authorize?client_id=${CLIENT_ID}&permissions=67108864&scope=bot%20applications.commands`;
  console.log(`🔗 Bot Invite URL:`);
  console.log(`   ${inviteUrl}`);
  console.log(`======================================================\n`);

  await registerSlashCommands();
});

// Event: New Member Joined the Server
client.on('guildMemberAdd', async (member) => {
  // Ignore bots joining
  if (member.user.bot) return;

  try {
    const channel = await resolveWelcomeChannel(member.guild);
    if (!channel) {
      console.warn(`[guildMemberAdd] Could not find a suitable text channel in ${member.guild.name} to send welcome message.`);
      return;
    }

    const welcomePayload = createWelcomeMessage(member);
    await channel.send(welcomePayload);
    console.log(`[guildMemberAdd] Sent welcome & nickname prompt for ${member.user.tag} in #${channel.name}`);
  } catch (error) {
    console.error(`[guildMemberAdd] Error handling new member ${member.user.tag}:`, error);
  }
});

// Event: Interaction Create (Button clicks, Modals, Slash commands)
client.on('interactionCreate', async (interaction) => {
  try {
    // 1. Handle Button Click
    if (interaction.isButton()) {
      if (interaction.customId.startsWith('btn_set_nickname')) {
        // Build modal popup
        const modal = new ModalBuilder()
          .setCustomId('modal_set_nickname')
          .setTitle('Set Server Nickname');

        const nicknameInput = new TextInputBuilder()
          .setCustomId('input_nickname_field')
          .setLabel('What would you like your nickname to be?')
          .setStyle(TextInputStyle.Short)
          .setPlaceholder('Enter your name or preferred handle (max 32 chars)')
          .setMinLength(1)
          .setMaxLength(32)
          .setRequired(true);

        const firstActionRow = new ActionRowBuilder().addComponents(nicknameInput);
        modal.addComponents(firstActionRow);

        // Show modal to the user who clicked
        await interaction.showModal(modal);
      }
      return;
    }

    // 2. Handle Modal Submission
    if (interaction.isModalSubmit()) {
      if (interaction.customId === 'modal_set_nickname') {
        const newNickname = interaction.fields.getTextInputValue('input_nickname_field').trim();
        const guild = interaction.guild;
        const member = interaction.member;

        if (!guild || !member) {
          await interaction.reply({
            content: '❌ This command can only be used inside a server.',
            ephemeral: true
          });
          return;
        }

        // Check bot permissions
        const botMember = guild.members.me;
        if (!botMember.permissions.has(PermissionFlagsBits.ManageNicknames)) {
          await interaction.reply({
            content: '❌ **Permission Error:** The bot is missing the **Manage Nicknames** permission on this server. Please notify a server administrator.',
            ephemeral: true
          });
          return;
        }

        // Check Discord role hierarchy
        if (guild.ownerId === member.id) {
          await interaction.reply({
            content: `⚠️ **Server Owner Notice:** Discord does not allow bots to change the server owner's nickname. You can change it manually in server settings!`,
            ephemeral: true
          });
          return;
        }

        if (member.roles.highest.position >= botMember.roles.highest.position) {
          await interaction.reply({
            content: `⚠️ **Role Hierarchy Notice:** Your highest role is equal to or higher than the bot's role. Discord requires the bot's role to be placed **above** your role in **Server Settings > Roles** for the bot to modify your nickname.`,
            ephemeral: true
          });
          return;
        }

        // Attempt nickname change
        try {
          await member.setNickname(newNickname, 'User requested via nickname bot modal');
          
          await interaction.reply({
            content: `🎉 **Success!** Your server nickname has been updated to **${newNickname}**! Welcome aboard!`,
            ephemeral: true
          });
          console.log(`[Nickname Change] Updated ${member.user.tag}'s nickname to "${newNickname}" in ${guild.name}`);
        } catch (err) {
          console.error(`[Nickname Change Error]`, err);
          await interaction.reply({
            content: `❌ Could not set nickname: ${err.message || 'Unknown error'}. Please contact an administrator.`,
            ephemeral: true
          });
        }
      }
      return;
    }

    // 3. Handle Slash Commands
    if (interaction.isChatInputCommand()) {
      const { commandName } = interaction;

      if (commandName === 'setnickname') {
        const directNickname = interaction.options.getString('nickname');

        // If nickname argument was provided directly in slash command
        if (directNickname) {
          const guild = interaction.guild;
          const member = interaction.member;

          if (!guild || !member) {
            await interaction.reply({ content: '❌ Must be used inside a server.', ephemeral: true });
            return;
          }

          const botMember = guild.members.me;
          if (!botMember.permissions.has(PermissionFlagsBits.ManageNicknames)) {
            await interaction.reply({
              content: '❌ The bot lacks the **Manage Nicknames** permission.',
              ephemeral: true
            });
            return;
          }

          if (guild.ownerId === member.id) {
            await interaction.reply({
              content: `⚠️ Bots cannot change the Server Owner's nickname due to Discord limitations.`,
              ephemeral: true
            });
            return;
          }

          if (member.roles.highest.position >= botMember.roles.highest.position) {
            await interaction.reply({
              content: `⚠️ The bot's role must be positioned above your roles in **Server Settings > Roles**.`,
              ephemeral: true
            });
            return;
          }

          await member.setNickname(directNickname, 'Changed via /setnickname');
          await interaction.reply({
            content: `✅ Your nickname has been changed to **${directNickname}**!`,
            ephemeral: true
          });
        } else {
          // Open Modal if no nickname was provided directly
          const modal = new ModalBuilder()
            .setCustomId('modal_set_nickname')
            .setTitle('Set Server Nickname');

          const nicknameInput = new TextInputBuilder()
            .setCustomId('input_nickname_field')
            .setLabel('Desired Server Nickname')
            .setStyle(TextInputStyle.Short)
            .setPlaceholder('Enter your name or preferred handle')
            .setMinLength(1)
            .setMaxLength(32)
            .setRequired(true);

          const row = new ActionRowBuilder().addComponents(nicknameInput);
          modal.addComponents(row);

          await interaction.showModal(modal);
        }
      }

      if (commandName === 'prompt-nickname') {
        const targetMember = interaction.options.getMember('target') || interaction.member;
        const welcomePayload = createWelcomeMessage(targetMember);

        await interaction.channel.send(welcomePayload);
        await interaction.reply({
          content: `✅ Sent nickname prompt for **${targetMember.user.tag}**!`,
          ephemeral: true
        });
      }
    }
  } catch (interactionError) {
    console.error('Unhandled interaction error:', interactionError);
    if (interaction.isRepliable() && !interaction.replied && !interaction.deferred) {
      await interaction.reply({
        content: '⚠️ An unexpected error occurred while processing your request.',
        ephemeral: true
      }).catch(() => null);
    }
  }
});

// Log In to Discord
client.login(DISCORD_TOKEN);
