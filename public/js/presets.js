export const DEFAULT_RULES_TEMPLATE = {
  title: 'Server Rules & Guidelines',
  content: `Welcome to Fregion community! Before proceeding, please review our core server rules:

**1. Respect Everyone** — Treat all members with courtesy and kindness. Zero tolerance for harassment, bullying, trolling or starting unnecessary drama.
**2. No Discrimination or Hate Speech** — Do not use slurs, defamatory, or abusive language. Any discrimination based on race, sex, gender or identity will lead to an immediate ban.
**3. No Threats or Intimidation** — Do not threaten, blackmail, or intimidate anyone on this server. Personal safety is strictly enforced.
**4. Keep Content Appropriate** — Keep discussions in the relevant channels. No NSFW, sexually explicit, graphic, or offensive content.
**5. No Illegal Content** — Sharing pirated materials, malicious links, malware, or any illegal content is strictly prohibited.
**6. No Advertisements or Spam** — Self-promotion, unsolicited advertising, and referral links are prohibited. Streamers may promote themselves in the designated promotion channel as long as it is related to the game. Offenders will be muted.
**7. Server Language Policy** — Speak in English as much as possible since we have international guild mate for community inclusivity and moderation.
**8. No Political or Religious Debates** — Political and religious discussions or arguments are prohibited on this server.
**9. Follow Game Terms of Service** — Respect game rules at all times. No exploits, account selling, botting, or unapproved third-party software.
**10. Listen to Staff** — Follow moderator instructions at all times and remain respectful to all staff and team members.
**11. If you know someone from Fregion, invite them using this link discord.gg/fregion-global.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━
**Next Step:** Click the button below to acknowledge the rules. You will receive the **[Compliant]** role, unlocking the **#identity-verification** channel where you can set your AION 2 In-Game Name with **Maiev**!`,
  footer: 'Acknowledge the rules below to proceed'
};

export const DEFAULT_VERIFY_TEMPLATE = {
  title: 'AION 2 IGN Setup',
  content: `Welcome to **{server}**!

To proceed, please register your **AION 2 In-Game Name (IGN)**:

**How it works:**
1. Click the **"Set AION 2 IGN"** button below.
2. Enter your exact in-game character name.
3. Maiev will update your server nickname to your IGN, grant you access to more channels so you can interact with Fregion community.`,
  footer: 'Maiev  • AION 2'
};

export const DEFAULT_USER_VERIFY_TEMPLATE = {
  title: 'Video Verification — Become Trusted',
  content: `Welcome to **{server}** Video Verification!

To receive your **Verified / Trusted** status, please submit a short screen recording matching the reference video attached to this post:

**How to Verify:**
1. Watch the reference video above/below to see what needs to be shown.
2. Click the **"Start Video Verification"** button below.
3. Maiev will open a **Private Thread** visible only to you, Server Administrators, and appointed Reviewers.
4. Upload your screen recording inside your private thread and wait for a Reviewer to approve it!`,
  footer: '{server} • Private Thread Verification',
  buttonLabel: 'Start Video Verification',
  threadTitle: 'Case #{case} — Private Verification ({user})',
  threadContent: `Hello {user}! This private thread is only visible to you, Server Administrators, and our Verification Reviewers ({reviewers}).

**Next Step:**
Please upload your **screen recording video** directly into this thread matching the reference guide in **#{channel}**.

*Once reviewed, a Reviewer will approve your submission (granting your Verified role and archiving this thread) or let you know if any changes are needed.*`
};

export const DEFAULT_WELCOME_TEMPLATE = {
  title: 'Welcome to {server}, {ign}!',
  content: `Your AION 2 IGN has been successfully registered as **{ign}**!

The exclusive community channels are now unlocked! You can now interact with the community.`,
  footer: '{server} • AION 2'
};

export const DEFAULT_WELCOME_ANNOUNCEMENT_TEMPLATE = 'Welcome to **{server}**, {user}! Glad to have you here, Daeva!';

export const DEFAULT_NATIONALITY_TEMPLATE = {
  title: '✨ Reaction Roles — Choose Your Roles',
  content: '',
  footer: 'React with an emoji below to toggle your role'
};

export const ROLE_PRESETS = {
  classes: {
    key: 'classes',
    name: 'Classes',
    category: 'Classes',
    defaultTitle: '⚔️ Choose Your Class Archetype',
    defaultFooter: 'React with an emoji below to choose your class',
    roles: [
      { emoji: ':Templar:', name: 'Templar', code: 'templar', intent: 'unique', category: 'Classes' },
      { emoji: ':Gladiator:', name: 'Gladiator', code: 'gladiator', intent: 'unique', category: 'Classes' },
      { emoji: ':Ranger:', name: 'Ranger', code: 'ranger', intent: 'unique', category: 'Classes' },
      { emoji: ':Assassin:', name: 'Assassin', code: 'assassin', intent: 'unique', category: 'Classes' },
      { emoji: ':Sorcerer:', name: 'Sorcerer', code: 'sorcerer', intent: 'unique', category: 'Classes' },
      { emoji: ':Spiritmaster:', name: 'Spiritmaster', code: 'spiritmaster', intent: 'unique', category: 'Classes' },
      { emoji: ':Cleric:', name: 'Cleric', code: 'cleric', intent: 'unique', category: 'Classes' },
      { emoji: ':Chanter:', name: 'Chanter', code: 'chanter', intent: 'unique', category: 'Classes' }
    ]
  },
  nationality: {
    key: 'nationality',
    name: 'Region',
    category: 'Region',
    defaultTitle: '🌍 Choose Your Region',
    defaultFooter: 'React with a flag emoji below to toggle your region',
    roles: [
      { emoji: '🇵🇭', name: 'Philippines', code: 'ph', intent: 'unique', category: 'Region' },
      { emoji: '🇰🇷', name: 'South Korea', code: 'kr', intent: 'unique', category: 'Region' },
      { emoji: '🇯🇵', name: 'Japan', code: 'jp', intent: 'unique', category: 'Region' },
      { emoji: '🇮🇩', name: 'Indonesia', code: 'id', intent: 'unique', category: 'Region' },
      { emoji: '🇹🇭', name: 'Thailand', code: 'th', intent: 'unique', category: 'Region' },
      { emoji: '🇹🇼', name: 'Taiwan', code: 'tw', intent: 'unique', category: 'Region' },
      { emoji: '🇨🇳', name: 'China', code: 'cn', intent: 'unique', category: 'Region' },
      { emoji: '🇦🇺', name: 'Australia', code: 'au', intent: 'unique', category: 'Region' },
      { emoji: '🇲🇾', name: 'Malaysia', code: 'my', intent: 'unique', category: 'Region' },
      { emoji: '🇻🇳', name: 'Vietnam', code: 'vn', intent: 'unique', category: 'Region' },
      { emoji: '🌏', name: 'International', code: 'intl', intent: 'unique', category: 'Region' }
    ]
  },
  notifications: {
    key: 'notifications',
    name: 'Notification Alerts',
    category: 'Notification Alerts',
    defaultTitle: '🔔 Notification Preferences',
    defaultFooter: 'React with an emoji below to toggle notification pings',
    roles: [
      { emoji: '🔔', name: 'Announcements', code: 'announcements', intent: 'toggle', category: 'Notification Alerts' },
      { emoji: ':Abyss:', name: 'Abyss Group Farming', code: 'abyss-farming', intent: 'toggle', category: 'Notification Alerts' },
      { emoji: ':Rift:', name: 'Spacetime Rift', code: 'spacetime-rift', intent: 'toggle', category: 'Notification Alerts' },
      { emoji: '🎮', name: 'Community Events', code: 'events', intent: 'toggle', category: 'Notification Alerts' }
    ]
  },
  platforms: {
    key: 'platforms',
    name: 'Gaming Platforms',
    category: 'Gaming Platforms',
    defaultTitle: '💻 Select Your Gaming Platform',
    defaultFooter: 'React with an icon below to select your device',
    roles: [
      { emoji: '💻', name: 'PC / Windows', code: 'pc', intent: 'toggle', category: 'Gaming Platforms' },
      { emoji: '🎮', name: 'Console', code: 'console', intent: 'toggle', category: 'Gaming Platforms' },
      { emoji: '📱', name: 'Mobile', code: 'mobile', intent: 'toggle', category: 'Gaming Platforms' }
    ]
  }
};

