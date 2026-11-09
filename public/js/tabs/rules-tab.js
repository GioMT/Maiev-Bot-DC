import { DEFAULT_RULES_TEMPLATE } from '../presets.js?v=7.6';
import { syncCachedConfig } from '../state.js?v=7.6';
import { formatDiscordMarkdown, refreshIcons, showToast } from '../utils.js?v=7.6';
import { saveAllConfiguration, scheduleAutoSave } from '../api.js?v=7.6';

export function renderRulesEditor(cfg) {
  const title = cfg.rulesTitle !== undefined ? cfg.rulesTitle : DEFAULT_RULES_TEMPLATE.title;
  const content = cfg.rulesContent !== undefined ? cfg.rulesContent : DEFAULT_RULES_TEMPLATE.content;
  const footer = cfg.rulesFooter !== undefined ? cfg.rulesFooter : DEFAULT_RULES_TEMPLATE.footer;

  const titleEl = document.getElementById('rules-title-input');
  const contentEl = document.getElementById('rules-content-input');
  const footerEl = document.getElementById('rules-footer-input');
  const deployBadge = document.getElementById('rules-deploy-badge');

  if (titleEl) titleEl.value = title;
  if (contentEl) contentEl.value = content;
  if (footerEl) footerEl.value = footer;

  if (deployBadge) {
    if (cfg.rulesMessageId) {
      deployBadge.className = 'badge badge-success';
      deployBadge.textContent = `Deployed (${String(cfg.rulesMessageId).slice(-6)})`;
    } else {
      deployBadge.className = 'badge';
      deployBadge.textContent = 'Not Posted Yet';
    }
  }

  updateRulesPreview();
}

export function updateRulesPreview() {
  const title = document.getElementById('rules-title-input').value || DEFAULT_RULES_TEMPLATE.title;
  const content = document.getElementById('rules-content-input').value || DEFAULT_RULES_TEMPLATE.content;
  const footer = document.getElementById('rules-footer-input').value || DEFAULT_RULES_TEMPLATE.footer;

  document.getElementById('sim-rules-title').innerHTML = formatDiscordMarkdown(title);
  document.getElementById('sim-rules-desc').innerHTML = formatDiscordMarkdown(content);
  document.getElementById('sim-rules-footer').textContent = footer;
}

async function deployRulesPanel(forceNew = true) {
  const channelId = document.getElementById('select-rules-channel')?.value;
  if (!channelId) {
    showToast('Please select a target rules channel first.', 'error');
    return;
  }

  const btn = document.getElementById(forceNew ? 'btn-post-rules-channel' : 'btn-update-rules-channel');
  const origHtml = btn?.innerHTML;
  if (btn) {
    btn.disabled = true;
    btn.innerHTML = `<i data-lucide="loader-2"></i> ${forceNew ? 'Posting...' : 'Updating...'}`;
    refreshIcons();
  }

  try {
    await saveAllConfiguration({ silent: true, skipBossTimer: true });
    const res = await fetch('/api/post-rules', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        channelId,
        forceNew,
        rulesTitle: document.getElementById('rules-title-input')?.value,
        rulesContent: document.getElementById('rules-content-input')?.value,
        rulesFooter: document.getElementById('rules-footer-input')?.value,
        onboardedRoleId: document.getElementById('select-onboarded-role')?.value
      })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to deploy rules card');

    if (data.config) {
      syncCachedConfig(data.config, true);
    } else if (data.messageId) {
      syncCachedConfig({ rulesChannelId: channelId, rulesMessageId: data.messageId });
    }

    const deployBadge = document.getElementById('rules-deploy-badge');
    if (deployBadge && data.messageId) {
      deployBadge.className = 'badge badge-success';
      deployBadge.textContent = `Deployed (${String(data.messageId).slice(-6)})`;
    }

    showToast(
      data.updated
        ? `Updated active Rules card in #${data.channelName || 'rules'}!`
        : `Posted Rules card to #${data.channelName || 'rules'}!`,
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

export function setupRulesTabListeners() {
  const titleInput = document.getElementById('rules-title-input');
  const contentInput = document.getElementById('rules-content-input');
  const footerInput = document.getElementById('rules-footer-input');

  const onInput = () => {
    updateRulesPreview();
    scheduleAutoSave(450);
  };
  titleInput?.addEventListener('input', onInput);
  contentInput?.addEventListener('input', onInput);
  footerInput?.addEventListener('input', onInput);

  document.getElementById('btn-reset-rules-template')?.addEventListener('click', () => {
    titleInput.value = DEFAULT_RULES_TEMPLATE.title;
    contentInput.value = DEFAULT_RULES_TEMPLATE.content;
    footerInput.value = DEFAULT_RULES_TEMPLATE.footer;
    updateRulesPreview();
    scheduleAutoSave(200);
    showToast('Reset rules editor to standard AION 2 template!', 'success');
  });

  document.getElementById('btn-post-rules-channel')?.addEventListener('click', () => deployRulesPanel(true));
  document.getElementById('btn-update-rules-channel')?.addEventListener('click', () => deployRulesPanel(false));

  document.getElementById('sim-btn-accept-rules')?.addEventListener('click', () => {
    const onboardedRoleName = document.getElementById('select-onboarded-role').selectedOptions[0]?.text || '@Onboarded';
    const feedback = document.getElementById('sim-rules-feedback');
    if (feedback) {
      feedback.classList.remove('hidden');
      feedback.innerHTML = `<span style="color: #57F287;"><i data-lucide="check-circle-2"></i></span> <strong>[Simulated Response]</strong> Rules Acknowledged! Member received <strong>${onboardedRoleName}</strong>. Channel <strong>#identity-verification</strong> is now unlocked!`;
      refreshIcons();
    }
  });
}

