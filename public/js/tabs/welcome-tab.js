import { DEFAULT_WELCOME_ANNOUNCEMENT_TEMPLATE } from '../presets.js?v=7.5';
import { getActiveServerName } from '../state.js?v=7.5';
import { formatDiscordMarkdown, showToast } from '../utils.js?v=7.5';
import { scheduleAutoSave } from '../api.js?v=7.5';

export function renderWelcomeAnnouncementEditor(cfg) {
  const enable = cfg.enableWelcomeAnnouncement !== false;
  const message = cfg.welcomeAnnouncementMessage !== undefined ? cfg.welcomeAnnouncementMessage : DEFAULT_WELCOME_ANNOUNCEMENT_TEMPLATE;

  const checkEl = document.getElementById('check-enable-welcome-announcement');
  if (checkEl) checkEl.checked = enable;

  const msgInput = document.getElementById('welcome-announcement-input');
  if (msgInput) msgInput.value = message;

  updateWelcomeAnnouncementPreview();
}

export function updateWelcomeAnnouncementPreview() {
  const serverName = getActiveServerName();
  const template = document.getElementById('welcome-announcement-input')?.value || DEFAULT_WELCOME_ANNOUNCEMENT_TEMPLATE;

  const formatted = formatDiscordMarkdown(
    template
      .replace(/{server}/g, serverName)
      .replace(/{user}/g, '@DaevaPlayer')
      .replace(/{ign}/g, 'DaevaLegend')
      .replace(/{flag}/g, '🇵🇭')
      .replace(/{nationality}/g, 'Philippines')
      .replace(/{roles}/g, '@Unverified, @Elyos Fregion')
  );

  const descEl = document.getElementById('sim-welcome-announcement-desc');
  if (descEl) descEl.innerHTML = formatted;

  const authorEl = document.getElementById('sim-welcome-announcement-author');
  if (authorEl) authorEl.textContent = `${serverName} • New Daeva Arrival`;

  const footEl = document.getElementById('sim-welcome-announcement-footer');
  if (footEl) footEl.textContent = `${serverName} • 467 👤 • Welcome Channel`;
}

export function setupWelcomeTabListeners() {
  const welcomeAnnounceInput = document.getElementById('welcome-announcement-input');
  welcomeAnnounceInput?.addEventListener('input', () => {
    updateWelcomeAnnouncementPreview();
    scheduleAutoSave(450);
  });

  document.getElementById('check-enable-welcome-announcement')?.addEventListener('change', () => {
    scheduleAutoSave(200);
  });

  document.getElementById('btn-reset-welcome-announcement-template')?.addEventListener('click', () => {
    document.getElementById('welcome-announcement-input').value = DEFAULT_WELCOME_ANNOUNCEMENT_TEMPLATE;
    updateWelcomeAnnouncementPreview();
    scheduleAutoSave(200);
    showToast('Reset public welcome announcement to standard template!', 'success');
  });

  document.getElementById('btn-test-welcome-announcement')?.addEventListener('click', async () => {
    const channelId = document.getElementById('select-welcome-channel').value;
    const message = document.getElementById('welcome-announcement-input').value.trim();
    if (!channelId) {
      showToast('Please select a welcome channel first.', 'error');
      return;
    }
    try {
      const res = await fetch('/api/test-welcome', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ channelId, message })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed');
      showToast('Test welcome announcement sent to Discord!', 'success');
    } catch (err) {
      showToast(`Error: ${err.message}`, 'error');
    }
  });
}

