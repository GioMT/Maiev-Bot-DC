/**
 * Maiev Bot Control Center — Modular ES Entry Point
 */
import { state, syncCachedConfig } from './state.js?v=7.6';
import { refreshIcons, showToast } from './utils.js?v=7.6';
import { saveAllConfiguration, flushPendingAutoSaveOnUnload } from './api.js?v=7.6';
import {
  setupTabs,
  renderHeaderTelemetry,
  renderRoleDropdowns,
  renderChannelDropdowns,
  setupServerNameEditing
} from './tabs/header-telemetry.js?v=7.6';
import { renderRulesEditor, setupRulesTabListeners } from './tabs/rules-tab.js?v=7.6';
import {
  renderVerifyEditor,
  renderWelcomeEditor,
  setupVerifyTabListeners
} from './tabs/verify-tab.js?v=7.6';
import {
  renderUserVerifyEditor,
  setupUserVerifyTabListeners
} from './tabs/user-verify-tab.js?v=7.6';
import {
  renderWelcomeAnnouncementEditor,
  setupWelcomeTabListeners
} from './tabs/welcome-tab.js?v=7.6';
import {
  renderNationalityRolesManager,
  setupReactionRolesTabListeners,
  applyRemoteNationalitySync
} from './tabs/reaction-roles-tab.js?v=7.6';
import {
  renderDiagnostics,
  fetchMembers,
  setupDiagnosticsTabListeners
} from './tabs/diagnostics-tab.js?v=7.6';
import {
  fetchBossTimerState,
  setupBossTimerTabListeners
} from './tabs/boss-timer-tab.js?v=7.6';
import {
  fetchAlertsState,
  setupAlertsTabListeners
} from './tabs/alerts-tab.js?v=7.6';

export async function fetchServerState() {
  try {
    const res = await fetch('/api/status', { cache: 'no-store' });
    if (!res.ok) throw new Error('API request failed');
    const data = await res.json();
    state.serverState = data;

    if (data.config) {
      syncCachedConfig(data.config, true);
    }

    renderHeaderTelemetry(data);
    renderRoleDropdowns(data);
    renderChannelDropdowns(data);
    renderRulesEditor(data.config || {});
    renderVerifyEditor(data.config || {});
    renderUserVerifyEditor(data.config || {});
    renderWelcomeEditor(data.config || {});
    renderWelcomeAnnouncementEditor(data.config || {});
    renderNationalityRolesManager(data);
    renderDiagnostics(data);
    state.initialLoadComplete = true;

    fetchMembers();
    fetchBossTimerState();
    fetchAlertsState();
    refreshIcons();
  } catch (err) {
    console.error('Failed to load status:', err);
    showToast('Could not connect to bot API. Please check server logs.', 'error');
  }
}

function setupGlobalListeners() {
  setupServerNameEditing();

  const saveButtons = [
    document.getElementById('btn-global-save'),
    ...document.querySelectorAll('.btn-save-section')
  ].filter(Boolean);

  saveButtons.forEach(btn => {
    btn.addEventListener('click', saveAllConfiguration);
  });

  document.getElementById('btn-refresh')?.addEventListener('click', () => {
    fetchServerState();
    showToast('Refreshed live data from Discord Gateway!', 'success');
  });

  window.addEventListener('beforeunload', flushPendingAutoSaveOnUnload);

  setupRulesTabListeners();
  setupVerifyTabListeners();
  setupUserVerifyTabListeners();
  setupWelcomeTabListeners();
  setupReactionRolesTabListeners();
  setupBossTimerTabListeners();
  setupAlertsTabListeners();
  setupDiagnosticsTabListeners(fetchServerState);
}

function setupRealtimeSync() {
  if (typeof EventSource !== 'undefined') {
    const eventSource = new EventSource('/api/events');
    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === 'config_updated' && data.config && !state.pendingConfigSave) {
          syncCachedConfig(data.config, true);
          applyRemoteNationalitySync(data.config);
        }
      } catch (_) {}
    };
  }

  setInterval(async () => {
    if (state.pendingConfigSave) return;
    try {
      const res = await fetch('/api/status', { cache: 'no-store' });
      if (res.ok && !state.pendingConfigSave) {
        const data = await res.json();
        state.serverState = data;
        if (data.config) {
          syncCachedConfig(data.config, true);
          applyRemoteNationalitySync(data.config);
        }
      }
    } catch (_) {}
  }, 5000);
}

function bootstrap() {
  let initialCfg = {};
  try {
    const cached = localStorage.getItem('maiev_config_cache');
    if (cached) initialCfg = JSON.parse(cached);
  } catch (_) {}

  state.serverState = { config: initialCfg, guildReady: false };

  setupTabs();
  renderRulesEditor(initialCfg);
  renderVerifyEditor(initialCfg);
  renderUserVerifyEditor(initialCfg);
  renderWelcomeEditor(initialCfg);
  renderWelcomeAnnouncementEditor(initialCfg);
  fetchServerState();
  setupGlobalListeners();
  setupRealtimeSync();
  refreshIcons();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', bootstrap);
} else {
  bootstrap();
}

