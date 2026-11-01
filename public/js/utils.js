export function escapeHtml(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function refreshIcons() {
  if (window.lucide && typeof window.lucide.createIcons === 'function') {
    window.lucide.createIcons();
  }
}

export function formatDiscordMarkdown(text) {
  if (!text) return '';
  let formatted = text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
  formatted = formatted.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
  formatted = formatted.replace(/\*(.*?)\*/g, '<em>$1</em>');
  formatted = formatted.replace(/`(.*?)`/g, '<code style="background: rgba(0,0,0,0.3); padding: 1px 4px; border-radius: 3px;">$1</code>');
  formatted = formatted.replace(/\n/g, '<br>');
  return formatted;
}

export function extractFlagIsoCode(emoji) {
  if (!emoji) return null;
  try {
    const chars = [...emoji.trim()];
    if (chars.length === 2) {
      const cp1 = chars[0].codePointAt(0);
      const cp2 = chars[1].codePointAt(0);
      if (cp1 >= 0x1F1E6 && cp1 <= 0x1F1FF && cp2 >= 0x1F1E6 && cp2 <= 0x1F1FF) {
        return String.fromCharCode(cp1 - 0x1F1E6 + 65, cp2 - 0x1F1E6 + 65).toLowerCase();
      }
    }
  } catch (_) {}
  return null;
}

export function showToast(message, type = 'success') {
  const toast = document.getElementById('toast-banner');
  const text = document.getElementById('toast-message');
  if (!toast || !text) return;
  text.textContent = message;
  toast.className = `toast-banner ${type}`;
  setTimeout(() => {
    toast.className = 'toast-banner hidden';
  }, 4500);
}

export function adjustServerInputWidth(input) {
  if (!input) return;
  const tempSpan = document.createElement('span');
  tempSpan.style.visibility = 'hidden';
  tempSpan.style.position = 'absolute';
  tempSpan.style.whiteSpace = 'pre';
  tempSpan.style.font = '700 0.85rem "JetBrains Mono", monospace';
  tempSpan.textContent = input.value || input.placeholder || 'Asia Fregion';
  document.body.appendChild(tempSpan);
  const width = Math.max(105, Math.min(tempSpan.getBoundingClientRect().width + 24, 260));
  input.style.width = `${width}px`;
  document.body.removeChild(tempSpan);
}

