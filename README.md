# 🤖 Discord Nickname Bot

A modern Discord bot built with **Discord.js v14** that automatically greets new members in your server and prompts them to set their server nickname via an interactive button and a popup Modal window.

---

## ✨ Features

- **Automatic Welcome**: Welcomes new members the moment they join (`guildMemberAdd`).
- **Interactive Button & Modal**: Users click **"✏️ Set My Nickname"** to open a native Discord popup Modal.
- **Auto-Update**: Updates the member's server nickname automatically upon modal submission.
- **Safe & Permissive**: Detects permission issues (like Discord's role hierarchy or server ownership) and provides friendly feedback.
- **Slash Commands**:
  - `/setnickname [nickname]` — Allows any member to update their nickname anytime.
  - `/prompt-nickname [target]` — Allows admins to manually trigger the nickname prompt for any member.
- **Auto-Detect Channels**: Automatically finds `#welcome`, `#general`, or your server's default system channel if a specific channel is not specified in `.env`.

---

## 🚀 Setup Instructions

### Step 1: Create Your Discord Bot Application

1. Open the [Discord Developer Portal](https://discord.com/developers/applications) and sign in.
2. Click **New Application** (top right) and give it a name (e.g. `Nickname Assistant`).
3. In the **General Information** tab, copy the **Application ID**. You will need this as `CLIENT_ID`.
4. Go to the **Bot** tab on the left sidebar:
   - Click **Reset Token** (or **Add Bot** if prompted) and copy your **Token**. This is your `DISCORD_TOKEN`.
   - Scroll down to **Privileged Gateway Intents** and enable:
     - ✅ **Server Members Intent** *(CRITICAL: Required for detecting new members joining)*
   - Click **Save Changes**.

---

### Step 2: Configure Environment Variables

Open the [.env](file:///c:/Users/Admin/Desktop/gio-portfolio/discord-nickname-bot/.env) file in the `discord-nickname-bot` folder:

```env
DISCORD_TOKEN=your_bot_token_here
CLIENT_ID=your_application_id_here

# (Optional) Add your server ID for instant slash command testing:
GUILD_ID=

# (Optional) Specify a channel ID for welcomes (leave blank to auto-detect #welcome or system channel):
WELCOME_CHANNEL_ID=
```

> **How to get Discord IDs?** Enable Developer Mode in Discord (`User Settings > Advanced > Developer Mode`). Then right-click any server or channel and select **Copy ID**.

---

### Step 3: Invite the Bot to Your Server

Generate your bot invite link:
Replace `YOUR_CLIENT_ID` with your bot's Application ID:

```
https://discord.com/oauth2/authorize?client_id=YOUR_CLIENT_ID&permissions=67108864&scope=bot%20applications.commands
```

Or run the bot once (`npm start`) — it will print your custom invite link directly in the console!

> ⚠️ **Important: Role Hierarchy in Discord**
> Discord does not allow bots to change the nickname of anyone with a role equal to or higher than the bot.
> 1. In your Discord server, go to **Server Settings > Roles**.
> 2. Drag the **Bot's role** above regular member roles.
> 3. Ensure the bot has the **Manage Nicknames** permission.

---

### Step 4: Run the Bot

Inside the `discord-nickname-bot` directory:

```bash
# Start normally
npm start

# Or run with live file reloading (Node.js 18+)
npm run dev
```

When started, you should see:
```text
🤖 Logged in as: YourBot#1234
📡 Connected to 1 server(s)
✅ Global slash commands registered successfully!
```

---

## 🛠️ Usage

1. When a new user joins your server, the bot posts a welcome card with a **"✏️ Set My Nickname"** button.
2. The user clicks the button, a modal appears, and they type their name (max 32 characters).
3. The bot automatically updates their nickname on the server and confirms with an ephemeral message!
4. Existing users can also use `/setnickname` at any time.
