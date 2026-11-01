import { DEFAULT_RULES_TEMPLATE } from '../presets.js';
import { formatDiscordMarkdown, refreshIcons, showToast } from '../utils.js';
import { postEmbed } from '../api.js';

export function renderRulesEditor(cfg) {
  const title = cfg.rulesTitle || DEFAULT_RULES_TEMPLATE.title;
  const content = cfg.rulesContent || DEFAULT_RULES_TEMPLATE.content;
  const footer = cfg.rulesFooter || DEFAULT_RULES_TEMPLATE.footer;

  document.getElementById('rules-title-input').value = title;
  document.getElementById('rules-content-input').value = content;
  document.getElementById('rules-footer-input').value = footer;

  updateRulesPreview();
}

export function updateRulesPreview() {
  const title = document.getElementById('rules-title-input').value || DEFAULT_RULES_TEMPLATE.title;
  const content = document.getElementById('rules-content-input').value || DEFAULT_RULES_TEMPLATE.content;
  const footer = document.getElementById('rules-footer-input').value || DEFAULT_RULES_TEMPLATE.footer;

  document.getElementById('sim-rules-title').textContent = title;
  document.getElementById('sim-rules-desc').innerHTML = formatDiscordMarkdown(content);
  document.getElementById('sim-rules-footer').textContent = footer;
}

export function setupRulesTabListeners() {
  const titleInput = document.getElementById('rules-title-input');
  const contentInput = document.getElementById('rules-content-input');
  const footerInput = document.getElementById('rules-footer-input');

  titleInput?.addEventListener('input', updateRulesPreview);
  contentInput?.addEventListener('input', updateRulesPreview);
  footerInput?.addEventListener('input', updateRulesPreview);

  document.getElementById('btn-reset-rules-template')?.addEventListener('click', () => {
    titleInput.value = DEFAULT_RULES_TEMPLATE.title;
    contentInput.value = DEFAULT_RULES_TEMPLATE.content;
    footerInput.value = DEFAULT_RULES_TEMPLATE.footer;
    updateRulesPreview();
    showToast('Reset rules editor to standard AION 2 template!', 'success');
  });

  document.getElementById('btn-post-rules-channel')?.addEventListener('click', async () => {
    const channelId = document.getElementById('select-rules-channel').value;
    if (!channelId) {
      showToast('Please select a rules channel first.', 'error');
      return;
    }
    postEmbed('/api/post-rules', channelId, 'Rules card posted successfully to Discord!');
  });

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

