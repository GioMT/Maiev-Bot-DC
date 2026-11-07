import { DEFAULT_USER_VERIFY_TEMPLATE } from '../presets.js?v=7.2';
import { state, getActiveServerName } from '../state.js?v=7.2';
import { formatDiscordMarkdown, refreshIcons, showToast } from '../utils.js?v=7.2';

let currentUploadedVideoPath = '';
let simReasonMode = 'reupload'; // 'reupload' | 'reject'

export function getUploadedUserVerifyVideoPath() {
  return currentUploadedVideoPath;
}

export function renderUserVerifyRoleCheckboxes(data) {
  const roles = [...(data.guild?.roles || [])].sort((a, b) => b.position - a.position);
  const cfg = data.config || {};

  const reviewerContainer = document.getElementById('uverify-reviewer-roles-container');
  const addContainer = document.getElementById('uverify-roles-add-container');
  const removeContainer = document.getElementById('uverify-roles-remove-container');

  const selectedReviewers = Array.isArray(cfg.userVerifyReviewerRoleIds) ? cfg.userVerifyReviewerRoleIds : [];
  const selectedAdd = Array.isArray(cfg.userVerifyRolesToAdd) ? cfg.userVerifyRolesToAdd : [];
  const selectedRemove = Array.isArray(cfg.userVerifyRolesToRemove) ? cfg.userVerifyRolesToRemove : [];

  const updateBadge = (badgeId, inputName) => {
    const badge = document.getElementById(badgeId);
    if (!badge) return;
    const count = document.querySelectorAll(`input[name="${inputName}"]:checked`).length;
    badge.textContent = `${count} Selected`;
  };

  function populateGrid(container, inputName, selectedIds, badgeId, onChangeCb) {
    if (!container) return;
    container.innerHTML = '';
    roles.forEach(role => {
      if (role.name === '@everyone') return;
      const label = document.createElement('label');
      label.className = 'role-checkbox-item';
      const isChecked = selectedIds.includes(role.id);
      label.innerHTML = `
        <input type="checkbox" name="${inputName}" value="${role.id}" data-role-name="${role.name.replace(/"/g, '&quot;')}" ${isChecked ? 'checked' : ''}>
        <span class="role-name">@${role.name}</span>
      `;
      label.querySelector('input')?.addEventListener('change', () => {
        updateBadge(badgeId, inputName);
        if (onChangeCb) onChangeCb();
      });
      container.appendChild(label);
    });
    updateBadge(badgeId, inputName);
  }

  populateGrid(reviewerContainer, 'role_uverify_reviewer', selectedReviewers, 'uverify-reviewer-count', updateUserVerifyPreview);
  populateGrid(addContainer, 'role_uverify_add', selectedAdd, 'uverify-add-count', updateUserVerifyPreview);
  populateGrid(removeContainer, 'role_uverify_remove', selectedRemove, 'uverify-remove-count', updateUserVerifyPreview);
}

function renderUploadedVideoBadge(videoPath) {
  currentUploadedVideoPath = videoPath || '';
  const statusEl = document.getElementById('uverify-uploaded-video-status');
  const removeBtn = document.getElementById('btn-remove-uverify-video');

  if (!statusEl) return;

  if (currentUploadedVideoPath) {
    const fileName = currentUploadedVideoPath.split('/').pop();
    statusEl.innerHTML = `<span style="color: var(--accent-green); font-weight: 600;">✅ Attached: ${fileName}</span>`;
    removeBtn?.classList.remove('hidden');
  } else {
    statusEl.innerHTML = `<span class="text-muted">No local video file attached yet (upload .mp4, .mov, or .webm)</span>`;
    removeBtn?.classList.add('hidden');
  }
}

export function renderUserVerifyEditor(cfg = {}) {
  const titleEl = document.getElementById('uverify-title-input');
  const contentEl = document.getElementById('uverify-content-input');
  const footerEl = document.getElementById('uverify-footer-input');
  const btnLabelEl = document.getElementById('uverify-btn-label-input');
  const videoUrlEl = document.getElementById('uverify-video-url-input');
  const threadTitleEl = document.getElementById('uverify-thread-title-input');
  const threadContentEl = document.getElementById('uverify-thread-content-input');
  const deployBadge = document.getElementById('uverify-deploy-badge');

  if (titleEl) titleEl.value = cfg.userVerifyTitle || DEFAULT_USER_VERIFY_TEMPLATE.title;
  if (contentEl) contentEl.value = cfg.userVerifyContent || DEFAULT_USER_VERIFY_TEMPLATE.content;
  if (footerEl) footerEl.value = cfg.userVerifyFooter || DEFAULT_USER_VERIFY_TEMPLATE.footer;
  if (btnLabelEl) btnLabelEl.value = cfg.userVerifyButtonLabel || DEFAULT_USER_VERIFY_TEMPLATE.buttonLabel;
  if (videoUrlEl) videoUrlEl.value = cfg.userVerifyVideoUrl || '';
  if (threadTitleEl) threadTitleEl.value = cfg.userVerifyThreadTitle || DEFAULT_USER_VERIFY_TEMPLATE.threadTitle;
  if (threadContentEl) threadContentEl.value = cfg.userVerifyThreadContent || DEFAULT_USER_VERIFY_TEMPLATE.threadContent;

  if (deployBadge) {
    if (cfg.userVerifyMessageId) {
      deployBadge.className = 'badge badge-success';
      deployBadge.textContent = `Deployed (${String(cfg.userVerifyMessageId).slice(-6)})`;
    } else {
      deployBadge.className = 'badge';
      deployBadge.textContent = 'Not Posted Yet';
    }
  }

  renderUploadedVideoBadge(cfg.userVerifyUploadedVideo || '');
  updateUserVerifyPreview();
}

function getSelectedRoleNames(inputName, fallback) {
  const checked = Array.from(document.querySelectorAll(`input[name="${inputName}"]:checked`));
  if (checked.length === 0) return fallback;
  return checked.map(el => `@${el.getAttribute('data-role-name') || 'Role'}`).join(', ');
}

export function updateUserVerifyPreview() {
  const serverName = getActiveServerName();
  const chSelect = document.getElementById('select-user-verify-channel');
  const chName = chSelect?.selectedOptions?.[0]?.text?.replace(/^#/, '') || 'user-verify';

  const simChName = document.getElementById('sim-uverify-channel-name');
  if (simChName && !simChName.textContent.includes('--')) {
    simChName.textContent = chName;
  }

  // 1. Channel View Preview
  const rawTitle = document.getElementById('uverify-title-input')?.value || DEFAULT_USER_VERIFY_TEMPLATE.title;
  const rawContent = document.getElementById('uverify-content-input')?.value || DEFAULT_USER_VERIFY_TEMPLATE.content;
  const rawFooter = document.getElementById('uverify-footer-input')?.value || DEFAULT_USER_VERIFY_TEMPLATE.footer;
  const btnLabel = document.getElementById('uverify-btn-label-input')?.value || DEFAULT_USER_VERIFY_TEMPLATE.buttonLabel;
  const videoUrl = (document.getElementById('uverify-video-url-input')?.value || '').trim();

  const titleEl = document.getElementById('sim-uverify-title');
  const descEl = document.getElementById('sim-uverify-desc');
  const footerEl = document.getElementById('sim-uverify-footer');
  const startBtnLabelEl = document.getElementById('sim-uverify-start-label');
  const watchUrlBtn = document.getElementById('sim-btn-uverify-watch-url');
  const videoWrap = document.getElementById('sim-uverify-video-wrap');
  const videoPlayer = document.getElementById('sim-uverify-video-player');

  if (titleEl) titleEl.innerHTML = formatDiscordMarkdown(rawTitle.replace(/{server}/g, serverName));
  if (descEl) descEl.innerHTML = formatDiscordMarkdown(rawContent.replace(/{server}/g, serverName));
  if (footerEl) footerEl.textContent = rawFooter.replace(/{server}/g, serverName);
  if (startBtnLabelEl) startBtnLabelEl.textContent = btnLabel;

  // Show inline HTML5 video player in simulator if uploaded file OR direct video URL is present
  const directPlayableSrc = currentUploadedVideoPath || (/\.(mp4|mov|webm|m4v)(\?.*)?$/i.test(videoUrl) ? videoUrl : '');
  if (videoWrap && videoPlayer) {
    if (directPlayableSrc) {
      videoWrap.classList.remove('hidden');
      if (videoPlayer.getAttribute('data-src') !== directPlayableSrc) {
        videoPlayer.src = directPlayableSrc;
        videoPlayer.setAttribute('data-src', directPlayableSrc);
      }
    } else {
      videoWrap.classList.add('hidden');
      videoPlayer.removeAttribute('src');
      videoPlayer.setAttribute('data-src', '');
    }
  }

  if (watchUrlBtn) {
    if (videoUrl && /^https?:\/\//i.test(videoUrl)) {
      watchUrlBtn.classList.remove('hidden');
      watchUrlBtn.href = videoUrl;
    } else {
      watchUrlBtn.classList.add('hidden');
    }
  }

  // 2. Private Thread View Preview
  const reviewerNames = getSelectedRoleNames('role_uverify_reviewer', 'Server Administrators');
  const rawThreadTitle = document.getElementById('uverify-thread-title-input')?.value || DEFAULT_USER_VERIFY_TEMPLATE.threadTitle;
  const rawThreadContent = document.getElementById('uverify-thread-content-input')?.value || DEFAULT_USER_VERIFY_TEMPLATE.threadContent;

  const threadMentionsEl = document.getElementById('sim-uverify-thread-mentions');
  const threadTitleEl = document.getElementById('sim-uverify-thread-title');
  const threadDescEl = document.getElementById('sim-uverify-thread-desc');

  if (threadMentionsEl) {
    threadMentionsEl.textContent = reviewerNames === 'Server Administrators'
      ? '@DaevaLegend'
      : `@DaevaLegend • Reviewers: ${reviewerNames}`;
  }

  if (threadTitleEl) {
    threadTitleEl.innerHTML = formatDiscordMarkdown(
      rawThreadTitle
        .replace(/{case}/g, '0001')
        .replace(/{user}/g, 'DaevaLegend')
        .replace(/{server}/g, serverName)
        .replace(/{channel}/g, chName)
    );
  }

  if (threadDescEl) {
    threadDescEl.innerHTML = formatDiscordMarkdown(
      rawThreadContent
        .replace(/{case}/g, '#0001')
        .replace(/{user}/g, '**@DaevaLegend**')
        .replace(/{server}/g, serverName)
        .replace(/{channel}/g, chName)
        .replace(/{reviewers}/g, `**${reviewerNames}**`)
    );
  }

  const threadFooterEl = document.getElementById('sim-uverify-thread-footer');
  if (threadFooterEl) {
    threadFooterEl.textContent = `${serverName} • Case #0001 Private Verification`;
  }
}

function switchSimulatorView(mode) {
  const isThread = mode === 'thread';
  document.getElementById('btn-sim-uverify-view-channel')?.classList.toggle('active', !isThread);
  document.getElementById('btn-sim-uverify-view-thread')?.classList.toggle('active', isThread);
  document.getElementById('sim-uverify-channel-pane')?.classList.toggle('hidden', isThread);
  document.getElementById('sim-uverify-thread-pane')?.classList.toggle('hidden', !isThread);
  refreshIcons();
}

function setSimulatedReviewerButtonsDisabled(disabled) {
  ['sim-btn-uverify-approve', 'sim-btn-uverify-reupload', 'sim-btn-uverify-reject'].forEach(id => {
    const btn = document.getElementById(id);
    if (btn) btn.disabled = disabled;
  });
}

function resetThreadSimulation() {
  setSimulatedReviewerButtonsDisabled(false);
  const statusEl = document.getElementById('sim-uverify-thread-status');
  if (statusEl) {
    statusEl.innerHTML = '⏳ Pending — Waiting for recording &amp; reviewer check';
    statusEl.style.color = '#dbdee1';
  }
  const embedEl = document.getElementById('sim-uverify-thread-embed');
  if (embedEl) embedEl.style.borderLeftColor = '#00d2ff';
  const ephEmbedEl = document.getElementById('sim-uverify-ephemeral-embed');
  if (ephEmbedEl) ephEmbedEl.style.borderLeftColor = '#5865F2';
  const ephDescEl = document.getElementById('sim-uverify-ephemeral-desc');
  if (ephDescEl) {
    ephDescEl.innerHTML = `
      <strong>Applicant:</strong> @DaevaLegend (<code>DaevaLegend</code>)<br>
      <strong>Case Status:</strong> ⏳ Pending Review<br><br>
      <em>Choose an action below — these controls are <strong>invisible</strong> to the applicant:</em>
    `;
  }
  const logEl = document.getElementById('sim-uverify-thread-log');
  if (logEl) {
    logEl.classList.add('hidden');
    logEl.innerHTML = '';
  }
}

export function collectUserVerifyFormValues() {
  const userVerifyChannelId = document.getElementById('select-user-verify-channel')?.value || '';
  const userVerifyReviewerRoleIds = Array.from(document.querySelectorAll('input[name="role_uverify_reviewer"]:checked')).map(el => el.value);
  const userVerifyRolesToAdd = Array.from(document.querySelectorAll('input[name="role_uverify_add"]:checked')).map(el => el.value);
  const userVerifyRolesToRemove = Array.from(document.querySelectorAll('input[name="role_uverify_remove"]:checked')).map(el => el.value);

  const userVerifyTitle = document.getElementById('uverify-title-input')?.value.trim() || DEFAULT_USER_VERIFY_TEMPLATE.title;
  const userVerifyContent = document.getElementById('uverify-content-input')?.value.trim() || DEFAULT_USER_VERIFY_TEMPLATE.content;
  const userVerifyFooter = document.getElementById('uverify-footer-input')?.value.trim() || DEFAULT_USER_VERIFY_TEMPLATE.footer;
  const userVerifyButtonLabel = document.getElementById('uverify-btn-label-input')?.value.trim() || DEFAULT_USER_VERIFY_TEMPLATE.buttonLabel;
  const userVerifyVideoUrl = document.getElementById('uverify-video-url-input')?.value.trim() || '';
  const userVerifyThreadTitle = document.getElementById('uverify-thread-title-input')?.value.trim() || DEFAULT_USER_VERIFY_TEMPLATE.threadTitle;
  const userVerifyThreadContent = document.getElementById('uverify-thread-content-input')?.value.trim() || DEFAULT_USER_VERIFY_TEMPLATE.threadContent;

  return {
    userVerifyChannelId,
    userVerifyReviewerRoleIds,
    userVerifyRolesToAdd,
    userVerifyRolesToRemove,
    userVerifyTitle,
    userVerifyContent,
    userVerifyFooter,
    userVerifyButtonLabel,
    userVerifyVideoUrl,
    userVerifyUploadedVideo: currentUploadedVideoPath,
    userVerifyThreadTitle,
    userVerifyThreadContent
  };
}

async function deployUserVerifyPanel(forceNew) {
  const values = collectUserVerifyFormValues();
  if (!values.userVerifyChannelId) {
    showToast('Please select a target verification channel (e.g. #user-verify) first.', 'error');
    return;
  }

  const btn = document.getElementById(forceNew ? 'btn-post-user-verify-channel' : 'btn-update-user-verify-channel');
  const originalHtml = btn?.innerHTML;
  if (btn) {
    btn.disabled = true;
    btn.innerHTML = '<i data-lucide="loader-2"></i> Deploying...';
    refreshIcons();
  }

  try {
    const res = await fetch('/api/post-user-verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        channelId: values.userVerifyChannelId,
        forceNew,
        ...values
      })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to deploy verification card');

    const deployBadge = document.getElementById('uverify-deploy-badge');
    if (deployBadge && data.messageId) {
      deployBadge.className = 'badge badge-success';
      deployBadge.textContent = `Deployed (${String(data.messageId).slice(-6)})`;
    }

    showToast(
      data.updated
        ? `Updated verification card in #${data.channelName}!`
        : `Posted verification card${currentUploadedVideoPath ? ' + reference video' : ''} to #${data.channelName}!`,
      'success'
    );
  } catch (err) {
    showToast(`Error: ${err.message}`, 'error');
  } finally {
    if (btn && originalHtml) {
      btn.disabled = false;
      btn.innerHTML = originalHtml;
      refreshIcons();
    }
  }
}

export function setupUserVerifyTabListeners() {
  [
    'uverify-title-input',
    'uverify-content-input',
    'uverify-footer-input',
    'uverify-btn-label-input',
    'uverify-video-url-input',
    'uverify-thread-title-input',
    'uverify-thread-content-input'
  ].forEach(id => {
    document.getElementById(id)?.addEventListener('input', updateUserVerifyPreview);
  });

  document.getElementById('select-user-verify-channel')?.addEventListener('change', updateUserVerifyPreview);

  // Reset Templates
  document.getElementById('btn-reset-uverify-template')?.addEventListener('click', () => {
    document.getElementById('uverify-title-input').value = DEFAULT_USER_VERIFY_TEMPLATE.title;
    document.getElementById('uverify-content-input').value = DEFAULT_USER_VERIFY_TEMPLATE.content;
    document.getElementById('uverify-footer-input').value = DEFAULT_USER_VERIFY_TEMPLATE.footer;
    document.getElementById('uverify-btn-label-input').value = DEFAULT_USER_VERIFY_TEMPLATE.buttonLabel;
    updateUserVerifyPreview();
    showToast('Reset channel verification embed to default template!', 'success');
  });

  document.getElementById('btn-reset-uverify-thread-template')?.addEventListener('click', () => {
    document.getElementById('uverify-thread-title-input').value = DEFAULT_USER_VERIFY_TEMPLATE.threadTitle;
    document.getElementById('uverify-thread-content-input').value = DEFAULT_USER_VERIFY_TEMPLATE.threadContent;
    updateUserVerifyPreview();
    showToast('Reset private thread welcome message to default template!', 'success');
  });

  // Video File Upload
  const fileInput = document.getElementById('uverify-video-file-input');
  const uploadBtn = document.getElementById('btn-trigger-uverify-video-upload');
  const removeVideoBtn = document.getElementById('btn-remove-uverify-video');

  uploadBtn?.addEventListener('click', () => fileInput?.click());

  fileInput?.addEventListener('change', async () => {
    const file = fileInput.files?.[0];
    if (!file) return;

    if (file.size > 50 * 1024 * 1024) {
      showToast('Video exceeds 50 MB limit. Please compress the video or paste a Video URL instead.', 'error');
      fileInput.value = '';
      return;
    }

    const origHtml = uploadBtn.innerHTML;
    uploadBtn.disabled = true;
    uploadBtn.innerHTML = '<i data-lucide="loader-2"></i> Uploading Video...';
    refreshIcons();

    try {
      const res = await fetch('/api/upload-verify-video', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/octet-stream',
          'X-File-Name': encodeURIComponent(file.name)
        },
        body: file
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Upload failed');

      renderUploadedVideoBadge(data.videoPath);
      updateUserVerifyPreview();
      showToast(`Reference video "${file.name}" uploaded & ready to post!`, 'success');
    } catch (err) {
      showToast(`Video upload failed: ${err.message}`, 'error');
    } finally {
      uploadBtn.disabled = false;
      uploadBtn.innerHTML = origHtml;
      fileInput.value = '';
      refreshIcons();
    }
  });

  removeVideoBtn?.addEventListener('click', async () => {
    try {
      const res = await fetch('/api/upload-verify-video', { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to remove video');
      renderUploadedVideoBadge('');
      updateUserVerifyPreview();
      showToast('Removed attached reference video.', 'success');
    } catch (err) {
      showToast(`Error: ${err.message}`, 'error');
    }
  });

  // Deploy / Update Buttons
  document.getElementById('btn-post-user-verify-channel')?.addEventListener('click', () => deployUserVerifyPanel(true));
  document.getElementById('btn-update-user-verify-channel')?.addEventListener('click', () => deployUserVerifyPanel(false));

  // Simulator Switcher & Interactive Option C Flow
  document.getElementById('btn-sim-uverify-view-channel')?.addEventListener('click', () => switchSimulatorView('channel'));
  document.getElementById('btn-sim-uverify-view-thread')?.addEventListener('click', () => switchSimulatorView('thread'));

  document.getElementById('sim-btn-uverify-start')?.addEventListener('click', () => {
    resetThreadSimulation();
    switchSimulatorView('thread');
    showToast('Simulated Private Thread "verify-0001-DaevaLegend" (Case #0001) created!', 'success');
  });

  document.getElementById('sim-btn-uverify-reset-sim')?.addEventListener('click', () => {
    resetThreadSimulation();
    showToast('Reset private thread simulation state.', 'success');
  });

  // Simulated Approve Button
  document.getElementById('sim-btn-uverify-approve')?.addEventListener('click', () => {
    const addRoles = getSelectedRoleNames('role_uverify_add', '@Verified');
    const remRoles = getSelectedRoleNames('role_uverify_remove', '');

    setSimulatedReviewerButtonsDisabled(true);
    const statusEl = document.getElementById('sim-uverify-thread-status');
    if (statusEl) {
      statusEl.innerHTML = '✅ Approved by <strong>@AdminReviewer</strong>';
      statusEl.style.color = '#2ecc71';
    }
    const embedEl = document.getElementById('sim-uverify-thread-embed');
    if (embedEl) embedEl.style.borderLeftColor = '#2ecc71';
    const ephEmbedEl = document.getElementById('sim-uverify-ephemeral-embed');
    if (ephEmbedEl) ephEmbedEl.style.borderLeftColor = '#2ecc71';
    const ephDescEl = document.getElementById('sim-uverify-ephemeral-desc');
    if (ephDescEl) {
      ephDescEl.innerHTML = `
        <strong>Applicant:</strong> @DaevaLegend (<code>DaevaLegend</code>)<br>
        <strong>Case Status:</strong> ✅ Approved &amp; Verified! Private thread archived.<br><br>
        <em>This verification case has already been finalized.</em>
      `;
    }

    const logEl = document.getElementById('sim-uverify-thread-log');
    if (logEl) {
      logEl.classList.remove('hidden');
      logEl.innerHTML = `
        <div style="background: rgba(46, 204, 113, 0.12); border-left: 3px solid #2ecc71; padding: 12px; border-radius: 6px; margin-top: 10px;">
          <div style="font-weight: 700; color: #2ecc71; margin-bottom: 4px;">✅ Verification Complete!</div>
          <div style="color: #dbdee1; font-size: 0.83rem; line-height: 1.45;">
            Congratulations <strong>@DaevaLegend</strong>! Your screen recording verification was approved.<br>
            <strong>Granted:</strong> <code>${addRoles}</code>
            ${remRoles ? `<br><strong>Removed:</strong> <code>${remRoles}</code>` : ''}
            <br><span style="color: #949ba4; font-size: 0.78rem;">🔒 Private thread locked &amp; archived automatically.</span>
          </div>
        </div>
      `;
    }
  });

  // Simulated Re-upload & Reject Reason Modal
  const reasonModal = document.getElementById('sim-uverify-reason-modal');
  const openSimReasonModal = (mode) => {
    simReasonMode = mode;
    const isReupload = mode === 'reupload';
    document.getElementById('sim-uverify-reason-modal-title').textContent = isReupload
      ? 'Request New Recording'
      : 'Reject & Close Verification';
    document.getElementById('sim-uverify-reason-modal-label').innerHTML = isReupload
      ? 'WHAT SHOULD THE USER FIX OR RE-RECORD? <span class="required">*</span>'
      : 'REASON FOR REJECTING THIS VERIFICATION <span class="required">*</span>';
    document.getElementById('sim-uverify-reason-input').value = isReupload
      ? 'Please clearly show your character select screen with the Fregion server visible.'
      : 'Submission does not match our server character requirements.';
    reasonModal?.classList.remove('hidden');
  };

  document.getElementById('sim-btn-uverify-reupload')?.addEventListener('click', () => openSimReasonModal('reupload'));
  document.getElementById('sim-btn-uverify-reject')?.addEventListener('click', () => openSimReasonModal('reject'));

  document.getElementById('sim-uverify-reason-close')?.addEventListener('click', () => reasonModal?.classList.add('hidden'));
  document.getElementById('sim-uverify-reason-cancel')?.addEventListener('click', () => reasonModal?.classList.add('hidden'));

  document.getElementById('sim-uverify-reason-submit')?.addEventListener('click', () => {
    const reason = document.getElementById('sim-uverify-reason-input')?.value.trim() || 'No reason provided.';
    reasonModal?.classList.add('hidden');

    const isReupload = simReasonMode === 'reupload';
    const statusEl = document.getElementById('sim-uverify-thread-status');
    const embedEl = document.getElementById('sim-uverify-thread-embed');
    const logEl = document.getElementById('sim-uverify-thread-log');

    if (isReupload) {
      setSimulatedReviewerButtonsDisabled(false);
      if (statusEl) {
        statusEl.innerHTML = '🔄 Re-upload Requested by <strong>@AdminReviewer</strong>';
        statusEl.style.color = '#f39c12';
      }
      if (embedEl) embedEl.style.borderLeftColor = '#f39c12';
      const ephEmbedEl = document.getElementById('sim-uverify-ephemeral-embed');
      if (ephEmbedEl) ephEmbedEl.style.borderLeftColor = '#f39c12';
      const ephDescEl = document.getElementById('sim-uverify-ephemeral-desc');
      if (ephDescEl) {
        ephDescEl.innerHTML = `
          <strong>Applicant:</strong> @DaevaLegend (<code>DaevaLegend</code>)<br>
          <strong>Case Status:</strong> 🔄 Re-upload Requested — Thread remains open<br><br>
          <em>Choose an action below — these controls are <strong>invisible</strong> to the applicant:</em>
        `;
      }
      if (logEl) {
        logEl.classList.remove('hidden');
        logEl.innerHTML = `
          <div style="background: rgba(243, 156, 18, 0.12); border-left: 3px solid #f39c12; padding: 12px; border-radius: 6px; margin-top: 10px;">
            <div style="font-weight: 700; color: #f39c12; margin-bottom: 4px;">🔄 Action Required — Please Submit Updated Recording</div>
            <div style="color: #dbdee1; font-size: 0.83rem; line-height: 1.45;">
              Hello <strong>@DaevaLegend</strong>, a reviewer requested an update:<br>
              <blockquote style="margin: 6px 0; padding-left: 8px; border-left: 2px solid rgba(255,255,255,0.25); color: #fff;">${formatDiscordMarkdown(reason)}</blockquote>
              <span style="color: #949ba4; font-size: 0.78rem;">🔓 Private thread stays OPEN — Reviewer controls remain available via <code>/review</code>!</span>
            </div>
          </div>
        `;
      }
    } else {
      setSimulatedReviewerButtonsDisabled(true);
      if (statusEl) {
        statusEl.innerHTML = '❌ Rejected &amp; Closed by <strong>@AdminReviewer</strong>';
        statusEl.style.color = '#e74c3c';
      }
      if (embedEl) embedEl.style.borderLeftColor = '#e74c3c';
      const ephEmbedEl = document.getElementById('sim-uverify-ephemeral-embed');
      if (ephEmbedEl) ephEmbedEl.style.borderLeftColor = '#e74c3c';
      const ephDescEl = document.getElementById('sim-uverify-ephemeral-desc');
      if (ephDescEl) {
        ephDescEl.innerHTML = `
          <strong>Applicant:</strong> @DaevaLegend (<code>DaevaLegend</code>)<br>
          <strong>Case Status:</strong> ❌ Rejected &amp; Private Thread Archived<br><br>
          <em>This verification case has already been finalized.</em>
        `;
      }
      if (logEl) {
        logEl.classList.remove('hidden');
        logEl.innerHTML = `
          <div style="background: rgba(231, 76, 60, 0.12); border-left: 3px solid #e74c3c; padding: 12px; border-radius: 6px; margin-top: 10px;">
            <div style="font-weight: 700; color: #e74c3c; margin-bottom: 4px;">❌ Verification Declined</div>
            <div style="color: #dbdee1; font-size: 0.83rem; line-height: 1.45;">
              Submission declined by <strong>@AdminReviewer</strong>:<br>
              <blockquote style="margin: 6px 0; padding-left: 8px; border-left: 2px solid rgba(255,255,255,0.25); color: #fff;">${formatDiscordMarkdown(reason)}</blockquote>
              <span style="color: #949ba4; font-size: 0.78rem;">🔒 User DM notified &amp; private thread locked + archived.</span>
            </div>
          </div>
        `;
      }
    }
  });
}

