import 'dotenv/config';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { JsonStore } from './json-store.js';
import { eventBus } from '../event-bus.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
export const ROOT_DIR = path.resolve(__dirname, '..', '..', '..');
export const CONFIG_FILE = path.join(ROOT_DIR, 'config.json');
export const RUNTIME_CONFIG_FILE = path.join(ROOT_DIR, 'config.runtime.json');

export const DEFAULT_CONFIG = {
  autoJoinRoleIds: [],
  onboardedRoleId: process.env.ONBOARDED_ROLE_ID || '',
  ignRolesToAdd: [],
  ignRolesToRemove: [],
  rulesChannelId: process.env.RULES_CHANNEL_ID || '',
  rulesMessageId: '',
  verifyChannelId: process.env.VERIFY_CHANNEL_ID || '',
  verifyMessageId: '',
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
  verifyTitle: process.env.VERIFY_TITLE || 'AION 2 IGN Setup',
  verifyContent: process.env.VERIFY_CONTENT || (
    'Welcome to **{server}**!\n\n' +
    'To proceed, please register your **AION 2 In-Game Name (IGN)**:\n\n' +
    '**How it works:**\n' +
    '1. Click the **"Set AION 2 IGN"** button below.\n' +
    '2. Enter your exact in-game character name.\n' +
    '3. Maiev will update your server nickname to your IGN, grant you access to more channels so you can interact with Fregion community.'
  ),
  verifyFooter: process.env.VERIFY_FOOTER || 'Maiev  • AION 2',
  welcomeTitle: process.env.WELCOME_TITLE || 'Welcome to {server}, {ign}!',
  welcomeContent: process.env.WELCOME_CONTENT || (
    'Your AION 2 IGN has been successfully registered as **{ign}**!\n\n' +
    'The exclusive community channels are now unlocked! You can now interact with the community.'
  ),
  welcomeFooter: process.env.WELCOME_FOOTER || '{server} • AION 2',
  welcomeAnnouncementChannelId: '',
  enableWelcomeAnnouncement: true,
  welcomeAnnouncementMessage: 'Welcome to **{server}**, {user}! Glad to have you here, Daeva!',
  serverName: process.env.SERVER_NAME || 'Asia Fregion',
  nationalityChannelId: process.env.NATIONALITY_CHANNEL_ID || '',
  nationalityTitle: '✨ Reaction Roles — Choose Your Roles',
  nationalityContent: '',
  nationalityFooter: 'React with an emoji below to toggle your role',
  nationalityMessageIds: [],
  nationalityRoles: [
    { code: 'ph', name: 'Philippines', emoji: '🇵🇭', roleId: '', category: 'Region' }
  ],
  userVerifyChannelId: '',
  userVerifyStaffChannelId: '',
  userVerifyMessageId: '',
  userVerifyReviewerRoleIds: [],
  userVerifyRolesToAdd: [],
  userVerifyRolesToRemove: [],
  userVerifyButtonLabel: 'Start Video Verification',
  userVerifyTitle: 'Video Verification — Become Trusted',
  userVerifyContent: (
    'Welcome to **{server}** Video Verification!\n\n' +
    'To receive your **Verified / Trusted** status, please submit a short screen recording matching the reference video attached to this post:\n\n' +
    '**How to Verify:**\n' +
    '1. Watch the reference video above/below to see what needs to be shown.\n' +
    '2. Click the **"Start Video Verification"** button below.\n' +
    '3. Maiev will open a **Private Thread** visible only to you, Server Administrators, and appointed Reviewers.\n' +
    '4. Upload your screen recording inside your private thread and wait for a Reviewer to approve it!'
  ),
  userVerifyFooter: '{server} • Private Thread Verification',
  userVerifyVideoUrl: '',
  userVerifyUploadedVideo: '',
  userVerifyThreadTitle: 'Case #{case} — Private Verification ({user})',
  userVerifyThreadContent: (
    'Hello {user}! This private thread is only visible to you, Server Administrators, and our Verification Reviewers ({reviewers}).\n\n' +
    '**Next Step:**\n' +
    'Please upload your **screen recording video** directly into this thread matching the reference guide in **#{channel}**.\n\n' +
    '*Once reviewed, a Reviewer will approve your submission (granting your Verified role and archiving this thread) or let you know if any changes are needed.*'
  )
};

function buildSeedConfig() {
  let baseFromGitConfig = {};
  try {
    if (fs.existsSync(CONFIG_FILE)) {
      const raw = fs.readFileSync(CONFIG_FILE, 'utf-8');
      if (raw.trim()) {
        baseFromGitConfig = JSON.parse(raw);
      }
    }
  } catch (err) {
    console.warn('⚠️ [ConfigStore] Could not parse baseline config.json:', err.message);
  }

  const seeded = {
    ...structuredClone(DEFAULT_CONFIG),
    ...baseFromGitConfig
  };

  // Self-heal on first runtime migration if a reference video already exists in public/uploads/
  if (!fs.existsSync(RUNTIME_CONFIG_FILE) && !seeded.userVerifyUploadedVideo) {
    try {
      const uploadsDir = path.join(ROOT_DIR, 'public', 'uploads');
      if (fs.existsSync(uploadsDir)) {
        const videoFiles = fs.readdirSync(uploadsDir)
          .filter(f => /\.(mp4|mov|webm|m4v)$/i.test(f))
          .map(f => ({
            name: f,
            mtimeMs: fs.statSync(path.join(uploadsDir, f)).mtimeMs
          }))
          .sort((a, b) => b.mtimeMs - a.mtimeMs);

        if (videoFiles.length > 0) {
          seeded.userVerifyUploadedVideo = `/uploads/${videoFiles[0].name}`;
        }
      }
    } catch (_) {}
  }

  return seeded;
}

const seedConfig = buildSeedConfig();
const store = new JsonStore(RUNTIME_CONFIG_FILE, seedConfig);

// Persist initial runtime snapshot if existing Video Verify settings or uploaded video were found on disk
const hasExistingUserVerifySettings = Boolean(
  seedConfig.userVerifyUploadedVideo ||
  seedConfig.userVerifyChannelId ||
  seedConfig.userVerifyStaffChannelId ||
  (Array.isArray(seedConfig.userVerifyReviewerRoleIds) && seedConfig.userVerifyReviewerRoleIds.length > 0) ||
  (Array.isArray(seedConfig.userVerifyRolesToAdd) && seedConfig.userVerifyRolesToAdd.length > 0) ||
  (Array.isArray(seedConfig.userVerifyRolesToRemove) && seedConfig.userVerifyRolesToRemove.length > 0)
);
if (!fs.existsSync(RUNTIME_CONFIG_FILE) && hasExistingUserVerifySettings) {
  store.persist();
}

export const configStore = {
  get() {
    return store.get();
  },

  save(partialConfig) {
    const updated = store.update(partialConfig);
    eventBus.emit('config:updated', updated);
    return updated;
  }
};

