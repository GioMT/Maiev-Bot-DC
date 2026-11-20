import { formatDiscordMarkdown, showToast } from '../utils.js?v=7.6';

/**
 * Populate target channel and optional mention dropdowns for the Send Message tab.
 */
export function renderAnnouncerDropdowns(data) {
  const channels = data.guild?.channels || [];
  const roles = [...(data.guild?.roles || [])].sort((a, b) => b.position - a.position);

  const channelSelect = document.getElementById('select-announcer-channel');
  if (channelSelect) {
    const prevValue = channelSelect.value;
    channelSelect.innerHTML = '<option value="">-- Choose Channel --</option>';
    channels.forEach(ch => {
      const opt = document.createElement('option');
      opt.value = ch.id;
      opt.textContent = `#${ch.name}`;
      if (ch.id === prevValue) opt.selected = true;
      channelSelect.appendChild(opt);
    });
  }

  const mentionSelect = document.getElementById('select-announcer-mention');
  if (mentionSelect) {
    const prevMention = mentionSelect.value;
    mentionSelect.innerHTML = `
      <option value="">No Mention</option>
      <option value="here">@here (Online Members)</option>
      <option value="everyone">@everyone (All Members)</option>
    `;
    roles.forEach(role => {
      if (role.name === '@everyone') return;
      const opt = document.createElement('option');
      opt.value = `role:${role.id}`;
      opt.textContent = `@${role.name}`;
      mentionSelect.appendChild(opt);
    });
    if (prevMention) mentionSelect.value = prevMention;
  }

  updateAnnouncerPreview();
}

/**
 * Update the live Discord preview panel in the Send Message tab.
 */
export function updateAnnouncerPreview() {
  const channelSelect = document.getElementById('select-announcer-channel');
  const mentionSelect = document.getElementById('select-announcer-mention');
  const asEmbedCheck = document.getElementById('check-announcer-embed');
  const colorInput = document.getElementById('announcer-embed-color');
  const titleInput = document.getElementById('announcer-title-input');
  const contentInput = document.getElementById('announcer-content-input');

  const chText = channelSelect?.selectedOptions[0]?.text || '#general';
  const chNameEl = document.getElementById('sim-announcer-channel-name');
  if (chNameEl) {
    chNameEl.textContent = chText.includes('--') ? 'general' : chText.replace(/^#/, '');
  }

  const mentionVal = mentionSelect?.value || '';
  const mentionLabel = mentionVal === 'everyone'
    ? '@everyone'
    : mentionVal === 'here'
      ? '@here'
      : mentionVal.startsWith('role:')
        ? (mentionSelect?.selectedOptions[0]?.text || '@Role')
        : '';

  const title = (titleInput?.value || '').trim();
  const content = contentInput?.value || '';
  const useEmbed = Boolean(asEmbedCheck?.checked || title);
  const color = /^#[0-9a-fA-F]{6}$/.test(colorInput?.value || '') ? colorInput.value : '#00d2ff';

  const plainWrap = document.getElementById('sim-announcer-plain-wrap');
  const embedWrap = document.getElementById('sim-announcer-embed-wrap');
  const mentionWrap = document.getElementById('sim-announcer-mention-wrap');
  const titleEl = document.getElementById('sim-announcer-title');
  const descEl = document.getElementById('sim-announcer-desc');

  const previewText = content.trim()
    ? formatDiscordMarkdown(content)
    : '<span style="color: var(--text-muted); font-style: italic;">Start typing your message on the left to preview it here...</span>';

  if (useEmbed) {
    plainWrap?.classList.add('hidden');
    embedWrap?.classList.remove('hidden');

    if (mentionWrap) {
      if (mentionLabel) {
        mentionWrap.textContent = mentionLabel;
        mentionWrap.classList.remove('hidden');
      } else {
        mentionWrap.classList.add('hidden');
      }
    }

    if (embedWrap) {
      embedWrap.style.borderLeftColor = color;
    }

    if (titleEl) {
      if (title) {
        titleEl.innerHTML = formatDiscordMarkdown(title);
        titleEl.classList.remove('hidden');
      } else {
        titleEl.classList.add('hidden');
      }
    }

    if (descEl) {
      descEl.innerHTML = previewText;
    }
  } else {
    embedWrap?.classList.add('hidden');
    mentionWrap?.classList.add('hidden');
    plainWrap?.classList.remove('hidden');

    if (plainWrap) {
      const prefixHtml = mentionLabel
        ? `<span style="color: var(--accent-blurple); font-weight: 600;">${mentionLabel}</span><br>`
        : '';
      plainWrap.innerHTML = `${prefixHtml}${previewText}`;
    }
  }
}

/**
 * Attach event listeners for the Send Message tab.
 */
export function setupAnnouncerTabListeners() {
  const inputs = [
    'select-announcer-channel',
    'select-announcer-mention',
    'check-announcer-embed',
    'announcer-embed-color',
    'announcer-title-input',
    'announcer-content-input'
  ];

  inputs.forEach(id => {
    const el = document.getElementById(id);
    if (!el) return;
    el.addEventListener('input', updateAnnouncerPreview);
    el.addEventListener('change', updateAnnouncerPreview);
  });

  document.getElementById('btn-announcer-clear')?.addEventListener('click', () => {
    const titleEl = document.getElementById('announcer-title-input');
    const contentEl = document.getElementById('announcer-content-input');
    const mentionEl = document.getElementById('select-announcer-mention');
    if (titleEl) titleEl.value = '';
    if (contentEl) contentEl.value = '';
    if (mentionEl) mentionEl.value = '';
    document.getElementById('announcer-last-sent')?.classList.add('hidden');
    updateAnnouncerPreview();
  });

  document.getElementById('btn-announcer-send')?.addEventListener('click', async () => {
    const channelId = document.getElementById('select-announcer-channel')?.value || '';
    const mention = document.getElementById('select-announcer-mention')?.value || '';
    const asEmbed = document.getElementById('check-announcer-embed')?.checked || false;
    const embedColor = document.getElementById('announcer-embed-color')?.value || '#00d2ff';
    const embedTitle = document.getElementById('announcer-title-input')?.value.trim() || '';
    const content = document.getElementById('announcer-content-input')?.value.trim() || '';

    if (!channelId) {
      showToast('Please select a target Discord channel first.', 'error');
      return;
    }
    if (!content && !embedTitle) {
      showToast('Please write a message or embed title before sending.', 'error');
      return;
    }

    const sendBtn = document.getElementById('btn-announcer-send');
    if (sendBtn) sendBtn.disabled = true;

    try {
      const res = await fetch('/api/announcer/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          channelId,
          content,
          embedTitle,
          embedColor,
          asEmbed,
          mention
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to send message');

      showToast(`Message sent to #${data.channelName}!`, 'success');

      const statusBox = document.getElementById('announcer-last-sent');
      const statusLink = document.getElementById('announcer-last-sent-link');
      const statusChannel = document.getElementById('announcer-last-sent-channel');
      if (statusBox && statusChannel) {
        statusChannel.textContent = `#${data.channelName}`;
        if (statusLink && data.url) {
          statusLink.href = data.url;
          statusLink.classList.remove('hidden');
        }
        statusBox.classList.remove('hidden');
      }
    } catch (err) {
      showToast(`Error: ${err.message}`, 'error');
    } finally {
      if (sendBtn) sendBtn.disabled = false;
    }
  });
}

