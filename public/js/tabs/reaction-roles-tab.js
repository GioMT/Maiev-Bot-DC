import {
  DEFAULT_NATIONALITY_TEMPLATE,
  ROLE_PRESETS
} from '../presets.js?v=7.2';
import { state, getActiveServerName } from '../state.js?v=7.2';
import {
  formatDiscordMarkdown,
  extractFlagIsoCode,
  normalizeEmojiCode,
  renderEmojiHtml,
  refreshIcons,
  showToast
} from '../utils.js?v=7.2';
import { autoSaveNationalityRoles } from '../api.js?v=7.2';
import { setupDiscordEmojiPicker } from '../emoji-picker.js?v=7.2';

export function renderNationalityRolesManager(data) {
  const cfg = data.config || {};

  if (cfg.reactionPresets && Object.keys(cfg.reactionPresets).length > 0) {
    state.reactionPresets = JSON.parse(JSON.stringify(cfg.reactionPresets));
    if (state.reactionPresets.classes && (state.reactionPresets.classes.name === 'AION 2 Class Archetypes' || !state.reactionPresets.classes.name)) {
      state.reactionPresets.classes.name = 'Classes';
      state.reactionPresets.classes.category = 'Classes';
    }
    if (state.reactionPresets.nationality && (state.reactionPresets.nationality.name === 'Nationality & Regional Flags' || state.reactionPresets.nationality.name === 'Nationality & Region Flags' || !state.reactionPresets.nationality.name)) {
      state.reactionPresets.nationality.name = 'Region';
      state.reactionPresets.nationality.category = 'Region';
    }
    if (state.reactionPresets.nationality && state.reactionPresets.nationality.title === '💻 Select Your Gaming Platform') {
      state.reactionPresets.nationality.title = '🌍 Choose Your Region';
      state.reactionPresets.nationality.footer = 'React with a flag emoji below to toggle your region';
    }
  } else {
    state.reactionPresets = {};
    const roles = Array.isArray(cfg.nationalityRoles) ? [...cfg.nationalityRoles] : [];

    const classRoles = roles.filter(r => r.category === 'Classes' || r.category === 'AION 2 Class Archetypes' || ['templar', 'gladiator', 'ranger', 'assassin', 'sorcerer', 'spiritmaster', 'cleric', 'chanter'].includes(r.code));
    const natRoles = roles.filter(r => r.category === 'Region' || r.category === 'Nationality & Regional Flags' || r.category === 'Nationality & Region Flags' || ['ph', 'kr', 'jp', 'id', 'th', 'tw', 'cn', 'au', 'my', 'vn', 'intl'].includes(r.code));
    const notifRoles = roles.filter(r => r.category === 'Notification Alerts');
    const platRoles = roles.filter(r => r.category === 'Gaming Platforms');
    const otherRoles = roles.filter(r => !classRoles.includes(r) && !natRoles.includes(r) && !notifRoles.includes(r) && !platRoles.includes(r));

    if (classRoles.length > 0) {
      state.reactionPresets.classes = {
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
      state.reactionPresets.nationality = {
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
      state.reactionPresets.notifications = {
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
      state.reactionPresets.platforms = {
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
    if (otherRoles.length > 0 && Object.keys(state.reactionPresets).length === 0) {
      state.reactionPresets.custom = {
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

    if (Object.keys(state.reactionPresets).length === 0) {
      applyPreset('classes');
    }
  }

  if (Array.isArray(cfg.nationalityMessageIds)) {
    cfg.nationalityMessageIds.forEach(item => {
      const pId = typeof item === 'object' ? item.presetId : null;
      const mId = typeof item === 'object' ? item.messageId : item;
      const cId = typeof item === 'object' ? item.channelId : null;
      if (pId && state.reactionPresets[pId]) {
        state.reactionPresets[pId].messageId = mId;
        if (cId) state.reactionPresets[pId].channelId = cId;
      }
    });
  }

  const keys = Object.keys(state.reactionPresets);
  if (!keys.includes(state.activePresetId)) {
    state.activePresetId = keys[0] || 'classes';
  }

  renderReactionSubtabs();
  switchActivePreset(state.activePresetId);
  refreshIcons();
}

export function renderReactionSubtabs() {
  const container = document.getElementById('reaction-subtabs-list');
  if (!container) return;
  container.innerHTML = '';

  const keys = Object.keys(state.reactionPresets);
  if (keys.length === 0) {
    applyPreset('classes');
    return;
  }

  if (!state.reactionPresets[state.activePresetId]) {
    state.activePresetId = keys[0];
  }

  keys.forEach(key => {
    const preset = state.reactionPresets[key];
    const roleCount = (preset.roles || []).length;
    const isActive = key === state.activePresetId;

    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = `reaction-subtab-btn ${isActive ? 'active' : ''}`;
    btn.dataset.presetId = key;
    btn.innerHTML = `
      <span>${renderEmojiHtml(preset.icon || '🏷️')}</span>
      <span>${preset.name || key}</span>
      <span class="reaction-subtab-badge">${roleCount}</span>
      ${keys.length > 1 ? `<span class="reaction-subtab-close" data-close-preset="${key}" title="Remove preset tab">&times;</span>` : ''}
    `;

    btn.addEventListener('click', (e) => {
      const closeBtn = e.target.closest('[data-close-preset]');
      if (closeBtn) {
        e.stopPropagation();
        const toClose = closeBtn.dataset.closePreset;
        if (confirm(`Remove preset card "${state.reactionPresets[toClose]?.name || toClose}"?`)) {
          delete state.reactionPresets[toClose];
          const remainingKeys = Object.keys(state.reactionPresets);
          if (state.activePresetId === toClose) {
            state.activePresetId = remainingKeys[0] || 'classes';
          }
          if (remainingKeys.length === 0) {
            applyPreset('classes');
          } else {
            switchActivePreset(state.activePresetId);
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

export function switchActivePreset(presetId) {
  if (!state.reactionPresets[presetId]) {
    const keys = Object.keys(state.reactionPresets);
    if (keys.length > 0) presetId = keys[0];
    else return;
  }

  if (state.reactionPresets[state.activePresetId] && state.activePresetId !== presetId) {
    const tEl = document.getElementById('nationality-title-input');
    const cEl = document.getElementById('nationality-content-input');
    const fEl = document.getElementById('nationality-footer-input');
    const chEl = document.getElementById('select-nationality-roles-channel');
    if (tEl) state.reactionPresets[state.activePresetId].title = tEl.value;
    if (cEl) state.reactionPresets[state.activePresetId].content = cEl.value;
    if (fEl) state.reactionPresets[state.activePresetId].footer = fEl.value;
    if (chEl && chEl.value) state.reactionPresets[state.activePresetId].channelId = chEl.value;
  }

  state.activePresetId = presetId;
  const preset = state.reactionPresets[presetId];
  state.currentNationalityRoles = preset.roles || [];

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

  const nameLabel = document.getElementById('active-subtab-name-label');
  if (nameLabel) nameLabel.textContent = preset.name || presetId;

  const simBadge = document.getElementById('sim-active-preset-badge');
  if (simBadge) simBadge.textContent = preset.name || presetId;

  const postBtnText = document.getElementById('btn-post-label-text');
  if (postBtnText) {
    const shortName = (preset.name || 'Reaction').split(' ')[0];
    postBtnText.textContent = `Post ${shortName} Card`;
  }

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

  document.querySelectorAll('.reaction-subtab-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.presetId === presetId);
  });

  state.activeCategoryFilter = 'all';
  renderNationalityRolesList();
  updateNationalityPreview();
  refreshIcons();
}

export function updateNationalityPreview() {
  const serverName = getActiveServerName();
  const currentPreset = state.reactionPresets[state.activePresetId] || {};
  const simTitle = document.getElementById('sim-nationality-title');
  const simDesc = document.getElementById('sim-nationality-desc');
  const simFooter = document.getElementById('sim-nationality-footer');
  const simReactions = document.getElementById('sim-nationality-reactions-container');

  const rawTitle = document.getElementById('nationality-title-input')?.value || currentPreset.title || DEFAULT_NATIONALITY_TEMPLATE.title;
  const rawContent = document.getElementById('nationality-content-input')?.value !== undefined
    ? document.getElementById('nationality-content-input').value
    : (currentPreset.content || '');
  const rawFooter = document.getElementById('nationality-footer-input')?.value || currentPreset.footer || DEFAULT_NATIONALITY_TEMPLATE.footer;

  if (simTitle) simTitle.innerHTML = formatDiscordMarkdown(rawTitle.replace(/{server}/g, serverName));
  if (simFooter) simFooter.textContent = rawFooter.replace(/{server}/g, serverName);

  let descHtml = '';
  if (rawContent && rawContent.trim()) {
    descHtml = formatDiscordMarkdown(rawContent.replace(/{server}/g, serverName));
  } else {
    const list = (state.currentNationalityRoles || []).filter(n => n && n.name);
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
          return `${renderEmojiHtml(n.emoji)} <strong>${n.name}</strong>`;
        }).join('<br>');
        return `${catHeader}${items}`;
      }).join('<br>');
    } else {
      listStr = list.map(n => {
        return `${renderEmojiHtml(n.emoji)} <strong>${n.name}</strong>`;
      }).join('<br>');
    }

    descHtml = listStr;
  }
  if (simDesc) simDesc.innerHTML = descHtml;

  if (simReactions) {
    simReactions.innerHTML = '';
    const activeRoles = (state.currentNationalityRoles || []).filter(n => n && n.emoji);
    activeRoles.forEach(item => {
      const pill = document.createElement('span');
      pill.className = 'sim-emoji-reaction';
      pill.style.cssText = 'background: rgba(255,255,255,0.07); border: 1px solid rgba(255,255,255,0.15); border-radius: 6px; padding: 4px 10px; font-size: 0.85rem; cursor: pointer; user-select: none; transition: all 0.15s ease;';

      const isSimActive = state.simulatedAssignedRoles.has(item.code || item.name);
      if (isSimActive) {
        pill.style.background = 'rgba(0, 210, 255, 0.2)';
        pill.style.borderColor = '#00d2ff';
      }

      pill.innerHTML = `${renderEmojiHtml(item.emoji)} ${isSimActive ? '2' : '1'}`;
      pill.title = `Simulate reacting with ${item.emoji} (${item.intent || 'toggle'})`;

      pill.addEventListener('click', () => {
        handleSimulatedReactionClick(item);
      });
      simReactions.appendChild(pill);
    });
  }
}

export function handleSimulatedReactionClick(item) {
  const feedback = document.getElementById('sim-nationality-feedback');
  if (!feedback) return;
  feedback.classList.remove('hidden');

  const intent = (item.intent || document.getElementById('reaction-default-intent-select')?.value || 'toggle').toLowerCase();
  const id = item.code || item.name;
  const emojiHtml = renderEmojiHtml(item.emoji);

  if (intent === 'unique') {
    const itemCat = item.category || null;
    (state.currentNationalityRoles || []).forEach(other => {
      const otherCat = other.category || null;
      if (!itemCat || otherCat === itemCat) {
        state.simulatedAssignedRoles.delete(other.code || other.name);
      }
    });
    state.simulatedAssignedRoles.add(id);
    feedback.innerHTML = `<span style="color: #00d2ff;"><i data-lucide="check-circle-2"></i></span> <strong>[Simulated Unique Role]</strong> Selected <strong>${item.name}</strong> (${emojiHtml})! Other ${itemCat ? `<strong>${itemCat}</strong>` : ''} roles were cleared.`;
  } else if (intent === 'give_only') {
    state.simulatedAssignedRoles.add(id);
    feedback.innerHTML = `<span style="color: #57F287;"><i data-lucide="check-circle-2"></i></span> <strong>[Simulated Give-Only Role]</strong> Unlocked role for <strong>${item.name}</strong> (${emojiHtml}) permanently!`;
  } else if (intent === 'remove_only') {
    state.simulatedAssignedRoles.delete(id);
    feedback.innerHTML = `<span style="color: #ED4245;"><i data-lucide="trash-2"></i></span> <strong>[Simulated Remove-Only Role]</strong> Removed role for <strong>${item.name}</strong> (${emojiHtml}).`;
  } else {
    if (state.simulatedAssignedRoles.has(id)) {
      state.simulatedAssignedRoles.delete(id);
      feedback.innerHTML = `<span style="color: #949ba4;"><i data-lucide="minus-circle"></i></span> <strong>[Simulated Toggle]</strong> Unreacted ${emojiHtml} — removed role for <strong>${item.name}</strong>.`;
    } else {
      state.simulatedAssignedRoles.add(id);
      feedback.innerHTML = `<span style="color: #57F287;"><i data-lucide="check-circle-2"></i></span> <strong>[Simulated Toggle]</strong> Reacted ${emojiHtml} — granted role for <strong>${item.name}</strong>!`;
    }
  }

  updateNationalityPreview();
  refreshIcons();
}

export function renderCategoryFilterBar() {
  const bar = document.getElementById('category-filter-bar');
  if (!bar) return;

  const categories = Array.from(new Set(
    (state.currentNationalityRoles || []).map(r => r.category).filter(Boolean)
  ));

  if (categories.length <= 1) {
    bar.innerHTML = '';
    bar.style.display = 'none';
    return;
  }

  bar.style.display = 'flex';
  bar.innerHTML = '';

  const allChip = document.createElement('span');
  allChip.className = `category-filter-chip ${state.activeCategoryFilter === 'all' ? 'active' : ''}`;
  allChip.textContent = `All (${state.currentNationalityRoles.length})`;
  allChip.addEventListener('click', () => {
    state.activeCategoryFilter = 'all';
    renderCategoryFilterBar();
    renderNationalityRolesList();
  });
  bar.appendChild(allChip);

  categories.forEach(cat => {
    const count = (state.currentNationalityRoles || []).filter(r => r.category === cat).length;
    const chip = document.createElement('span');
    chip.className = `category-filter-chip ${state.activeCategoryFilter === cat ? 'active' : ''}`;
    chip.textContent = `${cat} (${count})`;
    chip.addEventListener('click', () => {
      state.activeCategoryFilter = cat;
      renderCategoryFilterBar();
      renderNationalityRolesList();
    });
    bar.appendChild(chip);
  });
}

export function renderNationalityRolesList() {
  const container = document.getElementById('nationality-roles-container');
  const countBadge = document.getElementById('reaction-roles-count-badge');
  if (countBadge) countBadge.textContent = `${state.currentNationalityRoles.length} Roles`;
  if (!container) return;
  container.innerHTML = '';

  renderCategoryFilterBar();

  const roles = state.serverState?.guild?.roles || [];

  if (state.currentNationalityRoles.length === 0) {
    container.innerHTML = '<p class="text-muted" style="grid-column: 1/-1; padding: 14px;">No reaction roles configured yet. Click <strong>Populate Presets</strong> above to start with ready-made templates, or create custom roles below!</p>';
    return;
  }

  const displayRoles = state.activeCategoryFilter === 'all'
    ? state.currentNationalityRoles
    : state.currentNationalityRoles.filter(r => r.category === state.activeCategoryFilter);

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
          <span class="nat-flag clickable-emoji" title="Click to change emoji">${renderEmojiHtml(item.emoji || '🌐')}</span>
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

    const flagEl = card.querySelector('.nat-flag');
    if (flagEl) {
      flagEl.addEventListener('click', (e) => {
        e.stopPropagation();
        window.__maievEmojiPicker?.openForCard(flagEl, (picked) => {
          item.emoji = picked.emoji;
          renderNationalityRolesList();
          updateNationalityPreview();
          autoSaveNationalityRoles();
          showToast(`Updated emoji for ${item.name} to ${picked.emoji}`, 'success');
        });
      });
    }

    card.querySelector('.nat-role-select').addEventListener('change', (e) => {
      item.roleId = e.target.value;
      autoSaveNationalityRoles();
    });

    card.querySelector('.nat-intent-select').addEventListener('change', (e) => {
      item.intent = e.target.value;
      autoSaveNationalityRoles();
      updateNationalityPreview();
      showToast(`Updated intent for ${item.name} to "${e.target.value}"`, 'success');
    });

    card.querySelector('.btn-del-nat').addEventListener('click', () => {
      const idx = state.currentNationalityRoles.indexOf(item);
      if (idx !== -1) {
        state.currentNationalityRoles.splice(idx, 1);
      }
      if (state.reactionPresets[state.activePresetId]) {
        state.reactionPresets[state.activePresetId].roles = state.currentNationalityRoles;
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

export function populateMultiRoleChecklist() {
  const container = document.getElementById('multi-role-server-roles-container');
  if (!container) return;
  container.innerHTML = '';

  const roles = state.serverState?.guild?.roles || [];
  if (roles.length === 0) {
    container.innerHTML = '<p class="text-muted">No server roles found.</p>';
    return;
  }

  roles.forEach(role => {
    if (role.name === '@everyone') return;
    const isAlreadyConfigured = state.currentNationalityRoles.some(r => r.roleId === role.id);

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

export function applyMultiplePresets(presetKeys, mergeMode = 'append') {
  if (!Array.isArray(presetKeys) || presetKeys.length === 0) return;

  const roles = state.serverState?.guild?.roles || [];

  if (mergeMode === 'replace') {
    state.reactionPresets = {};
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

    if (state.reactionPresets[key] && mergeMode === 'append') {
      const existingCodes = new Set((state.reactionPresets[key].roles || []).map(r => r.code || r.name.toLowerCase()));
      matchedRoles.forEach(newRole => {
        const codeKey = newRole.code || newRole.name.toLowerCase();
        if (!existingCodes.has(codeKey)) {
          state.reactionPresets[key].roles.push(newRole);
          existingCodes.add(codeKey);
        }
      });
    } else {
      state.reactionPresets[key] = {
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

  state.activePresetId = presetKeys[0];
  renderReactionSubtabs();
  switchActivePreset(state.activePresetId);
  autoSaveNationalityRoles();
  refreshIcons();

  const presetNames = presetKeys.map(k => ROLE_PRESETS[k]?.name || k).join(', ');
  showToast(`Enabled preset subtabs: ${presetNames}!`, 'success');
}

export function applyPreset(presetKey) {
  applyMultiplePresets([presetKey], 'append');
}

export function applyQuickEmbedTemplate(key) {
  const currentPreset = state.reactionPresets[state.activePresetId];
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

export function autoFitEmbedSettingsToRoles() {
  const currentPreset = state.reactionPresets[state.activePresetId];
  const titleInput = document.getElementById('nationality-title-input');
  const footerInput = document.getElementById('nationality-footer-input');
  const contentInput = document.getElementById('nationality-content-input');
  if (!titleInput || !footerInput) return;

  const presetDef = ROLE_PRESETS[state.activePresetId];
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

export function applyRemoteNationalitySync(remoteConfig) {
  if (!remoteConfig) return;

  const activeEl = document.activeElement;
  if (activeEl && ['new-nat-emoji', 'new-nat-name', 'new-nat-code', 'new-nat-role', 'nationality-content-input', 'nationality-title-input', 'nationality-footer-input'].includes(activeEl.id)) {
    return;
  }

  if (remoteConfig.reactionPresets && Object.keys(remoteConfig.reactionPresets).length > 0) {
    const currentJson = JSON.stringify(state.reactionPresets || {});
    const remoteJson = JSON.stringify(remoteConfig.reactionPresets);
    if (currentJson !== remoteJson) {
      state.reactionPresets = JSON.parse(JSON.stringify(remoteConfig.reactionPresets));
      if (!state.reactionPresets[state.activePresetId]) {
        state.activePresetId = Object.keys(state.reactionPresets)[0] || 'classes';
      }
      state.currentNationalityRoles = state.reactionPresets[state.activePresetId]?.roles || [];
      renderReactionSubtabs();
      switchActivePreset(state.activePresetId);
    }
  }
}

export function setupReactionRolesTabListeners() {
  setupDiscordEmojiPicker();
  const natTitleInput = document.getElementById('nationality-title-input');
  const natContentInput = document.getElementById('nationality-content-input');
  const natFooterInput = document.getElementById('nationality-footer-input');

  natTitleInput?.addEventListener('input', (e) => {
    if (state.reactionPresets[state.activePresetId]) {
      state.reactionPresets[state.activePresetId].title = e.target.value;
    }
    updateNationalityPreview();
  });
  natContentInput?.addEventListener('input', (e) => {
    if (state.reactionPresets[state.activePresetId]) {
      state.reactionPresets[state.activePresetId].content = e.target.value;
    }
    updateNationalityPreview();
  });
  natFooterInput?.addEventListener('input', (e) => {
    if (state.reactionPresets[state.activePresetId]) {
      state.reactionPresets[state.activePresetId].footer = e.target.value;
    }
    updateNationalityPreview();
  });

  const defaultIntentSelect = document.getElementById('reaction-default-intent-select');
  if (defaultIntentSelect) {
    defaultIntentSelect.addEventListener('change', () => {
      const intentVal = defaultIntentSelect.value;
      state.currentNationalityRoles.forEach(r => {
        if (!r.intent || r.intent === 'toggle') r.intent = intentVal;
      });
      if (state.reactionPresets[state.activePresetId]) {
        state.reactionPresets[state.activePresetId].intent = intentVal;
      }
      renderNationalityRolesList();
      updateNationalityPreview();
      autoSaveNationalityRoles();
      showToast(`Set default reaction role intent to "${intentVal}"`, 'success');
    });
  }

  document.getElementById('select-nationality-roles-channel')?.addEventListener('change', (e) => {
    if (state.reactionPresets[state.activePresetId]) {
      state.reactionPresets[state.activePresetId].channelId = e.target.value;
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

  document.getElementById('btn-reset-nationality-template')?.addEventListener('click', () => {
    if (natTitleInput) natTitleInput.value = DEFAULT_NATIONALITY_TEMPLATE.title;
    if (natContentInput) natContentInput.value = DEFAULT_NATIONALITY_TEMPLATE.content;
    if (natFooterInput) natFooterInput.value = DEFAULT_NATIONALITY_TEMPLATE.footer;
    updateNationalityPreview();
    showToast('Reset reaction roles template to standard format!', 'success');
  });

  document.getElementById('btn-autofit-embed-template')?.addEventListener('click', () => {
    autoFitEmbedSettingsToRoles();
  });

  document.getElementById('select-embed-template-preset')?.addEventListener('change', (e) => {
    if (e.target.value) {
      applyQuickEmbedTemplate(e.target.value);
      e.target.value = '';
    }
  });

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

  document.getElementById('btn-add-nationality')?.addEventListener('click', () => {
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

    const currentPreset = state.reactionPresets[state.activePresetId];
    const category = currentPreset ? (currentPreset.name || currentPreset.category) : '';
    state.currentNationalityRoles.push({ emoji, name, code, roleId, intent, category });
    if (currentPreset) currentPreset.roles = state.currentNationalityRoles;

    document.getElementById('new-nat-emoji').value = '';
    document.getElementById('new-nat-name').value = '';
    document.getElementById('new-nat-code').value = '';
    document.getElementById('new-nat-role').value = '';
    window.__maievEmojiPicker?.resetCreator();

    renderNationalityRolesList();
    renderReactionSubtabs();
    updateNationalityPreview();
    autoSaveNationalityRoles();
    showToast(`Added reaction role for ${name} (${intent})!`, 'success');
  });

  // Presets Modal
  const btnPopulate = document.getElementById('btn-populate-reaction-roles');
  const btnAddSubtabPreset = document.getElementById('btn-add-subtab-preset');
  const modalPresets = document.getElementById('modal-presets');
  const btnPresetsClose = document.getElementById('modal-presets-close');
  const btnPresetsCancel = document.getElementById('modal-presets-cancel');
  const btnPresetsSelectAll = document.getElementById('btn-presets-select-all');
  const btnPresetsDeselectAll = document.getElementById('btn-presets-deselect-all');
  const btnApplyPresets = document.getElementById('btn-apply-selected-presets');
  const summaryEl = document.getElementById('selected-presets-summary');

  const selectedPresetKeys = new Set();

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
    updatePresetModalUI();
    modalPresets.classList.remove('hidden');
    refreshIcons();
  };

  if (btnPopulate && modalPresets) btnPopulate.addEventListener('click', openPresetsModal);
  if (btnAddSubtabPreset && modalPresets) btnAddSubtabPreset.addEventListener('click', openPresetsModal);

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

    modalPresets.querySelectorAll('.preset-card-btn').forEach(card => {
      card.addEventListener('click', () => {
        const key = card.getAttribute('data-preset');
        if (selectedPresetKeys.has(key)) selectedPresetKeys.delete(key);
        else selectedPresetKeys.add(key);
        updatePresetModalUI();
      });
    });

    btnApplyPresets?.addEventListener('click', () => {
      if (selectedPresetKeys.size === 0) return;
      const mergeMode = document.querySelector('input[name="preset-merge-mode"]:checked')?.value || 'append';
      applyMultiplePresets(Array.from(selectedPresetKeys), mergeMode);
      modalPresets.classList.add('hidden');
    });
  }

  // Create Custom Preset Modal
  const btnCreateCustomPreset = document.getElementById('btn-create-custom-preset');
  const btnOpenCreateFromModal = document.getElementById('btn-open-create-preset-from-modal');
  const modalCreatePreset = document.getElementById('modal-create-preset');
  const btnCreatePresetClose = document.getElementById('modal-create-preset-close');
  const btnCreatePresetCancel = document.getElementById('modal-create-preset-cancel');
  const btnSubmitCreatePreset = document.getElementById('btn-submit-create-preset');
  const createPresetIconInput = document.getElementById('create-preset-icon');
  const createPresetNameInput = document.getElementById('create-preset-name');
  const createPresetIntentSelect = document.getElementById('create-preset-intent');
  const createPresetTitleInput = document.getElementById('create-preset-title');
  const createPresetFooterInput = document.getElementById('create-preset-footer');

  let titleManuallyEdited = false;

  const openCreatePresetModal = () => {
    modalPresets?.classList.add('hidden');
    titleManuallyEdited = false;
    if (createPresetIconInput) createPresetIconInput.value = '🏷️';
    if (createPresetNameInput) createPresetNameInput.value = '';
    if (createPresetIntentSelect) createPresetIntentSelect.value = 'toggle';
    if (createPresetTitleInput) createPresetTitleInput.value = '';
    if (createPresetFooterInput) createPresetFooterInput.value = 'React with an emoji below to toggle your role';
    modalCreatePreset?.classList.remove('hidden');
    refreshIcons();
    setTimeout(() => createPresetNameInput?.focus(), 30);
  };

  btnCreateCustomPreset?.addEventListener('click', openCreatePresetModal);
  btnOpenCreateFromModal?.addEventListener('click', openCreatePresetModal);
  btnCreatePresetClose?.addEventListener('click', () => modalCreatePreset?.classList.add('hidden'));
  btnCreatePresetCancel?.addEventListener('click', () => modalCreatePreset?.classList.add('hidden'));

  createPresetTitleInput?.addEventListener('input', () => {
    titleManuallyEdited = Boolean(createPresetTitleInput.value.trim());
  });

  const syncSuggestedPresetTitle = () => {
    if (titleManuallyEdited || !createPresetTitleInput) return;
    const icon = createPresetIconInput?.value.trim() || '🏷️';
    const name = createPresetNameInput?.value.trim() || '';
    createPresetTitleInput.value = name ? `${icon} Choose Your ${name}` : '';
  };

  createPresetNameInput?.addEventListener('input', syncSuggestedPresetTitle);
  createPresetIconInput?.addEventListener('input', syncSuggestedPresetTitle);

  createPresetIntentSelect?.addEventListener('change', () => {
    if (!createPresetFooterInput) return;
    const val = createPresetIntentSelect.value;
    if (val === 'unique') {
      createPresetFooterInput.value = 'React with an emoji below to select your role (1 choice)';
    } else if (val === 'give_only') {
      createPresetFooterInput.value = 'React with an emoji below to unlock your role';
    } else {
      createPresetFooterInput.value = 'React with an emoji below to toggle your role';
    }
  });

  btnSubmitCreatePreset?.addEventListener('click', () => {
    const rawName = createPresetNameInput?.value.trim() || '';
    if (!rawName) {
      showToast('Please enter a Preset Name.', 'error');
      createPresetNameInput?.focus();
      return;
    }

    const icon = createPresetIconInput?.value.trim() || '🏷️';
    const intent = createPresetIntentSelect?.value || 'toggle';
    const title = createPresetTitleInput?.value.trim() || `${icon} Choose Your ${rawName}`;
    const footer = createPresetFooterInput?.value.trim() || 'React with an emoji below to toggle your role';

    let baseId = rawName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'custom-preset';
    let presetId = baseId;
    let counter = 2;
    while (state.reactionPresets[presetId]) {
      presetId = `${baseId}-${counter++}`;
    }

    state.reactionPresets[presetId] = {
      id: presetId,
      name: rawName,
      icon,
      category: rawName,
      title,
      content: '',
      footer,
      channelId: document.getElementById('select-nationality-roles-channel')?.value || '',
      messageId: '',
      intent,
      roles: []
    };

    state.activePresetId = presetId;
    renderReactionSubtabs();
    switchActivePreset(presetId);
    autoSaveNationalityRoles();
    modalCreatePreset?.classList.add('hidden');
    showToast(`Created custom preset "${icon} ${rawName}"! Add roles to it below.`, 'success');
  });

  // Multi-Role Creator Modal
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

    btnMultiRolesSubmit?.addEventListener('click', () => {
      if (!checklistView.classList.contains('hidden')) {
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

          if (!state.currentNationalityRoles.some(r => r.roleId === roleId)) {
            state.currentNationalityRoles.push({
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
        const text = document.getElementById('multi-role-paste-textarea').value.trim();
        if (!text) {
          showToast('Please paste or enter role definitions.', 'error');
          return;
        }

        const lines = text.split('\n');
        let addedCount = 0;
        const guildRoles = state.serverState?.guild?.roles || [];

        lines.forEach(line => {
          const parts = line.split(',').map(s => s.trim());
          if (parts.length >= 2) {
            const emoji = parts[0];
            const name = parts[1];
            const code = parts[2] || name.toLowerCase().replace(/[^a-z0-9]/g, '-');
            const intent = parts[3] || 'toggle';
            const matchedRole = guildRoles.find(r => r.name.toLowerCase() === name.toLowerCase());

            state.currentNationalityRoles.push({
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

  // Post Reaction Roles Card Button
  const btnPostNatRoles = document.getElementById('btn-post-nationality-roles-channel');
  if (btnPostNatRoles) {
    btnPostNatRoles.addEventListener('click', async () => {
      const channelSelect = document.getElementById('select-nationality-roles-channel');
      const channelId = channelSelect?.value;
      if (!channelId) {
        showToast('Please select a target channel to post the reaction card.', 'error');
        return;
      }

      const currentPreset = state.reactionPresets[state.activePresetId];
      if (!currentPreset || (currentPreset.roles || []).length === 0) {
        showToast('No roles configured in this preset to post.', 'error');
        return;
      }

      const presetName = currentPreset.name || state.activePresetId;
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
            presetId: state.activePresetId,
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

  // Update Active Reaction Roles Card in-place
  const btnUpdateNatRoles = document.getElementById('btn-update-nationality-roles-channel');
  if (btnUpdateNatRoles) {
    btnUpdateNatRoles.addEventListener('click', async () => {
      const channelSelect = document.getElementById('select-nationality-roles-channel');
      const channelId = channelSelect?.value;
      if (!channelId) {
        showToast('Please select a target channel to update the reaction card.', 'error');
        return;
      }

      const currentPreset = state.reactionPresets[state.activePresetId];
      if (!currentPreset || (currentPreset.roles || []).length === 0) {
        showToast('No roles configured in this preset to update.', 'error');
        return;
      }

      const presetName = currentPreset.name || state.activePresetId;
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
            presetId: state.activePresetId,
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
}

