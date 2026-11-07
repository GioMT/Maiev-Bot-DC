import { state, getActiveServerName } from './state.js?v=7.1';
import {
  DEFAULT_RULES_TEMPLATE,
  DEFAULT_VERIFY_TEMPLATE,
  DEFAULT_WELCOME_TEMPLATE,
  DEFAULT_NATIONALITY_TEMPLATE
} from './presets.js?v=7.1';
import { showToast } from './utils.js?v=7.1';
import { saveBossTimerSettings } from './tabs/boss-timer-tab.js?v=7.1';
import { collectUserVerifyFormValues } from './tabs/user-verify-tab.js?v=7.1';

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
    await fetch('/api/config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ serverName: name })
    });
  } catch (err) {
    console.error('Failed to auto-persist server name:', err);
  }
}

export async function autoSaveNationalityRoles() {
  try {
    const allRoles = Object.values(state.reactionPresets).flatMap(p => p.roles || []);
    const intent = document.getElementById('reaction-default-intent-select')?.value || 'toggle';
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

export async function saveAllConfiguration() {
  const autoJoinRoleIds = Array.from(document.querySelectorAll('input[name="role_auto_join"]:checked')).map(el => el.value);
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
  const nationalityContent = document.getElementById('nationality-content-input')?.value.trim() || '';
  const nationalityFooter = document.getElementById('nationality-footer-input')?.value.trim() || DEFAULT_NATIONALITY_TEMPLATE.footer;
  const serverName = document.getElementById('server-name-input')?.value.trim() || getActiveServerName();

  try {
    const reactionRoleIntent = document.getElementById('reaction-default-intent-select')?.value || 'toggle';
    const allRoles = Object.values(state.reactionPresets).flatMap(p => p.roles || []);
    const res = await fetch('/api/config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
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
        reactionPresets: state.reactionPresets,
        ...collectUserVerifyFormValues()
      })
    });

    if (!res.ok) throw new Error('Save failed');
    const result = await res.json();
    if (result.config) {
      try {
        localStorage.setItem('maiev_config_cache', JSON.stringify(result.config));
      } catch (_) {}
    }
    await saveBossTimerSettings().catch(() => null);
    showToast('All dashboard configuration settings saved successfully!', 'success');
  } catch (err) {
    showToast('Error saving configuration.', 'error');
  }
}

