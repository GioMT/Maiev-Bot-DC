import { state, getActiveServerName, syncCachedConfig } from './state.js?v=7.5';
import {
  DEFAULT_RULES_TEMPLATE,
  DEFAULT_VERIFY_TEMPLATE,
  DEFAULT_WELCOME_TEMPLATE,
  DEFAULT_NATIONALITY_TEMPLATE
} from './presets.js?v=7.5';
import { showToast } from './utils.js?v=7.5';
import { saveBossTimerSettings } from './tabs/boss-timer-tab.js?v=7.5';
import { collectUserVerifyFormValues } from './tabs/user-verify-tab.js?v=7.5';
import { saveAlertsToBackend } from './tabs/alerts-tab.js?v=7.5';

let autoSaveTimer = null;

function readCheckedRoles(inputName, fallbackArray) {
  const allInputs = document.querySelectorAll(`input[name="${inputName}"]`);
  if (allInputs.length === 0) {
    return Array.isArray(fallbackArray) ? fallbackArray : [];
  }
  const checkedIds = Array.from(allInputs).filter(el => el.checked).map(el => el.value);
  if (!state.serverState?.guildReady && Array.isArray(fallbackArray)) {
    const renderedIds = new Set(Array.from(allInputs).map(el => el.value));
    const unrendered = fallbackArray.filter(id => !renderedIds.has(id));
    return [...new Set([...checkedIds, ...unrendered])];
  }
  return checkedIds;
}

function readSelectValue(selectId, fallbackValue) {
  const el = document.getElementById(selectId);
  if (!el || !state.initialLoadComplete || el.options.length <= 1) {
    return el?.value || fallbackValue || '';
  }
  return el.value;
}

function readTextInput(inputId, cfgVal, defaultVal) {
  const el = document.getElementById(inputId);
  if (el) return el.value;
  return cfgVal !== undefined ? cfgVal : defaultVal;
}

export function syncActivePresetInputsToState() {
  const activePreset = state.reactionPresets?.[state.activePresetId];
  if (!activePreset) return;
  const tEl = document.getElementById('nationality-title-input');
  const cEl = document.getElementById('nationality-content-input');
  const fEl = document.getElementById('nationality-footer-input');
  const chEl = document.getElementById('select-nationality-roles-channel');
  const intentEl = document.getElementById('reaction-default-intent-select');

  if (tEl) activePreset.title = tEl.value;
  if (cEl) activePreset.content = cEl.value;
  if (fEl) activePreset.footer = fEl.value;
  if (chEl && state.initialLoadComplete && chEl.options.length > 1) {
    activePreset.channelId = chEl.value;
  }
  if (intentEl && intentEl.value) {
    activePreset.intent = intentEl.value;
  }
}

export function buildFullConfigPayload() {
  const cfg = state.serverState?.config || {};

  syncActivePresetInputsToState();

  const autoJoinRoleIds = readCheckedRoles('role_auto_join', cfg.autoJoinRoleIds);
  const onboardedRoleId = readSelectValue('select-onboarded-role', cfg.onboardedRoleId);
  const rulesChannelId = readSelectValue('select-rules-channel', cfg.rulesChannelId);
  const verifyChannelId = readSelectValue('select-verify-channel', cfg.verifyChannelId);

  const ignRolesToAdd = readCheckedRoles('role_add', cfg.ignRolesToAdd);
  const ignRolesToRemove = readCheckedRoles('role_remove', cfg.ignRolesToRemove);

  const rulesTitle = readTextInput('rules-title-input', cfg.rulesTitle, DEFAULT_RULES_TEMPLATE.title);
  const rulesContent = readTextInput('rules-content-input', cfg.rulesContent, DEFAULT_RULES_TEMPLATE.content);
  const rulesFooter = readTextInput('rules-footer-input', cfg.rulesFooter, DEFAULT_RULES_TEMPLATE.footer);

  const verifyTitle = readTextInput('verify-title-input', cfg.verifyTitle, DEFAULT_VERIFY_TEMPLATE.title);
  const verifyContent = readTextInput('verify-content-input', cfg.verifyContent, DEFAULT_VERIFY_TEMPLATE.content);
  const verifyFooter = readTextInput('verify-footer-input', cfg.verifyFooter, DEFAULT_VERIFY_TEMPLATE.footer);

  const welcomeTitle = readTextInput('welcome-title-input', cfg.welcomeTitle, DEFAULT_WELCOME_TEMPLATE.title);
  const welcomeContent = readTextInput('welcome-content-input', cfg.welcomeContent, DEFAULT_WELCOME_TEMPLATE.content);
  const welcomeFooter = readTextInput('welcome-footer-input', cfg.welcomeFooter, DEFAULT_WELCOME_TEMPLATE.footer);

  const welcomeAnnouncementChannelId = readSelectValue('select-welcome-channel', cfg.welcomeAnnouncementChannelId);
  const enableWelcomeAnnouncement = document.getElementById('check-enable-welcome-announcement')?.checked !== false;
  const welcomeAnnouncementMessage = readTextInput('welcome-announcement-input', cfg.welcomeAnnouncementMessage, '');

  const nationalityChannelId = readSelectValue('select-nationality-roles-channel', cfg.nationalityChannelId);
  const nationalityTitle = readTextInput('nationality-title-input', cfg.nationalityTitle, DEFAULT_NATIONALITY_TEMPLATE.title);
  const nationalityContent = readTextInput('nationality-content-input', cfg.nationalityContent, '');
  const nationalityFooter = readTextInput('nationality-footer-input', cfg.nationalityFooter, DEFAULT_NATIONALITY_TEMPLATE.footer);
  const serverName = document.getElementById('server-name-input')?.value.trim() || getActiveServerName();

  const reactionRoleIntent = document.getElementById('reaction-default-intent-select')?.value || cfg.reactionRoleIntent || 'toggle';
  const hasPresets = state.reactionPresets && Object.keys(state.reactionPresets).length > 0;
  const allRoles = hasPresets
    ? Object.values(state.reactionPresets).flatMap(p => p.roles || [])
    : (cfg.nationalityRoles || []);

  return {
    autoJoinRoleIds,
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
    reactionPresets: hasPresets ? state.reactionPresets : cfg.reactionPresets,
    ...collectUserVerifyFormValues()
  };
}

export async function postEmbed(endpoint, channelId, successMessage) {
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

export async function persistServerName(name) {
  try {
    syncCachedConfig({ serverName: name });
    const res = await fetch('/api/config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ serverName: name }),
      keepalive: true
    });
    const data = await res.json().catch(() => null);
    if (data?.config) syncCachedConfig(data.config, true);
  } catch (err) {
    console.error('Failed to auto-persist server name:', err);
  }
}

export async function autoSaveNationalityRoles(keepalive = false) {
  try {
    syncActivePresetInputsToState();
    const cfg = state.serverState?.config || {};
    const allRoles = Object.values(state.reactionPresets).flatMap(p => p.roles || []);
    const intent = document.getElementById('reaction-default-intent-select')?.value || 'toggle';
    const nationalityChannelId = readSelectValue('select-nationality-roles-channel', cfg.nationalityChannelId);
    const nationalityTitle = readTextInput('nationality-title-input', cfg.nationalityTitle, DEFAULT_NATIONALITY_TEMPLATE.title);
    const nationalityContent = readTextInput('nationality-content-input', cfg.nationalityContent, '');
    const nationalityFooter = readTextInput('nationality-footer-input', cfg.nationalityFooter, DEFAULT_NATIONALITY_TEMPLATE.footer);

    state.pendingConfigSave = true;
    syncCachedConfig({
      nationalityRoles: allRoles,
      reactionPresets: state.reactionPresets,
      reactionRoleIntent: intent,
      nationalityChannelId,
      nationalityTitle,
      nationalityContent,
      nationalityFooter
    });
    const res = await fetch('/api/nationality-roles', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        nationalityRoles: allRoles,
        reactionPresets: state.reactionPresets,
        intent,
        nationalityChannelId,
        nationalityTitle,
        nationalityContent,
        nationalityFooter
      }),
      keepalive
    });
    if (res.ok && !keepalive) {
      const data = await res.json().catch(() => null);
      if (data?.config) syncCachedConfig(data.config, true);
    }
  } catch (err) {
    if (!keepalive) {
      console.error('Failed to auto-save reaction roles:', err);
    }
  } finally {
    state.pendingConfigSave = false;
  }
}

export function scheduleAutoSave(delayMs = 450) {
  if (!state.initialLoadComplete) return;
  state.pendingConfigSave = true;

  // Immediately cache optimistic snapshot so hard refresh (Cmd+R) never loses edits
  const snapshot = buildFullConfigPayload();
  syncCachedConfig(snapshot);

  if (autoSaveTimer) clearTimeout(autoSaveTimer);
  autoSaveTimer = setTimeout(() => {
    autoSaveTimer = null;
    saveAllConfiguration({ silent: true, skipBossTimer: true });
  }, delayMs);
}

export function flushPendingAutoSaveOnUnload() {
  if (!state.pendingConfigSave || !state.initialLoadComplete) return;
  if (autoSaveTimer) {
    clearTimeout(autoSaveTimer);
    autoSaveTimer = null;
  }
  state.pendingConfigSave = false;
  try {
    const payload = buildFullConfigPayload();
    syncCachedConfig(payload);
    fetch('/api/config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      keepalive: true
    }).catch(() => {});
  } catch (_) {}
}

export async function saveAllConfiguration(options = {}) {
  const isOptionsObj = Boolean(options && typeof options === 'object' && !('target' in options));
  const silent = isOptionsObj && Boolean(options.silent);
  const skipBossTimer = isOptionsObj && Boolean(options.skipBossTimer);

  if (!state.initialLoadComplete) {
    if (!silent) {
      showToast('Dashboard is still loading live Discord roles — please try again in a moment.', 'info');
    }
    return;
  }

  if (autoSaveTimer) {
    clearTimeout(autoSaveTimer);
    autoSaveTimer = null;
  }

  const payload = buildFullConfigPayload();
  state.pendingConfigSave = true;
  syncCachedConfig(payload);

  try {
    const res = await fetch('/api/config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      keepalive: true
    });

    if (!res.ok) throw new Error('Save failed');
    const result = await res.json();
    if (result.config) {
      syncCachedConfig(result.config, true);
    }
    if (!skipBossTimer) {
      await Promise.all([
        saveBossTimerSettings().catch(() => null),
        saveAlertsToBackend(false).catch(() => null)
      ]);
    }
    if (!silent) {
      showToast('All dashboard configuration settings saved successfully!', 'success');
    }
  } catch (err) {
    if (!silent) {
      showToast('Error saving configuration.', 'error');
    }
  } finally {
    state.pendingConfigSave = false;
  }
}

