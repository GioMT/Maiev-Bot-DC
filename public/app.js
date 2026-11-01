/**
 * Maiev Bot Control Center — Client Application
 * Modular tabbed dashboard for Rules Onboarding, AION 2 IGN Verification,
 * Public Welcome Announcements, and Reaction Roles Manager.
 */

const DEFAULT_RULES_TEMPLATE = {
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

const DEFAULT_VERIFY_TEMPLATE = {
  title: 'AION 2 IGN Setup',
  content: `Welcome to **{server}**!

To proceed, please register your **AION 2 In-Game Name (IGN)**:

**How it works:**
1. Click the **"Set AION 2 IGN"** button below.
2. Enter your exact in-game character name.
3. Maiev will update your server nickname to your IGN, grant you access to more channels so you can interact with Fregion community.`,
  footer: 'Maiev  • AION 2'
};

const DEFAULT_WELCOME_TEMPLATE = {
  title: 'Welcome to {server}, {ign}!',
  content: `Your AION 2 IGN has been successfully registered as **{ign}**!

The exclusive community channels are now unlocked! You can now interact with the community.`,
  footer: '{server} • AION 2'
};

const DEFAULT_WELCOME_ANNOUNCEMENT_TEMPLATE = "Welcome to **{server}**, {user}! Glad to have you here, Daeva!";

const DEFAULT_NATIONALITY_TEMPLATE = {
  title: '✨ Reaction Roles — Choose Your Roles',
  content: '',
  footer: 'React with an emoji below to toggle your role'
};

// Preset collections with category definitions and embed settings
const ROLE_PRESETS = {
  classes: {
    key: 'classes',
    name: 'Classes',
    category: 'Classes',
    defaultTitle: '⚔️ Choose Your Class Archetype',
    defaultFooter: 'React with an emoji below to choose your class',
    roles: [
      { emoji: '🛡️', name: 'Templar', code: 'templar', intent: 'unique', category: 'Classes' },
      { emoji: '⚔️', name: 'Gladiator', code: 'gladiator', intent: 'unique', category: 'Classes' },
      { emoji: '🏹', name: 'Ranger', code: 'ranger', intent: 'unique', category: 'Classes' },
      { emoji: '🗡️', name: 'Assassin', code: 'assassin', intent: 'unique', category: 'Classes' },
      { emoji: '🔮', name: 'Sorcerer', code: 'sorcerer', intent: 'unique', category: 'Classes' },
      { emoji: '🌀', name: 'Spiritmaster', code: 'spiritmaster', intent: 'unique', category: 'Classes' },
      { emoji: '⚕️', name: 'Cleric', code: 'cleric', intent: 'unique', category: 'Classes' },
      { emoji: '🎶', name: 'Chanter', code: 'chanter', intent: 'unique', category: 'Classes' }
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
      { emoji: '🌌', name: 'Abyss Group Farming', code: 'abyss-farming', intent: 'toggle', category: 'Notification Alerts' },
      { emoji: '🌀', name: 'Spacetime Rift', code: 'spacetime-rift', intent: 'toggle', category: 'Notification Alerts' },
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

let serverState = null;
let currentNationalityRoles = [];
let reactionPresets = {};
let activePresetId = 'classes';
let simulatedAssignedRoles = new Set();
let activeCategoryFilter = 'all';

// Helper: Refresh Lucide vector icons across entire page
function refreshIcons() {
  if (window.lucide && typeof window.lucide.createIcons === 'function') {
    window.lucide.createIcons();
  }
}

// Initialize on DOM load
document.addEventListener('DOMContentLoaded', () => {
  let initialCfg = {};
  try {
    const cached = localStorage.getItem('maiev_config_cache');
    if (cached) initialCfg = JSON.parse(cached);
  } catch (_) { }

  setupTabs();
  renderRulesEditor(initialCfg);
  renderVerifyEditor(initialCfg);
  renderWelcomeEditor(initialCfg);
  renderWelcomeAnnouncementEditor(initialCfg);
  fetchServerState();
  setupEventListeners();
  setupRealtimeSync();
  refreshIcons();
});

// Setup Main Tab Navigation
function setupTabs() {
  const tabButtons = document.querySelectorAll('.main-tab-btn');
  const tabPanes = document.querySelectorAll('.tab-pane');

  const savedTab = localStorage.getItem('maiev_active_tab') || 'tab-rules';

  function activateTab(tabId) {
    tabButtons.forEach(btn => {
      const isActive = btn.getAttribute('data-tab') === tabId;
      btn.classList.toggle('active', isActive);
      btn.setAttribute('aria-selected', isActive ? 'true' : 'false');
    });

    tabPanes.forEach(pane => {
      pane.classList.toggle('active', pane.id === tabId);
    });

    localStorage.setItem('maiev_active_tab', tabId);
    refreshIcons();
  }

  tabButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      const tabId = btn.getAttribute('data-tab');
      activateTab(tabId);
    });
  });

  // Activate saved or default tab
  activateTab(savedTab);
}

// Fetch complete bot & server status from API
async function fetchServerState() {
  try {
    const res = await fetch('/api/status');
    if (!res.ok) throw new Error('API request failed');
    const data = await res.json();
    serverState = data;

    if (data.config) {
      try {
        localStorage.setItem('maiev_config_cache', JSON.stringify(data.config));
      } catch (_) { }
    }

    renderHeaderTelemetry(data);
    renderRoleDropdowns(data);
    renderChannelDropdowns(data);
    renderRulesEditor(data.config || {});
    renderVerifyEditor(data.config || {});
    renderWelcomeEditor(data.config || {});
    renderWelcomeAnnouncementEditor(data.config || {});
    renderNationalityRolesManager(data);
    renderDiagnostics(data);
    fetchMembers();
    refreshIcons();
  } catch (err) {
    console.error('Failed to load status:', err);
    showToast('Could not connect to bot API. Please check server logs.', 'error');
  }
}

// Dynamic width adjuster for server name input
function adjustServerInputWidth(input) {
  if (!input) return;
  const tempSpan = document.createElement('span');
  tempSpan.style.visibility = 'hidden';
  tempSpan.style.position = 'absolute';
  tempSpan.style.whiteSpace = 'pre';
  tempSpan.style.font = '700 0.85rem "JetBrains Mono", monospace';
  tempSpan.textContent = input.value || input.placeholder || 'Asia Fregion';
  document.body.appendChild(tempSpan);
  const width = Math.max(105, Math.min(tempSpan.getBoundingClientRect().width + 24, 260));
  input.style.width = `${width}px`;
  document.body.removeChild(tempSpan);
}

// Render Header & Telemetry
function renderHeaderTelemetry(data) {
  if (data.avatar) {
    document.getElementById('bot-avatar').src = data.avatar;
    document.getElementById('sim-bot-avatar-1').src = data.avatar;
    document.getElementById('sim-bot-avatar-2').src = data.avatar;
    const simAvatar3 = document.getElementById('sim-bot-avatar-3');
    if (simAvatar3) simAvatar3.src = data.avatar;
    const simAvatar4 = document.getElementById('sim-bot-avatar-4');
    if (simAvatar4) simAvatar4.src = data.avatar;
  }
  document.getElementById('bot-connection-string').textContent = `${data.botName} • Connected to Discord Gateway`;
  document.getElementById('ping-value').textContent = `${Math.max(data.ping, 1)} ms`;

  const sName = data.config?.serverName || data.guild?.name || 'Asia Fregion';
  if (data.guild) data.guild.name = sName;
  const serverInput = document.getElementById('server-name-input');
  if (serverInput && document.activeElement !== serverInput) {
    serverInput.value = sName;
    adjustServerInputWidth(serverInput);
  }
  const legacyServerEl = document.getElementById('server-name');
  if (legacyServerEl) legacyServerEl.textContent = sName;

  document.getElementById('member-count').textContent = data.guild?.memberCount || '--';
}

// Render Role Selectors (Stage 1 and Stage 2)
function renderRoleDropdowns(data) {
  const roles = data.guild?.roles || [];
  const currentConfig = data.config || {};

  roles.sort((a, b) => b.position - a.position);

  // 1. Onboarded Role Select (Single)
  const onboardedSelect = document.getElementById('select-onboarded-role');
  onboardedSelect.innerHTML = '<option value="">-- Select Onboarded Role --</option>';

  roles.forEach(role => {
    if (role.name === '@everyone') return;
    const opt = document.createElement('option');
    opt.value = role.id;
    opt.textContent = `@${role.name}`;
    if (role.id === currentConfig.onboardedRoleId || (!currentConfig.onboardedRoleId && /compliant|onboard/i.test(role.name))) {
      opt.selected = true;
    }
    onboardedSelect.appendChild(opt);
  });

  // 2. Roles to ADD container (Checkboxes)
  const addContainer = document.getElementById('roles-to-add-container');
  addContainer.innerHTML = '';

  // 3. Roles to REMOVE container (Checkboxes)
  const removeContainer = document.getElementById('roles-to-remove-container');
  removeContainer.innerHTML = '';

  const defaultAdd = currentConfig.ignRolesToAdd || [];
  const defaultRemove = currentConfig.ignRolesToRemove || [];

  roles.forEach(role => {
    if (role.name === '@everyone') return;

    // Add checkbox
    const addLabel = document.createElement('label');
    addLabel.className = 'role-checkbox-item';
    const isAddChecked = defaultAdd.includes(role.id) ||
      (defaultAdd.length === 0 && (role.name.includes('Unverified') || role.name.includes('Elyos')));

    addLabel.innerHTML = `
      <input type="checkbox" name="role_add" value="${role.id}" ${isAddChecked ? 'checked' : ''}>
      <span class="role-name">@${role.name}</span>
    `;
    addContainer.appendChild(addLabel);

    // Remove checkbox
    const removeLabel = document.createElement('label');
    removeLabel.className = 'role-checkbox-item';
    const isRemoveChecked = defaultRemove.includes(role.id) ||
      (defaultRemove.length === 0 && (role.name.includes('Compliant') || role.name.includes('Onboard')));

    removeLabel.innerHTML = `
      <input type="checkbox" name="role_remove" value="${role.id}" ${isRemoveChecked ? 'checked' : ''}>
      <span class="role-name">@${role.name}</span>
    `;
    removeContainer.appendChild(removeLabel);
  });

  // 4. Role selector inside single reaction role box
  const newNatRole = document.getElementById('new-nat-role');
  if (newNatRole) {
    newNatRole.innerHTML = '<option value="">-- Choose Server Role --</option>';
    roles.forEach(r => {
      if (r.name === '@everyone') return;
      const opt = document.createElement('option');
      opt.value = r.id;
      opt.textContent = `@${r.name}`;
      newNatRole.appendChild(opt);
    });
  }
}

// Render Channel Selectors
function renderChannelDropdowns(data) {
  const channels = data.guild?.channels || [];
  const currentConfig = data.config || {};

  const rulesSelect = document.getElementById('select-rules-channel');
  const verifySelect = document.getElementById('select-verify-channel');
  const welcomeSelect = document.getElementById('select-welcome-channel');
  const natSelect = document.getElementById('select-nationality-roles-channel');

  const defaultRules = currentConfig.rulesChannelId;
  const defaultVerify = currentConfig.verifyChannelId;
  const defaultWelcome = currentConfig.welcomeAnnouncementChannelId;
  const defaultNat = currentConfig.nationalityChannelId;

  function populate(selectEl, selectedId, fallbackName) {
    if (!selectEl) return;
    selectEl.innerHTML = '<option value="">-- Choose Channel --</option>';
    channels.forEach(ch => {
      const opt = document.createElement('option');
      opt.value = ch.id;
      opt.textContent = `#${ch.name}`;
      if (ch.id === selectedId || (!selectedId && ch.name.toLowerCase().includes(fallbackName))) {
        opt.selected = true;
      }
      selectEl.appendChild(opt);
    });
  }

  populate(rulesSelect, defaultRules, 'rule');
  populate(verifySelect, defaultVerify, 'verify');
  populate(welcomeSelect, defaultWelcome, 'welcome');
  populate(natSelect, defaultNat, 'nation');

  // Update channel names in simulator headers
  updateSimChannelHeaders();

  rulesSelect?.addEventListener('change', updateSimChannelHeaders);
  verifySelect?.addEventListener('change', updateSimChannelHeaders);
  welcomeSelect?.addEventListener('change', updateSimChannelHeaders);
  natSelect?.addEventListener('change', updateSimChannelHeaders);
}

function updateSimChannelHeaders() {
  const rName = document.getElementById('select-rules-channel')?.selectedOptions[0]?.text?.replace('#', '') || 'rules';
  const vName = document.getElementById('select-verify-channel')?.selectedOptions[0]?.text?.replace('#', '') || 'identity-verification';
  const wName = document.getElementById('select-welcome-channel')?.selectedOptions[0]?.text?.replace('#', '') || 'welcome';
  const nName = document.getElementById('select-nationality-roles-channel')?.selectedOptions[0]?.text?.replace('#', '') || 'roles';

  const elR = document.getElementById('sim-rules-channel-name');
  if (elR) elR.textContent = rName;
  const elV = document.getElementById('sim-verify-channel-name');
  if (elV) elV.textContent = vName;
  const elW = document.getElementById('sim-welcome-channel-name');
  if (elW) elW.textContent = wName;
  const elN = document.getElementById('sim-nationality-channel-name');
  if (elN) elN.textContent = nName;
}

// Render Stage 1 Rules Editor
function renderRulesEditor(cfg) {
  const title = cfg.rulesTitle || DEFAULT_RULES_TEMPLATE.title;
  const content = cfg.rulesContent || DEFAULT_RULES_TEMPLATE.content;
  const footer = cfg.rulesFooter || DEFAULT_RULES_TEMPLATE.footer;

  document.getElementById('rules-title-input').value = title;
  document.getElementById('rules-content-input').value = content;
  document.getElementById('rules-footer-input').value = footer;

  updateRulesPreview();
}

// Live update Rules Discord preview
function updateRulesPreview() {
  const title = document.getElementById('rules-title-input').value || DEFAULT_RULES_TEMPLATE.title;
  const content = document.getElementById('rules-content-input').value || DEFAULT_RULES_TEMPLATE.content;
  const footer = document.getElementById('rules-footer-input').value || DEFAULT_RULES_TEMPLATE.footer;

  document.getElementById('sim-rules-title').textContent = title;
  document.getElementById('sim-rules-desc').innerHTML = formatDiscordMarkdown(content);
  document.getElementById('sim-rules-footer').textContent = footer;
}

// Render Stage 2 Verification Editor
function renderVerifyEditor(cfg) {
  const title = cfg.verifyTitle || DEFAULT_VERIFY_TEMPLATE.title;
  const content = cfg.verifyContent || DEFAULT_VERIFY_TEMPLATE.content;
  const footer = cfg.verifyFooter || DEFAULT_VERIFY_TEMPLATE.footer;

  document.getElementById('verify-title-input').value = title;
  document.getElementById('verify-content-input').value = content;
  document.getElementById('verify-footer-input').value = footer;

  updateVerifyPreview();
}

// Live update Verification Discord preview
function updateVerifyPreview() {
  const serverName = serverState?.config?.serverName || serverState?.guild?.name || 'Asia Fregion';
  const title = (document.getElementById('verify-title-input').value || DEFAULT_VERIFY_TEMPLATE.title).replace(/{server}/g, serverName);
  const content = (document.getElementById('verify-content-input').value || DEFAULT_VERIFY_TEMPLATE.content).replace(/{server}/g, serverName);
  const footer = (document.getElementById('verify-footer-input').value || DEFAULT_VERIFY_TEMPLATE.footer).replace(/{server}/g, serverName);

  document.getElementById('sim-verify-title').textContent = title;
  document.getElementById('sim-verify-desc').innerHTML = formatDiscordMarkdown(content);
  document.getElementById('sim-verify-footer').textContent = footer;
}

// Render Post-Verification Welcome Popup Editor
function renderWelcomeEditor(cfg) {
  const title = cfg.welcomeTitle || DEFAULT_WELCOME_TEMPLATE.title;
  const content = cfg.welcomeContent || DEFAULT_WELCOME_TEMPLATE.content;
  const footer = cfg.welcomeFooter || DEFAULT_WELCOME_TEMPLATE.footer;

  document.getElementById('welcome-title-input').value = title;
  document.getElementById('welcome-content-input').value = content;
  document.getElementById('welcome-footer-input').value = footer;
}

// Render Stage 3 Welcome Announcement Editor
function renderWelcomeAnnouncementEditor(cfg) {
  const enable = cfg.enableWelcomeAnnouncement !== false;
  const message = cfg.welcomeAnnouncementMessage !== undefined ? cfg.welcomeAnnouncementMessage : DEFAULT_WELCOME_ANNOUNCEMENT_TEMPLATE;

  const checkEl = document.getElementById('check-enable-welcome-announcement');
  if (checkEl) checkEl.checked = enable;

  const msgInput = document.getElementById('welcome-announcement-input');
  if (msgInput) msgInput.value = message;

  updateWelcomeAnnouncementPreview();
}

// Live update Welcome Announcement preview
function updateWelcomeAnnouncementPreview() {
  const serverName = serverState?.config?.serverName || serverState?.guild?.name || 'Asia Fregion';
  const template = document.getElementById('welcome-announcement-input')?.value || DEFAULT_WELCOME_ANNOUNCEMENT_TEMPLATE;

  const formatted = formatDiscordMarkdown(
    template
      .replace(/{server}/g, serverName)
      .replace(/{user}/g, '@DaevaPlayer')
      .replace(/{ign}/g, 'DaevaLegend')
      .replace(/{flag}/g, '🇵🇭')
      .replace(/{nationality}/g, 'Philippines')
      .replace(/{roles}/g, '@Unverified, @Elyos Fregion')
  );

  const descEl = document.getElementById('sim-welcome-announcement-desc');
  if (descEl) descEl.innerHTML = formatted;

  const authorEl = document.getElementById('sim-welcome-announcement-author');
  if (authorEl) authorEl.textContent = `${serverName} • New Daeva Arrival`;

  const footEl = document.getElementById('sim-welcome-announcement-footer');
  if (footEl) footEl.textContent = `${serverName} • Welcome Channel`;
}

// Render Reaction Roles Manager (Stage 4)
function renderNationalityRolesManager(data) {
  const cfg = data.config || {};

  if (cfg.reactionPresets && Object.keys(cfg.reactionPresets).length > 0) {
    reactionPresets = JSON.parse(JSON.stringify(cfg.reactionPresets));
    if (reactionPresets.classes && (reactionPresets.classes.name === 'AION 2 Class Archetypes' || !reactionPresets.classes.name)) {
      reactionPresets.classes.name = 'Classes';
      reactionPresets.classes.category = 'Classes';
    }
    if (reactionPresets.nationality && (reactionPresets.nationality.name === 'Nationality & Regional Flags' || reactionPresets.nationality.name === 'Nationality & Region Flags' || !reactionPresets.nationality.name)) {
      reactionPresets.nationality.name = 'Region';
      reactionPresets.nationality.category = 'Region';
    }
  } else {
    // Migration: build presets from cfg.nationalityRoles
    reactionPresets = {};
    const roles = Array.isArray(cfg.nationalityRoles) ? [...cfg.nationalityRoles] : [];

    const classRoles = roles.filter(r => r.category === 'Classes' || r.category === 'AION 2 Class Archetypes' || ['templar', 'gladiator', 'ranger', 'assassin', 'sorcerer', 'spiritmaster', 'cleric', 'chanter'].includes(r.code));
    const natRoles = roles.filter(r => r.category === 'Region' || r.category === 'Nationality & Regional Flags' || r.category === 'Nationality & Region Flags' || ['ph', 'kr', 'jp', 'id', 'th', 'tw', 'cn', 'au', 'my', 'vn', 'intl'].includes(r.code));
    const notifRoles = roles.filter(r => r.category === 'Notification Alerts');
    const platRoles = roles.filter(r => r.category === 'Gaming Platforms');
    const otherRoles = roles.filter(r => !classRoles.includes(r) && !natRoles.includes(r) && !notifRoles.includes(r) && !platRoles.includes(r));

    if (classRoles.length > 0) {
      reactionPresets.classes = {
        id: 'classes',
        name: 'Classes',
        icon: '⚔️',
        category: 'Classes',
        title: '⚔️ Choose Your Class Archetype',
        content: '',
        footer: 'React with an emoji below to choose your class',
        channelId: cfg.nationalityChannelId || '',
        messageId: '',
        intent: 'unique',
        roles: classRoles
      };
    }
    if (natRoles.length > 0) {
      reactionPresets.nationality = {
        id: 'nationality',
        name: 'Region',
        icon: '🌍',
        category: 'Region',
        title: '🌍 Choose Your Region',
        content: '',
        footer: 'React with a flag emoji below to toggle your region',
        channelId: cfg.nationalityChannelId || '',
        messageId: '',
        intent: 'unique',
        roles: natRoles
      };
    }
    if (notifRoles.length > 0) {
      reactionPresets.notifications = {
        id: 'notifications',
        name: 'Notification Alerts',
        icon: '🔔',
        category: 'Notification Alerts',
        title: '🔔 Notification Preferences',
        content: '',
        footer: 'React with an emoji below to toggle notification pings',
        channelId: cfg.nationalityChannelId || '',
        messageId: '',
        intent: 'toggle',
        roles: notifRoles
      };
    }
    if (platRoles.length > 0) {
      reactionPresets.platforms = {
        id: 'platforms',
        name: 'Gaming Platforms',
        icon: '💻',
        category: 'Gaming Platforms',
        title: '💻 Select Your Gaming Platform',
        content: '',
        footer: 'React with an icon below to select your device',
        channelId: cfg.nationalityChannelId || '',
        messageId: '',
        intent: 'toggle',
        roles: platRoles
      };
    }
    if (otherRoles.length > 0 && Object.keys(reactionPresets).length === 0) {
      reactionPresets.custom = {
        id: 'custom',
        name: 'Custom Roles',
        icon: '🏷️',
        category: 'Custom Roles',
        title: cfg.nationalityTitle || 'Reaction Roles — Choose Your Roles',
        content: cfg.nationalityContent || '',
        footer: cfg.nationalityFooter || 'React with an emoji below to toggle your role',
        channelId: cfg.nationalityChannelId || '',
        messageId: '',
        intent: 'toggle',
        roles: otherRoles
      };
    }

    // Default fallback if nothing was created
    if (Object.keys(reactionPresets).length === 0) {
      applyPreset('classes');
    }
  }

  // Populate messageId from config.nationalityMessageIds if available
  if (Array.isArray(cfg.nationalityMessageIds)) {
    cfg.nationalityMessageIds.forEach(item => {
      const pId = typeof item === 'object' ? item.presetId : null;
      const mId = typeof item === 'object' ? item.messageId : item;
      const cId = typeof item === 'object' ? item.channelId : null;
      if (pId && reactionPresets[pId]) {
        reactionPresets[pId].messageId = mId;
        if (cId) reactionPresets[pId].channelId = cId;
      }
    });
  }

  const keys = Object.keys(reactionPresets);
  if (!keys.includes(activePresetId)) {
    activePresetId = keys[0] || 'classes';
  }

  renderReactionSubtabs();
  switchActivePreset(activePresetId);
  refreshIcons();
}

// Render the Subtabs Navigation bar for active presets
function renderReactionSubtabs() {
  const container = document.getElementById('reaction-subtabs-list');
  if (!container) return;
  container.innerHTML = '';

  const keys = Object.keys(reactionPresets);
  if (keys.length === 0) {
    applyPreset('classes');
    return;
  }

  if (!reactionPresets[activePresetId]) {
    activePresetId = keys[0];
  }

  keys.forEach(key => {
    const preset = reactionPresets[key];
    const roleCount = (preset.roles || []).length;
    const isActive = key === activePresetId;

    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = `reaction-subtab-btn ${isActive ? 'active' : ''}`;
    btn.dataset.presetId = key;
    btn.innerHTML = `
      <span>${preset.icon || '🏷️'}</span>
      <span>${preset.name || key}</span>
      <span class="reaction-subtab-badge">${roleCount}</span>
      ${keys.length > 1 ? `<span class="reaction-subtab-close" data-close-preset="${key}" title="Remove preset tab">&times;</span>` : ''}
    `;

    btn.addEventListener('click', (e) => {
      const closeBtn = e.target.closest('[data-close-preset]');
      if (closeBtn) {
        e.stopPropagation();
        const toClose = closeBtn.dataset.closePreset;
        if (confirm(`Remove preset card "${reactionPresets[toClose]?.name || toClose}"?`)) {
          delete reactionPresets[toClose];
          const remainingKeys = Object.keys(reactionPresets);
          if (activePresetId === toClose) {
            activePresetId = remainingKeys[0] || 'classes';
          }
          if (remainingKeys.length === 0) {
            applyPreset('classes');
          } else {
            switchActivePreset(activePresetId);
          }
          renderReactionSubtabs();
          autoSaveNationalityRoles();
        }
        return;
      }
      switchActivePreset(key);
    });

    container.appendChild(btn);
  });

  refreshIcons();
}

// Switch Active Preset Subtab
function switchActivePreset(presetId) {
  if (!reactionPresets[presetId]) {
    const keys = Object.keys(reactionPresets);
    if (keys.length > 0) presetId = keys[0];
    else return;
  }

  // Save current input values into previous preset if needed
  if (reactionPresets[activePresetId] && activePresetId !== presetId) {
    const tEl = document.getElementById('nationality-title-input');
    const cEl = document.getElementById('nationality-content-input');
    const fEl = document.getElementById('nationality-footer-input');
    const chEl = document.getElementById('select-nationality-roles-channel');
    if (tEl) reactionPresets[activePresetId].title = tEl.value;
    if (cEl) reactionPresets[activePresetId].content = cEl.value;
    if (fEl) reactionPresets[activePresetId].footer = fEl.value;
    if (chEl && chEl.value) reactionPresets[activePresetId].channelId = chEl.value;
  }

  activePresetId = presetId;
  const preset = reactionPresets[presetId];
  currentNationalityRoles = preset.roles || [];

  // Update form inputs for this preset
  const titleInput = document.getElementById('nationality-title-input');
  const contentInput = document.getElementById('nationality-content-input');
  const footerInput = document.getElementById('nationality-footer-input');
  const channelSelect = document.getElementById('select-nationality-roles-channel');
  const intentSelect = document.getElementById('reaction-default-intent-select');

  if (titleInput) titleInput.value = preset.title || (ROLE_PRESETS[presetId]?.defaultTitle || 'Reaction Roles — Choose Your Roles');
  if (contentInput) contentInput.value = preset.content || '';
  if (footerInput) footerInput.value = preset.footer || (ROLE_PRESETS[presetId]?.defaultFooter || 'React with an emoji below to toggle your role');
  if (channelSelect && preset.channelId) channelSelect.value = preset.channelId;
  if (intentSelect && preset.intent) intentSelect.value = preset.intent;

  // Update dynamic labels
  const nameLabel = document.getElementById('active-subtab-name-label');
  if (nameLabel) nameLabel.textContent = preset.name || presetId;

  const simBadge = document.getElementById('sim-active-preset-badge');
  if (simBadge) simBadge.textContent = preset.name || presetId;

  const postBtnText = document.getElementById('btn-post-label-text');
  if (postBtnText) {
    const shortName = (preset.name || 'Reaction').split(' ')[0];
    postBtnText.textContent = `Post ${shortName} Card`;
  }

  // Update deployment badge
  const deployBadge = document.getElementById('active-subtab-deploy-badge');
  if (deployBadge) {
    if (preset.messageId) {
      deployBadge.className = 'badge badge-success';
      deployBadge.innerHTML = `<i data-lucide="check-circle-2"></i> Deployed (${preset.messageId.slice(-6)})`;
    } else {
      deployBadge.className = 'badge badge-warning';
      deployBadge.innerHTML = `<i data-lucide="alert-circle"></i> Not Deployed`;
    }
  }

  // Update simulator channel name
  const simChName = document.getElementById('sim-nationality-channel-name');
  if (simChName) {
    const chName = channelSelect?.selectedOptions?.[0]?.text;
    if (chName && chName.startsWith('#')) {
      simChName.textContent = chName.replace('#', '');
    } else if (presetId === 'classes') {
      simChName.textContent = 'classes';
    } else if (presetId === 'nationality') {
      simChName.textContent = 'regions';
    } else {
      simChName.textContent = 'roles';
    }
  }

  // Highlight active subtab button
  document.querySelectorAll('.reaction-subtab-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.presetId === presetId);
  });

  activeCategoryFilter = 'all';
  renderNationalityRolesList();
  updateNationalityPreview();
  refreshIcons();
}

// Live update Reaction Roles Discord Preview & Interactive Reaction Simulator
function updateNationalityPreview() {
  const serverName = serverState?.config?.serverName || serverState?.guild?.name || 'Asia Fregion';
  const currentPreset = reactionPresets[activePresetId] || {};
  const simTitle = document.getElementById('sim-nationality-title');
  const simDesc = document.getElementById('sim-nationality-desc');
  const simFooter = document.getElementById('sim-nationality-footer');
  const simReactions = document.getElementById('sim-nationality-reactions-container');

  const rawTitle = document.getElementById('nationality-title-input')?.value || currentPreset.title || DEFAULT_NATIONALITY_TEMPLATE.title;
  const rawContent = document.getElementById('nationality-content-input')?.value !== undefined
    ? document.getElementById('nationality-content-input').value
    : (currentPreset.content || '');
  const rawFooter = document.getElementById('nationality-footer-input')?.value || currentPreset.footer || DEFAULT_NATIONALITY_TEMPLATE.footer;

  if (simTitle) simTitle.textContent = rawTitle.replace(/{server}/g, serverName);
  if (simFooter) simFooter.textContent = rawFooter.replace(/{server}/g, serverName);

  let descHtml = '';
  if (rawContent && rawContent.trim()) {
    descHtml = formatDiscordMarkdown(rawContent.replace(/{server}/g, serverName));
  } else {
    const list = (currentNationalityRoles || []).filter(n => n && n.name);

    // Group roles by category if multiple categories exist
    const categories = {};
    list.forEach(role => {
      const cat = role.category || role.group || '';
      if (!categories[cat]) categories[cat] = [];
      categories[cat].push(role);
    });

    const categoryKeys = Object.keys(categories);
    const hasMultiple = categoryKeys.length > 1 || (categoryKeys.length === 1 && categoryKeys[0] !== '');

    let listStr = '';
    if (list.length === 0) {
      listStr = '<em>(No reaction roles configured yet in this preset)</em>';
    } else if (hasMultiple && categoryKeys.length > 1) {
      listStr = categoryKeys.map(cat => {
        const catHeader = `<div style="font-size: 0.82rem; font-weight: 700; color: #00d2ff; margin-top: 8px; margin-bottom: 4px; text-transform: uppercase; letter-spacing: 0.5px;">${cat || 'Roles'}</div>`;
        const items = categories[cat].map(n => {
          const codeStr = n.code ? ` (<code>${n.code.toUpperCase()}</code>)` : '';
          const intentTag = n.intent && n.intent !== 'toggle' ? ` <small class="text-muted">[${n.intent}]</small>` : '';
          return `${n.emoji} <strong>${n.name}</strong>${codeStr}${intentTag}`;
        }).join('<br>');
        return `${catHeader}${items}`;
      }).join('<br>');
    } else {
      listStr = list.map(n => {
        const codeStr = n.code ? ` (<code>${n.code.toUpperCase()}</code>)` : '';
        const intentTag = n.intent && n.intent !== 'toggle' ? ` <small class="text-muted">[${n.intent}]</small>` : '';
        return `${n.emoji} <strong>${n.name}</strong>${codeStr}${intentTag}`;
      }).join('<br>');
    }

    descHtml = `Welcome to <strong>${serverName}</strong>!<br><br>` +
      `Please react below to claim your roles:<br><br>` +
      `${listStr}<br><br>` +
      `━━━━━━━━━━━━━━━━━━━━━━━━━━━━<br>` +
      `👉 <strong>React with an emoji below</strong> to receive your role!`;
  }
  if (simDesc) simDesc.innerHTML = descHtml;

  // Render interactive emoji reaction pills in simulator
  if (simReactions) {
    simReactions.innerHTML = '';
    const activeRoles = (currentNationalityRoles || []).filter(n => n && n.emoji);
    activeRoles.forEach(item => {
      const pill = document.createElement('span');
      pill.className = 'sim-emoji-reaction';
      pill.style.cssText = 'background: rgba(255,255,255,0.07); border: 1px solid rgba(255,255,255,0.15); border-radius: 6px; padding: 4px 10px; font-size: 0.85rem; cursor: pointer; user-select: none; transition: all 0.15s ease;';

      const isSimActive = simulatedAssignedRoles.has(item.code || item.name);
      if (isSimActive) {
        pill.style.background = 'rgba(0, 210, 255, 0.2)';
        pill.style.borderColor = '#00d2ff';
      }

      pill.textContent = `${item.emoji} ${isSimActive ? '2' : '1'}`;
      pill.title = `Simulate reacting with ${item.emoji} (${item.intent || 'toggle'})`;

      pill.addEventListener('click', () => {
        handleSimulatedReactionClick(item);
      });
      simReactions.appendChild(pill);
    });
  }
}

// Simulate reaction behavior in UI preview based on intent (scoped by category)
function handleSimulatedReactionClick(item) {
  const feedback = document.getElementById('sim-nationality-feedback');
  if (!feedback) return;
  feedback.classList.remove('hidden');

  const intent = (item.intent || document.getElementById('reaction-default-intent-select')?.value || 'toggle').toLowerCase();
  const id = item.code || item.name;

  if (intent === 'unique') {
    const itemCat = item.category || null;
    // Clear only roles within the SAME category so other categories are untouched
    (currentNationalityRoles || []).forEach(other => {
      const otherCat = other.category || null;
      if (!itemCat || otherCat === itemCat) {
        simulatedAssignedRoles.delete(other.code || other.name);
      }
    });
    simulatedAssignedRoles.add(id);
    feedback.innerHTML = `<span style="color: #00d2ff;"><i data-lucide="check-circle-2"></i></span> <strong>[Simulated Unique Role]</strong> Selected <strong>${item.name}</strong> (${item.emoji})! Other ${itemCat ? `<strong>${itemCat}</strong>` : ''} roles were cleared.`;
  } else if (intent === 'give_only') {
    simulatedAssignedRoles.add(id);
    feedback.innerHTML = `<span style="color: #57F287;"><i data-lucide="check-circle-2"></i></span> <strong>[Simulated Give-Only Role]</strong> Unlocked role for <strong>${item.name}</strong> (${item.emoji}) permanently!`;
  } else if (intent === 'remove_only') {
    simulatedAssignedRoles.delete(id);
    feedback.innerHTML = `<span style="color: #ED4245;"><i data-lucide="trash-2"></i></span> <strong>[Simulated Remove-Only Role]</strong> Removed role for <strong>${item.name}</strong> (${item.emoji}).`;
  } else {
    // Toggle
    if (simulatedAssignedRoles.has(id)) {
      simulatedAssignedRoles.delete(id);
      feedback.innerHTML = `<span style="color: #949ba4;"><i data-lucide="minus-circle"></i></span> <strong>[Simulated Toggle]</strong> Unreacted ${item.emoji} — removed role for <strong>${item.name}</strong>.`;
    } else {
      simulatedAssignedRoles.add(id);
      feedback.innerHTML = `<span style="color: #57F287;"><i data-lucide="check-circle-2"></i></span> <strong>[Simulated Toggle]</strong> Reacted ${item.emoji} — granted role for <strong>${item.name}</strong>!`;
    }
  }

  updateNationalityPreview();
  refreshIcons();
}

// Render dynamic category filter bar
function renderCategoryFilterBar() {
  const bar = document.getElementById('category-filter-bar');
  if (!bar) return;

  const categories = Array.from(new Set(
    (currentNationalityRoles || []).map(r => r.category).filter(Boolean)
  ));

  if (categories.length <= 1) {
    bar.innerHTML = '';
    bar.style.display = 'none';
    return;
  }

  bar.style.display = 'flex';
  bar.innerHTML = '';

  // All Chip
  const allChip = document.createElement('span');
  allChip.className = `category-filter-chip ${activeCategoryFilter === 'all' ? 'active' : ''}`;
  allChip.textContent = `All (${currentNationalityRoles.length})`;
  allChip.addEventListener('click', () => {
    activeCategoryFilter = 'all';
    renderCategoryFilterBar();
    renderNationalityRolesList();
  });
  bar.appendChild(allChip);

  categories.forEach(cat => {
    const count = (currentNationalityRoles || []).filter(r => r.category === cat).length;
    const chip = document.createElement('span');
    chip.className = `category-filter-chip ${activeCategoryFilter === cat ? 'active' : ''}`;
    chip.textContent = `${cat} (${count})`;
    chip.addEventListener('click', () => {
      activeCategoryFilter = cat;
      renderCategoryFilterBar();
      renderNationalityRolesList();
    });
    bar.appendChild(chip);
  });
}

// Render the grid list of configured reaction roles with customizable intent & category badges
function renderNationalityRolesList() {
  const container = document.getElementById('nationality-roles-container');
  const countBadge = document.getElementById('reaction-roles-count-badge');
  if (countBadge) countBadge.textContent = `${currentNationalityRoles.length} Roles`;
  if (!container) return;
  container.innerHTML = '';

  renderCategoryFilterBar();

  const roles = serverState?.guild?.roles || [];

  if (currentNationalityRoles.length === 0) {
    container.innerHTML = '<p class="text-muted" style="grid-column: 1/-1; padding: 14px;">No reaction roles configured yet. Click <strong>Populate Presets</strong> above to start with ready-made templates, or create custom roles below!</p>';
    return;
  }

  const displayRoles = activeCategoryFilter === 'all'
    ? currentNationalityRoles
    : currentNationalityRoles.filter(r => r.category === activeCategoryFilter);

  displayRoles.forEach(item => {
    const card = document.createElement('div');
    card.className = 'nat-card-item';

    let roleOptionsHtml = '<option value="">-- Link Server Role --</option>';
    roles.forEach(r => {
      if (r.name === '@everyone') return;
      const isSelected = r.id === item.roleId;
      roleOptionsHtml += `<option value="${r.id}" ${isSelected ? 'selected' : ''}>@${r.name}</option>`;
    });

    const currentIntent = item.intent || 'toggle';

    card.innerHTML = `
      <div class="nat-card-header">
        <div class="nat-identity">
          <span class="nat-flag">${item.emoji || '🌐'}</span>
          <div>
            <span class="nat-name">${item.name}</span>
            <span class="nat-code">${(item.code || '').toUpperCase()}</span>
            ${item.category ? `<br><span class="nat-category-pill">${item.category}</span>` : ''}
          </div>
        </div>
        <button type="button" class="btn btn-sm btn-secondary btn-del-nat" title="Remove role" style="padding: 3px 8px; color: #ED4245;">
          <i data-lucide="trash-2" style="width: 14px; height: 14px;"></i>
        </button>
      </div>
      <div style="display: flex; gap: 6px; flex-direction: column; margin-top: 6px;">
        <select class="form-select nat-role-select" title="Server Role">
          ${roleOptionsHtml}
        </select>
        <select class="form-select nat-intent-select" style="font-size: 0.78rem; padding: 4px 8px;" title="Role Intent">
          <option value="toggle" ${currentIntent === 'toggle' ? 'selected' : ''}>Intent: Toggle</option>
          <option value="unique" ${currentIntent === 'unique' ? 'selected' : ''}>Intent: Unique (1 Choice)</option>
          <option value="give_only" ${currentIntent === 'give_only' ? 'selected' : ''}>Intent: Give Only</option>
          <option value="remove_only" ${currentIntent === 'remove_only' ? 'selected' : ''}>Intent: Remove Only</option>
        </select>
      </div>
    `;

    // Role select change listener
    const selectRoleEl = card.querySelector('.nat-role-select');
    selectRoleEl.addEventListener('change', (e) => {
      item.roleId = e.target.value;
      autoSaveNationalityRoles();
    });

    // Intent select change listener
    const selectIntentEl = card.querySelector('.nat-intent-select');
    selectIntentEl.addEventListener('change', (e) => {
      item.intent = e.target.value;
      autoSaveNationalityRoles();
      updateNationalityPreview();
      showToast(`Updated intent for ${item.name} to "${e.target.value}"`, 'success');
    });

    // Delete button listener
    const delBtn = card.querySelector('.btn-del-nat');
    delBtn.addEventListener('click', () => {
      const idx = currentNationalityRoles.indexOf(item);
      if (idx !== -1) {
        currentNationalityRoles.splice(idx, 1);
      }
      if (reactionPresets[activePresetId]) {
        reactionPresets[activePresetId].roles = currentNationalityRoles;
      }
      renderReactionSubtabs();
      renderNationalityRolesList();
      updateNationalityPreview();
      autoSaveNationalityRoles();
      refreshIcons();
      showToast(`Removed role ${item.emoji} ${item.name}`, 'success');
    });

    container.appendChild(card);
  });

  refreshIcons();
}


// Format Discord Markdown to HTML
function formatDiscordMarkdown(text) {
  if (!text) return '';
  let formatted = text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
  // Bold **text**
  formatted = formatted.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
  // Italic *text*
  formatted = formatted.replace(/\*(.*?)\*/g, '<em>$1</em>');
  // Inline code `code`
  formatted = formatted.replace(/`(.*?)`/g, '<code style="background: rgba(0,0,0,0.3); padding: 1px 4px; border-radius: 3px;">$1</code>');
  // Newlines
  formatted = formatted.replace(/\n/g, '<br>');
  return formatted;
}

// Render Diagnostics with professional Lucide icons (no emojis)
function renderDiagnostics(data) {
  const perms = data.permissions || {};

  function setDiag(elementId, isHealthy, healthyText, warningText) {
    const el = document.getElementById(elementId);
    if (!el) return;
    const statusSpan = el.querySelector('.diag-status');
    const subtext = el.querySelector('.diag-subtext');

    if (isHealthy) {
      statusSpan.style.color = 'var(--accent-green)';
      statusSpan.innerHTML = '<i data-lucide="check-circle-2"></i>';
      subtext.textContent = healthyText;
    } else {
      statusSpan.style.color = 'var(--accent-red)';
      statusSpan.innerHTML = '<i data-lucide="alert-triangle"></i>';
      subtext.textContent = warningText;
    }
  }

  // Manage Roles
  setDiag(
    'diag-manage-roles',
    !!perms.hasManageRoles,
    'Healthy: Bot has permission to manage and assign member roles.',
    'Action Required: Enable "Manage Roles" on Maiev in Discord Server Settings > Roles.'
  );

  // Manage Messages
  setDiag(
    'diag-manage-messages',
    !!perms.hasManageMessages,
    'Healthy: Bot can clean inactive reactions when members leave.',
    'Action Required: Enable "Manage Messages" on Maiev to remove former members’ reactions.'
  );

  // Manage Nicknames
  setDiag(
    'diag-manage-nicknames',
    !!perms.hasManageNicknames,
    'Healthy: Bot has permission to sync server nicknames with in-game IGN.',
    'Action Required: Enable "Manage Nicknames" on Maiev in Discord Server Settings.'
  );

  // Hierarchy Position
  const hierEl = document.getElementById('diag-hierarchy');
  if (hierEl) {
    const statusSpan = hierEl.querySelector('.diag-status');
    const subtext = hierEl.querySelector('.diag-subtext');
    statusSpan.style.color = 'var(--accent-cyan)';
    statusSpan.innerHTML = '<i data-lucide="shield-check"></i>';
    subtext.textContent = `Bot highest role position: ${perms.rolePosition || 'Active'}. Ensure Maiev sits above member roles.`;
  }

  refreshIcons();
}

// Fetch member roster
let cachedMembers = [];
async function fetchMembers() {
  try {
    const res = await fetch('/api/members');
    if (!res.ok) return;
    cachedMembers = await res.json();
    renderMembersTable(cachedMembers);
  } catch (err) {
    console.error('Error fetching members:', err);
  }
}

function renderMembersTable(members) {
  const tbody = document.getElementById('members-table-body');
  if (!tbody) return;
  tbody.innerHTML = '';

  if (!members || members.length === 0) {
    tbody.innerHTML = '<tr><td colspan="3" class="text-center py-4 text-muted">No members found matching query.</td></tr>';
    return;
  }

  members.forEach(m => {
    const tr = document.createElement('tr');
    const rolesHtml = m.roles && m.roles.length > 0
      ? m.roles.map(r => `<span class="role-badge" style="background: rgba(88, 101, 242, 0.2); border: 1px solid rgba(88, 101, 242, 0.4); padding: 2px 7px; border-radius: 4px; font-size: 0.75rem; margin-right: 4px;">@${r}</span>`).join(' ')
      : '<span class="text-muted" style="font-size: 0.8rem;">No Roles</span>';

    tr.innerHTML = `
      <td><strong>${m.username}</strong></td>
      <td><span style="color: var(--accent-cyan); font-weight: 600;">${m.nickname || m.username}</span></td>
      <td>${rolesHtml}</td>
    `;
    tbody.appendChild(tr);
  });
}

// Interactive Server Name Editing in Header Telemetry
function setupServerNameEditing() {
  const serverInput = document.getElementById('server-name-input');
  if (!serverInput) return;

  const applyServerNameChange = (showNotice = false) => {
    const val = serverInput.value.trim() || 'Asia Fregion';
    if (!serverState.guild) serverState.guild = {};
    serverState.guild.name = val;
    if (!serverState.config) serverState.config = {};
    serverState.config.serverName = val;

    const legacyEl = document.getElementById('server-name');
    if (legacyEl) legacyEl.textContent = val;

    // Live update all previews that interpolate {server}
    updateRulesPreview();
    updateVerifyPreview();
    updateWelcomeAnnouncementPreview();
    updateNationalityPreview();

    adjustServerInputWidth(serverInput);

    if (showNotice) {
      showToast(`Server name updated to "${val}"!`, 'success');
    }
  };

  serverInput.addEventListener('input', () => {
    applyServerNameChange(false);
  });

  serverInput.addEventListener('change', () => {
    applyServerNameChange(false);
    persistServerName(serverInput.value.trim() || 'Asia Fregion');
  });

  serverInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      serverInput.blur();
      applyServerNameChange(true);
    }
  });

  const editIcon = document.querySelector('.server-edit-badge-icon');
  if (editIcon) {
    editIcon.addEventListener('click', () => {
      serverInput.focus();
      serverInput.select();
    });
  }
}

// Auto-persist server name to backend config
async function persistServerName(name) {
  try {
    await fetch('/api/config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ serverName: name })
    });
  } catch (err) {
    console.error('Failed to auto-persist server name:', err);
  }
}

// Event Listeners Setup
function setupEventListeners() {
  // Server Name Interactive Editing
  setupServerNameEditing();

  // Global Save & Section Save Buttons
  const saveButtons = [
    document.getElementById('btn-global-save'),
    ...document.querySelectorAll('.btn-save-section')
  ].filter(Boolean);

  saveButtons.forEach(btn => {
    btn.addEventListener('click', saveAllConfiguration);
  });

  // Re-check Diagnostics button
  const btnRecheckDiag = document.getElementById('btn-recheck-diagnostics');
  if (btnRecheckDiag) {
    btnRecheckDiag.addEventListener('click', () => {
      fetchServerState();
      showToast('Permissions & diagnostic status refreshed!', 'success');
    });
  }

  // Refresh Roster button
  const btnRefreshRoster = document.getElementById('btn-refresh-roster');
  if (btnRefreshRoster) {
    btnRefreshRoster.addEventListener('click', () => {
      fetchMembers();
      showToast('Server member roster refreshed!', 'success');
    });
  }

  // Live member search filter
  const memberSearch = document.getElementById('member-search-input');
  if (memberSearch) {
    memberSearch.addEventListener('input', (e) => {
      const q = e.target.value.toLowerCase().trim();
      if (!q) {
        renderMembersTable(cachedMembers);
        return;
      }
      const filtered = cachedMembers.filter(m =>
        (m.username && m.username.toLowerCase().includes(q)) ||
        (m.nickname && m.nickname.toLowerCase().includes(q)) ||
        (m.roles && m.roles.some(r => r.toLowerCase().includes(q)))
      );
      renderMembersTable(filtered);
    });
  }

  // Live input listening on rules fields
  const titleInput = document.getElementById('rules-title-input');
  const contentInput = document.getElementById('rules-content-input');
  const footerInput = document.getElementById('rules-footer-input');

  titleInput?.addEventListener('input', updateRulesPreview);
  contentInput?.addEventListener('input', updateRulesPreview);
  footerInput?.addEventListener('input', updateRulesPreview);

  // Live input listening on verification fields
  const verifyTitleInput = document.getElementById('verify-title-input');
  const verifyContentInput = document.getElementById('verify-content-input');
  const verifyFooterInput = document.getElementById('verify-footer-input');

  verifyTitleInput?.addEventListener('input', updateVerifyPreview);
  verifyContentInput?.addEventListener('input', updateVerifyPreview);
  verifyFooterInput?.addEventListener('input', updateVerifyPreview);

  // Live input listening on public welcome announcement
  const welcomeAnnounceInput = document.getElementById('welcome-announcement-input');
  welcomeAnnounceInput?.addEventListener('input', updateWelcomeAnnouncementPreview);

  // Live input listening on reaction roles embed fields
  const natTitleInput = document.getElementById('nationality-title-input');
  const natContentInput = document.getElementById('nationality-content-input');
  const natFooterInput = document.getElementById('nationality-footer-input');
  natTitleInput?.addEventListener('input', updateNationalityPreview);
  natContentInput?.addEventListener('input', updateNationalityPreview);
  natFooterInput?.addEventListener('input', updateNationalityPreview);

  // Global default intent selector
  const defaultIntentSelect = document.getElementById('reaction-default-intent-select');
  if (defaultIntentSelect) {
    defaultIntentSelect.addEventListener('change', () => {
      const intentVal = defaultIntentSelect.value;
      currentNationalityRoles.forEach(r => {
        if (!r.intent || r.intent === 'toggle') r.intent = intentVal;
      });
      renderNationalityRolesList();
      updateNationalityPreview();
      autoSaveNationalityRoles();
      showToast(`Set default reaction role intent to "${intentVal}"`, 'success');
    });
  }

  // Reset Rules Template Button
  document.getElementById('btn-reset-rules-template')?.addEventListener('click', () => {
    titleInput.value = DEFAULT_RULES_TEMPLATE.title;
    contentInput.value = DEFAULT_RULES_TEMPLATE.content;
    footerInput.value = DEFAULT_RULES_TEMPLATE.footer;
    updateRulesPreview();
    showToast('Reset rules editor to standard AION 2 template!', 'success');
  });

  // Reset Verification Template Button
  document.getElementById('btn-reset-verify-template')?.addEventListener('click', () => {
    verifyTitleInput.value = DEFAULT_VERIFY_TEMPLATE.title;
    verifyContentInput.value = DEFAULT_VERIFY_TEMPLATE.content;
    verifyFooterInput.value = DEFAULT_VERIFY_TEMPLATE.footer;
    updateVerifyPreview();
    showToast('Reset verification editor to standard template!', 'success');
  });

  // Reset Welcome Card Template Button
  document.getElementById('btn-reset-welcome-template')?.addEventListener('click', () => {
    document.getElementById('welcome-title-input').value = DEFAULT_WELCOME_TEMPLATE.title;
    document.getElementById('welcome-content-input').value = DEFAULT_WELCOME_TEMPLATE.content;
    document.getElementById('welcome-footer-input').value = DEFAULT_WELCOME_TEMPLATE.footer;
    showToast('Reset welcome popup card to standard template!', 'success');
  });

  // Reset Public Welcome Announcement Template Button
  document.getElementById('btn-reset-welcome-announcement-template')?.addEventListener('click', () => {
    document.getElementById('welcome-announcement-input').value = DEFAULT_WELCOME_ANNOUNCEMENT_TEMPLATE;
    updateWelcomeAnnouncementPreview();
    showToast('Reset public welcome announcement to standard template!', 'success');
  });

  // Reset Reaction Roles Template Button
  document.getElementById('btn-reset-nationality-template')?.addEventListener('click', () => {
    if (natTitleInput) natTitleInput.value = DEFAULT_NATIONALITY_TEMPLATE.title;
    if (natContentInput) natContentInput.value = DEFAULT_NATIONALITY_TEMPLATE.content;
    if (natFooterInput) natFooterInput.value = DEFAULT_NATIONALITY_TEMPLATE.footer;
    updateNationalityPreview();
    showToast('Reset reaction roles template to standard format!', 'success');
  });

  // Auto-fit Reaction Roles Embed Template Button
  document.getElementById('btn-autofit-embed-template')?.addEventListener('click', () => {
    autoFitEmbedSettingsToRoles();
  });

  // Quick Embed Preset Dropdown
  document.getElementById('select-embed-template-preset')?.addEventListener('change', (e) => {
    if (e.target.value) {
      applyQuickEmbedTemplate(e.target.value);
      e.target.value = '';
    }
  });

  // Auto-detect code when typing/pasting emojis
  const emojiInputEl = document.getElementById('new-nat-emoji');
  const codeInputEl = document.getElementById('new-nat-code');
  if (emojiInputEl && codeInputEl) {
    emojiInputEl.addEventListener('input', () => {
      const iso = extractFlagIsoCode(emojiInputEl.value.trim());
      if (iso && !codeInputEl.value.trim()) {
        codeInputEl.value = iso;
      }
    });
  }

  // Add Single Role Button
  const btnAddNat = document.getElementById('btn-add-nationality');
  if (btnAddNat) {
    btnAddNat.addEventListener('click', () => {
      const emoji = document.getElementById('new-nat-emoji').value.trim();
      const name = document.getElementById('new-nat-name').value.trim();
      const codeInput = document.getElementById('new-nat-code');
      const autoIso = extractFlagIsoCode(emoji);
      const code = (codeInput.value.trim() || autoIso || name.toLowerCase().replace(/[^a-z0-9]/g, '-')).toLowerCase();
      const roleId = document.getElementById('new-nat-role').value;
      const intent = document.getElementById('new-nat-intent').value || 'toggle';

      if (!emoji || !name) {
        showToast('Please provide at least an emoji and role label.', 'error');
        return;
      }

      const currentPreset = reactionPresets[activePresetId];
      const category = currentPreset ? (currentPreset.name || currentPreset.category) : '';
      currentNationalityRoles.push({ emoji, name, code, roleId, intent, category });
      if (currentPreset) currentPreset.roles = currentNationalityRoles;

      document.getElementById('new-nat-emoji').value = '';
      document.getElementById('new-nat-name').value = '';
      document.getElementById('new-nat-code').value = '';
      document.getElementById('new-nat-role').value = '';

      renderNationalityRolesList();
      renderReactionSubtabs();
      updateNationalityPreview();
      autoSaveNationalityRoles();
      showToast(`Added reaction role for ${name} (${intent})!`, 'success');
    });
  }

  // Live input syncing for active preset embed settings
  document.getElementById('nationality-title-input')?.addEventListener('input', (e) => {
    if (reactionPresets[activePresetId]) {
      reactionPresets[activePresetId].title = e.target.value;
    }
    updateNationalityPreview();
  });
  document.getElementById('nationality-content-input')?.addEventListener('input', (e) => {
    if (reactionPresets[activePresetId]) {
      reactionPresets[activePresetId].content = e.target.value;
    }
    updateNationalityPreview();
  });
  document.getElementById('nationality-footer-input')?.addEventListener('input', (e) => {
    if (reactionPresets[activePresetId]) {
      reactionPresets[activePresetId].footer = e.target.value;
    }
    updateNationalityPreview();
  });
  document.getElementById('select-nationality-roles-channel')?.addEventListener('change', (e) => {
    if (reactionPresets[activePresetId]) {
      reactionPresets[activePresetId].channelId = e.target.value;
    }
    const simChName = document.getElementById('sim-nationality-channel-name');
    if (simChName) {
      const text = e.target.selectedOptions?.[0]?.text;
      if (text && text.startsWith('#')) {
        simChName.textContent = text.replace('#', '');
      }
    }
    autoSaveNationalityRoles();
  });
  document.getElementById('reaction-default-intent-select')?.addEventListener('change', (e) => {
    if (reactionPresets[activePresetId]) {
      reactionPresets[activePresetId].intent = e.target.value;
    }
    autoSaveNationalityRoles();
  });

  // POPULATE PRESETS BUTTON & MULTI-PRESET MODAL
  const btnPopulate = document.getElementById('btn-populate-reaction-roles');
  const btnAddSubtabPreset = document.getElementById('btn-add-subtab-preset');
  const modalPresets = document.getElementById('modal-presets');
  const btnPresetsClose = document.getElementById('modal-presets-close');
  const btnPresetsCancel = document.getElementById('modal-presets-cancel');
  const btnPresetsSelectAll = document.getElementById('btn-presets-select-all');
  const btnPresetsDeselectAll = document.getElementById('btn-presets-deselect-all');
  const btnApplyPresets = document.getElementById('btn-apply-selected-presets');
  const summaryEl = document.getElementById('selected-presets-summary');

  let selectedPresetKeys = new Set();

  function updatePresetModalUI() {
    modalPresets?.querySelectorAll('.preset-card-btn').forEach(card => {
      const key = card.getAttribute('data-preset');
      const isSelected = selectedPresetKeys.has(key);
      card.classList.toggle('selected', isSelected);
      const chk = card.querySelector('.preset-select-checkbox');
      if (chk) chk.checked = isSelected;
    });

    const count = selectedPresetKeys.size;
    if (summaryEl) {
      summaryEl.textContent = count === 0
        ? '0 presets selected'
        : `${count} preset${count > 1 ? 's' : ''} selected (${Array.from(selectedPresetKeys).map(k => ROLE_PRESETS[k]?.name || k).join(', ')})`;
    }
    if (btnApplyPresets) {
      btnApplyPresets.disabled = count === 0;
      btnApplyPresets.innerHTML = `<i data-lucide="sparkles"></i> Apply Selected Presets (${count})`;
      refreshIcons();
    }
  }

  const openPresetsModal = () => {
    selectedPresetKeys.clear();
    // Default select active preset or none
    updatePresetModalUI();
    modalPresets.classList.remove('hidden');
    refreshIcons();
  };

  if (btnPopulate && modalPresets) {
    btnPopulate.addEventListener('click', openPresetsModal);
  }
  if (btnAddSubtabPreset && modalPresets) {
    btnAddSubtabPreset.addEventListener('click', openPresetsModal);
  }

  if (modalPresets) {
    btnPresetsClose?.addEventListener('click', () => modalPresets.classList.add('hidden'));
    btnPresetsCancel?.addEventListener('click', () => modalPresets.classList.add('hidden'));

    btnPresetsSelectAll?.addEventListener('click', () => {
      Object.keys(ROLE_PRESETS).forEach(k => selectedPresetKeys.add(k));
      updatePresetModalUI();
    });

    btnPresetsDeselectAll?.addEventListener('click', () => {
      selectedPresetKeys.clear();
      updatePresetModalUI();
    });

    // Preset cards selection toggle
    modalPresets.querySelectorAll('.preset-card-btn').forEach(card => {
      card.addEventListener('click', () => {
        const key = card.getAttribute('data-preset');
        if (selectedPresetKeys.has(key)) {
          selectedPresetKeys.delete(key);
        } else {
          selectedPresetKeys.add(key);
        }
        updatePresetModalUI();
      });
    });

    // Apply button
    btnApplyPresets?.addEventListener('click', () => {
      if (selectedPresetKeys.size === 0) return;
      const mergeMode = document.querySelector('input[name="preset-merge-mode"]:checked')?.value || 'append';
      const autoAdapt = document.getElementById('check-auto-adapt-embed-settings')?.checked !== false;

      applyMultiplePresets(Array.from(selectedPresetKeys), mergeMode, autoAdapt);
      modalPresets.classList.add('hidden');
    });
  }

  // MULTI-ROLE CREATOR BUTTON & MODAL
  const btnOpenMultiRole = document.getElementById('btn-open-multi-role-modal');
  const modalMultiRoles = document.getElementById('modal-multi-roles');
  const btnMultiRolesClose = document.getElementById('modal-multi-roles-close');
  const btnMultiRolesCancel = document.getElementById('modal-multi-roles-cancel');
  const btnMultiRolesSubmit = document.getElementById('modal-multi-roles-submit');

  const btnModeChecklist = document.getElementById('btn-mode-roles-checklist');
  const btnModeBulkText = document.getElementById('btn-mode-bulk-text');
  const checklistView = document.getElementById('multi-role-checklist-view');
  const bulkTextView = document.getElementById('multi-role-bulk-text-view');

  if (btnOpenMultiRole && modalMultiRoles) {
    btnOpenMultiRole.addEventListener('click', () => {
      populateMultiRoleChecklist();
      modalMultiRoles.classList.remove('hidden');
      refreshIcons();
    });

    btnMultiRolesClose?.addEventListener('click', () => modalMultiRoles.classList.add('hidden'));
    btnMultiRolesCancel?.addEventListener('click', () => modalMultiRoles.classList.add('hidden'));

    // Mode Toggle
    btnModeChecklist?.addEventListener('click', () => {
      btnModeChecklist.classList.add('active');
      btnModeBulkText.classList.remove('active');
      checklistView.classList.remove('hidden');
      bulkTextView.classList.add('hidden');
    });

    btnModeBulkText?.addEventListener('click', () => {
      btnModeBulkText.classList.add('active');
      btnModeChecklist.classList.remove('active');
      bulkTextView.classList.remove('hidden');
      checklistView.classList.add('hidden');
    });

    // Submit multi-roles
    btnMultiRolesSubmit?.addEventListener('click', () => {
      if (!checklistView.classList.contains('hidden')) {
        // Mode A: Checklist submission
        const checkedBoxes = Array.from(document.querySelectorAll('.multi-role-checkbox:checked'));
        if (checkedBoxes.length === 0) {
          showToast('Please select at least one role from the checklist.', 'error');
          return;
        }

        const batchIntent = document.getElementById('multi-role-batch-intent').value || 'toggle';
        let addedCount = 0;

        checkedBoxes.forEach(cb => {
          const roleId = cb.value;
          const roleName = cb.getAttribute('data-role-name') || 'Role';
          const defaultEmoji = '⭐';
          const code = roleName.toLowerCase().replace(/[^a-z0-9]/g, '-');

          // Avoid duplicate roleIds if already configured
          if (!currentNationalityRoles.some(r => r.roleId === roleId)) {
            currentNationalityRoles.push({
              emoji: defaultEmoji,
              name: roleName,
              code,
              roleId,
              intent: batchIntent
            });
            addedCount++;
          }
        });

        renderNationalityRolesList();
        updateNationalityPreview();
        autoSaveNationalityRoles();
        modalMultiRoles.classList.add('hidden');
        showToast(`Created ${addedCount} new reaction role(s) with "${batchIntent}" intent!`, 'success');
      } else {
        // Mode B: Bulk Paste text
        const text = document.getElementById('multi-role-paste-textarea').value.trim();
        if (!text) {
          showToast('Please paste or enter role definitions.', 'error');
          return;
        }

        const lines = text.split('\n');
        let addedCount = 0;
        const guildRoles = serverState?.guild?.roles || [];

        lines.forEach(line => {
          const parts = line.split(',').map(s => s.trim());
          if (parts.length >= 2) {
            const emoji = parts[0];
            const name = parts[1];
            const code = parts[2] || name.toLowerCase().replace(/[^a-z0-9]/g, '-');
            const intent = parts[3] || 'toggle';

            // Auto-match role by name if possible
            const matchedRole = guildRoles.find(r => r.name.toLowerCase() === name.toLowerCase());

            currentNationalityRoles.push({
              emoji,
              name,
              code,
              roleId: matchedRole ? matchedRole.id : '',
              intent
            });
            addedCount++;
          }
        });

        renderNationalityRolesList();
        updateNationalityPreview();
        autoSaveNationalityRoles();
        modalMultiRoles.classList.add('hidden');
        showToast(`Imported ${addedCount} reaction role(s)!`, 'success');
      }
    });
  }

  // Send Test Welcome Announcement Button
  document.getElementById('btn-test-welcome-announcement')?.addEventListener('click', async () => {
    const channelId = document.getElementById('select-welcome-channel').value;
    const message = document.getElementById('welcome-announcement-input').value.trim();
    if (!channelId) {
      showToast('Please select a welcome channel first.', 'error');
      return;
    }
    try {
      const res = await fetch('/api/test-welcome', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ channelId, message })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed');
      showToast('Test welcome announcement sent to Discord!', 'success');
    } catch (err) {
      showToast(`Error: ${err.message}`, 'error');
    }
  });

  // Post Reaction Roles Card Button (posts ONLY the active preset!)
  const btnPostNatRoles = document.getElementById('btn-post-nationality-roles-channel');
  if (btnPostNatRoles) {
    btnPostNatRoles.addEventListener('click', async () => {
      const channelSelect = document.getElementById('select-nationality-roles-channel');
      const channelId = channelSelect?.value;
      if (!channelId) {
        showToast('Please select a target channel to post the reaction card.', 'error');
        return;
      }

      const currentPreset = reactionPresets[activePresetId];
      if (!currentPreset || (currentPreset.roles || []).length === 0) {
        showToast('No roles configured in this preset to post.', 'error');
        return;
      }

      const presetName = currentPreset.name || activePresetId;
      btnPostNatRoles.disabled = true;
      btnPostNatRoles.innerHTML = '<i data-lucide="loader-2"></i> Posting...';

      try {
        const title = document.getElementById('nationality-title-input')?.value.trim() || currentPreset.title || DEFAULT_NATIONALITY_TEMPLATE.title;
        const content = document.getElementById('nationality-content-input')?.value.trim() || currentPreset.content || '';
        const footer = document.getElementById('nationality-footer-input')?.value.trim() || currentPreset.footer || DEFAULT_NATIONALITY_TEMPLATE.footer;
        const intent = document.getElementById('reaction-default-intent-select')?.value || currentPreset.intent || 'toggle';

        const res = await fetch('/api/post-nationality-roles', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            channelId,
            presetId: activePresetId,
            roles: currentPreset.roles,
            nationalityRoles: currentPreset.roles,
            nationalityTitle: title,
            nationalityContent: content,
            nationalityFooter: footer,
            intent,
            forceNew: true
          })
        });
        const data = await res.json();
        if (data.success) {
          currentPreset.messageId = data.messageId;
          currentPreset.channelId = channelId;
          currentPreset.title = title;
          currentPreset.content = content;
          currentPreset.footer = footer;
          currentPreset.intent = intent;

          const deployBadge = document.getElementById('active-subtab-deploy-badge');
          if (deployBadge) {
            deployBadge.className = 'badge badge-success';
            deployBadge.innerHTML = `<i data-lucide="check-circle-2"></i> Deployed (${data.messageId.slice(-6)})`;
          }

          showToast(`"${presetName}" card posted to #${data.channelName || 'channel'}!`, 'success');
          autoSaveNationalityRoles();
        } else {
          showToast(`Error: ${data.error || 'Failed to post embed'}`, 'error');
        }
      } catch (err) {
        showToast(`Error: ${err.message}`, 'error');
      } finally {
        btnPostNatRoles.disabled = false;
        const shortName = (currentPreset.name || 'Reaction').split(' ')[0];
        btnPostNatRoles.innerHTML = `<i data-lucide="send"></i> <span id="btn-post-label-text">Post ${shortName} Card</span>`;
        refreshIcons();
      }
    });
  }

  // Update Active Reaction Roles Card in-place (updates ONLY the active preset!)
  const btnUpdateNatRoles = document.getElementById('btn-update-nationality-roles-channel');
  if (btnUpdateNatRoles) {
    btnUpdateNatRoles.addEventListener('click', async () => {
      const channelSelect = document.getElementById('select-nationality-roles-channel');
      const channelId = channelSelect?.value;
      if (!channelId) {
        showToast('Please select a target channel to update the reaction card.', 'error');
        return;
      }

      const currentPreset = reactionPresets[activePresetId];
      if (!currentPreset || (currentPreset.roles || []).length === 0) {
        showToast('No roles configured in this preset to update.', 'error');
        return;
      }

      const presetName = currentPreset.name || activePresetId;
      btnUpdateNatRoles.disabled = true;
      btnUpdateNatRoles.innerHTML = '<i data-lucide="loader-2"></i> Updating...';

      try {
        const title = document.getElementById('nationality-title-input')?.value.trim() || currentPreset.title || DEFAULT_NATIONALITY_TEMPLATE.title;
        const content = document.getElementById('nationality-content-input')?.value.trim() || currentPreset.content || '';
        const footer = document.getElementById('nationality-footer-input')?.value.trim() || currentPreset.footer || DEFAULT_NATIONALITY_TEMPLATE.footer;
        const intent = document.getElementById('reaction-default-intent-select')?.value || currentPreset.intent || 'toggle';

        const res = await fetch('/api/post-nationality-roles', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            channelId,
            presetId: activePresetId,
            messageId: currentPreset.messageId,
            roles: currentPreset.roles,
            nationalityRoles: currentPreset.roles,
            nationalityTitle: title,
            nationalityContent: content,
            nationalityFooter: footer,
            intent,
            forceNew: false
          })
        });
        const data = await res.json();
        if (data.success) {
          currentPreset.messageId = data.messageId;
          currentPreset.channelId = channelId;
          currentPreset.title = title;
          currentPreset.content = content;
          currentPreset.footer = footer;
          currentPreset.intent = intent;

          const deployBadge = document.getElementById('active-subtab-deploy-badge');
          if (deployBadge) {
            deployBadge.className = 'badge badge-success';
            deployBadge.innerHTML = `<i data-lucide="check-circle-2"></i> Deployed (${data.messageId.slice(-6)})`;
          }

          showToast(data.updated ? `"${presetName}" card updated in-place on Discord!` : `"${presetName}" card posted to #${data.channelName || 'channel'}!`, 'success');
          autoSaveNationalityRoles();
        } else {
          showToast(`Error: ${data.error || 'Failed to update embed'}`, 'error');
        }
      } catch (err) {
        showToast(`Error: ${err.message}`, 'error');
      } finally {
        btnUpdateNatRoles.disabled = false;
        btnUpdateNatRoles.innerHTML = '<i data-lucide="refresh-cw"></i> Update Active Card';
        refreshIcons();
      }
    });
  }

  // Clean Ghost Reactions Button
  const btnCleanReactions = document.getElementById('btn-clean-ghost-reactions');
  if (btnCleanReactions) {
    btnCleanReactions.addEventListener('click', async () => {
      btnCleanReactions.disabled = true;
      btnCleanReactions.innerHTML = '<i data-lucide="loader-2"></i> Cleaning...';
      try {
        const res = await fetch('/api/clean-reactions', { method: 'POST' });
        const data = await res.json();
        if (data.success) {
          if (data.totalPurged === 0) {
            showToast(`Inspected ${data.messagesInspected} message(s) — 0 ghost reactions found.`, 'success');
          } else {
            showToast(`Purged ${data.totalPurged} ghost reaction(s) from former members.`, 'success');
          }
        } else {
          showToast(`Error: ${data.error || 'Failed to clean reactions'}`, 'error');
        }
      } catch (err) {
        showToast(`Error: ${err.message}`, 'error');
      } finally {
        btnCleanReactions.disabled = false;
        btnCleanReactions.innerHTML = '<i data-lucide="trash-2"></i> Clean Ghost Reactions';
        refreshIcons();
      }
    });
  }

  // Post Rules Embed Button
  document.getElementById('btn-post-rules-channel')?.addEventListener('click', async () => {
    const channelId = document.getElementById('select-rules-channel').value;
    if (!channelId) {
      showToast('Please select a rules channel first.', 'error');
      return;
    }
    postEmbed('/api/post-rules', channelId, 'Rules card posted successfully to Discord!');
  });

  // Post Setup Embed Button
  document.getElementById('btn-post-verify-channel')?.addEventListener('click', async () => {
    const channelId = document.getElementById('select-verify-channel').value;
    if (!channelId) {
      showToast('Please select a setup channel first.', 'error');
      return;
    }
    postEmbed('/api/post-verify', channelId, 'AION 2 IGN Setup card posted successfully!');
  });

  // Refresh Header telemetry button
  document.getElementById('btn-refresh')?.addEventListener('click', () => {
    fetchServerState();
    showToast('Refreshed live data from Discord Gateway!', 'success');
  });

  // Simulator: Rules Accept Button Click
  document.getElementById('sim-btn-accept-rules')?.addEventListener('click', () => {
    const onboardedRoleName = document.getElementById('select-onboarded-role').selectedOptions[0]?.text || '@Onboarded';
    const feedback = document.getElementById('sim-rules-feedback');
    if (feedback) {
      feedback.classList.remove('hidden');
      feedback.innerHTML = `<span style="color: #57F287;"><i data-lucide="check-circle-2"></i></span> <strong>[Simulated Response]</strong> Rules Acknowledged! Member received <strong>${onboardedRoleName}</strong>. Channel <strong>#identity-verification</strong> is now unlocked!`;
      refreshIcons();
    }
  });

  // Simulator: Open & Close Modal
  const modalBackdrop = document.getElementById('sim-modal-backdrop');
  document.getElementById('sim-btn-open-modal')?.addEventListener('click', () => {
    modalBackdrop?.classList.remove('hidden');
  });
  document.getElementById('sim-modal-close')?.addEventListener('click', () => modalBackdrop?.classList.add('hidden'));
  document.getElementById('sim-modal-cancel')?.addEventListener('click', () => modalBackdrop?.classList.add('hidden'));

  // Simulator: Submit Modal
  document.getElementById('sim-modal-submit')?.addEventListener('click', () => {
    const ign = document.getElementById('sim-modal-ign-input').value.trim() || 'DaevaLegend';
    modalBackdrop?.classList.add('hidden');

    const serverName = serverState?.config?.serverName || serverState?.guild?.name || 'Asia Fregion';
    const serverIcon = serverState?.guild?.icon || 'https://assets-global.website-files.com/6257adef93867e50d84d30e2/636e0a6a49cf127bf92de1e2_icon_clyde_blurple_RGB.png';
    const welcomeTitle = (document.getElementById('welcome-title-input').value || DEFAULT_WELCOME_TEMPLATE.title)
      .replace(/{server}/g, serverName).replace(/{ign}/g, ign);
    const welcomeBody = (document.getElementById('welcome-content-input').value || DEFAULT_WELCOME_TEMPLATE.content)
      .replace(/{server}/g, serverName)
      .replace(/{ign}/g, ign)
      .replace(/{roles}/g, '@Unverified, @Elyos Fregion');
    const welcomeFoot = (document.getElementById('welcome-footer-input').value || DEFAULT_WELCOME_TEMPLATE.footer)
      .replace(/{server}/g, serverName).replace(/{ign}/g, ign);

    const feedback = document.getElementById('sim-verify-feedback');
    if (feedback) {
      feedback.classList.remove('hidden');
      feedback.innerHTML = `
        <div style="background: rgba(0, 210, 255, 0.08); border-left: 3px solid #00d2ff; padding: 12px; border-radius: 6px;">
          <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 8px;">
            <img src="${serverIcon}" style="width: 26px; height: 26px; border-radius: 50%; border: 1px solid rgba(0,210,255,0.4);" alt="Server Profile">
            <strong style="color: #00d2ff; font-size: 0.85rem;">${serverName}</strong>
          </div>
          <div style="font-weight: 700; font-size: 1rem; color: #fff; margin-bottom: 6px;">${welcomeTitle}</div>
          <div style="line-height: 1.45; color: #dbdee1; font-size: 0.84rem;">${formatDiscordMarkdown(welcomeBody)}</div>
          <div style="font-size: 0.72rem; color: #949ba4; margin-top: 8px; border-top: 1px solid rgba(255,255,255,0.08); padding-top: 6px;">${welcomeFoot}</div>
        </div>
      `;
    }
    refreshIcons();
  });
}

// Populate multi-role checklist modal from server roles
function populateMultiRoleChecklist() {
  const container = document.getElementById('multi-role-server-roles-container');
  if (!container) return;
  container.innerHTML = '';

  const roles = serverState?.guild?.roles || [];
  if (roles.length === 0) {
    container.innerHTML = '<p class="text-muted">No server roles found.</p>';
    return;
  }

  roles.forEach(role => {
    if (role.name === '@everyone') return;
    const isAlreadyConfigured = currentNationalityRoles.some(r => r.roleId === role.id);

    const row = document.createElement('label');
    row.className = 'multi-role-item-row';
    row.innerHTML = `
      <div style="display: flex; align-items: center; gap: 8px;">
        <input type="checkbox" class="multi-role-checkbox" value="${role.id}" data-role-name="${role.name}" ${isAlreadyConfigured ? 'disabled' : ''}>
        <span style="font-weight: 600; color: #fff;">@${role.name}</span>
      </div>
      <span style="font-size: 0.75rem; color: var(--text-muted);">${isAlreadyConfigured ? 'Already Added' : 'Available'}</span>
    `;
    container.appendChild(row);
  });
}

// Apply Multiple Preset Templates simultaneously (creates/enables separate subtabs)
function applyMultiplePresets(presetKeys, mergeMode = 'append', autoAdaptEmbed = true) {
  if (!Array.isArray(presetKeys) || presetKeys.length === 0) return;

  const roles = serverState?.guild?.roles || [];

  if (mergeMode === 'replace') {
    reactionPresets = {};
  }

  presetKeys.forEach(key => {
    const preset = ROLE_PRESETS[key];
    if (!preset) return;

    const matchedRoles = preset.roles.map(item => {
      const matchedRole = roles.find(r =>
        r.name.toLowerCase() === item.name.toLowerCase() ||
        r.name.toLowerCase().includes(item.name.toLowerCase()) ||
        item.name.toLowerCase().includes(r.name.toLowerCase())
      );
      return {
        emoji: item.emoji,
        name: item.name,
        code: item.code,
        roleId: matchedRole ? matchedRole.id : '',
        intent: item.intent || 'unique',
        category: preset.category
      };
    });

    if (reactionPresets[key] && mergeMode === 'append') {
      const existingCodes = new Set((reactionPresets[key].roles || []).map(r => r.code || r.name.toLowerCase()));
      matchedRoles.forEach(newRole => {
        const codeKey = newRole.code || newRole.name.toLowerCase();
        if (!existingCodes.has(codeKey)) {
          reactionPresets[key].roles.push(newRole);
          existingCodes.add(codeKey);
        }
      });
    } else {
      reactionPresets[key] = {
        id: key,
        name: preset.name,
        icon: key === 'classes' ? '⚔️' : (key === 'nationality' ? '🌍' : (key === 'notifications' ? '🔔' : (key === 'platforms' ? '💻' : '🏷️'))),
        category: preset.category,
        title: preset.defaultTitle,
        content: '',
        footer: preset.defaultFooter,
        channelId: document.getElementById('select-nationality-roles-channel')?.value || '',
        messageId: '',
        intent: preset.roles[0]?.intent || 'unique',
        roles: matchedRoles
      };
    }
  });

  // Switch to the first selected preset
  activePresetId = presetKeys[0];
  renderReactionSubtabs();
  switchActivePreset(activePresetId);
  autoSaveNationalityRoles();
  refreshIcons();

  const presetNames = presetKeys.map(k => ROLE_PRESETS[k]?.name || k).join(', ');
  showToast(`Enabled preset subtabs: ${presetNames}!`, 'success');
}

// Single preset fallback
function applyPreset(presetKey) {
  applyMultiplePresets([presetKey], 'append', true);
}

// Apply Quick Embed Preset text template
function applyQuickEmbedTemplate(key) {
  const currentPreset = reactionPresets[activePresetId];
  const titleInput = document.getElementById('nationality-title-input');
  const contentInput = document.getElementById('nationality-content-input');
  const footerInput = document.getElementById('nationality-footer-input');
  if (!titleInput || !footerInput) return;

  if (key === 'classes') {
    titleInput.value = '⚔️ Choose Your Class Archetype';
    footerInput.value = 'React with an emoji below to choose your class';
  } else if (key === 'nationality') {
    titleInput.value = '🌍 Choose Your Region';
    footerInput.value = 'React with a flag emoji below to toggle your region';
  } else if (key === 'notifications') {
    titleInput.value = '🔔 Notification Preferences';
    footerInput.value = 'React with an emoji below to toggle notification pings';
  } else if (key === 'platforms') {
    titleInput.value = '💻 Select Your Gaming Platform';
    footerInput.value = 'React with an icon below to select your device';
  } else if (key === 'master') {
    titleInput.value = '✨ Server Roles — Choose Your Roles';
    footerInput.value = 'React with an emoji below to toggle your roles';
  }
  if (contentInput) contentInput.value = '';

  if (currentPreset) {
    currentPreset.title = titleInput.value;
    currentPreset.footer = footerInput.value;
    currentPreset.content = '';
  }

  updateNationalityPreview();
  autoSaveNationalityRoles();
  showToast('Applied quick embed preset template!', 'success');
}

// Auto-fit Reaction Roles embed title & footer to active roles
function autoFitEmbedSettingsToRoles() {
  const currentPreset = reactionPresets[activePresetId];
  const titleInput = document.getElementById('nationality-title-input');
  const footerInput = document.getElementById('nationality-footer-input');
  const contentInput = document.getElementById('nationality-content-input');
  if (!titleInput || !footerInput) return;

  const presetDef = ROLE_PRESETS[activePresetId];
  if (presetDef) {
    titleInput.value = presetDef.defaultTitle;
    footerInput.value = presetDef.defaultFooter;
  } else {
    titleInput.value = currentPreset?.name ? `✨ ${currentPreset.name} — Choose Your Roles` : DEFAULT_NATIONALITY_TEMPLATE.title;
    footerInput.value = 'React with an emoji below to toggle your role';
  }
  if (contentInput) contentInput.value = '';

  if (currentPreset) {
    currentPreset.title = titleInput.value;
    currentPreset.footer = footerInput.value;
    currentPreset.content = '';
  }

  updateNationalityPreview();
  autoSaveNationalityRoles();
  showToast(`Reaction Card Embed Settings auto-fitted for "${currentPreset?.name || 'preset'}"!`, 'success');
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
  } catch (_) { }
  return null;
}

// Save All Configuration to Server
async function saveAllConfiguration() {
  const onboardedRoleId = document.getElementById('select-onboarded-role')?.value || '';
  const rulesChannelId = document.getElementById('select-rules-channel')?.value || '';
  const verifyChannelId = document.getElementById('select-verify-channel')?.value || '';

  const ignRolesToAdd = Array.from(document.querySelectorAll('input[name="role_add"]:checked')).map(el => el.value);
  const ignRolesToRemove = Array.from(document.querySelectorAll('input[name="role_remove"]:checked')).map(el => el.value);

  const rulesTitle = document.getElementById('rules-title-input')?.value.trim() || DEFAULT_RULES_TEMPLATE.title;
  const rulesContent = document.getElementById('rules-content-input')?.value.trim() || DEFAULT_RULES_TEMPLATE.content;
  const rulesFooter = document.getElementById('rules-footer-input')?.value.trim() || DEFAULT_RULES_TEMPLATE.footer;

  const verifyTitle = document.getElementById('verify-title-input')?.value.trim() || DEFAULT_VERIFY_TEMPLATE.title;
  const verifyContent = document.getElementById('verify-content-input')?.value.trim() || DEFAULT_VERIFY_TEMPLATE.content;
  const verifyFooter = document.getElementById('verify-footer-input')?.value.trim() || DEFAULT_VERIFY_TEMPLATE.footer;

  const welcomeTitle = document.getElementById('welcome-title-input')?.value.trim() || DEFAULT_WELCOME_TEMPLATE.title;
  const welcomeContent = document.getElementById('welcome-content-input')?.value.trim() || DEFAULT_WELCOME_TEMPLATE.content;
  const welcomeFooter = document.getElementById('welcome-footer-input')?.value.trim() || DEFAULT_WELCOME_TEMPLATE.footer;

  const welcomeAnnouncementChannelId = document.getElementById('select-welcome-channel')?.value || '';
  const enableWelcomeAnnouncement = document.getElementById('check-enable-welcome-announcement')?.checked !== false;
  const welcomeAnnouncementMessage = document.getElementById('welcome-announcement-input')?.value.trim() || '';

  const nationalityChannelId = document.getElementById('select-nationality-roles-channel')?.value || '';
  const nationalityTitle = document.getElementById('nationality-title-input')?.value.trim() || DEFAULT_NATIONALITY_TEMPLATE.title;
  const serverName = document.getElementById('server-name-input')?.value.trim() || serverState?.guild?.name || 'Asia Fregion';

  try {
    const reactionRoleIntent = document.getElementById('reaction-default-intent-select')?.value || 'toggle';
    const allRoles = Object.values(reactionPresets).flatMap(p => p.roles || []);
    const res = await fetch('/api/config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        serverName,
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
        reactionRoleIntent,
        nationalityRoles: allRoles,
        reactionPresets: reactionPresets
      })
    });

    if (!res.ok) throw new Error('Save failed');
    const result = await res.json();
    if (result.config) {
      try {
        localStorage.setItem('maiev_config_cache', JSON.stringify(result.config));
      } catch (_) { }
    }
    showToast('All dashboard configuration settings saved successfully!', 'success');
  } catch (err) {
    showToast('Error saving configuration.', 'error');
  }
}

// Auto-save reaction roles to server immediately
async function autoSaveNationalityRoles() {
  try {
    const allRoles = Object.values(reactionPresets).flatMap(p => p.roles || []);
    const intent = document.getElementById('reaction-default-intent-select')?.value || 'toggle';
    await fetch('/api/nationality-roles', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        nationalityRoles: allRoles,
        reactionPresets: reactionPresets,
        intent
      })
    });
  } catch (err) {
    console.error('Failed to auto-save reaction roles:', err);
  }
}

// Helper: Post Embed API Call
async function postEmbed(endpoint, channelId, successMessage) {
  try {
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ channelId })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed');
    showToast(successMessage, 'success');
  } catch (err) {
    showToast(`Error: ${err.message}`, 'error');
  }
}

// Helper: Toast Notification
function showToast(message, type = 'success') {
  const toast = document.getElementById('toast-banner');
  const text = document.getElementById('toast-message');
  if (!toast || !text) return;
  text.textContent = message;
  toast.className = `toast-banner ${type}`;
  setTimeout(() => {
    toast.className = 'toast-banner hidden';
  }, 4500);
}

// Setup real-time bidirectional synchronization between Discord & Web UI
function setupRealtimeSync() {
  if (typeof EventSource !== 'undefined') {
    const eventSource = new EventSource('/api/events');
    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === 'config_updated' && data.config) {
          applyRemoteNationalitySync(data.config);
        }
      } catch (_) { }
    };
  }

  // Periodic polling backup (every 5 seconds)
  setInterval(async () => {
    try {
      const res = await fetch('/api/status');
      if (res.ok) {
        const data = await res.json();
        if (data.config) {
          applyRemoteNationalitySync(data.config);
        }
      }
    } catch (_) { }
  }, 5000);
}

// Apply remote config updates to Web UI without interrupting user typing
function applyRemoteNationalitySync(remoteConfig) {
  if (!remoteConfig) return;

  const activeEl = document.activeElement;
  if (activeEl && ['new-nat-emoji', 'new-nat-name', 'new-nat-code', 'new-nat-role', 'nationality-content-input', 'nationality-title-input', 'nationality-footer-input'].includes(activeEl.id)) {
    return;
  }

  if (remoteConfig.reactionPresets && Object.keys(remoteConfig.reactionPresets).length > 0) {
    const currentJson = JSON.stringify(reactionPresets || {});
    const remoteJson = JSON.stringify(remoteConfig.reactionPresets);
    if (currentJson !== remoteJson) {
      reactionPresets = JSON.parse(JSON.stringify(remoteConfig.reactionPresets));
      if (!reactionPresets[activePresetId]) {
        activePresetId = Object.keys(reactionPresets)[0] || 'classes';
      }
      currentNationalityRoles = reactionPresets[activePresetId]?.roles || [];
      renderReactionSubtabs();
      switchActivePreset(activePresetId);
    }
  }
}
