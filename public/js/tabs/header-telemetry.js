import { state } from '../state.js?v=7.5';
import { adjustServerInputWidth, refreshIcons, showToast } from '../utils.js?v=7.5';
import { persistServerName, scheduleAutoSave } from '../api.js?v=7.5';
import { updateRulesPreview } from './rules-tab.js?v=7.5';
import { updateVerifyPreview } from './verify-tab.js?v=7.5';
import { renderUserVerifyRoleCheckboxes, updateUserVerifyPreview } from './user-verify-tab.js?v=7.5';
import { updateWelcomeAnnouncementPreview } from './welcome-tab.js?v=7.5';
import { updateNationalityPreview } from './reaction-roles-tab.js?v=7.5';
import { renderBossTimerChannelDropdowns, updateBossTimerPreview } from './boss-timer-tab.js?v=7.5';
import { renderAlertsChannelAndRoleDropdowns, updateAlertsPreview } from './alerts-tab.js?v=7.5';

const MODULE_TITLES = {
  'tab-modules-hub': 'All Modules',
  'tab-rules': 'Rules Onboarding',
  'tab-verify': 'IGN Verification',
  'tab-user-verify': 'Video Verification',
  'tab-welcome': 'Public Welcome',
  'tab-reaction-roles': 'Reaction Roles',
  'tab-boss-timer': 'Field Boss Timer',
  'tab-alerts': 'Scheduled Alerts',
  'tab-health': 'Diagnostics',
  'tab-roster': 'Server Roster'
};

export function setupTabs() {
  const tabButtons = document.querySelectorAll('.main-tab-btn');
  const tabPanes = document.querySelectorAll('.tab-pane');
  const savedTab = localStorage.getItem('maiev_active_tab') || 'tab-rules';
  const bcCurrent = document.getElementById('dyno-active-module-title');
  const bcModulesLink = document.getElementById('dyno-bc-modules-link');

  function activateTab(tabId) {
    if (!document.getElementById(tabId)) tabId = 'tab-rules';

    tabButtons.forEach(btn => {
      const isActive = btn.getAttribute('data-tab') === tabId;
      btn.classList.toggle('active', isActive);
      btn.setAttribute('aria-selected', isActive ? 'true' : 'false');
    });

    tabPanes.forEach(pane => {
      pane.classList.toggle('active', pane.id === tabId);
    });

    if (bcCurrent) {
      bcCurrent.textContent = MODULE_TITLES[tabId] || 'Module Settings';
    }

    localStorage.setItem('maiev_active_tab', tabId);
    refreshIcons();
  }

  tabButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      const tabId = btn.getAttribute('data-tab');
      activateTab(tabId);
    });
  });

  document.querySelectorAll('[data-open-tab]').forEach(btn => {
    btn.addEventListener('click', () => {
      const targetTab = btn.getAttribute('data-open-tab');
      if (targetTab) activateTab(targetTab);
    });
  });

  bcModulesLink?.addEventListener('click', () => {
    activateTab('tab-modules-hub');
  });

  activateTab(savedTab);
}

export function renderHeaderTelemetry(data) {
  if (data.avatar) {
    document.getElementById('bot-avatar').src = data.avatar;
    document.getElementById('sim-bot-avatar-1').src = data.avatar;
    document.getElementById('sim-bot-avatar-2').src = data.avatar;
    const simAvatar3 = document.getElementById('sim-bot-avatar-3');
    if (simAvatar3) simAvatar3.src = data.avatar;
    const simAvatar4 = document.getElementById('sim-bot-avatar-4');
    if (simAvatar4) simAvatar4.src = data.avatar;
    const simAvatar5 = document.getElementById('sim-bot-avatar-5');
    if (simAvatar5) simAvatar5.src = data.avatar;
    const simAvatar6 = document.getElementById('sim-bot-avatar-6');
    if (simAvatar6) simAvatar6.src = data.avatar;
    const simAvatar7 = document.getElementById('sim-bot-avatar-7');
    if (simAvatar7) simAvatar7.src = data.avatar;
    const simAvatar8 = document.getElementById('sim-bot-avatar-8');
    if (simAvatar8) simAvatar8.src = data.avatar;
    const simAvatar9 = document.getElementById('sim-bot-avatar-9');
    if (simAvatar9) simAvatar9.src = data.avatar;
    const simAvatar10 = document.getElementById('sim-bot-avatar-10');
    if (simAvatar10) simAvatar10.src = data.avatar;
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
  const sidebarServerName = document.getElementById('dyno-sidebar-server-name');
  if (sidebarServerName) sidebarServerName.textContent = sName;
  const sidebarAvatar = document.getElementById('dyno-sidebar-avatar');
  if (sidebarAvatar && (data.guild?.icon || data.avatar)) {
    sidebarAvatar.src = data.guild?.icon || data.avatar;
  }

  document.getElementById('member-count').textContent = data.guild?.memberCount || '--';
}

export function renderRoleDropdowns(data) {
  const roles = data.guild?.roles || [];
  const currentConfig = data.config || {};

  roles.sort((a, b) => b.position - a.position);

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

  onboardedSelect.onchange = () => scheduleAutoSave(250);

  // Render Instant Auto-Role on Join Checkboxes
  const autoJoinContainer = document.getElementById('roles-auto-join-container');
  const autoJoinCountBadge = document.getElementById('auto-join-roles-count');
  if (autoJoinContainer) {
    autoJoinContainer.innerHTML = '';
    const selectedAutoJoin = Array.isArray(currentConfig.autoJoinRoleIds) ? currentConfig.autoJoinRoleIds : [];
    if (autoJoinCountBadge) {
      autoJoinCountBadge.textContent = `${selectedAutoJoin.length} Selected`;
    }

    roles.forEach(role => {
      if (role.name === '@everyone') return;
      const label = document.createElement('label');
      label.className = 'role-checkbox-item';
      const isChecked = selectedAutoJoin.includes(role.id);
      label.innerHTML = `
        <input type="checkbox" name="role_auto_join" value="${role.id}" ${isChecked ? 'checked' : ''}>
        <span class="role-name">@${role.name}</span>
      `;
      label.querySelector('input')?.addEventListener('change', () => {
        const count = document.querySelectorAll('input[name="role_auto_join"]:checked').length;
        if (autoJoinCountBadge) autoJoinCountBadge.textContent = `${count} Selected`;
        scheduleAutoSave(250);
      });
      autoJoinContainer.appendChild(label);
    });
  }

  const addContainer = document.getElementById('roles-to-add-container');
  addContainer.innerHTML = '';

  const removeContainer = document.getElementById('roles-to-remove-container');
  removeContainer.innerHTML = '';

  const defaultAdd = Array.isArray(currentConfig.ignRolesToAdd) ? currentConfig.ignRolesToAdd : [];
  const defaultRemove = Array.isArray(currentConfig.ignRolesToRemove) ? currentConfig.ignRolesToRemove : [];
  const hasExplicitAddArray = Array.isArray(currentConfig.ignRolesToAdd);
  const hasExplicitRemoveArray = Array.isArray(currentConfig.ignRolesToRemove);

  roles.forEach(role => {
    if (role.name === '@everyone') return;

    const addLabel = document.createElement('label');
    addLabel.className = 'role-checkbox-item';
    const isAddChecked = defaultAdd.includes(role.id) ||
      (!hasExplicitAddArray && (role.name.includes('Unverified') || role.name.includes('Elyos')));

    addLabel.innerHTML = `
      <input type="checkbox" name="role_add" value="${role.id}" ${isAddChecked ? 'checked' : ''}>
      <span class="role-name">@${role.name}</span>
    `;
    addLabel.querySelector('input')?.addEventListener('change', () => scheduleAutoSave(250));
    addContainer.appendChild(addLabel);

    const removeLabel = document.createElement('label');
    removeLabel.className = 'role-checkbox-item';
    const isRemoveChecked = defaultRemove.includes(role.id) ||
      (!hasExplicitRemoveArray && (role.name.includes('Compliant') || role.name.includes('Onboard')));

    removeLabel.innerHTML = `
      <input type="checkbox" name="role_remove" value="${role.id}" ${isRemoveChecked ? 'checked' : ''}>
      <span class="role-name">@${role.name}</span>
    `;
    removeLabel.querySelector('input')?.addEventListener('change', () => scheduleAutoSave(250));
    removeContainer.appendChild(removeLabel);
  });

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

  renderUserVerifyRoleCheckboxes(data);
}

export function updateSimChannelHeaders() {
  const rName = document.getElementById('select-rules-channel')?.selectedOptions[0]?.text?.replace('#', '') || 'rules';
  const vName = document.getElementById('select-verify-channel')?.selectedOptions[0]?.text?.replace('#', '') || 'identity-verification';
  const uvName = document.getElementById('select-user-verify-channel')?.selectedOptions[0]?.text?.replace('#', '') || 'user-verify';
  const uvStaffName = document.getElementById('select-user-verify-staff-channel')?.selectedOptions[0]?.text?.replace('#', '') || 'verify-reviews';
  const wName = document.getElementById('select-welcome-channel')?.selectedOptions[0]?.text?.replace('#', '') || 'welcome';
  const nName = document.getElementById('select-nationality-roles-channel')?.selectedOptions[0]?.text?.replace('#', '') || 'roles';

  const elR = document.getElementById('sim-rules-channel-name');
  if (elR) elR.textContent = rName;
  const elV = document.getElementById('sim-verify-channel-name');
  if (elV) elV.textContent = vName;
  const elUV = document.getElementById('sim-uverify-channel-name');
  if (elUV && !uvName.includes('--')) elUV.textContent = uvName;
  const elUVStaff = document.getElementById('sim-uverify-staff-channel-name');
  if (elUVStaff) elUVStaff.textContent = uvStaffName.includes('--') ? 'verify-reviews' : uvStaffName;
  const elW = document.getElementById('sim-welcome-channel-name');
  if (elW) elW.textContent = wName;
  const elN = document.getElementById('sim-nationality-channel-name');
  if (elN) elN.textContent = nName;
}

export function renderChannelDropdowns(data) {
  const channels = data.guild?.channels || [];
  const currentConfig = data.config || {};

  const rulesSelect = document.getElementById('select-rules-channel');
  const verifySelect = document.getElementById('select-verify-channel');
  const userVerifySelect = document.getElementById('select-user-verify-channel');
  const userVerifyStaffSelect = document.getElementById('select-user-verify-staff-channel');
  const welcomeSelect = document.getElementById('select-welcome-channel');
  const natSelect = document.getElementById('select-nationality-roles-channel');

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

  populate(rulesSelect, currentConfig.rulesChannelId, 'rule');
  populate(verifySelect, currentConfig.verifyChannelId, 'verify');
  populate(userVerifySelect, currentConfig.userVerifyChannelId, 'user-verify');

  if (userVerifyStaffSelect) {
    userVerifyStaffSelect.innerHTML = '<option value="">-- Optional: In-Thread /review Only (No Staff Channel) --</option>';
    channels.forEach(ch => {
      const opt = document.createElement('option');
      opt.value = ch.id;
      opt.textContent = `#${ch.name}`;
      if (currentConfig.userVerifyStaffChannelId && ch.id === currentConfig.userVerifyStaffChannelId) {
        opt.selected = true;
      }
      userVerifyStaffSelect.appendChild(opt);
    });
  }

  populate(welcomeSelect, currentConfig.welcomeAnnouncementChannelId, 'welcome');
  populate(natSelect, currentConfig.nationalityChannelId, 'nation');
  renderBossTimerChannelDropdowns(channels);
  renderAlertsChannelAndRoleDropdowns(data);

  updateSimChannelHeaders();
  updateUserVerifyPreview();
  updateBossTimerPreview();
  updateAlertsPreview();

  if (rulesSelect) {
    rulesSelect.onchange = () => {
      updateSimChannelHeaders();
      scheduleAutoSave(250);
    };
  }
  if (verifySelect) {
    verifySelect.onchange = () => {
      updateSimChannelHeaders();
      scheduleAutoSave(250);
    };
  }
  if (userVerifySelect) userVerifySelect.onchange = updateSimChannelHeaders;
  if (userVerifyStaffSelect) userVerifyStaffSelect.onchange = updateSimChannelHeaders;
  if (welcomeSelect) {
    welcomeSelect.onchange = () => {
      updateSimChannelHeaders();
      scheduleAutoSave(250);
    };
  }
  if (natSelect) natSelect.onchange = updateSimChannelHeaders;
}

export function setupServerNameEditing() {
  const serverInput = document.getElementById('server-name-input');
  if (!serverInput) return;

  const applyServerNameChange = (showNotice = false) => {
    const val = serverInput.value.trim() || 'Asia Fregion';
    if (!state.serverState) state.serverState = {};
    if (!state.serverState.guild) state.serverState.guild = {};
    state.serverState.guild.name = val;
    if (!state.serverState.config) state.serverState.config = {};
    state.serverState.config.serverName = val;

    const legacyEl = document.getElementById('server-name');
    if (legacyEl) legacyEl.textContent = val;
    const sidebarServerName = document.getElementById('dyno-sidebar-server-name');
    if (sidebarServerName) sidebarServerName.textContent = val;

    updateRulesPreview();
    updateVerifyPreview();
    updateUserVerifyPreview();
    updateWelcomeAnnouncementPreview();
    updateNationalityPreview();
    adjustServerInputWidth(serverInput);

    if (showNotice) {
      showToast(`Server name updated to "${val}"!`, 'success');
    }
  };

  serverInput.addEventListener('input', () => applyServerNameChange(false));
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

