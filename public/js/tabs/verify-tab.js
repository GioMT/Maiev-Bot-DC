import {
  DEFAULT_VERIFY_TEMPLATE,
  DEFAULT_WELCOME_TEMPLATE
} from '../presets.js?v=7.6';
import { state, getActiveServerName, syncCachedConfig } from '../state.js?v=7.6';
import { formatDiscordMarkdown, refreshIcons, showToast } from '../utils.js?v=7.6';
import { saveAllConfiguration, scheduleAutoSave } from '../api.js?v=7.6';

export function renderVerifyEditor(cfg) {
  const title = cfg.verifyTitle !== undefined ? cfg.verifyTitle : DEFAULT_VERIFY_TEMPLATE.title;
  const content = cfg.verifyContent !== undefined ? cfg.verifyContent : DEFAULT_VERIFY_TEMPLATE.content;
  const footer = cfg.verifyFooter !== undefined ? cfg.verifyFooter : DEFAULT_VERIFY_TEMPLATE.footer;

  const titleEl = document.getElementById('verify-title-input');
  const contentEl = document.getElementById('verify-content-input');
  const footerEl = document.getElementById('verify-footer-input');
  const deployBadge = document.getElementById('verify-deploy-badge');

  if (titleEl) titleEl.value = title;
  if (contentEl) contentEl.value = content;
  if (footerEl) footerEl.value = footer;

  if (deployBadge) {
    if (cfg.verifyMessageId) {
      deployBadge.className = 'badge badge-success';
      deployBadge.textContent = `Deployed (${String(cfg.verifyMessageId).slice(-6)})`;
    } else {
      deployBadge.className = 'badge';
      deployBadge.textContent = 'Not Posted Yet';
    }
  }

  updateVerifyPreview();
}

export function updateVerifyPreview() {
  const serverName = getActiveServerName();
  const title = (document.getElementById('verify-title-input').value || DEFAULT_VERIFY_TEMPLATE.title).replace(/{server}/g, serverName);
  const content = (document.getElementById('verify-content-input').value || DEFAULT_VERIFY_TEMPLATE.content).replace(/{server}/g, serverName);
  const footer = (document.getElementById('verify-footer-input').value || DEFAULT_VERIFY_TEMPLATE.footer).replace(/{server}/g, serverName);

  document.getElementById('sim-verify-title').innerHTML = formatDiscordMarkdown(title);
  document.getElementById('sim-verify-desc').innerHTML = formatDiscordMarkdown(content);
  document.getElementById('sim-verify-footer').textContent = footer;
}

export function renderWelcomeEditor(cfg) {
  const title = cfg.welcomeTitle !== undefined ? cfg.welcomeTitle : DEFAULT_WELCOME_TEMPLATE.title;
  const content = cfg.welcomeContent !== undefined ? cfg.welcomeContent : DEFAULT_WELCOME_TEMPLATE.content;
  const footer = cfg.welcomeFooter !== undefined ? cfg.welcomeFooter : DEFAULT_WELCOME_TEMPLATE.footer;

  const titleEl = document.getElementById('welcome-title-input');
  const contentEl = document.getElementById('welcome-content-input');
  const footerEl = document.getElementById('welcome-footer-input');

  if (titleEl) titleEl.value = title;
  if (contentEl) contentEl.value = content;
  if (footerEl) footerEl.value = footer;
}

async function deployVerifyPanel(forceNew = true) {
  const channelId = document.getElementById('select-verify-channel')?.value;
  if (!channelId) {
    showToast('Please select a target setup channel first.', 'error');
    return;
  }

  const btn = document.getElementById(forceNew ? 'btn-post-verify-channel' : 'btn-update-verify-channel');
  const origHtml = btn?.innerHTML;
  if (btn) {
    btn.disabled = true;
    btn.innerHTML = `<i data-lucide="loader-2"></i> ${forceNew ? 'Posting...' : 'Updating...'}`;
    refreshIcons();
  }

  try {
    await saveAllConfiguration({ silent: true, skipBossTimer: true });
    const res = await fetch('/api/post-verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        channelId,
        forceNew,
        verifyTitle: document.getElementById('verify-title-input')?.value,
        verifyContent: document.getElementById('verify-content-input')?.value,
        verifyFooter: document.getElementById('verify-footer-input')?.value,
        welcomeTitle: document.getElementById('welcome-title-input')?.value,
        welcomeContent: document.getElementById('welcome-content-input')?.value,
        welcomeFooter: document.getElementById('welcome-footer-input')?.value
      })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to deploy IGN setup card');

    if (data.config) {
      syncCachedConfig(data.config, true);
    } else if (data.messageId) {
      syncCachedConfig({ verifyChannelId: channelId, verifyMessageId: data.messageId });
    }

    const deployBadge = document.getElementById('verify-deploy-badge');
    if (deployBadge && data.messageId) {
      deployBadge.className = 'badge badge-success';
      deployBadge.textContent = `Deployed (${String(data.messageId).slice(-6)})`;
    }

    showToast(
      data.updated
        ? `Updated active IGN Setup card in #${data.channelName || 'verify'}!`
        : `Posted IGN Setup card to #${data.channelName || 'verify'}!`,
      'success'
    );
  } catch (err) {
    showToast(`Error: ${err.message}`, 'error');
  } finally {
    if (btn && origHtml) {
      btn.disabled = false;
      btn.innerHTML = origHtml;
      refreshIcons();
    }
  }
}

export function setupVerifyTabListeners() {
  const verifyTitleInput = document.getElementById('verify-title-input');
  const verifyContentInput = document.getElementById('verify-content-input');
  const verifyFooterInput = document.getElementById('verify-footer-input');

  const onVerifyInput = () => {
    updateVerifyPreview();
    scheduleAutoSave(450);
  };
  verifyTitleInput?.addEventListener('input', onVerifyInput);
  verifyContentInput?.addEventListener('input', onVerifyInput);
  verifyFooterInput?.addEventListener('input', onVerifyInput);

  ['welcome-title-input', 'welcome-content-input', 'welcome-footer-input'].forEach(id => {
    document.getElementById(id)?.addEventListener('input', () => scheduleAutoSave(450));
  });

  document.getElementById('btn-reset-verify-template')?.addEventListener('click', () => {
    verifyTitleInput.value = DEFAULT_VERIFY_TEMPLATE.title;
    verifyContentInput.value = DEFAULT_VERIFY_TEMPLATE.content;
    verifyFooterInput.value = DEFAULT_VERIFY_TEMPLATE.footer;
    updateVerifyPreview();
    scheduleAutoSave(200);
    showToast('Reset verification editor to standard template!', 'success');
  });

  document.getElementById('btn-reset-welcome-template')?.addEventListener('click', () => {
    document.getElementById('welcome-title-input').value = DEFAULT_WELCOME_TEMPLATE.title;
    document.getElementById('welcome-content-input').value = DEFAULT_WELCOME_TEMPLATE.content;
    document.getElementById('welcome-footer-input').value = DEFAULT_WELCOME_TEMPLATE.footer;
    scheduleAutoSave(200);
    showToast('Reset welcome popup card to standard template!', 'success');
  });

  document.getElementById('btn-post-verify-channel')?.addEventListener('click', () => deployVerifyPanel(true));
  document.getElementById('btn-update-verify-channel')?.addEventListener('click', () => deployVerifyPanel(false));

  const modalBackdrop = document.getElementById('sim-modal-backdrop');
  document.getElementById('sim-btn-open-modal')?.addEventListener('click', () => {
    modalBackdrop?.classList.remove('hidden');
  });
  document.getElementById('sim-modal-close')?.addEventListener('click', () => modalBackdrop?.classList.add('hidden'));
  document.getElementById('sim-modal-cancel')?.addEventListener('click', () => modalBackdrop?.classList.add('hidden'));

  document.getElementById('sim-modal-submit')?.addEventListener('click', () => {
    const ign = document.getElementById('sim-modal-ign-input').value.trim() || 'DaevaLegend';
    modalBackdrop?.classList.add('hidden');

    const serverName = getActiveServerName();
    const serverIcon = state.serverState?.guild?.icon || 'https://assets-global.website-files.com/6257adef93867e50d84d30e2/636e0a6a49cf127bf92de1e2_icon_clyde_blurple_RGB.png';
    const welcomeTitle = (document.getElementById('welcome-title-input').value || DEFAULT_WELCOME_TEMPLATE.title)
      .replace(/{server}/g, serverName).replace(/{ign}/g, ign);
    const welcomeBody = (document.getElementById('welcome-content-input').value || DEFAULT_WELCOME_TEMPLATE.content)
      .replace(/{server}/g, serverName)
      .replace(/{ign}/g, ign)
      .replace(/{roles}/g, '@Unverified, @Elyos Fregion');
    const welcomeFoot = (document.getElementById('welcome-footer-input').value || DEFAULT_WELCOME_TEMPLATE.footer)
      .replace(/{server}/g, serverName).replace(/{ign}/g, ign);

    const feedback = document.getElementById('sim-verify-feedback');
    if (feedback) {
      feedback.classList.remove('hidden');
      feedback.innerHTML = `
        <div style="background: rgba(0, 210, 255, 0.08); border-left: 3px solid #00d2ff; padding: 12px; border-radius: 6px;">
          <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 8px;">
            <img src="${serverIcon}" style="width: 26px; height: 26px; border-radius: 50%; border: 1px solid rgba(0,210,255,0.4);" alt="Server Profile">
            <strong style="color: #00d2ff; font-size: 0.85rem;">${serverName}</strong>
          </div>
          <div style="font-weight: 700; font-size: 1rem; color: #fff; margin-bottom: 6px;">${formatDiscordMarkdown(welcomeTitle)}</div>
          <div style="line-height: 1.45; color: #dbdee1; font-size: 0.84rem;">${formatDiscordMarkdown(welcomeBody)}</div>
          <div style="font-size: 0.72rem; color: #949ba4; margin-top: 8px; border-top: 1px solid rgba(255,255,255,0.08); padding-top: 6px;">${welcomeFoot}</div>
        </div>
      `;
    }
    refreshIcons();
  });
}

