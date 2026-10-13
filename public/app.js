/**
 * Maiev Bot Control Center — Client Application
 * Real-time management for AION 2 Verification, Welcome Announcements, and Nationality Flag Roles
 */

const DEFAULT_RULES_TEMPLATE = {
  title: '📜 Server Rules & Guidelines',
  content: `Welcome to the community! Before proceeding, please review our core server rules:

**1. Respect Everyone** — Treat all members with courtesy and kindness. Zero tolerance for harassment, racism, or toxicity.
**2. Keep Content Appropriate** — Keep discussions in the relevant channels. No NSFW or offensive content.
**3. Follow Game Terms of Service** — No exploits, account selling, or unapproved third-party software.
**4. Listen to Staff** — Follow moderator instructions at all times.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━
**Next Step:** Click the button below to acknowledge the rules. You will receive the **[Onboarded]** role, unlocking the **#verify-ign** channel where you can set your AION 2 In-Game Name with **Maiev**!`,
  footer: 'Acknowledge the rules below to proceed'
};

const DEFAULT_VERIFY_TEMPLATE = {
  title: '🛡️ Maiev — AION 2 IGN Verification',
  content: `Welcome to **{server}**!

To proceed, please register your **AION 2 In-Game Name (IGN)**:

**How it works:**
1. Click the **"🎮 Set AION 2 IGN & Verify"** button below.
2. Enter your exact in-game character name.
3. Maiev will update your server nickname to your IGN, grant you **[Unverified]** and **[Elyos Fregion]**, and remove **[Onboarded]** so you can post your screenshot in the verification channel!`,
  footer: 'Maiev Verification System • AION 2'
};

const DEFAULT_WELCOME_TEMPLATE = {
  title: '🎉 Welcome to {server}, {ign}!',
  content: `Your AION 2 IGN has been successfully registered as **{ign}**!

• **Roles Granted:** **{roles}**
• **Channel Updated:** **#verify-ign** has been closed

📸 **Next Step:** The exclusive community channels are now unlocked! Please post your character screenshot in the verification channel for staff approval. Visit your regional channel to pick your nationality role!`,
  footer: '{server} • AION 2 Elyos Legion'
};

const DEFAULT_WELCOME_ANNOUNCEMENT_TEMPLATE = "👋 Welcome to **{server}**, {user}! Registered as **{ign}**. Welcome to the Legion, Daeva!";

const DEFAULT_NATIONALITY_TEMPLATE = {
  title: '🌍 Choose Your Nationality',
  content: '',
  footer: 'React with a flag emoji below to toggle your role'
};

let serverState = null;
let currentNationalityRoles = [];

// Initialize on DOM load
document.addEventListener('DOMContentLoaded', () => {
  fetchServerState();
  setupEventListeners();
});

// Fetch complete bot & server status from API
async function fetchServerState() {
  try {
    const res = await fetch('/api/status');
    if (!res.ok) throw new Error('API request failed');
    const data = await res.json();
    serverState = data;

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
  } catch (err) {
    console.error('Failed to load status:', err);
    showToast('Could not connect to bot API. Please check server logs.', 'error');
  }
}

// Render Header & Telemetry
function renderHeaderTelemetry(data) {
  if (data.avatar) {
    document.getElementById('bot-avatar').src = data.avatar;
    document.getElementById('sim-bot-avatar-1').src = data.avatar;
    document.getElementById('sim-bot-avatar-2').src = data.avatar;
    const simAvatar3 = document.getElementById('sim-bot-avatar-3');
    if (simAvatar3) simAvatar3.src = data.avatar;
  }
  document.getElementById('bot-connection-string').textContent = `${data.botName} • Connected to Discord Gateway`;
  document.getElementById('ping-value').textContent = `${Math.max(data.ping, 1)} ms`;
  document.getElementById('server-name').textContent = data.guild?.name || 'AION 2 Server';
  document.getElementById('member-count').textContent = data.guild?.memberCount || '--';
}

// Render Role Selectors (Stage 1 and Stage 2)
function renderRoleDropdowns(data) {
  const roles = data.guild?.roles || [];
  const currentConfig = data.config || {};

  // Sort roles by position descending
  roles.sort((a, b) => b.position - a.position);

  // 1. Onboarded Role Select (Single)
  const onboardedSelect = document.getElementById('select-onboarded-role');
  onboardedSelect.innerHTML = '<option value="">-- Select Onboarded Role --</option>';

  roles.forEach(role => {
    if (role.name === '@everyone') return;
    const opt = document.createElement('option');
    opt.value = role.id;
    opt.textContent = `@${role.name}`;
    if (role.id === currentConfig.onboardedRoleId || (!currentConfig.onboardedRoleId && /onboarded/i.test(role.name))) {
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

  const savedAddRoles = currentConfig.ignRolesToAdd || [];
  const savedRemoveRoles = currentConfig.ignRolesToRemove || [];

  roles.forEach(role => {
    if (role.name === '@everyone') return;

    // Checkbox for Roles to ADD
    const addItem = document.createElement('label');
    addItem.className = 'role-checkbox-item';
    const isAddChecked = savedAddRoles.includes(role.id) || 
      (savedAddRoles.length === 0 && /unverified|elyos|fregion/i.test(role.name));
    
    addItem.innerHTML = `
      <input type="checkbox" name="role_add" value="${role.id}" ${isAddChecked ? 'checked' : ''}>
      <span class="role-dot" style="background-color: ${role.color !== '#000000' ? role.color : '#5865F2'}"></span>
      <span>@${role.name}</span>
    `;
    addContainer.appendChild(addItem);

    // Checkbox for Roles to REMOVE
    const removeItem = document.createElement('label');
    removeItem.className = 'role-checkbox-item';
    const isRemoveChecked = savedRemoveRoles.includes(role.id) || 
      (savedRemoveRoles.length === 0 && /onboarded/i.test(role.name));

    removeItem.innerHTML = `
      <input type="checkbox" name="role_remove" value="${role.id}" ${isRemoveChecked ? 'checked' : ''}>
      <span class="role-dot" style="background-color: ${role.color !== '#000000' ? role.color : '#e74c3c'}"></span>
      <span>@${role.name}</span>
    `;
    removeContainer.appendChild(removeItem);
  });

  updateFunnelLabels();
}

// Render Channel Selectors
function renderChannelDropdowns(data) {
  const channels = data.guild?.channels || [];
  const currentConfig = data.config || {};

  const rulesSelect = document.getElementById('select-rules-channel');
  const verifySelect = document.getElementById('select-verify-channel');
  const welcomeSelect = document.getElementById('select-welcome-channel');
  const natRolesSelect = document.getElementById('select-nationality-roles-channel');

  rulesSelect.innerHTML = '<option value="">-- Select Channel --</option>';
  verifySelect.innerHTML = '<option value="">-- Select Channel --</option>';
  if (welcomeSelect) welcomeSelect.innerHTML = '<option value="">-- Select Welcome Channel --</option>';
  if (natRolesSelect) natRolesSelect.innerHTML = '<option value="">-- Select Channel --</option>';

  channels.forEach(ch => {
    const optRules = document.createElement('option');
    optRules.value = ch.id;
    optRules.textContent = `#${ch.name}`;
    if (ch.id === currentConfig.rulesChannelId || (!currentConfig.rulesChannelId && /rules/i.test(ch.name))) {
      optRules.selected = true;
    }
    rulesSelect.appendChild(optRules);

    const optVerify = document.createElement('option');
    optVerify.value = ch.id;
    optVerify.textContent = `#${ch.name}`;
    if (ch.id === currentConfig.verifyChannelId || (!currentConfig.verifyChannelId && /verify/i.test(ch.name))) {
      optVerify.selected = true;
    }
    verifySelect.appendChild(optVerify);

    if (welcomeSelect) {
      const optWelcome = document.createElement('option');
      optWelcome.value = ch.id;
      optWelcome.textContent = `#${ch.name}`;
      if (ch.id === currentConfig.welcomeAnnouncementChannelId || (!currentConfig.welcomeAnnouncementChannelId && /welcome/i.test(ch.name))) {
        optWelcome.selected = true;
      }
      welcomeSelect.appendChild(optWelcome);
    }

    if (natRolesSelect) {
      const optNat = document.createElement('option');
      optNat.value = ch.id;
      optNat.textContent = `#${ch.name}`;
      if (/role/i.test(ch.name)) {
        optNat.selected = true;
      }
      natRolesSelect.appendChild(optNat);
    }
  });
}

// Render Personalized Rules Editor
function renderRulesEditor(cfg) {
  const title = cfg.rulesTitle || DEFAULT_RULES_TEMPLATE.title;
  const content = cfg.rulesContent || DEFAULT_RULES_TEMPLATE.content;
  const footer = cfg.rulesFooter || DEFAULT_RULES_TEMPLATE.footer;

  document.getElementById('rules-title-input').value = title;
  document.getElementById('rules-content-input').value = content;
  document.getElementById('rules-footer-input').value = footer;

  updateRulesPreview();
}

// Update the Discord embed simulator in real-time
function updateRulesPreview() {
  const title = document.getElementById('rules-title-input').value;
  const content = document.getElementById('rules-content-input').value;
  const footer = document.getElementById('rules-footer-input').value;

  const simTitle = document.getElementById('sim-rules-title');
  const simDesc = document.getElementById('sim-rules-desc');
  const simFooter = document.getElementById('sim-rules-footer');

  if (simTitle) simTitle.textContent = title || '📜 Server Rules & Guidelines';
  if (simDesc) simDesc.innerHTML = formatDiscordMarkdown(content);
  if (simFooter) simFooter.textContent = footer || 'Acknowledge the rules below to proceed';
}

// Render Personalized Verification Embed Editor
function renderVerifyEditor(cfg) {
  const title = cfg.verifyTitle || DEFAULT_VERIFY_TEMPLATE.title;
  const content = cfg.verifyContent || DEFAULT_VERIFY_TEMPLATE.content;
  const footer = cfg.verifyFooter || DEFAULT_VERIFY_TEMPLATE.footer;

  document.getElementById('verify-title-input').value = title;
  document.getElementById('verify-content-input').value = content;
  document.getElementById('verify-footer-input').value = footer;

  updateVerifyPreview();
}

// Update the Discord verification embed simulator in real-time
function updateVerifyPreview() {
  const title = document.getElementById('verify-title-input').value;
  let content = document.getElementById('verify-content-input').value;
  const footer = document.getElementById('verify-footer-input').value;

  const serverName = serverState?.guild?.name || 'AION 2 Server';
  content = content.replace(/{server}/g, serverName);

  const simTitle = document.getElementById('sim-verify-title');
  const simDesc = document.getElementById('sim-verify-desc');
  const simFooter = document.getElementById('sim-verify-footer');

  if (simTitle) simTitle.textContent = title || '🛡️ Maiev — AION 2 IGN Verification';
  if (simDesc) simDesc.innerHTML = formatDiscordMarkdown(content);
  if (simFooter) simFooter.textContent = footer || 'Maiev Verification System • AION 2';
}

// Render Personalized Post-Verification Welcome Popup Editor
function renderWelcomeEditor(cfg) {
  const title = cfg.welcomeTitle || DEFAULT_WELCOME_TEMPLATE.title;
  const content = cfg.welcomeContent || DEFAULT_WELCOME_TEMPLATE.content;
  const footer = cfg.welcomeFooter || DEFAULT_WELCOME_TEMPLATE.footer;

  document.getElementById('welcome-title-input').value = title;
  document.getElementById('welcome-content-input').value = content;
  document.getElementById('welcome-footer-input').value = footer;
}

// Render Public Welcome Channel Announcement Editor
function renderWelcomeAnnouncementEditor(cfg) {
  const check = document.getElementById('check-enable-welcome-announcement');
  const textarea = document.getElementById('welcome-announcement-input');

  if (check) check.checked = cfg.enableWelcomeAnnouncement !== false;
  if (textarea) textarea.value = cfg.welcomeAnnouncementMessage || DEFAULT_WELCOME_ANNOUNCEMENT_TEMPLATE;

  updateWelcomeAnnouncementPreview();
}

// Update simulated public welcome announcement
function updateWelcomeAnnouncementPreview() {
  const textarea = document.getElementById('welcome-announcement-input');
  const template = textarea?.value || DEFAULT_WELCOME_ANNOUNCEMENT_TEMPLATE;
  const serverName = serverState?.guild?.name || 'AION 2 Server';

  const preview = template
    .replace(/{server}/g, serverName)
    .replace(/{user}/g, '@DaevaPlayer')
    .replace(/{ign}/g, 'DaevaLegend')
    .replace(/{flag}/g, '🇵🇭')
    .replace(/{nationality}/g, 'Philippines');

  const descEl = document.getElementById('sim-welcome-announcement-desc');
  const authorEl = document.getElementById('sim-welcome-announcement-author');
  const footerEl = document.getElementById('sim-welcome-announcement-footer');

  if (descEl) descEl.innerHTML = formatDiscordMarkdown(preview);
  if (authorEl) authorEl.textContent = `${serverName} • New Daeva Arrival`;
  if (footerEl) footerEl.textContent = `${serverName} • Welcome Channel`;
}

// Render Nationality Roles Manager
function renderNationalityRolesManager(data) {
  currentNationalityRoles = Array.isArray(data.config?.nationalityRoles)
    ? [...data.config.nationalityRoles]
    : [
        { code: 'ph', name: 'Philippines', emoji: '🇵🇭', roleId: '' },
        { code: 'jp', name: 'Japan', emoji: '🇯🇵', roleId: '' },
        { code: 'global', name: 'Global / Other', emoji: '🌐', roleId: '' }
      ];

  // Populate Add Custom Nationality role dropdown
  const newRoleSelect = document.getElementById('new-nat-role');
  if (newRoleSelect) {
    newRoleSelect.innerHTML = '<option value="">-- Choose Role --</option>';
    const roles = data.guild?.roles || [];
    roles.forEach(r => {
      if (r.name === '@everyone') return;
      const opt = document.createElement('option');
      opt.value = r.id;
      opt.textContent = `@${r.name}`;
      newRoleSelect.appendChild(opt);
    });
  }

  renderNationalityRolesList();
  renderSimFlagPills();

  // Populate Nationality Embed Editor
  const natTitleInput = document.getElementById('nationality-title-input');
  const natContentInput = document.getElementById('nationality-content-input');
  const natFooterInput = document.getElementById('nationality-footer-input');
  if (natTitleInput) natTitleInput.value = data.config?.nationalityTitle || DEFAULT_NATIONALITY_TEMPLATE.title;
  if (natContentInput) natContentInput.value = data.config?.nationalityContent || '';
  if (natFooterInput) natFooterInput.value = data.config?.nationalityFooter || DEFAULT_NATIONALITY_TEMPLATE.footer;

  updateNationalityPreview();
}

// Update the Nationality Embed simulator preview in real-time
function updateNationalityPreview() {
  const title = document.getElementById('nationality-title-input')?.value || DEFAULT_NATIONALITY_TEMPLATE.title;
  const rawContent = document.getElementById('nationality-content-input')?.value || '';
  const footer = document.getElementById('nationality-footer-input')?.value || DEFAULT_NATIONALITY_TEMPLATE.footer;
  const serverName = serverState?.guild?.name || 'AION 2 Server';

  const simTitle = document.getElementById('sim-nationality-title');
  const simDesc = document.getElementById('sim-nationality-desc');
  const simFooter = document.getElementById('sim-nationality-footer');
  const simButtons = document.getElementById('sim-nationality-buttons-container');
  const simReactions = document.getElementById('sim-nationality-reactions-container');

  if (simTitle) simTitle.textContent = title;
  if (simFooter) simFooter.textContent = footer;

  let descHtml = '';
  if (rawContent && rawContent.trim()) {
    descHtml = formatDiscordMarkdown(rawContent.replace(/{server}/g, serverName));
  } else {
    const list = (currentNationalityRoles || []).filter(n => n && n.name);
    const listStr = list.length > 0
      ? list.map(n => `${n.emoji} <strong>${n.name}</strong> (<code>${(n.code || '').toUpperCase()}</code>)`).join('<br>')
      : '🇵🇭 <strong>Philippines</strong> (<code>PH</code>)<br>🇯🇵 <strong>Japan</strong> (<code>JP</code>)<br>🌐 <strong>Global / Other</strong> (<code>GLOBAL</code>)';

    descHtml = `Welcome to <strong>${serverName}</strong>!<br><br>` +
      `Please select your nationality flag below to unlock access to your regional legion channels:<br><br>` +
      `${listStr}<br><br>` +
      `━━━━━━━━━━━━━━━━━━━━━━━━━━━━<br>` +
      `👉 <strong>React with your flag emoji below</strong> to receive your nationality role!`;
  }
  if (simDesc) simDesc.innerHTML = descHtml;

  // Render emoji reaction pills in simulator
  if (simReactions) {
    simReactions.innerHTML = '';
    const activeNats = (currentNationalityRoles || []).filter(n => n && n.emoji);
    activeNats.forEach(item => {
      const pill = document.createElement('span');
      pill.className = 'sim-emoji-reaction';
      pill.style.cssText = 'background: rgba(255,255,255,0.07); border: 1px solid rgba(255,255,255,0.15); border-radius: 6px; padding: 3px 8px; font-size: 0.82rem; cursor: pointer; user-select: none;';
      pill.textContent = `${item.emoji} 1`;
      pill.title = `Click to simulate reacting with ${item.emoji}`;
      pill.addEventListener('click', () => {
        const feedback = document.getElementById('sim-nationality-feedback');
        if (feedback) {
          feedback.classList.remove('hidden');
          feedback.innerHTML = `✅ <strong>[Simulated Response]</strong> Reacted with ${item.emoji}! Role for <strong>${item.name}</strong> assigned!`;
        }
      });
      simReactions.appendChild(pill);
    });
  }
}

// Render the grid list of configured nationalities
function renderNationalityRolesList() {
  const container = document.getElementById('nationality-roles-container');
  if (!container) return;
  container.innerHTML = '';

  const roles = serverState?.guild?.roles || [];

  if (currentNationalityRoles.length === 0) {
    container.innerHTML = '<p class="text-muted" style="grid-column: 1/-1; padding: 12px;">No nationality flags configured yet. Use the form below to add flags for the countries you support!</p>';
    return;
  }

  currentNationalityRoles.forEach((item, index) => {
    const card = document.createElement('div');
    card.className = 'nat-card-item';

    let roleOptionsHtml = '<option value="">-- Link Server Role --</option>';
    roles.forEach(r => {
      if (r.name === '@everyone') return;
      const isSelected = r.id === item.roleId;
      roleOptionsHtml += `<option value="${r.id}" ${isSelected ? 'selected' : ''}>@${r.name}</option>`;
    });

    card.innerHTML = `
      <div class="nat-card-header">
        <div class="nat-identity">
          <span class="nat-flag">${item.emoji || '🌐'}</span>
          <span class="nat-name">${item.name}</span>
          <span class="nat-code">${(item.code || '').toUpperCase()}</span>
        </div>
        <button type="button" class="btn btn-sm btn-secondary btn-del-nat" title="Remove flag" style="padding: 2px 8px; font-size: 0.72rem; color: #ED4245;">
          ✕
        </button>
      </div>
      <div>
        <select class="form-select nat-role-select">
          ${roleOptionsHtml}
        </select>
      </div>
    `;

    // Role select change listener
    const selectEl = card.querySelector('.nat-role-select');
    selectEl.addEventListener('change', (e) => {
      currentNationalityRoles[index].roleId = e.target.value;
    });

    // Delete button listener
    const delBtn = card.querySelector('.btn-del-nat');
    delBtn.addEventListener('click', () => {
      currentNationalityRoles.splice(index, 1);
      renderNationalityRolesList();
      renderSimFlagPills();
      updateNationalityPreview();
      showToast(`Removed flag ${item.emoji} ${item.name}`, 'success');
    });

    container.appendChild(card);
  });
}

// Render flag pills inside the simulated Discord modal
function renderSimFlagPills() {
  const pillsContainer = document.getElementById('sim-flag-pills-container');
  if (!pillsContainer) return;
  pillsContainer.innerHTML = '';

  currentNationalityRoles.forEach(item => {
    const pill = document.createElement('button');
    pill.type = 'button';
    pill.className = 'flag-pill';
    pill.innerHTML = `<span>${item.emoji}</span> <span>${item.name}</span>`;
    pill.addEventListener('click', () => {
      document.getElementById('sim-modal-nat-input').value = item.emoji;
      document.querySelectorAll('.flag-pill').forEach(p => p.classList.remove('active'));
      pill.classList.add('active');
    });
    pillsContainer.appendChild(pill);
  });
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

// Render Diagnostics
function renderDiagnostics(data) {
  const perms = data.permissions || {};

  // Manage Roles
  const rolesDiag = document.getElementById('diag-manage-roles');
  if (perms.hasManageRoles) {
    rolesDiag.querySelector('.diag-status').textContent = '✅';
    rolesDiag.querySelector('.diag-subtext').textContent = 'Healthy: Maiev can manage server roles.';
  } else {
    rolesDiag.querySelector('.diag-status').textContent = '❌';
    rolesDiag.querySelector('.diag-subtext').textContent = 'Warning: Enable "Manage Roles" on Maiev in Server Settings > Roles.';
  }

  // Manage Nicknames
  const nicksDiag = document.getElementById('diag-manage-nicknames');
  if (perms.hasManageNicknames) {
    nicksDiag.querySelector('.diag-status').textContent = '✅';
    nicksDiag.querySelector('.diag-subtext').textContent = 'Healthy: Maiev can update nicknames.';
  } else {
    nicksDiag.querySelector('.diag-status').textContent = '❌';
    nicksDiag.querySelector('.diag-subtext').textContent = 'Warning: Enable "Manage Nicknames" on Maiev.';
  }

  // Hierarchy
  const hierDiag = document.getElementById('diag-hierarchy');
  hierDiag.querySelector('.diag-status').textContent = '✅';
  hierDiag.querySelector('.diag-subtext').textContent = `Bot highest role position: ${perms.rolePosition || 'Top'}. Ensure it is above member roles.`;
}

// Fetch member roster
async function fetchMembers() {
  try {
    const res = await fetch('/api/members');
    if (!res.ok) return;
    const members = await res.json();
    const tbody = document.getElementById('members-table-body');
    tbody.innerHTML = '';

    if (members.length === 0) {
      tbody.innerHTML = '<tr><td colspan="3" class="text-center py-4 text-muted">No members cached yet.</td></tr>';
      return;
    }

    members.forEach(m => {
      const tr = document.createElement('tr');
      const rolesHtml = m.roles.map(r => `<span class="role-badge" style="background: rgba(88, 101, 242, 0.2); border: 1px solid rgba(88, 101, 242, 0.4);">@${r}</span>`).join(' ');
      tr.innerHTML = `
        <td><strong>${m.username}</strong></td>
        <td><span style="color: #00d2ff;">${m.nickname || m.username}</span></td>
        <td>${rolesHtml || '<span class="text-muted">No Roles</span>'}</td>
      `;
      tbody.appendChild(tr);
    });
  } catch (err) {
    console.error('Error fetching members:', err);
  }
}

// Event Listeners Setup
function setupEventListeners() {
  // Live input listening on personalized rules fields
  const titleInput = document.getElementById('rules-title-input');
  const contentInput = document.getElementById('rules-content-input');
  const footerInput = document.getElementById('rules-footer-input');

  titleInput.addEventListener('input', updateRulesPreview);
  contentInput.addEventListener('input', updateRulesPreview);
  footerInput.addEventListener('input', updateRulesPreview);

  // Live input listening on personalized verification embed fields
  const verifyTitleInput = document.getElementById('verify-title-input');
  const verifyContentInput = document.getElementById('verify-content-input');
  const verifyFooterInput = document.getElementById('verify-footer-input');

  verifyTitleInput.addEventListener('input', updateVerifyPreview);
  verifyContentInput.addEventListener('input', updateVerifyPreview);
  verifyFooterInput.addEventListener('input', updateVerifyPreview);

  // Live input listening on public welcome announcement
  const welcomeAnnounceInput = document.getElementById('welcome-announcement-input');
  if (welcomeAnnounceInput) {
    welcomeAnnounceInput.addEventListener('input', updateWelcomeAnnouncementPreview);
  }

  // Reset Rules Template Button
  document.getElementById('btn-reset-rules-template').addEventListener('click', () => {
    titleInput.value = DEFAULT_RULES_TEMPLATE.title;
    contentInput.value = DEFAULT_RULES_TEMPLATE.content;
    footerInput.value = DEFAULT_RULES_TEMPLATE.footer;
    updateRulesPreview();
    showToast('Reset rules editor to standard AION 2 template!', 'success');
  });

  // Reset Verification Template Button
  document.getElementById('btn-reset-verify-template').addEventListener('click', () => {
    verifyTitleInput.value = DEFAULT_VERIFY_TEMPLATE.title;
    verifyContentInput.value = DEFAULT_VERIFY_TEMPLATE.content;
    verifyFooterInput.value = DEFAULT_VERIFY_TEMPLATE.footer;
    updateVerifyPreview();
    showToast('Reset verification editor to standard template!', 'success');
  });

  // Reset Welcome Card Template Button
  document.getElementById('btn-reset-welcome-template').addEventListener('click', () => {
    document.getElementById('welcome-title-input').value = DEFAULT_WELCOME_TEMPLATE.title;
    document.getElementById('welcome-content-input').value = DEFAULT_WELCOME_TEMPLATE.content;
    document.getElementById('welcome-footer-input').value = DEFAULT_WELCOME_TEMPLATE.footer;
    showToast('Reset welcome popup card to standard template!', 'success');
  });

  // Reset Public Welcome Announcement Template Button
  const btnResetAnnounce = document.getElementById('btn-reset-welcome-announcement-template');
  if (btnResetAnnounce) {
    btnResetAnnounce.addEventListener('click', () => {
      document.getElementById('welcome-announcement-input').value = DEFAULT_WELCOME_ANNOUNCEMENT_TEMPLATE;
      updateWelcomeAnnouncementPreview();
      showToast('Reset public welcome announcement to standard template!', 'success');
    });
  }

  // Add Custom Nationality Button
  const btnAddNat = document.getElementById('btn-add-nationality');
  if (btnAddNat) {
    btnAddNat.addEventListener('click', () => {
      const emojiInput = document.getElementById('new-nat-emoji');
      const nameInput = document.getElementById('new-nat-name');
      const codeInput = document.getElementById('new-nat-code');
      const roleSelect = document.getElementById('new-nat-role');

      const emoji = emojiInput.value.trim();
      const name = nameInput.value.trim();
      const code = (codeInput.value.trim() || name.slice(0, 3)).toLowerCase();
      const roleId = roleSelect.value;

      if (!emoji || !name) {
        showToast('Please provide at least a flag emoji and country name.', 'error');
        return;
      }

      currentNationalityRoles.push({ emoji, name, code, roleId });
      emojiInput.value = '';
      nameInput.value = '';
      codeInput.value = '';
      roleSelect.value = '';

      renderNationalityRolesList();
      renderSimFlagPills();
      updateNationalityPreview();
      showToast(`Added ${emoji} ${name}! Click Save Configuration to apply.`, 'success');
    });
  }

  // Send Test Public Welcome Announcement Button
  const btnTestWelcome = document.getElementById('btn-test-welcome-announcement');
  if (btnTestWelcome) {
    btnTestWelcome.addEventListener('click', async () => {
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
        showToast('🚀 Test welcome announcement sent to Discord!', 'success');
      } catch (err) {
        showToast(`❌ Error: ${err.message}`, 'error');
      }
    });
  }

  // Post Nationality Roles Card Button
  const btnPostNatRoles = document.getElementById('btn-post-nationality-roles-channel');
  if (btnPostNatRoles) {
    btnPostNatRoles.addEventListener('click', async () => {
      const channelId = document.getElementById('select-nationality-roles-channel').value;
      if (!channelId) {
        showToast('Please select a channel to post the nationality reaction embed.', 'error');
        return;
      }
      postEmbed('/api/post-nationality-roles', channelId, 'Nationality reaction roles embed posted to Discord!');
    });
  }

  // Refresh Button
  document.getElementById('btn-refresh').addEventListener('click', () => {
    fetchServerState();
    showToast('Refreshed live data from Discord!', 'success');
  });

  // Live input listening on personalized nationality embed fields
  const natTitleInput = document.getElementById('nationality-title-input');
  const natContentInput = document.getElementById('nationality-content-input');
  const natFooterInput = document.getElementById('nationality-footer-input');
  if (natTitleInput) natTitleInput.addEventListener('input', updateNationalityPreview);
  if (natContentInput) natContentInput.addEventListener('input', updateNationalityPreview);
  if (natFooterInput) natFooterInput.addEventListener('input', updateNationalityPreview);

  // Reset Nationality Template Button
  const btnResetNat = document.getElementById('btn-reset-nationality-template');
  if (btnResetNat) {
    btnResetNat.addEventListener('click', () => {
      if (natTitleInput) natTitleInput.value = DEFAULT_NATIONALITY_TEMPLATE.title;
      if (natContentInput) natContentInput.value = DEFAULT_NATIONALITY_TEMPLATE.content;
      if (natFooterInput) natFooterInput.value = DEFAULT_NATIONALITY_TEMPLATE.footer;
      updateNationalityPreview();
      showToast('Reset nationality embed editor to standard template!', 'success');
    });
  }

  // Save Configuration (includes rules, verification, welcome popup, public announcement, and nationality roles!)
  document.getElementById('btn-save-config').addEventListener('click', async () => {
    const onboardedRoleId = document.getElementById('select-onboarded-role').value;
    const rulesChannelId = document.getElementById('select-rules-channel').value;
    const verifyChannelId = document.getElementById('select-verify-channel').value;

    const ignRolesToAdd = Array.from(document.querySelectorAll('input[name="role_add"]:checked')).map(el => el.value);
    const ignRolesToRemove = Array.from(document.querySelectorAll('input[name="role_remove"]:checked')).map(el => el.value);

    const rulesTitle = titleInput.value.trim();
    const rulesContent = contentInput.value.trim();
    const rulesFooter = footerInput.value.trim();

    const verifyTitle = verifyTitleInput.value.trim();
    const verifyContent = verifyContentInput.value.trim();
    const verifyFooter = verifyFooterInput.value.trim();

    const welcomeTitle = document.getElementById('welcome-title-input').value.trim();
    const welcomeContent = document.getElementById('welcome-content-input').value.trim();
    const welcomeFooter = document.getElementById('welcome-footer-input').value.trim();

    const welcomeAnnouncementChannelId = document.getElementById('select-welcome-channel')?.value || '';
    const enableWelcomeAnnouncement = document.getElementById('check-enable-welcome-announcement')?.checked !== false;
    const welcomeAnnouncementMessage = document.getElementById('welcome-announcement-input')?.value.trim() || '';

    const nationalityTitle = natTitleInput?.value.trim() || DEFAULT_NATIONALITY_TEMPLATE.title;
    const nationalityContent = natContentInput?.value.trim() || '';
    const nationalityFooter = natFooterInput?.value.trim() || DEFAULT_NATIONALITY_TEMPLATE.footer;

    try {
      const res = await fetch('/api/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
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
          nationalityRoles: currentNationalityRoles
        })
      });

      if (!res.ok) throw new Error('Save failed');
      const result = await res.json();
      showToast('🎉 All settings, welcome announcement & nationality roles saved successfully!', 'success');
      updateFunnelLabels();
    } catch (err) {
      showToast('❌ Error saving configuration.', 'error');
    }
  });

  // Post Rules Embed Button
  document.getElementById('btn-post-rules-channel').addEventListener('click', async () => {
    const channelId = document.getElementById('select-rules-channel').value;
    if (!channelId) {
      showToast('Please select a rules channel first.', 'error');
      return;
    }
    postEmbed('/api/post-rules', channelId, 'Personalized Rules card posted successfully to Discord!');
  });

  // Post Verify Embed Button
  document.getElementById('btn-post-verify-channel').addEventListener('click', async () => {
    const channelId = document.getElementById('select-verify-channel').value;
    if (!channelId) {
      showToast('Please select a verification channel first.', 'error');
      return;
    }
    postEmbed('/api/post-verify', channelId, 'AION 2 Verification card posted successfully!');
  });

  // Simulator Tab Switch
  const rulesTab = document.getElementById('tab-rules-btn');
  const verifyTab = document.getElementById('tab-verify-btn');
  const welcomeTab = document.getElementById('tab-welcome-announcement-btn');
  const natTab = document.getElementById('tab-nationality-btn');

  const rulesView = document.getElementById('sim-rules-view');
  const verifyView = document.getElementById('sim-verify-view');
  const welcomeView = document.getElementById('sim-welcome-announcement-view');
  const natView = document.getElementById('sim-nationality-view');
  const simChanName = document.getElementById('sim-channel-name');

  rulesTab.addEventListener('click', () => {
    rulesTab.classList.add('active');
    verifyTab.classList.remove('active');
    if (welcomeTab) welcomeTab.classList.remove('active');
    if (natTab) natTab.classList.remove('active');
    rulesView.classList.remove('hidden');
    verifyView.classList.add('hidden');
    if (welcomeView) welcomeView.classList.add('hidden');
    if (natView) natView.classList.add('hidden');
    simChanName.textContent = 'rules';
  });

  verifyTab.addEventListener('click', () => {
    verifyTab.classList.add('active');
    rulesTab.classList.remove('active');
    if (welcomeTab) welcomeTab.classList.remove('active');
    if (natTab) natTab.classList.remove('active');
    verifyView.classList.remove('hidden');
    rulesView.classList.add('hidden');
    if (welcomeView) welcomeView.classList.add('hidden');
    if (natView) natView.classList.add('hidden');
    simChanName.textContent = 'verify-ign';
  });

  if (welcomeTab) {
    welcomeTab.addEventListener('click', () => {
      welcomeTab.classList.add('active');
      rulesTab.classList.remove('active');
      verifyTab.classList.remove('active');
      if (natTab) natTab.classList.remove('active');
      if (welcomeView) welcomeView.classList.remove('hidden');
      rulesView.classList.add('hidden');
      verifyView.classList.add('hidden');
      if (natView) natView.classList.add('hidden');
      simChanName.textContent = 'welcome';
    });
  }

  if (natTab) {
    natTab.addEventListener('click', () => {
      natTab.classList.add('active');
      rulesTab.classList.remove('active');
      verifyTab.classList.remove('active');
      if (welcomeTab) welcomeTab.classList.remove('active');
      if (natView) natView.classList.remove('hidden');
      rulesView.classList.add('hidden');
      verifyView.classList.add('hidden');
      if (welcomeView) welcomeView.classList.add('hidden');
      simChanName.textContent = 'nationality-roles';
    });
  }

  // Simulator: Click "I Agree to Rules"
  document.getElementById('sim-btn-accept-rules').addEventListener('click', () => {
    const onboardedRoleName = document.getElementById('select-onboarded-role').selectedOptions[0]?.text || '@Onboarded';
    const feedback = document.getElementById('sim-rules-feedback');
    feedback.classList.remove('hidden');
    feedback.innerHTML = `✅ <strong>[Simulated Response]</strong> Rules Acknowledged! Member received <strong>${onboardedRoleName}</strong>. Channel <strong>#verify-ign</strong> is now unlocked!`;
  });

  // Simulator: Open Modal
  const modalBackdrop = document.getElementById('sim-modal-backdrop');
  document.getElementById('sim-btn-open-modal').addEventListener('click', () => {
    modalBackdrop.classList.remove('hidden');
  });

  // Simulator: Close Modal
  document.getElementById('sim-modal-close').addEventListener('click', () => modalBackdrop.classList.add('hidden'));
  document.getElementById('sim-modal-cancel').addEventListener('click', () => modalBackdrop.classList.add('hidden'));

  // Simulator: Submit Modal
  document.getElementById('sim-modal-submit').addEventListener('click', () => {
    const ign = document.getElementById('sim-modal-ign-input').value.trim() || 'DaevaLegend';
    modalBackdrop.classList.add('hidden');

    const serverName = serverState?.guild?.name || 'AION 2 Server';
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
        <div style="margin-top: 8px; font-size: 0.76rem; color: #57F287;">
          📢 <em>Public Welcome sent to #${document.getElementById('select-welcome-channel')?.selectedOptions[0]?.text || 'welcome'} mentioning you!</em>
        </div>
      </div>
    `;

    // Also update simulated welcome announcement view
    const announceDesc = document.getElementById('sim-welcome-announcement-desc');
    if (announceDesc) {
      const template = document.getElementById('welcome-announcement-input')?.value || DEFAULT_WELCOME_ANNOUNCEMENT_TEMPLATE;
      announceDesc.innerHTML = formatDiscordMarkdown(
        template
          .replace(/{server}/g, serverName)
          .replace(/{user}/g, '@DaevaPlayer')
          .replace(/{ign}/g, ign)
          .replace(/{roles}/g, '@Unverified, @Elyos Fregion')
      );
    }
  });
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
    showToast(`🚀 ${successMessage}`, 'success');
  } catch (err) {
    showToast(`❌ Error: ${err.message}`, 'error');
  }
}

// Helper: Toast Notification
function showToast(message, type = 'success') {
  const toast = document.getElementById('toast-banner');
  const text = document.getElementById('toast-message');
  text.textContent = message;
  toast.className = `toast-banner ${type}`;
  setTimeout(() => {
    toast.className = 'toast-banner hidden';
  }, 4500);
}

// Helper: Update top funnel text
function updateFunnelLabels() {
  const onboardedText = document.getElementById('select-onboarded-role').selectedOptions[0]?.text;
  if (onboardedText && onboardedText !== '-- Select Onboarded Role --') {
    document.getElementById('funnel-onboarded-label').textContent = onboardedText;
  }
}
