/**
 * Maiev Bot Control Center — Client Application
 */

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
  // Refresh Button
  document.getElementById('btn-refresh').addEventListener('click', () => {
    fetchServerState();
    showToast('Refreshed live data from Discord!', 'success');
  });

  // Save Configuration
  document.getElementById('btn-save-config').addEventListener('click', async () => {
    const onboardedRoleId = document.getElementById('select-onboarded-role').value;
    const rulesChannelId = document.getElementById('select-rules-channel').value;
    const verifyChannelId = document.getElementById('select-verify-channel').value;

    const ignRolesToAdd = Array.from(document.querySelectorAll('input[name="role_add"]:checked')).map(el => el.value);
    const ignRolesToRemove = Array.from(document.querySelectorAll('input[name="role_remove"]:checked')).map(el => el.value);

    try {
      const res = await fetch('/api/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          onboardedRoleId,
          ignRolesToAdd,
          ignRolesToRemove,
          rulesChannelId,
          verifyChannelId
        })
      });

      if (!res.ok) throw new Error('Save failed');
      const result = await res.json();
      showToast('🎉 Configuration saved successfully and synced with Maiev!', 'success');
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
    postEmbed('/api/post-rules', channelId, 'Rules card posted successfully!');
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

    const addRoleLabels = Array.from(document.querySelectorAll('input[name="role_add"]:checked'))
      .map(el => el.parentElement.textContent.trim()).join(' and ') || '@Unverified and @Elyos Fregion';

    const removeRoleLabels = Array.from(document.querySelectorAll('input[name="role_remove"]:checked'))
      .map(el => el.parentElement.textContent.trim()).join(', ') || '@Onboarded';

    const feedback = document.getElementById('sim-verify-feedback');
    feedback.classList.remove('hidden');
    feedback.innerHTML = `
      🎉 <strong>[Simulated Response] Verification Complete!</strong><br>
      • Nickname updated to: <strong>${ign}</strong><br>
      • Roles Granted: <strong>${addRoleLabels}</strong><br>
      • Role Removed: <strong>${removeRoleLabels}</strong> (Channel #verify-ign disappeared)<br>
      📸 Exclusive community channels now unlocked!
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
