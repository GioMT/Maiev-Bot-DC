# ⏰ Maiev — Aion 2 Field Boss & Abyss Tracker Guide

This document covers everything you need to know about Maiev's real-time Aion 2 Field Boss and Abyss tracking system. It details all third-party services, configuration settings, step-by-step setup guides, and troubleshooting procedures so you can easily maintain or recreate the setup in the future.

---

## 🏗️ Architecture & Data Flow

```
┌─────────────────┐       ┌────────────────────────┐       ┌────────────────────────┐       ┌─────────────────┐
│   Questlog.gg   │ ────> │   Cloudflare Worker    │ ────> │   Maiev (Node.js bot)  │ ────> │     Discord     │
│  (Aion 2 API)   │       │ (relay/questlog-worker)│       │  (on bot-hosting.net)  │       │   Channel & @   │
└─────────────────┘       └────────────────────────┘       └────────────────────────┘       └─────────────────┘
      Source                 Bypasses Cloudflare              Runs 1m / 3m loops               Live Embeds &
   Server: 1507               Bot Challenge                     In-memory cache                 @here Alerts
```

### Why the Cloudflare Worker Relay is Needed:
Questlog.gg sits behind Cloudflare's bot protection. When cloud datacenter IPs (like **bot-hosting.net**) make direct HTTP requests to Questlog, Cloudflare blocks them with a **`403 Forbidden (cf-mitigated: challenge)`** JavaScript verification page ("Just a moment...").

To solve this permanently, a free **Cloudflare Worker** (`relay/questlog-worker.js`) acts as a secure bridge:
- Requests to Questlog come directly from Cloudflare's internal global edge network (which is never blocked).
- The Worker fetches the boss timer JSON and passes it cleanly back to Maiev.
- **Cost:** 100% Free (Cloudflare free plan allows 100,000 requests/day; Maiev uses only ~480 requests/day).

---

## 🌐 Third-Party Services Involved

| Service | Purpose | URL / Dashboard |
|---|---|---|
| **Questlog.gg** | Upstream source of Aion 2 field boss respawn times | [questlog.gg/aion-2](https://questlog.gg/aion-2) |
| **Cloudflare Workers** | Proxy relay to bypass Cloudflare 403 bot challenges | [dash.cloudflare.com](https://dash.cloudflare.com) |
| **bot-hosting.net** | 24/7 Node.js bot hosting container | [bot-hosting.net](https://bot-hosting.net) |
| **Discord Developer Portal** | Bot token, permissions, and gateway intents | [discord.com/developers](https://discord.com/developers) |

---

## ⚙️ Environment Variables Reference

Configure these in your **bot-hosting.net** panel under **Environment Variables** (or in a `.env` file):

| Variable | Required? | Example / Value | Description |
|---|---|---|---|
| `DISCORD_TOKEN` | **Yes** | `MTM...` | Your Discord bot application token |
| `CLIENT_ID` | **Yes** | `1559...` | Discord Application Client ID |
| `BOSS_TIMER_API_URL` | **Yes** | `https://maiev-questlog-relay.<subdomain>.workers.dev/` | The deployed Cloudflare Worker relay URL |
| `BOSS_ALERT_CHANNEL_ID`| Recommended | `1559275351396323329` | Discord channel ID where **10-minute @here alert pings** are sent (General Chat) |
| `BOSS_TIMER_MESSAGE_ID`| Optional | `1563889101234567890` | Pinned message ID in tracker channel. Leave blank on first run; Maiev creates it automatically |

---

## 🚀 Step-by-Step Setup & Recreation Guide

If you ever rebuild the bot on a new host or need to recreate the Cloudflare Worker, follow these steps:

### Step 1: Deploy / Recreate the Cloudflare Worker Relay
1. Log in to [dash.cloudflare.com](https://dash.cloudflare.com).
2. Navigate to **Workers & Pages** in the left sidebar.
3. Click the blue **Create application** (or **Create Worker**) button.
4. Select **Start with Hello World!** (or blank template).
5. Name it: `maiev-questlog-relay` and click **Deploy**.
6. On the confirmation screen, click **Edit code** (the `</>` code editor).
7. Delete the sample code, and paste the full contents of [`relay/questlog-worker.js`](./relay/questlog-worker.js).
8. Click **Deploy** at the top right.
9. Copy your Worker URL: `https://maiev-questlog-relay.<your-subdomain>.workers.dev/`.
10. *(Optional Security)* If you want a secret key:
    - Go to **Settings > Variables and Secrets > Add**.
    - Type: `Secret`, Name: `RELAY_KEY`, Value: `<any_secret_passphrase>`.
    - If set, your URL becomes: `https://maiev-questlog-relay.<your-subdomain>.workers.dev/?key=<any_secret_passphrase>`.

### Step 2: Configure Discord Permissions
Ensure Maiev has the following permissions in the target channels:
- In the **Tracker Channel** (`1563876333623312394`):
  - ✅ **View Channel**
  - ✅ **Send Messages**
  - ✅ **Embed Links**
  - ✅ **Read Message History**
- In the **General Alert Channel** (`BOSS_ALERT_CHANNEL_ID`):
  - ✅ **View Channel**
  - ✅ **Send Messages**
  - ✅ **Embed Links**
  - ✅ **Mention @everyone, @here, and All Roles**

### Step 3: Configure bot-hosting.net
1. Open your server panel on **bot-hosting.net**.
2. Go to **Environment Variables** (or **Startup Settings**).
3. Set:
   ```text
   BOSS_TIMER_API_URL = https://maiev-questlog-relay.<your-subdomain>.workers.dev/
   BOSS_ALERT_CHANNEL_ID = <YOUR_GENERAL_CHAT_CHANNEL_ID>
   ```
4. Click **Restart**.

---

## 📊 Features & Operational Details

### 1. Two-Column Live Table Embeds
Maiev displays two separate embeds in channel `1563876333623312394`:
- **🔥 Fregion — Reshanta / Abyss Bosses** (Red `#e74c3c`)
- **🪽 Fregion — Elyos Overland Field Bosses** (Blue `#3498db`)

Each embed formats bosses into a clean, aligned table:
```text
Boss                     Status
───────────────────────  ─────────
Rotten Kutar             ● Alive
Centurion Demiros        ● Alive
Neikel of the East       ○ 00h 11m
Watcher Kaira            ○ 02h 39m      ★
Executor Tamasa          ○ 23h 09m      ★
Guardian Lord Nahma      ○ 04d 22h 39m  ★
```

### 2. Time Format
- **>= 1 day:** `00d 00h 00m` (e.g. `04d 22h 39m`)
- **< 1 day:** `00h 00m` (e.g. `23h 09m`, `00h 11m`)
- **Active:** `● Alive`
- **Zero reached (prior to map sync):** `● Spawning`

### 3. Major Bosses (Starred `★`)
The following high-value bosses are highlighted with a `★` and trigger the 10-minute alert:
- `Watcher Kaira`
- `Argo, the Spirit King`
- `Guardian Lord Nahma`
- `Eternal Gartua`
- `High Commander Lagta`
- `Soul Ruler Kashapa`
- `Silent Dartan`
- `Executor Tamasa`
- `Executor Argo`
- `Executor Kaira`

### 4. 10-Minute Respawn Alert (@here)
- When any major boss has `<= 10 minutes` remaining until respawn, Maiev sends an `@here` alert with an embedded battle card to `BOSS_ALERT_CHANNEL_ID`.
- **Deduplication:** Maiev stores the unique `${boss.name}_${boss.time}` key in memory, guaranteeing **only one alert per spawn cycle**.

### 5. Loop Timers
- **Data Sync Loop (every 3 minutes):** Pings the Worker relay to retrieve fresh data from Questlog.
- **Countdown Tick Loop (every 1 minute):** Recalculates remaining duration from cached data and edits the Discord message in-place, keeping timers ticking down accurately without exceeding Discord rate limits.

---

## 🛠️ Maintenance & Troubleshooting

### Issue 1: "Questlog API error: 403 Forbidden"
- **Cause:** `BOSS_TIMER_API_URL` is either missing or pointing directly at `questlog.gg` instead of your Cloudflare Worker.
- **Fix:** Check your panel environment variables and ensure `BOSS_TIMER_API_URL` is set to `https://maiev-questlog-relay.<subdomain>.workers.dev/`. Test that URL directly in your browser first; it should immediately return JSON data starting with `{"result":{"data":...}}`.

### Issue 2: A new duplicate message is posted whenever the bot restarts
- **Cause:** The bot-hosting.net container wiped `bossTimerConfig.json`.
- **Fix:** Copy the Message ID of the existing message in Discord (right-click the message → **Copy Message ID**), and add it as an environment variable in bot-hosting.net:
  ```text
  BOSS_TIMER_MESSAGE_ID = <COPIED_MESSAGE_ID>
  ```
  Maiev will resume updating that exact message on restart.

### Issue 3: The tracker message was deleted in Discord
- **Behavior:** Maiev detects Discord error `10008: Unknown Message`, automatically posts a new message, saves the new ID, and resumes the 1-minute updates without crashing.

### Issue 4: @here alert pings aren't working
- **Check 1:** Ensure `BOSS_ALERT_CHANNEL_ID` is set to a valid text channel ID in your panel environment variables.
- **Check 2:** Ensure Maiev's role has the **Mention @everyone, @here, and All Roles** permission in that channel.
