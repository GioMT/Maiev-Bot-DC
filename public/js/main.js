/**
 * Maiev Bot Control Center — Modular ES Entry Point
 */
import { state } from './state.js?v=6.0';
import { refreshIcons, showToast } from './utils.js?v=6.0';
import { saveAllConfiguration } from './api.js?v=6.0';
import {
  setupTabs,
  renderHeaderTelemetry,
  renderRoleDropdowns,
  renderChannelDropdowns,
  setupServerNameEditing
} from './tabs/header-telemetry.js?v=6.0';
import { renderRulesEditor, setupRulesTabListeners } from './tabs/rules-tab.js?v=6.0';
import {
  renderVerifyEditor,
  renderWelcomeEditor,
  setupVerifyTabListeners
} from './tabs/verify-tab.js?v=6.0';
import {
  renderWelcomeAnnouncementEditor,
  setupWelcomeTabListeners
} from './tabs/welcome-tab.js?v=6.0';
import {
  renderNationalityRolesManager,
  setupReactionRolesTabListeners,
  applyRemoteNationalitySync
} from './tabs/reaction-roles-tab.js?v=6.0';
import {
  renderDiagnostics,
  fetchMembers,
  setupDiagnosticsTabListeners
} from './tabs/diagnostics-tab.js?v=6.0';
import {
  fetchBossTimerState,
  setupBossTimerTabListeners
} from './tabs/boss-timer-tab.js?v=6.0';
import {
  fetchAlertsState,
  setupAlertsTabListeners
} from './tabs/alerts-tab.js?v=6.0';

export async function fetchServerState() {
  try {
    const res = await fetch('/api/status');
    if (!res.ok) throw new Error('API request failed');
    const data = await res.json();
    state.serverState = data;

    if (data.config) {
      try {
        localStorage.setItem('maiev_config_cache', JSON.stringify(data.config));
      } catch (_) {}
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

  setupRulesTabListeners();
  setupVerifyTabListeners();
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
        if (data.type === 'config_updated' && data.config) {
          applyRemoteNationalitySync(data.config);
        }
      } catch (_) {}
    };
  }

  setInterval(async () => {
    try {
      const res = await fetch('/api/status');
      if (res.ok) {
        const data = await res.json();
        state.serverState = data;
        if (data.config) {
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

  setupTabs();
  renderRulesEditor(initialCfg);
  renderVerifyEditor(initialCfg);
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

