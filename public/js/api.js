import { state, getActiveServerName, syncCachedConfig } from './state.js?v=7.4';
import {
  DEFAULT_RULES_TEMPLATE,
  DEFAULT_VERIFY_TEMPLATE,
  DEFAULT_WELCOME_TEMPLATE,
  DEFAULT_NATIONALITY_TEMPLATE
} from './presets.js?v=7.4';
import { showToast } from './utils.js?v=7.4';
import { saveBossTimerSettings } from './tabs/boss-timer-tab.js?v=7.4';
import { collectUserVerifyFormValues } from './tabs/user-verify-tab.js?v=7.4';

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

export function buildFullConfigPayload() {
  const cfg = state.serverState?.config || {};

  const autoJoinRoleIds = readCheckedRoles('role_auto_join', cfg.autoJoinRoleIds);
  const onboardedRoleId = readSelectValue('select-onboarded-role', cfg.onboardedRoleId);
  const rulesChannelId = readSelectValue('select-rules-channel', cfg.rulesChannelId);
  const verifyChannelId = readSelectValue('select-verify-channel', cfg.verifyChannelId);

  const ignRolesToAdd = readCheckedRoles('role_add', cfg.ignRolesToAdd);
  const ignRolesToRemove = readCheckedRoles('role_remove', cfg.ignRolesToRemove);

  const rulesTitle = document.getElementById('rules-title-input')?.value.trim() || DEFAULT_RULES_TEMPLATE.title;
  const rulesContent = document.getElementById('rules-content-input')?.value.trim() || DEFAULT_RULES_TEMPLATE.content;
  const rulesFooter = document.getElementById('rules-footer-input')?.value.trim() || DEFAULT_RULES_TEMPLATE.footer;

  const verifyTitle = document.getElementById('verify-title-input')?.value.trim() || DEFAULT_VERIFY_TEMPLATE.title;
  const verifyContent = document.getElementById('verify-content-input')?.value.trim() || DEFAULT_VERIFY_TEMPLATE.content;
  const verifyFooter = document.getElementById('verify-footer-input')?.value.trim() || DEFAULT_VERIFY_TEMPLATE.footer;

  const welcomeTitle = document.getElementById('welcome-title-input')?.value.trim() || DEFAULT_WELCOME_TEMPLATE.title;
  const welcomeContent = document.getElementById('welcome-content-input')?.value.trim() || DEFAULT_WELCOME_TEMPLATE.content;
  const welcomeFooter = document.getElementById('welcome-footer-input')?.value.trim() || DEFAULT_WELCOME_TEMPLATE.footer;

  const welcomeAnnouncementChannelId = readSelectValue('select-welcome-channel', cfg.welcomeAnnouncementChannelId);
  const enableWelcomeAnnouncement = document.getElementById('check-enable-welcome-announcement')?.checked !== false;
  const welcomeAnnouncementMessage = document.getElementById('welcome-announcement-input')?.value.trim() || '';

  const nationalityChannelId = readSelectValue('select-nationality-roles-channel', cfg.nationalityChannelId);
  const nationalityTitle = document.getElementById('nationality-title-input')?.value.trim() || DEFAULT_NATIONALITY_TEMPLATE.title;
  const nationalityContent = document.getElementById('nationality-content-input')?.value.trim() || '';
  const nationalityFooter = document.getElementById('nationality-footer-input')?.value.trim() || DEFAULT_NATIONALITY_TEMPLATE.footer;
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
      body: JSON.stringify({ serverName: name })
    });
    const data = await res.json().catch(() => null);
    if (data?.config) syncCachedConfig(data.config, true);
  } catch (err) {
    console.error('Failed to auto-persist server name:', err);
  }
}

export async function autoSaveNationalityRoles() {
  try {
    const allRoles = Object.values(state.reactionPresets).flatMap(p => p.roles || []);
    const intent = document.getElementById('reaction-default-intent-select')?.value || 'toggle';
    syncCachedConfig({
      nationalityRoles: allRoles,
      reactionPresets: state.reactionPresets,
      reactionRoleIntent: intent
    });
    await fetch('/api/nationality-roles', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        nationalityRoles: allRoles,
        reactionPresets: state.reactionPresets,
        intent
      })
    });
  } catch (err) {
    console.error('Failed to auto-save reaction roles:', err);
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
      body: JSON.stringify(payload)
    });

    if (!res.ok) throw new Error('Save failed');
    const result = await res.json();
    if (result.config) {
      syncCachedConfig(result.config, true);
    }
    if (!skipBossTimer) {
      await saveBossTimerSettings().catch(() => null);
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

