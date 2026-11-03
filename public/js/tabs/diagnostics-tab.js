import { state } from '../state.js?v=6.0';
import { refreshIcons, showToast } from '../utils.js?v=6.0';

export function renderDiagnostics(data) {
  const perms = data.permissions || {};

  function setDiag(elementId, isHealthy, healthyText, warningText) {
    const el = document.getElementById(elementId);
    if (!el) return;
    const statusSpan = el.querySelector('.diag-status');
    const subtext = el.querySelector('.diag-subtext');

    if (isHealthy) {
      statusSpan.style.color = 'var(--accent-green)';
      statusSpan.innerHTML = '<i data-lucide="check-circle-2"></i>';
      subtext.textContent = healthyText;
    } else {
      statusSpan.style.color = 'var(--accent-red)';
      statusSpan.innerHTML = '<i data-lucide="alert-triangle"></i>';
      subtext.textContent = warningText;
    }
  }

  setDiag(
    'diag-manage-roles',
    !!perms.hasManageRoles,
    'Healthy: Bot has permission to manage and assign member roles.',
    'Action Required: Enable "Manage Roles" on Maiev in Discord Server Settings > Roles.'
  );

  setDiag(
    'diag-manage-messages',
    !!perms.hasManageMessages,
    'Healthy: Bot can clean inactive reactions when members leave.',
    'Action Required: Enable "Manage Messages" on Maiev to remove former members’ reactions.'
  );

  setDiag(
    'diag-manage-nicknames',
    !!perms.hasManageNicknames,
    'Healthy: Bot has permission to sync server nicknames with in-game IGN.',
    'Action Required: Enable "Manage Nicknames" on Maiev in Discord Server Settings.'
  );

  const hierEl = document.getElementById('diag-hierarchy');
  if (hierEl) {
    const statusSpan = hierEl.querySelector('.diag-status');
    const subtext = hierEl.querySelector('.diag-subtext');
    statusSpan.style.color = 'var(--accent-cyan)';
    statusSpan.innerHTML = '<i data-lucide="shield-check"></i>';
    subtext.textContent = `Bot highest role position: ${perms.rolePosition || 'Active'}. Ensure Maiev sits above member roles.`;
  }

  refreshIcons();
}

export async function fetchMembers() {
  try {
    const res = await fetch('/api/members');
    if (!res.ok) return;
    state.cachedMembers = await res.json();
    renderMembersTable(state.cachedMembers);
  } catch (err) {
    console.error('Error fetching members:', err);
  }
}

export function renderMembersTable(members) {
  const tbody = document.getElementById('members-table-body');
  if (!tbody) return;
  tbody.innerHTML = '';

  if (!members || members.length === 0) {
    tbody.innerHTML = '<tr><td colspan="3" class="text-center py-4 text-muted">No members found matching query.</td></tr>';
    return;
  }

  members.forEach(m => {
    const tr = document.createElement('tr');
    const rolesHtml = m.roles && m.roles.length > 0
      ? m.roles.map(r => `<span class="role-badge" style="background: rgba(88, 101, 242, 0.2); border: 1px solid rgba(88, 101, 242, 0.4); padding: 2px 7px; border-radius: 4px; font-size: 0.75rem; margin-right: 4px;">@${r}</span>`).join(' ')
      : '<span class="text-muted" style="font-size: 0.8rem;">No Roles</span>';

    tr.innerHTML = `
      <td><strong>${m.username}</strong></td>
      <td><span style="color: var(--accent-cyan); font-weight: 600;">${m.nickname || m.username}</span></td>
      <td>${rolesHtml}</td>
    `;
    tbody.appendChild(tr);
  });
}

export function setupDiagnosticsTabListeners(onRefreshServerState) {
  document.getElementById('btn-recheck-diagnostics')?.addEventListener('click', () => {
    onRefreshServerState();
    showToast('Permissions & diagnostic status refreshed!', 'success');
  });

  document.getElementById('btn-refresh-roster')?.addEventListener('click', () => {
    fetchMembers();
    showToast('Server member roster refreshed!', 'success');
  });

  const memberSearch = document.getElementById('member-search-input');
  if (memberSearch) {
    memberSearch.addEventListener('input', (e) => {
      const q = e.target.value.toLowerCase().trim();
      if (!q) {
        renderMembersTable(state.cachedMembers);
        return;
      }
      const filtered = state.cachedMembers.filter(m =>
        (m.username && m.username.toLowerCase().includes(q)) ||
        (m.nickname && m.nickname.toLowerCase().includes(q)) ||
        (m.roles && m.roles.some(r => r.toLowerCase().includes(q)))
      );
      renderMembersTable(filtered);
    });
  }
}

