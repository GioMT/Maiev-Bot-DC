/**
 * Maiev Bot Control Center — Client Application
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

• **Roles Granted:** **[Unverified]** and **[Elyos Fregion]**
• **Channel Updated:** **#verify-ign** has been closed

📸 **Next Step:** The exclusive community channels are now unlocked! Please post your character screenshot in the verification channel for staff approval.`,
  footer: '{server} • AION 2 Elyos Legion'
};

let serverState = null;

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

  rulesSelect.innerHTML = '<option value="">-- Select Channel --</option>';
  verifySelect.innerHTML = '<option value="">-- Select Channel --</option>';

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

  // Refresh Button
  document.getElementById('btn-refresh').addEventListener('click', () => {
    fetchServerState();
    showToast('Refreshed live data from Discord!', 'success');
  });

  // Save Configuration (includes rules, verification, and welcome popup embeds!)
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
          welcomeFooter
        })
      });

      if (!res.ok) throw new Error('Save failed');
      const result = await res.json();
      showToast('🎉 Configuration, Rules, & Welcome Popup Card saved successfully!', 'success');
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
  const rulesView = document.getElementById('sim-rules-view');
  const verifyView = document.getElementById('sim-verify-view');
  const simChanName = document.getElementById('sim-channel-name');

  rulesTab.addEventListener('click', () => {
    rulesTab.classList.add('active');
    verifyTab.classList.remove('active');
    rulesView.classList.remove('hidden');
    verifyView.classList.add('hidden');
    simChanName.textContent = 'rules';
  });

  verifyTab.addEventListener('click', () => {
    verifyTab.classList.add('active');
    rulesTab.classList.remove('active');
    verifyView.classList.remove('hidden');
    rulesView.classList.add('hidden');
    simChanName.textContent = 'verify-ign';
  });

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
      .replace(/{server}/g, serverName).replace(/{ign}/g, ign);
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
      </div>
    `;
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
