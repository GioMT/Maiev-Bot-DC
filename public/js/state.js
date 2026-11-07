export const state = {
  serverState: null,
  initialLoadComplete: false,
  pendingConfigSave: false,
  currentNationalityRoles: [],
  reactionPresets: {},
  activePresetId: 'classes',
  simulatedAssignedRoles: new Set(),
  activeCategoryFilter: 'all',
  cachedMembers: []
};

export function getActiveServerName() {
  return state.serverState?.config?.serverName || state.serverState?.guild?.name || 'Asia Fregion';
}

export function syncCachedConfig(configPatch, replaceFull = false) {
  if (!configPatch || typeof configPatch !== 'object') return;
  if (!state.serverState) {
    state.serverState = { config: {} };
  }
  state.serverState.config = replaceFull
    ? { ...configPatch }
    : { ...(state.serverState.config || {}), ...configPatch };

  try {
    localStorage.setItem('maiev_config_cache', JSON.stringify(state.serverState.config));
  } catch (_) {}
}

