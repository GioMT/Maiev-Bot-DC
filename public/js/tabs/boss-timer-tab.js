import { state } from '../state.js?v=6.0';
import { formatDiscordMarkdown, refreshIcons, showToast } from '../utils.js?v=6.0';

const DEFAULT_BOSS_TITLES = {
  abyssTitle: '🔥 Fregion — Reshanta / Abyss Bosses',
  elyosTitle: '🪽 Fregion — Verteron Field Bosses',
  footerText: '● Alive  ○ Respawning (00d 00h 00m)  ★ Major boss  •  Updates every 1m'
};

const KNOWN_RESHANTA_BOSSES = [
  'Watcher Kaira',
  'Argo, the Spirit King',
  'Guardian Lord Nahma',
  'Executor Tamasa',
  'Executor Argo',
  'Executor Kaira'
];

const KNOWN_VERTERON_BOSSES = [
  'Soul Ruler Kashapa',
  'Silent Dartan',
  'Eternal Gartua',
  'High Commander Lagta',
  'Neikel of the East',
  'Rotten Kutar',
  'Kernon of the West',
  'Kusan the Mad Gladiator',
  'Ritualist Garshim',
  'Bodyguard Teegant',
  'Blooming Korin',
  'Furious Saursus',
  'Bloodfang Pnyn',
  'Heretic Layla',
  'Black Tentacle Lawa',
  'Phantasm Kasia',
  'Centurion Demiros',
  'Divine Ansas',
  'Harvest Manager Moshav',
  'Sentinel K\'nash',
  'Scholar Aulla',
  'Forest Warrior Aullamu',
  'Chaser Taulo',
  'Researcher Setram'
];

let bossTimerData = null;
let majorBossesSet = new Set([
  'Watcher Kaira',
  'Argo, the Spirit King',
  'Guardian Lord Nahma',
  'Eternal Gartua',
  'High Commander Lagta',
  'Soul Ruler Kashapa',
  'Silent Dartan',
  'Executor Tamasa',
  'Executor Argo',
  'Executor Kaira'
]);

function formatCountdownClient(ms) {
  const total = Math.max(0, Math.floor(ms / 1000));
  const d = Math.floor(total / 86400);
  const h = Math.floor((total % 86400) / 3600);
  const m = Math.floor((total % 3600) / 60);
  const pad = (n) => String(n).padStart(2, '0');
  if (d > 0) return `${pad(d)}d ${pad(h)}h ${pad(m)}m`;
  return `${pad(h)}h ${pad(m)}m`;
}

function buildClientBossTable(bosses, now = Date.now()) {
  if (!Array.isArray(bosses) || bosses.length === 0) {
    return 'No boss data currently available.';
  }
  const nameWidth = Math.max(4, ...bosses.map((b) => b.name.length));
  const entries = bosses.map((b) => {
    const alive = b.alive || b.time - now <= 0;
    const status = b.alive ? 'Alive' : (b.time - now <= 0 ? 'Spawning' : formatCountdownClient(b.time - now));
    return { boss: b, status, alive };
  });
  const statusWidth = Math.max(6, ...entries.map((e) => e.status.length + 2));
  const header = `${'Boss'.padEnd(nameWidth)}  Status`;
  const divider = `${'─'.repeat(nameWidth)}  ${'─'.repeat(statusWidth)}`;

  const rows = entries.map(({ boss: b, status, alive }) => {
    const dot = alive ? '●' : '○';
    const star = majorBossesSet.has(b.name) ? '  ★' : '';
    return `${b.name.padEnd(nameWidth)}  ${dot} ${status.padEnd(statusWidth - 2)}${star}`.trimEnd();
  });

  return [header, divider, ...rows].join('\n');
}

export async function fetchBossTimerState() {
  try {
    const res = await fetch('/api/boss-timer');
    if (!res.ok) return;
    const data = await res.json();
    bossTimerData = data;

    if (Array.isArray(data.config?.majorBosses)) {
      majorBossesSet = new Set(data.config.majorBosses);
    }

    renderBossTimerEditor(data);
    renderMajorBossesPills();
    updateBossTimerPreview();
    refreshIcons();
  } catch (err) {
    console.error('Error fetching boss timer state:', err);
  }
}

export function renderBossTimerChannelDropdowns(channels = []) {
  const trackerSelect = document.getElementById('select-boss-timer-channel');
  const alertSelect = document.getElementById('select-boss-alert-channel');
  const cfg = bossTimerData?.config || {};

  if (trackerSelect) {
    const currentVal = cfg.channelId || trackerSelect.value || '1563876333623312394';
    trackerSelect.innerHTML = '<option value="">-- Choose Tracker Channel --</option>';
    channels.forEach(ch => {
      const opt = document.createElement('option');
      opt.value = ch.id;
      opt.textContent = `#${ch.name}`;
      if (ch.id === currentVal || (!cfg.channelId && /boss|timer/i.test(ch.name))) {
        opt.selected = true;
      }
      trackerSelect.appendChild(opt);
    });
  }

  if (alertSelect) {
    const currentAlertVal = cfg.alertChannelId || alertSelect.value || '';
    alertSelect.innerHTML = '<option value="">-- Disabled (No @here Alert Channel) --</option>';
    channels.forEach(ch => {
      const opt = document.createElement('option');
      opt.value = ch.id;
      opt.textContent = `#${ch.name}`;
      if (ch.id === currentAlertVal || (!currentAlertVal && /general|alert/i.test(ch.name))) {
        if (currentAlertVal === ch.id) opt.selected = true;
      }
      alertSelect.appendChild(opt);
    });
  }
}

export function renderBossTimerEditor(data) {
  const cfg = data?.config || {};

  const serverIdInput = document.getElementById('boss-server-id-input');
  if (serverIdInput) serverIdInput.value = cfg.serverId || 1507;

  const enableAlertsEl = document.getElementById('check-boss-enable-alerts');
  if (enableAlertsEl) enableAlertsEl.checked = cfg.enableAlerts !== false;

  const autoDeleteEl = document.getElementById('check-boss-autodelete-alerts');
  if (autoDeleteEl) autoDeleteEl.checked = cfg.autoDeleteAlerts !== false;

  const abyssTitleEl = document.getElementById('boss-abyss-title-input');
  if (abyssTitleEl) abyssTitleEl.value = cfg.abyssTitle || DEFAULT_BOSS_TITLES.abyssTitle;

  const elyosTitleEl = document.getElementById('boss-elyos-title-input');
  if (elyosTitleEl) elyosTitleEl.value = cfg.elyosTitle || DEFAULT_BOSS_TITLES.elyosTitle;

  const footerEl = document.getElementById('boss-footer-input');
  if (footerEl) footerEl.value = cfg.footerText || DEFAULT_BOSS_TITLES.footerText;

  // Populate channel selects if serverState channels are already loaded
  if (state.serverState?.guild?.channels) {
    renderBossTimerChannelDropdowns(state.serverState.guild.channels);
  }

  // Update telemetry badges inside Boss Timer card
  const syncBadge = document.getElementById('boss-sync-status-badge');
  if (syncBadge) {
    if (data.isFallback) {
      syncBadge.className = 'badge badge-warning';
      syncBadge.innerHTML = '<i data-lucide="radio"></i> Simulated Preview Data';
    } else {
      syncBadge.className = 'badge badge-success';
      syncBadge.innerHTML = '<i data-lucide="check-circle-2"></i> Live Questlog Synced';
    }
  }

  const msgBadge = document.getElementById('boss-deployed-msg-badge');
  if (msgBadge) {
    if (cfg.messageId) {
      msgBadge.className = 'badge badge-accent';
      msgBadge.textContent = `Message ID: ...${String(cfg.messageId).slice(-6)}`;
    } else {
      msgBadge.className = 'badge';
      msgBadge.textContent = 'Not Posted Yet';
    }
  }
}

export function renderMajorBossesPills() {
  const container = document.getElementById('boss-major-watchlist-container');
  const countBadge = document.getElementById('boss-major-count-badge');
  if (countBadge) countBadge.textContent = `${majorBossesSet.size} Major Bosses`;
  if (!container) return;
  container.innerHTML = '';
  container.style.display = 'flex';
  container.style.flexDirection = 'column';
  container.style.gap = '14px';

  const reshantaNames = Array.from(new Set([
    ...((bossTimerData?.abyssBosses || []).map(b => b.name)),
    ...KNOWN_RESHANTA_BOSSES
  ]));

  const verteronNames = Array.from(new Set([
    ...((bossTimerData?.elyosBosses || []).map(b => b.name)),
    ...KNOWN_VERTERON_BOSSES
  ])).filter(name => !reshantaNames.includes(name));

  const customNames = Array.from(majorBossesSet).filter(
    name => !reshantaNames.includes(name) && !verteronNames.includes(name)
  );

  function createBossGroupSection(title, icon, accentColor, bossNames) {
    const groupBox = document.createElement('div');
    groupBox.style.cssText = `background: rgba(255,255,255,0.02); border: 1px solid rgba(255,255,255,0.08); border-left: 3px solid ${accentColor}; border-radius: 8px; padding: 10px 12px;`;

    const activeCount = bossNames.filter(n => majorBossesSet.has(n)).length;

    const header = document.createElement('div');
    header.style.cssText = 'display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; flex-wrap: wrap; gap: 6px;';
    header.innerHTML = `
      <div style="display: flex; align-items: center; gap: 8px;">
        <span style="font-size: 0.82rem; font-weight: 700; color: #fff; text-transform: uppercase; letter-spacing: 0.4px;">${icon} ${title}</span>
        <span style="font-size: 0.72rem; padding: 1px 7px; border-radius: 10px; background: rgba(255,255,255,0.08); color: var(--text-secondary);">${activeCount} / ${bossNames.length} ★</span>
      </div>
      <div style="display: flex; gap: 6px;">
        <button type="button" class="btn btn-xs btn-secondary btn-group-select-all" style="padding: 2px 8px; font-size: 0.72rem;">Select All</button>
        <button type="button" class="btn btn-xs btn-secondary btn-group-clear-all" style="padding: 2px 8px; font-size: 0.72rem;">Clear</button>
      </div>
    `;

    header.querySelector('.btn-group-select-all')?.addEventListener('click', () => {
      bossNames.forEach(n => majorBossesSet.add(n));
      renderMajorBossesPills();
      updateBossTimerPreview();
    });

    header.querySelector('.btn-group-clear-all')?.addEventListener('click', () => {
      bossNames.forEach(n => majorBossesSet.delete(n));
      renderMajorBossesPills();
      updateBossTimerPreview();
    });

    groupBox.appendChild(header);

    const pillsWrap = document.createElement('div');
    pillsWrap.style.cssText = 'display: flex; gap: 8px; flex-wrap: wrap;';

    bossNames.forEach(name => {
      const isMajor = majorBossesSet.has(name);
      const pill = document.createElement('button');
      pill.type = 'button';
      pill.className = `category-filter-chip ${isMajor ? 'active' : ''}`;
      pill.style.cssText = `cursor: pointer; display: inline-flex; align-items: center; gap: 6px; padding: 5px 11px; border-radius: 6px; font-size: 0.8rem; border: 1px solid ${isMajor ? 'rgba(0, 210, 255, 0.5)' : 'rgba(255,255,255,0.12)'}; background: ${isMajor ? 'rgba(0, 210, 255, 0.16)' : 'rgba(255,255,255,0.04)'}; color: ${isMajor ? '#fff' : '#949ba4'};`;
      pill.innerHTML = `<span>${isMajor ? '★' : '☆'}</span> <span>${name}</span>`;
      pill.title = isMajor ? 'Click to remove from Major Boss watchlist' : 'Click to mark as Major Boss (★ & 10m @here alert)';

      pill.addEventListener('click', () => {
        if (majorBossesSet.has(name)) {
          majorBossesSet.delete(name);
        } else {
          majorBossesSet.add(name);
        }
        renderMajorBossesPills();
        updateBossTimerPreview();
      });

      pillsWrap.appendChild(pill);
    });

    groupBox.appendChild(pillsWrap);
    return groupBox;
  }

  container.appendChild(createBossGroupSection('Reshanta Bosses (Abyss)', '🔥', '#e74c3c', reshantaNames));
  container.appendChild(createBossGroupSection('Verteron Bosses (Elyos)', '🪽', '#3498db', verteronNames));

  if (customNames.length > 0) {
    container.appendChild(createBossGroupSection('Custom Watchlist Bosses', '⭐', '#f1c40f', customNames));
  }
}

export function updateBossTimerPreview() {
  const abyssTitle = document.getElementById('boss-abyss-title-input')?.value || DEFAULT_BOSS_TITLES.abyssTitle;
  const elyosTitle = document.getElementById('boss-elyos-title-input')?.value || DEFAULT_BOSS_TITLES.elyosTitle;
  const footerText = document.getElementById('boss-footer-input')?.value || DEFAULT_BOSS_TITLES.footerText;

  const simAbyssTitle = document.getElementById('sim-boss-abyss-title');
  const simElyosTitle = document.getElementById('sim-boss-elyos-title');
  const simFooter = document.getElementById('sim-boss-footer');
  const simAbyssTable = document.getElementById('sim-boss-abyss-table');
  const simElyosTable = document.getElementById('sim-boss-elyos-table');

  if (simAbyssTitle) simAbyssTitle.innerHTML = formatDiscordMarkdown(abyssTitle);
  if (simElyosTitle) simElyosTitle.innerHTML = formatDiscordMarkdown(elyosTitle);
  if (simFooter) simFooter.textContent = footerText;

  const now = Date.now();
  const abyssBosses = bossTimerData?.abyssBosses || [];
  const elyosBosses = bossTimerData?.elyosBosses || [];

  if (simAbyssTable) {
    simAbyssTable.textContent = buildClientBossTable(abyssBosses, now);
  }
  if (simElyosTable) {
    simElyosTable.textContent = buildClientBossTable(elyosBosses, now);
  }

  // Update channel name in simulator header
  const trackerSelect = document.getElementById('select-boss-timer-channel');
  const simChName = document.getElementById('sim-boss-channel-name');
  if (simChName && trackerSelect?.selectedOptions?.[0]?.text?.startsWith('#')) {
    simChName.textContent = trackerSelect.selectedOptions[0].text.replace('#', '');
  }

  // Update simulated 10-minute alert boss name
  const firstMajor = Array.from(majorBossesSet)[0] || 'Watcher Kaira';
  const simAlertDesc = document.getElementById('sim-boss-alert-desc');
  if (simAlertDesc) {
    simAlertDesc.innerHTML = `${formatDiscordMarkdown(`**Major Boss Spawning Soon: ${firstMajor}**`)} <span style="background: rgba(255,255,255,0.1); padding: 1px 5px; border-radius: 3px; font-size: 0.78rem;">in 10 minutes</span>`;
  }
}

export async function saveBossTimerSettings() {
  const serverId = Number(document.getElementById('boss-server-id-input')?.value) || 1507;
  const channelId = document.getElementById('select-boss-timer-channel')?.value || '';
  const alertChannelId = document.getElementById('select-boss-alert-channel')?.value || '';
  const enableAlerts = document.getElementById('check-boss-enable-alerts')?.checked !== false;
  const autoDeleteAlerts = document.getElementById('check-boss-autodelete-alerts')?.checked !== false;
  const abyssTitle = document.getElementById('boss-abyss-title-input')?.value.trim() || DEFAULT_BOSS_TITLES.abyssTitle;
  const elyosTitle = document.getElementById('boss-elyos-title-input')?.value.trim() || DEFAULT_BOSS_TITLES.elyosTitle;
  const footerText = document.getElementById('boss-footer-input')?.value.trim() || DEFAULT_BOSS_TITLES.footerText;

  const res = await fetch('/api/boss-timer/config', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      serverId,
      channelId,
      alertChannelId,
      enableAlerts,
      autoDeleteAlerts,
      abyssTitle,
      elyosTitle,
      footerText,
      majorBosses: Array.from(majorBossesSet)
    })
  });

  if (!res.ok) throw new Error('Failed to save Boss Timer settings');
  const data = await res.json();
  bossTimerData = data;
  renderBossTimerEditor(data);
  updateBossTimerPreview();
  return data;
}

export function setupBossTimerTabListeners() {
  document.getElementById('boss-abyss-title-input')?.addEventListener('input', updateBossTimerPreview);
  document.getElementById('boss-elyos-title-input')?.addEventListener('input', updateBossTimerPreview);
  document.getElementById('boss-footer-input')?.addEventListener('input', updateBossTimerPreview);
  document.getElementById('select-boss-timer-channel')?.addEventListener('change', updateBossTimerPreview);

  // Add custom major boss button
  document.getElementById('btn-add-major-boss')?.addEventListener('click', () => {
    const input = document.getElementById('new-major-boss-input');
    const name = input?.value.trim();
    if (!name) {
      showToast('Enter a boss name to add to the Major Boss watchlist.', 'error');
      return;
    }
    majorBossesSet.add(name);
    input.value = '';
    renderMajorBossesPills();
    updateBossTimerPreview();
    showToast(`Added "${name}" to Major Boss watchlist (★)!`, 'success');
  });

  // Reset Boss Timer Titles & Major Bosses
  document.getElementById('btn-reset-boss-template')?.addEventListener('click', () => {
    document.getElementById('boss-abyss-title-input').value = DEFAULT_BOSS_TITLES.abyssTitle;
    document.getElementById('boss-elyos-title-input').value = DEFAULT_BOSS_TITLES.elyosTitle;
    document.getElementById('boss-footer-input').value = DEFAULT_BOSS_TITLES.footerText;
    if (bossTimerData?.defaultMajorBosses) {
      majorBossesSet = new Set(bossTimerData.defaultMajorBosses);
      renderMajorBossesPills();
    }
    updateBossTimerPreview();
    showToast('Reset Boss Timer titles and Major Boss watchlist to defaults!', 'success');
  });

  // Save Boss Timer button
  document.getElementById('btn-save-boss-timer')?.addEventListener('click', async () => {
    try {
      await saveBossTimerSettings();
      showToast('Boss Timer settings saved!', 'success');
    } catch (err) {
      showToast(`Error: ${err.message}`, 'error');
    }
  });

  // Force Sync Questlog button
  const btnSync = document.getElementById('btn-sync-boss-data');
  if (btnSync) {
    btnSync.addEventListener('click', async () => {
      btnSync.disabled = true;
      btnSync.innerHTML = '<i data-lucide="loader-2"></i> Syncing...';
      try {
        await saveBossTimerSettings();
        const res = await fetch('/api/boss-timer/sync', { method: 'POST' });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Sync failed');
        bossTimerData = data;
        renderBossTimerEditor(data);
        renderMajorBossesPills();
        updateBossTimerPreview();
        showToast(data.isFallback
          ? 'Updated preview timers (Questlog unreachable from this host; using preview dataset).'
          : 'Synced live boss timers from Questlog!', 'success');
      } catch (err) {
        showToast(`Error: ${err.message}`, 'error');
      } finally {
        btnSync.disabled = false;
        btnSync.innerHTML = '<i data-lucide="refresh-cw"></i> Sync Questlog Now';
        refreshIcons();
      }
    });
  }

  // Post / Update Boss Timer in Discord
  const handlePostBossTimer = async (forceNew = false) => {
    const channelId = document.getElementById('select-boss-timer-channel')?.value;
    if (!channelId) {
      showToast('Please select a target Boss Timer channel first.', 'error');
      return;
    }
    try {
      await saveBossTimerSettings();
      const res = await fetch('/api/boss-timer/post', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ channelId, forceNew })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to post Boss Timer');
      bossTimerData = data;
      renderBossTimerEditor(data);
      updateBossTimerPreview();
      showToast(data.posted
        ? `Posted new live Boss Timer table in #${data.channelName}!`
        : `Updated existing Boss Timer table in #${data.channelName}!`, 'success');
    } catch (err) {
      showToast(`Error: ${err.message}`, 'error');
    }
  };

  document.getElementById('btn-post-boss-timer')?.addEventListener('click', () => handlePostBossTimer(false));
  document.getElementById('btn-force-new-boss-timer')?.addEventListener('click', () => handlePostBossTimer(true));

  // Send Test 10m Alert
  document.getElementById('btn-test-boss-alert')?.addEventListener('click', async () => {
    const alertChannelId = document.getElementById('select-boss-alert-channel')?.value;
    if (!alertChannelId) {
      showToast('Please select a 10-Minute Alert Channel first.', 'error');
      return;
    }
    const bossName = Array.from(majorBossesSet)[0] || 'Watcher Kaira';
    try {
      await saveBossTimerSettings();
      const res = await fetch('/api/boss-timer/test-alert', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ alertChannelId, bossName })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to send test alert');
      showToast(`Sent test 10m @here alert for "${data.bossName}" to #${data.channelName}!`, 'success');
    } catch (err) {
      showToast(`Error: ${err.message}`, 'error');
    }
  });
}

