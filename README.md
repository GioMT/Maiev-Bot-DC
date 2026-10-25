# 🛡️ Maiev — Discord AION 2 Verification Bot

A Discord bot built with **Discord.js v14** for AION 2 gaming communities. Features a complete onboarding pipeline:
1. **Rules Acknowledgment:** Members read the rules and click **"✅ I Agree"**, unlocking the `#verify-ign` channel.
2. **AION 2 IGN Modal Verification:** In `#verify-ign`, members click **"🎮 Set AION 2 IGN & Verify"** to pop open a native Discord modal.
3. **Auto Nickname & Role Assignment:** Maiev sets their server nickname to their AION 2 character name and assigns the verified member role automatically!

---

## 🛠️ Slash Commands

- `/post-rules` *(Admin)*: Posts the rules embed with the **"✅ I Have Read & Agree to the Rules"** button.
- `/post-verify` *(Admin)*: Posts Maiev's verification embed with the **"🎮 Set AION 2 IGN & Verify"** button in `#verify-ign`.
- `/configure-verification` *(Admin)*: Interactively set the Rules Role, Verified Role, and #verify-ign channel directly inside Discord.
- `/setnickname` *(Everyone)*: Allows members to update their AION 2 character name if they rename their character.

---

## ⚙️ How to Set Up in Your Discord Server

### 1. Create Your Roles
In your Discord server under **Server Settings > Roles**:
- **Rules Role** (e.g. `Rules Acknowledged` or `Unverified`): Given after clicking the rules button.
- **Verified Member Role** (e.g. `Member` or `AION 2`): Given after entering their AION 2 IGN.

> ⚠️ **Hierarchy Reminder:** Ensure **Maiev's bot role is placed above** the member and verified roles, and has **Manage Roles** + **Manage Nicknames** permissions!

### 2. Set Up Channel Permissions
- **#rules channel**: Visible to `@everyone`.
- **#verify-ign channel**:
  - `@everyone`: Hide Channel (View Channel: ❌)
  - `@Rules Acknowledged` (or `Unverified`): View Channel: ✅, Send Messages: ❌ (they only need to click the button!)
- **General / Community channels**:
  - Visible only to `@Member` (the verified role).

### 3. Post the Messages
1. In your **#rules** channel, run:
   ```text
   /post-rules
   ```
2. In your **#verify-ign** channel, run:
   ```text
   /post-verify
   ```

Done! Your onboarding pipeline is now fully automated!

---

## ⏰ Aion 2 Field Boss & Abyss Tracker

Maiev tracks live Aion 2 Field Boss and Abyss respawn timers for **Server 1507 (Fregion)**:
- **Live Two-Column Status Table:** Live display for Reshanta (Abyss) and Elyos Overland field bosses.
- **Auto-Updating Embeds:** Recalculates and updates remaining time every 1 minute.
- **10-Minute @here Alert Pings:** Pings your General Chat when a major boss is 10 minutes away from respawning.
- **Cloudflare Worker Relay:** Built-in bridge to bypass Cloudflare bot challenges seamlessly.

👉 **For complete setup, architecture, and Cloudflare Worker instructions, read the [Aion 2 Boss Tracker Guide](AION2_BOSS_TRACKER_GUIDE.md).**


