export const state = {
  serverState: null,
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

