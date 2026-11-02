import { state } from '../state.js?v=4.9';
import { formatDiscordMarkdown, normalizeEmojiCode, renderEmojiHtml, refreshIcons, showToast } from '../utils.js?v=4.9';

function escapeHtml(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

const DAY_LABELS = [
  { day: 1, short: 'Mon', full: 'Monday' },
  { day: 2, short: 'Tue', full: 'Tuesday' },
  { day: 3, short: 'Wed', full: 'Wednesday' },
  { day: 4, short: 'Thu', full: 'Thursday' },
  { day: 5, short: 'Fri', full: 'Friday' },
  { day: 6, short: 'Sat', full: 'Saturday' },
  { day: 0, short: 'Sun', full: 'Sunday' }
];

let alertsList = [];
let activeAlertId = 'abyss-farming';

function formatTime12h(hhmm) {
  if (!hhmm || !/^\d{2}:\d{2}$/.test(hhmm)) return hhmm;
  const [hStr, mStr] = hhmm.split(':');
  const h = parseInt(hStr, 10);
  const suffix = h >= 12 ? 'PM' : 'AM';
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${mStr} ${suffix}`;
}

function phtToServerTime24h(hhmm) {
  if (!hhmm || !/^\d{2}:\d{2}$/.test(hhmm)) return hhmm;
  const [h, m] = hhmm.split(':').map(Number);
  const stH = (h + 1) % 24;
  return `${String(stH).padStart(2, '0')}:${String(m).padStart(2, '0')} ST`;
}

/**
 * Compute minutes remaining from alertHHMM to eventHHMM
 */
function computeRemainingMinutesBetween(alertHHMM, eventHHMM) {
  if (!/^\d{2}:\d{2}$/.test(alertHHMM || '') || !/^\d{2}:\d{2}$/.test(eventHHMM || '')) {
    return 0;
  }
  const [aH, aM] = alertHHMM.split(':').map(Number);
  const [eH, eM] = eventHHMM.split(':').map(Number);
  let diff = (eH * 60 + eM) - (aH * 60 + aM);
  if (diff < 0) diff += 24 * 60;
  return diff;
}

/**
 * Given a scheduled alert time (e.g. "01:50") and an array of daily eventTimes (e.g. ["02:00", "05:00", ...]),
 * find the nearest upcoming Event Start Time and return { matchedEventHHMM, diffMins }.
 */
function findNearestEventForAlertSlot(slotHHMM, eventTimes) {
  const list = Array.isArray(eventTimes) && eventTimes.length > 0 ? eventTimes : ['20:00'];
  let bestEvent = list[0];
  let bestDiff = computeRemainingMinutesBetween(slotHHMM, bestEvent);

  for (const ev of list) {
    const d = computeRemainingMinutesBetween(slotHHMM, ev);
    if (d < bestDiff) {
      bestDiff = d;
      bestEvent = ev;
    }
  }
  return { matchedEventHHMM: bestEvent, diffMins: bestDiff };
}

function formatCountdownBadgeText(diffMins) {
  if (diffMins <= 0) return 'now';
  const hrs = Math.floor(diffMins / 60);
  const mins = diffMins % 60;
  const parts = [];
  if (hrs > 0) parts.push(`${hrs} hour${hrs === 1 ? '' : 's'}`);
  if (mins > 0) parts.push(`${mins} minute${mins === 1 ? '' : 's'}`);
  return `in ${parts.join(' ')}`;
}

function formatShortOffsetLabel(diffMins, matchedEventHHMM) {
  const evLabel = formatTime12h(matchedEventHHMM || '20:00');
  if (diffMins <= 0) return `at ${evLabel}`;
  const hrs = Math.floor(diffMins / 60);
  const mins = diffMins % 60;
  const parts = [];
  if (hrs > 0) parts.push(`${hrs}h`);
  if (mins > 0) parts.push(`${mins}m`);
  return `${parts.join(' ')} before ${evLabel}`;
}

function subtractMinutesFromHHMM(eventHHMM, minsBefore) {
  const [eH, eM] = (eventHHMM || '20:00').split(':').map(Number);
  let total = (eH * 60 + eM - (Number(minsBefore) || 0)) % (24 * 60);
  if (total < 0) total += 24 * 60;
  const hh = String(Math.floor(total / 60)).padStart(2, '0');
  const mm = String(total % 60).padStart(2, '0');
  return `${hh}:${mm}`;
}

function ensureEventTimesAndOffsets(active) {
  if (!active) return;
  if (active.emoji) {
    active.emoji = normalizeEmojiCode(active.emoji);
  }
  if (!Array.isArray(active.eventTimes) || active.eventTimes.length === 0) {
    active.eventTimes = [active.eventTime || '20:00'];
  }
  active.eventTime = active.eventTimes[0];
  if (!Array.isArray(active.alertOffsets)) {
    active.alertOffsets = [10, 1];
  }
}

function rebuildScheduledTimesFromEventOffsets(active) {
  ensureEventTimesAndOffsets(active);
  if (!active.alertOffsets.length || !active.eventTimes.length) return;
  const generated = new Set();
  active.eventTimes.forEach(evTime => {
    active.alertOffsets.forEach(offsetMins => {
      generated.add(subtractMinutesFromHHMM(evTime, offsetMins));
    });
  });
  active.times = [...generated].sort();
}

export function getActiveAlert() {
  if (!alertsList.length) return null;
  let found = alertsList.find(a => a.id === activeAlertId);
  if (!found) {
    found = alertsList[0];
    activeAlertId = found.id;
  }
  ensureEventTimesAndOffsets(found);
  return found;
}

export async function fetchAlertsState() {
  try {
    const res = await fetch('/api/alerts');
    if (!res.ok) throw new Error('Failed to load alerts config');
    const data = await res.json();
    alertsList = Array.isArray(data.alerts) ? data.alerts : [];
    alertsList.forEach(ensureEventTimesAndOffsets);
    if (!alertsList.some(a => a.id === activeAlertId) && alertsList.length > 0) {
      activeAlertId = alertsList[0].id;
    }
    renderAlertsSubtabs();
    renderActiveAlertForm();
    updateAlertsPreview();
  } catch (err) {
    console.error('Error loading scheduled alerts:', err);
  }
}

function getLinkedPresetRoleInfo(alert, data) {
  if (!alert || alert.isCustom) return { hasPresetSlot: false, linkedRoleObj: null };
  const cfg = data?.config || state.serverState?.config || {};
  const roles = data?.guild?.roles || state.serverState?.guild?.roles || [];
  const notifRoles = cfg.reactionPresets?.notifications?.roles || [];
  const match = notifRoles.find(
    r =>
      (r.code && (r.code === alert.code || r.code === alert.id)) ||
      (r.name && r.name.toLowerCase() === (alert.name || '').toLowerCase())
  );
  if (!match) return { hasPresetSlot: false, linkedRoleObj: null };
  const linkedRoleObj = match.roleId ? roles.find(r => r.id === match.roleId) || null : null;
  return { hasPresetSlot: true, linkedRoleObj };
}

export function renderAlertsChannelAndRoleDropdowns(data) {
  const channels = data?.guild?.channels || state.serverState?.guild?.channels || [];
  const roles = data?.guild?.roles || state.serverState?.guild?.roles || [];
  const serverRoles = roles.filter(r => r.name !== '@everyone');

  const chSelect = document.getElementById('select-alert-target-channel');
  if (chSelect) {
    const currentVal = chSelect.value;
    chSelect.innerHTML = '<option value="">-- Select Target Channel --</option>';
    channels.forEach(ch => {
      const opt = document.createElement('option');
      opt.value = ch.id;
      opt.textContent = `#${ch.name}`;
      chSelect.appendChild(opt);
    });
    const active = getActiveAlert();
    if (active && active.channelId) {
      chSelect.value = active.channelId;
    } else if (currentVal) {
      chSelect.value = currentVal;
    }
  }

  const pingSelect = document.getElementById('select-alert-ping-type');
  if (pingSelect) {
    const active = getActiveAlert();
    const isCustomAlert = Boolean(active?.isCustom);
    const { linkedRoleObj } = getLinkedPresetRoleInfo(active, data);

    let desiredVal = isCustomAlert ? 'none' : 'preset_role';
    if (active) {
      if (active.pingType === 'role' && active.roleId) {
        desiredVal = `role:${active.roleId}`;
      } else if (active.pingType === 'preset_role' && isCustomAlert) {
        active.pingType = 'none';
        desiredVal = 'none';
      } else if (active.pingType) {
        desiredVal = active.pingType;
      }
    } else if (pingSelect.value) {
      desiredVal = pingSelect.value;
    }

    const presetLabel = linkedRoleObj
      ? `Linked Notification Preset Role (@${escapeHtml(linkedRoleObj.name)})`
      : 'Linked Notification Preset Role (Auto — Not Linked Yet)';

    pingSelect.innerHTML = `
      <optgroup label="Mention / Ping Options">
        <option value="none">-- Leave Blank (No Role / No Ping) --</option>
        ${!isCustomAlert ? `<option value="preset_role">${presetLabel}</option>` : ''}
        <option value="everyone">@everyone Mention</option>
        <option value="here">@here Mention</option>
      </optgroup>
    `;

    if (serverRoles.length > 0) {
      const optGroup = document.createElement('optgroup');
      optGroup.label = 'Server Roles';
      serverRoles.forEach(r => {
        const opt = document.createElement('option');
        opt.value = `role:${r.id}`;
        opt.textContent = `@${r.name}`;
        optGroup.appendChild(opt);
      });
      pingSelect.appendChild(optGroup);
    }

    pingSelect.value = desiredVal;
    if (!pingSelect.value) {
      pingSelect.value = isCustomAlert ? 'none' : 'preset_role';
    }
  }

  // Also populate the Create Custom Alert modal's Role / Mention Ping dropdown
  const createPingSelect = document.getElementById('create-alert-ping-type');
  if (createPingSelect) {
    const prevCreateVal = createPingSelect.value || 'none';
    createPingSelect.innerHTML = `
      <optgroup label="Mention / Ping Options">
        <option value="none">-- Leave Blank (No Role / No Ping) --</option>
        <option value="everyone">@everyone Mention</option>
        <option value="here">@here Mention</option>
      </optgroup>
    `;
    if (serverRoles.length > 0) {
      const optGroup = document.createElement('optgroup');
      optGroup.label = 'Server Roles';
      serverRoles.forEach(r => {
        const opt = document.createElement('option');
        opt.value = `role:${r.id}`;
        opt.textContent = `@${r.name}`;
        optGroup.appendChild(opt);
      });
      createPingSelect.appendChild(optGroup);
    }
    createPingSelect.value = prevCreateVal;
    if (!createPingSelect.value) createPingSelect.value = 'none';
  }
}

export function renderAlertsSubtabs() {
  const container = document.getElementById('alerts-subtabs-list');
  if (!container) return;
  container.innerHTML = '';

  alertsList.forEach(alert => {
    const btn = document.createElement('button');
    const isActive = alert.id === activeAlertId;
    btn.type = 'button';
    btn.className = `reaction-subtab-btn ${isActive ? 'active' : ''}`;
    const timeCount = Array.isArray(alert.times) ? alert.times.length : 0;
    const statusDotColor = alert.enabled ? '#23a55a' : '#6b7280';

    btn.innerHTML = `
      <span style="width: 7px; height: 7px; border-radius: 50%; background: ${statusDotColor}; display: inline-block;"></span>
      <span>${renderEmojiHtml(alert.emoji || '🔔')}</span>
      <span>${escapeHtml(alert.name)}</span>
      <span class="subtab-count-pill">${timeCount}t</span>
    `;

    btn.addEventListener('click', () => {
      syncCurrentFormToActiveAlert();
      activeAlertId = alert.id;
      renderAlertsSubtabs();
      renderActiveAlertForm();
      updateAlertsPreview();
    });

    container.appendChild(btn);
  });

  const deleteCustomBtn = document.getElementById('btn-delete-custom-alert');
  if (deleteCustomBtn) {
    deleteCustomBtn.classList.toggle('hidden', alertsList.length <= 1);
  }
}

export function renderActiveAlertForm() {
  const active = getActiveAlert();
  if (!active) return;

  renderAlertsChannelAndRoleDropdowns(state.serverState);

  const badgeType = document.getElementById('active-alert-type-badge');
  if (badgeType) {
    badgeType.textContent = active.isCustom ? 'Custom Alert Embed' : 'Recurring Game Timer';
    badgeType.className = active.isCustom ? 'badge badge-accent' : 'badge badge-success';
  }

  const enabledCheck = document.getElementById('check-alert-enabled');
  if (enabledCheck) enabledCheck.checked = Boolean(active.enabled);

  const chSelect = document.getElementById('select-alert-target-channel');
  if (chSelect) chSelect.value = active.channelId || '';

  const pingSelect = document.getElementById('select-alert-ping-type');
  if (pingSelect) {
    if (active.pingType === 'role' && active.roleId) {
      pingSelect.value = `role:${active.roleId}`;
    } else if (active.pingType === 'preset_role' && active.isCustom) {
      active.pingType = 'none';
      pingSelect.value = 'none';
    } else {
      pingSelect.value = active.pingType || (active.isCustom ? 'none' : 'preset_role');
    }
  }

  const eventTimeInput = document.getElementById('input-alert-event-time');
  if (eventTimeInput) eventTimeInput.value = active.eventTimes?.[0] || active.eventTime || '02:00';

  const scheduleModeSelect = document.getElementById('select-alert-schedule-mode');
  if (scheduleModeSelect) scheduleModeSelect.value = active.scheduleMode || 'daily';

  const daysWrap = document.getElementById('alert-days-picker-wrap');
  if (daysWrap) {
    daysWrap.style.opacity = active.scheduleMode === 'days' ? '1' : '0.45';
    daysWrap.style.pointerEvents = active.scheduleMode === 'days' ? 'auto' : 'none';
  }

  renderEventTimesPills(active);
  renderOffsetsPills(active);
  renderDaysOfWeekPills(active);
  renderScheduledTimesPills(active);

  const autoDeleteCheck = document.getElementById('check-alert-autodelete');
  if (autoDeleteCheck) autoDeleteCheck.checked = active.autoDelete !== false;

  const deleteMinsInput = document.getElementById('input-alert-delete-minutes');
  if (deleteMinsInput) deleteMinsInput.value = active.deleteAfterMinutes || 15;

  const nameInput = document.getElementById('input-alert-name');
  if (nameInput) nameInput.value = active.name || '';

  const emojiInput = document.getElementById('input-alert-emoji');
  if (emojiInput) emojiInput.value = active.emoji || '🔔';
  if (window.__maievEmojiPicker && typeof window.__maievEmojiPicker.setTriggerEmoji === 'function') {
    window.__maievEmojiPicker.setTriggerEmoji('input-alert-emoji', active.emoji || '🔔');
  }

  const colorInput = document.getElementById('input-alert-color');
  if (colorInput) colorInput.value = active.embedColor || '#e67e22';

  const titleInput = document.getElementById('input-alert-title');
  if (titleInput) titleInput.value = active.embedTitle ?? '';

  const descInput = document.getElementById('input-alert-description');
  if (descInput) descInput.value = active.embedDescription ?? '';

  const footerInput = document.getElementById('input-alert-footer');
  if (footerInput) footerInput.value = active.embedFooter ?? 'Aion 2 Scheduled Alert';

  const tsCheck = document.getElementById('check-alert-timestamp');
  if (tsCheck) tsCheck.checked = Boolean(active.includeTimestamp);

  const deleteCustomBtn = document.getElementById('btn-delete-custom-alert');
  if (deleteCustomBtn) {
    deleteCustomBtn.classList.toggle('hidden', alertsList.length <= 1);
  }
}

function renderEventTimesPills(active) {
  const container = document.getElementById('alert-event-times-pills-container');
  if (!container) return;
  ensureEventTimesAndOffsets(active);

  const evTimes = [...active.eventTimes].sort();
  active.eventTimes = evTimes;
  active.eventTime = evTimes[0] || '20:00';

  container.innerHTML = '';
  evTimes.forEach(ev => {
    const pill = document.createElement('div');
    pill.style.cssText = 'display: inline-flex; align-items: center; gap: 6px; background: rgba(240, 178, 50, 0.14); border: 1px solid rgba(240, 178, 50, 0.45); color: #fff; padding: 4px 9px; border-radius: 6px; font-size: 0.78rem; font-weight: 600;';
    pill.innerHTML = `
      <span style="color: #f0b232;">🔥 ${escapeHtml(formatTime12h(ev))} PHT</span>
      <span style="font-size: 0.7rem; color: var(--text-muted);">(${escapeHtml(phtToServerTime24h(ev))})</span>
      <button type="button" title="Remove Event Time ${escapeHtml(ev)}" style="background: none; border: none; color: #949ba4; cursor: pointer; font-size: 0.95rem; line-height: 1; padding: 0 2px;">&times;</button>
    `;

    pill.querySelector('button')?.addEventListener('click', () => {
      if (active.eventTimes.length <= 1) {
        showToast('At least one Event Start Time is required.', 'info');
        return;
      }
      active.eventTimes = active.eventTimes.filter(x => x !== ev);
      active.eventTime = active.eventTimes[0];
      rebuildScheduledTimesFromEventOffsets(active);
      renderEventTimesPills(active);
      renderScheduledTimesPills(active);
      renderAlertsSubtabs();
      updateAlertsPreview();
    });

    container.appendChild(pill);
  });
}

function renderOffsetsPills(active) {
  const container = document.getElementById('alert-offsets-pills-container');
  if (!container) return;
  ensureEventTimesAndOffsets(active);

  const offsets = [...active.alertOffsets].sort((a, b) => b - a);
  active.alertOffsets = offsets;

  container.innerHTML = '';
  offsets.forEach(mins => {
    const pill = document.createElement('div');
    pill.style.cssText = 'display: inline-flex; align-items: center; gap: 5px; background: rgba(35, 165, 90, 0.14); border: 1px solid rgba(35, 165, 90, 0.45); color: #fff; padding: 3px 8px; border-radius: 5px; font-size: 0.76rem; font-weight: 600;';
    pill.innerHTML = `
      <span style="color: #23a55a;">⚡ ${mins}m before</span>
      <button type="button" title="Remove ${mins}m offset" style="background: none; border: none; color: #949ba4; cursor: pointer; font-size: 0.92rem; line-height: 1; padding: 0 2px;">&times;</button>
    `;

    pill.querySelector('button')?.addEventListener('click', () => {
      active.alertOffsets = active.alertOffsets.filter(x => x !== mins);
      rebuildScheduledTimesFromEventOffsets(active);
      renderOffsetsPills(active);
      renderScheduledTimesPills(active);
      renderAlertsSubtabs();
      updateAlertsPreview();
    });

    container.appendChild(pill);
  });
}

function renderDaysOfWeekPills(active) {
  const container = document.getElementById('alert-days-pills-container');
  if (!container) return;
  container.innerHTML = '';

  const selectedDays = Array.isArray(active.daysOfWeek) ? active.daysOfWeek.map(Number) : [0, 1, 2, 3, 4, 5, 6];

  DAY_LABELS.forEach(({ day, short, full }) => {
    const isSelected = selectedDays.includes(day);
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.title = full;
    btn.className = `btn btn-xs ${isSelected ? 'btn-primary' : 'btn-secondary'}`;
    btn.style.minWidth = '48px';
    btn.textContent = short;

    btn.addEventListener('click', () => {
      const idx = active.daysOfWeek.indexOf(day);
      if (idx >= 0) {
        if (active.daysOfWeek.length > 1) {
          active.daysOfWeek.splice(idx, 1);
        } else {
          showToast('At least one day must remain selected.', 'info');
        }
      } else {
        active.daysOfWeek.push(day);
      }
      renderDaysOfWeekPills(active);
      updateAlertsPreview();
    });

    container.appendChild(btn);
  });
}

function renderScheduledTimesPills(active) {
  const container = document.getElementById('alert-times-pills-container');
  const countBadge = document.getElementById('alert-times-count-badge');
  if (!container) return;

  const times = Array.isArray(active.times) ? [...active.times].sort() : [];
  active.times = times;
  ensureEventTimesAndOffsets(active);

  if (countBadge) {
    countBadge.textContent = `${times.length} Scheduled Alert${times.length === 1 ? '' : 's'} / Day`;
  }

  if (times.length === 0) {
    container.innerHTML = `<span style="font-size: 0.8rem; color: var(--text-muted); font-style: italic;">No scheduled alert times added yet. Add pre-event offsets or exact times above.</span>`;
    return;
  }

  container.innerHTML = '';
  times.forEach(t => {
    const { matchedEventHHMM, diffMins } = findNearestEventForAlertSlot(t, active.eventTimes);
    const offsetStr = formatShortOffsetLabel(diffMins, matchedEventHHMM);
    const pill = document.createElement('div');
    pill.style.cssText = 'display: inline-flex; align-items: center; gap: 6px; background: rgba(51, 127, 213, 0.14); border: 1px solid rgba(51, 127, 213, 0.4); color: #fff; padding: 5px 10px; border-radius: 6px; font-size: 0.8rem; font-weight: 600;';
    pill.innerHTML = `
      <i data-lucide="clock" style="width: 13px; height: 13px; color: #337fd5;"></i>
      <span>${escapeHtml(formatTime12h(t))}</span>
      <span style="font-size: 0.72rem; color: #58a6ff; background: rgba(51,127,213,0.18); padding: 1px 6px; border-radius: 4px;">${escapeHtml(offsetStr)}</span>
      <button type="button" title="Remove ${escapeHtml(t)}" style="background: none; border: none; color: #949ba4; cursor: pointer; font-size: 1rem; line-height: 1; padding: 0 2px;">&times;</button>
    `;

    pill.querySelector('button')?.addEventListener('click', () => {
      active.times = active.times.filter(x => x !== t);
      renderScheduledTimesPills(active);
      renderAlertsSubtabs();
      updateAlertsPreview();
    });

    container.appendChild(pill);
  });

  refreshIcons();
}

export function syncCurrentFormToActiveAlert() {
  const active = getActiveAlert();
  if (!active) return;

  const enabledCheck = document.getElementById('check-alert-enabled');
  if (enabledCheck) active.enabled = enabledCheck.checked;

  const chSelect = document.getElementById('select-alert-target-channel');
  if (chSelect) active.channelId = chSelect.value;

  const pingSelect = document.getElementById('select-alert-ping-type');
  if (pingSelect) {
    const val = pingSelect.value;
    if (val.startsWith('role:')) {
      active.pingType = 'role';
      active.roleId = val.slice(5);
    } else {
      active.pingType = val;
      active.roleId = '';
    }
  }

  const scheduleModeSelect = document.getElementById('select-alert-schedule-mode');
  if (scheduleModeSelect) active.scheduleMode = scheduleModeSelect.value;

  const autoDeleteCheck = document.getElementById('check-alert-autodelete');
  if (autoDeleteCheck) active.autoDelete = autoDeleteCheck.checked;

  const deleteMinsInput = document.getElementById('input-alert-delete-minutes');
  if (deleteMinsInput) active.deleteAfterMinutes = Math.max(1, Number(deleteMinsInput.value) || 15);

  const nameInput = document.getElementById('input-alert-name');
  if (nameInput && nameInput.value.trim()) active.name = nameInput.value.trim();

  const emojiInput = document.getElementById('input-alert-emoji');
  if (emojiInput && emojiInput.value.trim()) active.emoji = emojiInput.value.trim();

  const colorInput = document.getElementById('input-alert-color');
  if (colorInput && colorInput.value.trim()) active.embedColor = colorInput.value.trim();

  const titleInput = document.getElementById('input-alert-title');
  if (titleInput) active.embedTitle = titleInput.value;

  const descInput = document.getElementById('input-alert-description');
  if (descInput) active.embedDescription = descInput.value;

  const footerInput = document.getElementById('input-alert-footer');
  if (footerInput) active.embedFooter = footerInput.value;

  const tsCheck = document.getElementById('check-alert-timestamp');
  if (tsCheck) active.includeTimestamp = tsCheck.checked;
}

function resolvePreviewPingLabel(active) {
  if (!active || !active.pingType || active.pingType === 'none') return '';
  if (active.pingType === 'here') return '@here';
  if (active.pingType === 'everyone') return '@everyone';

  const roles = state.serverState?.guild?.roles || [];
  if (active.pingType === 'role' && active.roleId) {
    const foundRole = roles.find(r => r.id === active.roleId);
    return foundRole ? `@${foundRole.name}` : '';
  }

  if (active.pingType === 'preset_role' && !active.isCustom) {
    const { linkedRoleObj } = getLinkedPresetRoleInfo(active, state.serverState);
    if (linkedRoleObj) return `@${linkedRoleObj.name}`;
    return '';
  }

  return '';
}

export function updateAlertsPreview() {
  syncCurrentFormToActiveAlert();
  const active = getActiveAlert();
  if (!active) return;

  const chSelect = document.getElementById('select-alert-target-channel');
  const chName = chSelect?.selectedOptions[0]?.text?.replace('#', '') || 'alerts-channel';
  const simChEl = document.getElementById('sim-alert-channel-name');
  if (simChEl) simChEl.textContent = chName.includes('Select Target') ? 'alerts-channel' : chName;

  const simPresetBadge = document.getElementById('sim-alert-active-badge');
  if (simPresetBadge) {
    const evCount = active.eventTimes?.length || 1;
    const evSummary = evCount > 1 ? `${evCount} daily events` : `${formatTime12h(active.eventTimes?.[0] || '20:00')} PHT`;
    simPresetBadge.innerHTML = `${renderEmojiHtml(active.emoji || '🔔')} ${escapeHtml(active.name)} (${escapeHtml(evSummary)})`;
  }

  const pingLabel = resolvePreviewPingLabel(active);
  const serverName = state.serverState?.config?.serverName || state.serverState?.guild?.name || 'Asia Fregion';
  const avatarSrc = state.serverState?.avatar || 'https://assets-global.website-files.com/6257adef93867e50d84d30e2/636e0a6a49cf127bf92de1e2_icon_clyde_blurple_RGB.png';

  const allTimes = Array.isArray(active.times) && active.times.length > 0 ? active.times : ['01:50', '01:59'];
  const previewTimes = allTimes.slice(0, 4);
  const remainingCount = Math.max(0, allTimes.length - previewTimes.length);
  const messagesListEl = document.getElementById('sim-alert-messages-list');

  if (messagesListEl) {
    let renderedHtml = previewTimes
      .map((slotHHMM, idx) => {
        const { matchedEventHHMM, diffMins } = findNearestEventForAlertSlot(slotHHMM, active.eventTimes);
        const eventTime12h = formatTime12h(matchedEventHHMM);
        const countdownLabel = formatCountdownBadgeText(diffMins);
        const countdownPillHtml = `<span style="background: rgba(255,255,255,0.12); padding: 1px 6px; border-radius: 3px; font-weight: 600; color: #fff; font-size: 0.82rem;">${escapeHtml(countdownLabel)}</span>`;
        const eventTimePillHtml = `<span style="background: rgba(255,255,255,0.12); padding: 1px 6px; border-radius: 3px; font-size: 0.8rem;">${escapeHtml(eventTime12h)}</span>`;

        const replacePlainVars = (str) =>
          String(str || '')
            .replace(/\{countdown_text\}/gi, countdownLabel)
            .replace(/\{name\}/gi, active.name || 'Alert')
            .replace(/\{server\}/gi, serverName)
            .replace(/\{time\}/gi, formatTime12h(slotHHMM))
            .replace(/\{deleteAfter\}/gi, String(active.deleteAfterMinutes || 15));

        const rawTitle = replacePlainVars(active.embedTitle || '')
          .replace(/\{countdown\}/gi, countdownLabel)
          .replace(/\{event_time\}/gi, eventTime12h)
          .trim();

        const rawDesc = active.embedDescription || `**${active.name} in {countdown}, please gear up and gather in Reshanta**`;
        const hasExplicitCountdown = /\{countdown\}|\{event_time\}/i.test(rawDesc);

        let descHtml = formatDiscordMarkdown(replacePlainVars(rawDesc), serverName)
          .replace(/\{countdown\}/gi, countdownPillHtml)
          .replace(/\{event_time\}/gi, eventTimePillHtml);

        if (active.includeTimestamp && !hasExplicitCountdown) {
          descHtml += ` ${countdownPillHtml} (${eventTimePillHtml})`;
        }

        let footerStr = replacePlainVars(active.embedFooter || 'Aion 2 Scheduled Alert').trim();
        if (active.autoDelete && active.deleteAfterMinutes > 0 && !footerStr.toLowerCase().includes('delete')) {
          footerStr += ` • Auto-deletes in ${active.deleteAfterMinutes}m`;
        }

        const dividerStyle = idx > 0 ? 'margin-top: 14px; padding-top: 14px; border-top: 1px dashed rgba(255,255,255,0.08);' : '';

        return `
          <div class="discord-message" style="${dividerStyle}">
            <img class="discord-author-avatar" src="${escapeHtml(avatarSrc)}" alt="Maiev">
            <div class="discord-message-content">
              <div class="discord-author-row">
                <span class="discord-author-name">Maiev</span>
                <span class="discord-bot-badge">BOT</span>
                <span class="discord-timestamp">Today at ${escapeHtml(formatTime12h(slotHHMM))} (for ${escapeHtml(eventTime12h)} Event)</span>
              </div>
              ${
                pingLabel
                  ? `<div style="color: #faa61a; background: rgba(250, 166, 26, 0.15); display: inline-block; padding: 1px 6px; border-radius: 3px; font-weight: 600; font-size: 0.82rem; margin-bottom: 6px;">${escapeHtml(pingLabel)}</div>`
                  : ''
              }
              <div class="discord-embed" style="border-left: 4px solid ${escapeHtml(active.embedColor || '#e67e22')};">
                ${rawTitle ? `<div class="embed-title">${formatDiscordMarkdown(rawTitle)}</div>` : ''}
                <div class="embed-description">${descHtml}</div>
                <div class="embed-footer" style="margin-top: 8px;">${escapeHtml(footerStr)}</div>
              </div>
            </div>
          </div>
        `;
      })
      .join('');

    if (remainingCount > 0) {
      renderedHtml += `
        <div style="margin-top: 12px; padding: 8px 12px; background: rgba(51, 127, 213, 0.1); border: 1px dashed rgba(51, 127, 213, 0.35); border-radius: 6px; font-size: 0.78rem; color: #949ba4; text-align: center;">
          + <strong>${remainingCount} more scheduled alert dispatches</strong> across today's remaining event cycles
        </div>
      `;
    }

    messagesListEl.innerHTML = renderedHtml;
  }

  // Update Schedule Summary Card in Simulator
  const summaryDays = document.getElementById('sim-alert-summary-days');
  if (summaryDays) {
    const evListStr = (active.eventTimes || []).map(formatTime12h).join(', ');
    if (active.scheduleMode === 'daily') {
      summaryDays.textContent = `Every Day • ${active.eventTimes?.length || 1} Event(s): ${evListStr}`;
    } else {
      const daysArr = DAY_LABELS.filter(d => (active.daysOfWeek || []).includes(d.day)).map(d => d.short);
      summaryDays.textContent = `${daysArr.length ? daysArr.join(', ') : 'No days'} • Event(s): ${evListStr}`;
    }
  }

  const summaryTimes = document.getElementById('sim-alert-summary-times');
  if (summaryTimes) {
    if (Array.isArray(active.times) && active.times.length > 0) {
      const offsetsStr = (active.alertOffsets || []).length
        ? `(${active.alertOffsets.map(m => `${m}m`).join(' & ')} before each event) — `
        : '';
      summaryTimes.textContent = `${offsetsStr}${active.times.length} total alerts/day`;
    } else {
      summaryTimes.textContent = 'Manual Dispatch Only (No scheduled times)';
    }
  }

  const summaryClean = document.getElementById('sim-alert-summary-clean');
  if (summaryClean) {
    summaryClean.textContent = active.autoDelete
      ? `Deletes automatically after ${active.deleteAfterMinutes} minute${Number(active.deleteAfterMinutes) === 1 ? '' : 's'}`
      : 'Disabled (Message stays in channel permanently)';
  }
}

async function saveAlertsToBackend(showSuccessToast = true) {
  syncCurrentFormToActiveAlert();
  try {
    const res = await fetch('/api/alerts/config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ alerts: alertsList })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to save alerts configuration');
    alertsList = data.alerts || alertsList;
    alertsList.forEach(ensureEventTimesAndOffsets);
    renderAlertsSubtabs();
    if (showSuccessToast) {
      showToast('Scheduled Alerts configuration saved!', 'success');
    }
    return true;
  } catch (err) {
    showToast(err.message, 'error');
    return false;
  }
}

export function setupAlertsTabListeners() {
  const inputsToWatch = [
    'check-alert-enabled',
    'select-alert-target-channel',
    'select-alert-ping-type',
    'select-alert-schedule-mode',
    'check-alert-autodelete',
    'input-alert-delete-minutes',
    'input-alert-name',
    'input-alert-emoji',
    'input-alert-color',
    'input-alert-title',
    'input-alert-description',
    'input-alert-footer',
    'check-alert-timestamp'
  ];

  inputsToWatch.forEach(id => {
    const el = document.getElementById(id);
    if (!el) return;
    el.addEventListener('input', () => {
      syncCurrentFormToActiveAlert();
      const active = getActiveAlert();
      const daysWrap = document.getElementById('alert-days-picker-wrap');
      if (daysWrap && active) {
        daysWrap.style.opacity = active.scheduleMode === 'days' ? '1' : '0.45';
        daysWrap.style.pointerEvents = active.scheduleMode === 'days' ? 'auto' : 'none';
      }
      renderAlertsSubtabs();
      updateAlertsPreview();
    });
    el.addEventListener('change', () => {
      syncCurrentFormToActiveAlert();
      renderAlertsSubtabs();
      updateAlertsPreview();
    });
  });

  // Add Single Event Start Time
  document.getElementById('btn-alert-add-event-time')?.addEventListener('click', () => {
    const active = getActiveAlert();
    const evInput = document.getElementById('input-alert-event-time');
    if (!active || !evInput) return;
    const val = evInput.value.trim();
    if (!/^\d{2}:\d{2}$/.test(val)) {
      showToast('Please select a valid Event Start Time first.', 'info');
      return;
    }
    ensureEventTimesAndOffsets(active);
    if (!active.eventTimes.includes(val)) {
      active.eventTimes.push(val);
      active.eventTimes.sort();
      active.eventTime = active.eventTimes[0];
      rebuildScheduledTimesFromEventOffsets(active);
      renderEventTimesPills(active);
      renderScheduledTimesPills(active);
      renderAlertsSubtabs();
      updateAlertsPreview();
      showToast(`Added Event Start Time ${formatTime12h(val)} PHT!`, 'success');
    } else {
      showToast(`${formatTime12h(val)} PHT is already in Event Start Times.`, 'info');
    }
  });

  // Generate Recurring Event Cycle (e.g. Every 3 Hours starting at 02:00 PHT / 03:00 Server Time)
  document.getElementById('btn-alert-generate-recurring-events')?.addEventListener('click', () => {
    const active = getActiveAlert();
    const evInput = document.getElementById('input-alert-event-time');
    const hrsInput = document.getElementById('input-alert-repeat-hours');
    if (!active || !evInput || !hrsInput) return;

    const startHHMM = evInput.value.trim() || '02:00';
    const intervalHours = Math.max(1, Math.min(12, Number(hrsInput.value) || 3));
    const [startH, startM] = startHHMM.split(':').map(Number);

    const cycle = new Set();
    const steps = Math.floor(24 / intervalHours);
    for (let i = 0; i < steps; i++) {
      const h = (startH + i * intervalHours) % 24;
      cycle.add(`${String(h).padStart(2, '0')}:${String(startM).padStart(2, '0')}`);
    }

    active.eventTimes = [...cycle].sort();
    active.eventTime = active.eventTimes[0];
    rebuildScheduledTimesFromEventOffsets(active);
    renderEventTimesPills(active);
    renderScheduledTimesPills(active);
    renderAlertsSubtabs();
    updateAlertsPreview();
    showToast(`Generated ${active.eventTimes.length} recurring event times (every ${intervalHours}h) & synced ${active.times.length} pre-event alerts!`, 'success');
  });

  // Clear Event Times (resets to current input-alert-event-time)
  document.getElementById('btn-alert-clear-event-times')?.addEventListener('click', () => {
    const active = getActiveAlert();
    const evInput = document.getElementById('input-alert-event-time');
    if (!active) return;
    const baseTime = evInput?.value.trim() || '20:00';
    active.eventTimes = [baseTime];
    active.eventTime = baseTime;
    rebuildScheduledTimesFromEventOffsets(active);
    renderEventTimesPills(active);
    renderScheduledTimesPills(active);
    renderAlertsSubtabs();
    updateAlertsPreview();
  });

  // Insert {countdown}, {event_time}, {name} tag buttons
  document.querySelectorAll('.btn-insert-alert-tag').forEach(btn => {
    btn.addEventListener('click', () => {
      const targetId = btn.getAttribute('data-target');
      const tag = btn.getAttribute('data-tag') || '{countdown}';
      const textarea = document.getElementById(targetId);
      if (!textarea) return;

      const start = textarea.selectionStart ?? textarea.value.length;
      const end = textarea.selectionEnd ?? textarea.value.length;
      const before = textarea.value.slice(0, start);
      const after = textarea.value.slice(end);
      textarea.value = `${before}${tag}${after}`;
      textarea.focus();
      textarea.selectionStart = textarea.selectionEnd = start + tag.length;

      if (targetId === 'input-alert-description') {
        syncCurrentFormToActiveAlert();
        updateAlertsPreview();
      }
    });
  });

  // Add Pre-Event Offset (applies to ALL Event Start Times!)
  document.getElementById('btn-alert-add-offset')?.addEventListener('click', () => {
    const active = getActiveAlert();
    const offsetInput = document.getElementById('input-alert-offset-mins');
    if (!active || !offsetInput) return;

    const minsBefore = Math.max(1, Math.min(720, Number(offsetInput.value) || 10));
    ensureEventTimesAndOffsets(active);

    if (!active.alertOffsets.includes(minsBefore)) {
      active.alertOffsets.push(minsBefore);
      active.alertOffsets.sort((a, b) => b - a);
    }

    rebuildScheduledTimesFromEventOffsets(active);
    renderOffsetsPills(active);
    renderScheduledTimesPills(active);
    renderAlertsSubtabs();
    updateAlertsPreview();
    showToast(`Added ${minsBefore}m pre-event offset across all ${active.eventTimes.length} event time(s)!`, 'success');
  });

  // Add Scheduled Time button
  document.getElementById('btn-alert-add-time')?.addEventListener('click', () => {
    const active = getActiveAlert();
    const timeInput = document.getElementById('input-alert-new-time');
    if (!active || !timeInput) return;
    const val = timeInput.value.trim();
    if (!/^\d{2}:\d{2}$/.test(val)) {
      showToast('Please pick a valid time (HH:MM) first.', 'info');
      return;
    }
    if (!Array.isArray(active.times)) active.times = [];
    if (active.times.includes(val)) {
      showToast(`${formatTime12h(val)} is already in the schedule.`, 'info');
      return;
    }
    active.times.push(val);
    active.times.sort();
    renderScheduledTimesPills(active);
    renderAlertsSubtabs();
    updateAlertsPreview();
  });

  // Clear all times
  document.getElementById('btn-alert-clear-times')?.addEventListener('click', () => {
    const active = getActiveAlert();
    if (!active) return;
    active.times = [];
    active.alertOffsets = [];
    renderOffsetsPills(active);
    renderScheduledTimesPills(active);
    renderAlertsSubtabs();
    updateAlertsPreview();
  });

  // Quick Day selection buttons
  document.getElementById('btn-alert-days-all')?.addEventListener('click', () => {
    const active = getActiveAlert();
    if (!active) return;
    active.daysOfWeek = [0, 1, 2, 3, 4, 5, 6];
    renderDaysOfWeekPills(active);
    updateAlertsPreview();
  });

  document.getElementById('btn-alert-days-weekdays')?.addEventListener('click', () => {
    const active = getActiveAlert();
    if (!active) return;
    active.daysOfWeek = [1, 2, 3, 4, 5];
    renderDaysOfWeekPills(active);
    updateAlertsPreview();
  });

  document.getElementById('btn-alert-days-weekends')?.addEventListener('click', () => {
    const active = getActiveAlert();
    if (!active) return;
    active.daysOfWeek = [0, 6];
    renderDaysOfWeekPills(active);
    updateAlertsPreview();
  });

  // Quick Auto-Delete duration chips
  document.querySelectorAll('.btn-quick-delete-mins').forEach(btn => {
    btn.addEventListener('click', () => {
      const mins = Number(btn.getAttribute('data-mins')) || 15;
      const active = getActiveAlert();
      const input = document.getElementById('input-alert-delete-minutes');
      const check = document.getElementById('check-alert-autodelete');
      if (input) input.value = mins;
      if (check) check.checked = true;
      if (active) {
        active.autoDelete = true;
        active.deleteAfterMinutes = mins;
      }
      updateAlertsPreview();
    });
  });

  // Save buttons
  document.getElementById('btn-save-alerts-top')?.addEventListener('click', () => saveAlertsToBackend(true));
  document.getElementById('btn-save-alerts-bottom')?.addEventListener('click', () => saveAlertsToBackend(true));

  // Send Alert Now (Live Dispatch)
  document.getElementById('btn-send-alert-now')?.addEventListener('click', async () => {
    syncCurrentFormToActiveAlert();
    const active = getActiveAlert();
    if (!active) return;

    if (!active.channelId) {
      showToast('Please select a Target Alert Channel before sending.', 'error');
      return;
    }

    const btn = document.getElementById('btn-send-alert-now');
    const origHtml = btn ? btn.innerHTML : '';
    if (btn) {
      btn.disabled = true;
      btn.innerHTML = `<i data-lucide="loader"></i> Sending Alert...`;
      refreshIcons();
    }

    try {
      const res = await fetch('/api/alerts/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ alert: active, alerts: alertsList })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to dispatch alert');

      const cleanNote = active.autoDelete ? ` (auto-deletes in ${active.deleteAfterMinutes}m)` : '';
      showToast(`Sent "${active.name}" alert to #${data.channelName}!${cleanNote}`, 'success');
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      if (btn) {
        btn.disabled = false;
        btn.innerHTML = origHtml;
        refreshIcons();
      }
    }
  });

  // Open Create Custom Alert Modal
  const createModal = document.getElementById('modal-create-alert');
  document.getElementById('btn-open-create-alert-modal')?.addEventListener('click', () => {
    renderAlertsChannelAndRoleDropdowns(state.serverState);
    if (createModal) createModal.classList.remove('hidden');
  });
  document.getElementById('modal-create-alert-close')?.addEventListener('click', () => {
    if (createModal) createModal.classList.add('hidden');
  });
  document.getElementById('modal-create-alert-cancel')?.addEventListener('click', () => {
    if (createModal) createModal.classList.add('hidden');
  });

  // Submit Create Custom Alert
  document.getElementById('btn-submit-create-alert')?.addEventListener('click', async () => {
    const nameEl = document.getElementById('create-alert-name');
    const emojiEl = document.getElementById('create-alert-emoji');
    const titleEl = document.getElementById('create-alert-title');
    const descEl = document.getElementById('create-alert-desc');
    const colorEl = document.getElementById('create-alert-color');
    const eventTimeEl = document.getElementById('create-alert-event-time');
    const timesCsvEl = document.getElementById('create-alert-times-csv');
    const deleteMinsEl = document.getElementById('create-alert-delete-mins');
    const pingTypeEl = document.getElementById('create-alert-ping-type');

    const name = nameEl?.value.trim();
    if (!name) {
      showToast('Please enter a name for the custom alert.', 'error');
      return;
    }

    const emoji = emojiEl?.value.trim() || '📢';
    const slug = 'custom-' + name.toLowerCase().replace(/[^a-z0-9]+/g, '-') + '-' + Date.now().toString().slice(-4);
    const currentActive = getActiveAlert();

    const parsedTimes = (timesCsvEl?.value || '19:00, 19:30')
      .split(',')
      .map(s => s.trim())
      .filter(s => /^\d{2}:\d{2}$/.test(s))
      .sort();

    const evTime = eventTimeEl?.value.trim() || '20:00';

    const rawPingVal = pingTypeEl?.value || 'none';
    let resolvedPingType = 'none';
    let resolvedRoleId = '';
    if (rawPingVal.startsWith('role:')) {
      resolvedPingType = 'role';
      resolvedRoleId = rawPingVal.slice(5);
    } else if (rawPingVal === 'everyone' || rawPingVal === 'here' || rawPingVal === 'none') {
      resolvedPingType = rawPingVal;
    }

    const newAlert = {
      id: slug,
      code: slug,
      name,
      emoji,
      isCustom: true,
      enabled: true,
      channelId: currentActive?.channelId || '',
      pingType: resolvedPingType,
      roleId: resolvedRoleId,
      embedColor: colorEl?.value || '#e67e22',
      embedTitle: titleEl?.value.trim() ?? '',
      embedDescription: descEl?.value.trim() || `**${name} in {countdown}, please gear up and gather in Reshanta**`,
      embedFooter: 'Aion 2 Custom Channel Alert',
      includeTimestamp: false,
      eventTime: evTime,
      eventTimes: [evTime],
      alertOffsets: [60, 30],
      scheduleMode: 'days',
      daysOfWeek: [1, 4, 6],
      times: parsedTimes.length ? parsedTimes : ['19:00', '19:30'],
      autoDelete: true,
      deleteAfterMinutes: Math.max(1, Number(deleteMinsEl?.value) || 15)
    };

    alertsList.push(newAlert);
    activeAlertId = newAlert.id;
    if (createModal) createModal.classList.add('hidden');

    if (nameEl) nameEl.value = '';
    if (titleEl) titleEl.value = '';
    if (pingTypeEl) pingTypeEl.value = 'none';

    renderAlertsSubtabs();
    renderActiveAlertForm();
    updateAlertsPreview();
    await saveAlertsToBackend(false);
    showToast(`Created custom alert "${name}"!`, 'success');
  });

  // Delete Alert Profile (any profile, preset or custom)
  document.getElementById('btn-delete-custom-alert')?.addEventListener('click', async () => {
    const active = getActiveAlert();
    if (!active) return;
    if (alertsList.length <= 1) {
      showToast('At least one alert profile must remain.', 'info');
      return;
    }
    const removedName = active.name;
    alertsList = alertsList.filter(a => a.id !== active.id);
    activeAlertId = alertsList[0]?.id || 'abyss-farming';
    renderAlertsSubtabs();
    renderActiveAlertForm();
    updateAlertsPreview();
    await saveAlertsToBackend(false);
    showToast(`Deleted alert profile "${removedName}".`, 'info');
  });
}
