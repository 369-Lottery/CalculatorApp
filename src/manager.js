const AVATARS = [
  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>',
  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="7" width="20" height="14" rx="2" ry="2"></rect><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"></path></svg>',
  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="6" width="20" height="12" rx="2" ry="2"></rect><path d="M6 12h4"></path><path d="M8 10v4"></path><line x1="15" y1="13" x2="15.01" y2="13"></line><line x1="18" y1="11" x2="18.01" y2="11"></line></svg>',
  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="13.5" cy="6.5" r=".5"></circle><circle cx="17.5" cy="10.5" r=".5"></circle><circle cx="8.5" cy="7.5" r=".5"></circle><circle cx="6.5" cy="12.5" r=".5"></circle><path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.926 0 1.648-.746 1.648-1.688 0-.437-.18-.835-.437-1.125-.29-.289-.438-.652-.438-1.125a1.64 1.64 0 0 1 1.668-1.668h1.996c3.051 0 5.555-2.503 5.555-5.554C21.965 6.012 17.461 2 12 2z"></path></svg>',
  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18V5l12-2v13"></path><circle cx="6" cy="18" r="3"></circle><circle cx="18" cy="16" r="3"></circle></svg>',
  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10 2v7.31"></path><path d="M14 9.3V1.99"></path><path d="M8.5 2h7"></path><path d="M14 9.3a6.5 6.5 0 1 1-4 0"></path><line x1="5.52" y1="16" x2="18.48" y2="16"></line></svg>',
  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="2" y1="12" x2="22" y2="12"></line><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"></path></svg>',
  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon></svg>'
];

// ─── Profile Colors (per profile slot) ───────────────────────────────────────
const PROFILE_COLORS = [
  '#4f8ef7','#7c5cbf','#27c68a','#e05252',
  '#e8a317','#06b6d4','#f97316','#a78bfa'
];

// ─── DOM refs ──────────────────────────────────────────────────────────────────
const profileList   = document.getElementById('profile-list');
const loadingState  = document.getElementById('loading-state');
const emptyState    = document.getElementById('empty-state');
const chromeWarn    = document.getElementById('chrome-warn');
const modalOverlay  = document.getElementById('modal-overlay');
const profileNameEl = document.getElementById('profile-name');
const confirmOvl    = document.getElementById('confirm-overlay');
const confirmText   = document.getElementById('confirm-text');
const toastCont     = document.getElementById('toast-container');
const settingsModal = document.getElementById('settings-modal');
const renameOvl     = document.getElementById('rename-overlay');
const renameInput   = document.getElementById('rename-input');

let selectedAvatar  = 0;
let selectedAppType = 'chrome';
let pendingDelete   = null;
let pendingRename   = null;
let chromeFound     = false;
let telegramFound   = false;
let facebookFound   = false;

// ─── Phnom Penh Time ──────────────────────────────────────────────────────────
const TIME_ZONE = 'Asia/Phnom_Penh';
const clockFormat = new Intl.DateTimeFormat('en-GB', {
  timeZone: TIME_ZONE, weekday: 'short', day: 'numeric', month: 'short',
  hour: 'numeric', minute: '2-digit', second: '2-digit', hour12: true
});
const dateTimeFormat = new Intl.DateTimeFormat('en-GB', {
  timeZone: TIME_ZONE, day: 'numeric', month: 'short', year: 'numeric',
  hour: 'numeric', minute: '2-digit', hour12: true
});

function formatTime(iso) {
  return iso ? dateTimeFormat.format(new Date(iso)) : 'Never';
}

function updateClock() {
  document.getElementById('pp-clock-time').textContent = clockFormat.format(new Date());
}

// ─── Toast ────────────────────────────────────────────────────────────────────
function showToast(msg, type = '') {
  const t = document.createElement('div');
  t.className = 'toast' + (type ? ` ${type}` : '');
  t.textContent = msg;
  toastCont.appendChild(t);
  setTimeout(() => {
    t.style.animation = 'toast-out 0.3s ease forwards';
    setTimeout(() => t.remove(), 300);
  }, 2500);
}

// ─── Load Profiles ────────────────────────────────────────────────────────────
async function loadProfiles() {
  profileList.innerHTML = '';
  loadingState.style.display = 'flex';
  emptyState.style.display = 'none';

  // Check Chrome and Telegram
  const status = await window.api.chromeStatus();
  chromeFound = status.found;
  telegramFound = status.tgFound;
  facebookFound = status.found; // Facebook profiles also require Chrome
  if (!chromeFound && !telegramFound) chromeWarn.style.display = 'block';
  else chromeWarn.style.display = 'none';

  const chromeRes = await window.api.getProfiles();
  const tgRes = await window.api.getTelegramProfiles();
  const fbRes = await window.api.getFacebookProfiles();
  const activity = await window.api.getActivity();
  loadingState.style.display = 'none';

  let allProfiles = [];
  if (chromeRes.success) allProfiles.push(...chromeRes.profiles);
  if (tgRes.success) allProfiles.push(...tgRes.profiles);
  if (fbRes.success) allProfiles.push(...fbRes.profiles);

  document.getElementById('profile-count').textContent = allProfiles.length || '';

  if (!allProfiles.length) {
    emptyState.style.display = 'flex';
    return;
  }

  allProfiles.forEach((p, i) => renderCard(p, i, activity.lastOpened[p.id]));
}

// ─── Render Profile Card ──────────────────────────────────────────────────────
async function refreshLastOpened(card, profileId) {
  const activity = await window.api.getActivity();
  card.querySelector('.profile-opened').textContent = `Last opened: ${formatTime(activity.lastOpened[profileId])}`;
}

function renderCard(p, i, lastOpened) {
  const color = PROFILE_COLORS[i % PROFILE_COLORS.length];
  const avatarBg = color + '22';
  const emoji = AVATARS[i % AVATARS.length];

  const card = document.createElement('div');
  card.className = 'profile-card';
  card.dataset.profileId = p.id;

  let tagHtml = '';
  if (p.isDefault) tagHtml = `<span class="profile-tag tag-default">Default</span>`;

  const isTg = p.type === 'telegram';
  const isFb = p.type === 'facebook';
  let appBadge;
  if (isTg) {
    appBadge = `<div class="app-badge app-badge-tg" title="Telegram Profile"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="22" y1="2" x2="11" y2="13"></line><polygon points="22 2 15 22 11 13 2 9 22 2"></polygon></svg></div>`;
  } else if (isFb) {
    appBadge = `<div class="app-badge app-badge-fb" title="Facebook Profile"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z"></path></svg></div>`;
  } else {
    appBadge = `<div class="app-badge" title="Chrome Profile"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><circle cx="12" cy="12" r="4"></circle><line x1="21.17" y1="8" x2="12" y2="8"></line><line x1="3.95" y1="6.06" x2="8.54" y2="14"></line><line x1="10.88" y1="21.94" x2="15.46" y2="14"></line></svg></div>`;
  }

  card.innerHTML = `
    <div class="profile-avatar" style="background:${avatarBg}; --avatar-color:${color}">
      ${emoji}
      ${appBadge}
    </div>
    <div class="profile-info">
      <div class="profile-name"><span class="profile-name-text">${escHtml(p.name)}</span> ${tagHtml}</div>
      ${p.email ? `<div class="profile-email">${escHtml(p.email)}</div>` : ''}
      <div class="profile-opened">Last opened: ${formatTime(lastOpened)}</div>
    </div>
    <div class="card-actions">
      <button class="card-btn launch-btn" title="Launch Profile"><svg viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:14px; height:14px;"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg></button>
      <button class="card-btn rename-btn" title="Rename profile"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:14px; height:14px;"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg></button>
      ${!p.isDefault ? `<button class="card-btn del" title="Delete profile"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:14px; height:14px;"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg></button>` : ''}
    </div>
  `;

  card.querySelector('.launch-btn')?.addEventListener('click', async (e) => {
    e.stopPropagation();
    if (isTg) {
        if (!telegramFound) { showToast('Telegram not found', 'error'); return; }
        await window.api.launchTelegram(p.id);
    } else if (isFb) {
        if (!facebookFound) { showToast('Chrome not found (required for Facebook)', 'error'); return; }
        await window.api.launchFacebook(p.id);
    } else {
        if (!chromeFound) { showToast('Chrome not found', 'error'); return; }
        await window.api.launchProfile(p.id);
    }
    await refreshLastOpened(card, p.id);
    showToast(`Launched "${p.name}"`, 'success');
  });

  card.querySelector('.rename-btn')?.addEventListener('click', (e) => {
    e.stopPropagation();
    pendingRename = p;
    renameInput.value = p.name;
    renameOvl.classList.add('show');
    setTimeout(() => renameInput.select(), 150);
  });

  card.querySelector('.del')?.addEventListener('click', (e) => {
    e.stopPropagation();
    pendingDelete = p;
    confirmText.textContent = `Delete "${p.name}"? This will permanently remove the profile and all its data.`;
    confirmOvl.classList.add('show');
  });

  // Click card = launch
  card.addEventListener('click', async () => {
    if (isTg) {
        if (!telegramFound) { showToast('Telegram not found', 'error'); return; }
        await window.api.launchTelegram(p.id);
    } else if (isFb) {
        if (!facebookFound) { showToast('Chrome not found (required for Facebook)', 'error'); return; }
        await window.api.launchFacebook(p.id);
    } else {
        if (!chromeFound) { showToast('Chrome not found', 'error'); return; }
        await window.api.launchProfile(p.id);
    }
    await refreshLastOpened(card, p.id);
    showToast(`Launching "${p.name}"…`, 'success');
  });

  profileList.appendChild(card);
}

// ─── HTML escape ───────────────────────────────────────────────────────────────
function escHtml(s) {
  return String(s)
    .replace(/&/g,'&amp;')
    .replace(/</g,'&lt;')
    .replace(/>/g,'&gt;')
    .replace(/"/g,'&quot;');
}

// ─── Add Profile Modal ────────────────────────────────────────────────────────
document.getElementById('btn-add').addEventListener('click', () => {
  profileNameEl.value = '';
  selectedAvatar = 0;
  document.querySelectorAll('.avatar-opt').forEach((o, i) => {
    o.classList.toggle('selected', i === 0);
  });
  modalOverlay.classList.add('show');
  setTimeout(() => profileNameEl.focus(), 200);
});

document.getElementById('modal-close').addEventListener('click', closeModal);
document.getElementById('btn-cancel').addEventListener('click', closeModal);

function closeModal() { modalOverlay.classList.remove('show'); }

// App Type selection
document.querySelectorAll('.app-type-opt').forEach((opt) => {
  opt.addEventListener('click', () => {
    document.querySelectorAll('.app-type-opt').forEach(o => o.classList.remove('selected'));
    opt.classList.add('selected');
    selectedAppType = opt.dataset.type;
  });
});

// Avatar selection
document.querySelectorAll('.avatar-opt').forEach((opt, i) => {
  opt.addEventListener('click', () => {
    document.querySelectorAll('.avatar-opt').forEach(o => o.classList.remove('selected'));
    opt.classList.add('selected');
    selectedAvatar = i;
  });
});

// Create Profile
document.getElementById('btn-create').addEventListener('click', async () => {
  const name = profileNameEl.value.trim();
  if (!name) { profileNameEl.focus(); return; }
  closeModal();
  
  let res;
  if (selectedAppType === 'telegram') {
      res = await window.api.addTelegramProfile(name, selectedAvatar);
  } else if (selectedAppType === 'facebook') {
      res = await window.api.addFacebookProfile(name, selectedAvatar);
  } else {
      res = await window.api.addProfile(name);
  }
  
  if (res.success) {
    showToast(`Profile "${name}" created!`, 'success');
    await loadProfiles();
  } else {
    showToast(res.error || 'Failed to create profile', 'error');
  }
});

profileNameEl.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') document.getElementById('btn-create').click();
  if (e.key === 'Escape') closeModal();
});

// ─── Guest Session ────────────────────────────────────────────────────────────
document.getElementById('btn-guest').addEventListener('click', async () => {
  if (!chromeFound) { showToast('Chrome not found', 'error'); return; }
  await window.api.launchProfile('__guest__');
  showToast('Opened Guest session', 'success');
});

// ─── Desktop Shortcut ─────────────────────────────────────────────────────────
document.getElementById('btn-shortcut').addEventListener('click', async () => {
  const res = await window.api.createShortcut();
  if (res.success) {
    showToast('Desktop shortcut created', 'success');
  } else {
    showToast(res.error || 'Failed to create shortcut', 'error');
  }
});

// ─── Confirm Delete ───────────────────────────────────────────────────────────
document.getElementById('confirm-cancel').addEventListener('click', () => {
  confirmOvl.classList.remove('show');
  pendingDelete = null;
});

document.getElementById('confirm-delete').addEventListener('click', async () => {
  if (!pendingDelete) return;
  confirmOvl.classList.remove('show');
  
  let res;
  if (pendingDelete.type === 'telegram') {
      res = await window.api.deleteTelegramProfile(pendingDelete.id);
  } else if (pendingDelete.type === 'facebook') {
      res = await window.api.deleteFacebookProfile(pendingDelete.id);
  } else {
      res = await window.api.deleteProfile(pendingDelete.id);
  }
  
  if (res.success) {
    showToast(`"${pendingDelete.name}" deleted`, 'success');
    pendingDelete = null;
    await loadProfiles();
  } else {
    showToast(res.error || 'Failed to delete', 'error');
    pendingDelete = null;
  }
});

// ─── Rename Profile ─────────────────────────────────────────────────────────────
function closeRenameModal() {
  renameOvl.classList.remove('show');
  pendingRename = null;
}

document.getElementById('rename-close').addEventListener('click', closeRenameModal);
document.getElementById('rename-cancel').addEventListener('click', closeRenameModal);

document.getElementById('rename-save').addEventListener('click', async () => {
  if (!pendingRename) return;
  const newName = renameInput.value.trim();
  if (!newName) { renameInput.focus(); return; }
  const targetProfile = pendingRename;
  closeRenameModal();

  let res;
  if (targetProfile.type === 'telegram') {
    res = await window.api.renameTelegramProfile(targetProfile.id, newName);
  } else if (targetProfile.type === 'facebook') {
    res = await window.api.renameFacebookProfile(targetProfile.id, newName);
  } else {
    res = await window.api.renameProfile(targetProfile.id, newName);
  }

  if (res.success) {
    showToast(`Renamed to "${newName}"`, 'success');
    await loadProfiles();
  } else {
    showToast(res.error || 'Failed to rename', 'error');
  }
});

renameInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') document.getElementById('rename-save').click();
  if (e.key === 'Escape') closeRenameModal();
});

// ─── Settings ─────────────────────────────────────────────────────────────────
document.getElementById('btn-settings').addEventListener('click', async () => {
  document.getElementById('old-passcode').value = '';
  document.getElementById('new-passcode').value = '';
  document.getElementById('new-restore-code').value = '';
  const activity = await window.api.getActivity();
  document.getElementById('last-backup-text').textContent = `Last backup: ${formatTime(activity.lastBackupAt)}`;
  document.getElementById('update-status').textContent = `Current version: ${await window.api.getAppVersion()}`;
  document.getElementById('btn-download-update').style.display = 'none';
  settingsModal.classList.add('show');
});

document.getElementById('settings-close').addEventListener('click', () => {
  settingsModal.classList.remove('show');
});

document.getElementById('btn-save-passcode').addEventListener('click', async () => {
  const oldCode = document.getElementById('old-passcode').value;
  const newCode = document.getElementById('new-passcode').value;
  if (!oldCode || !newCode) { showToast('Please enter both passcodes', 'error'); return; }
  
  const res = await window.api.changePasscode(oldCode, newCode);
  if (res.success) {
    showToast('Passcode updated successfully', 'success');
    document.getElementById('old-passcode').value = '';
    document.getElementById('new-passcode').value = '';
  } else {
    showToast(res.error || 'Failed to update passcode', 'error');
  }
});

document.getElementById('btn-save-restore').addEventListener('click', async () => {
  const newCode = document.getElementById('new-restore-code').value;
  if (!newCode) { showToast('Please enter a new restore code', 'error'); return; }
  
  const res = await window.api.changeRestoreCode(newCode);
  if (res.success) {
    showToast('Restore code updated successfully', 'success');
    document.getElementById('new-restore-code').value = '';
  } else {
    showToast(res.error || 'Failed to update restore code', 'error');
  }
});

document.getElementById('btn-check-update').addEventListener('click', async () => {
  const checkBtn = document.getElementById('btn-check-update');
  const downloadBtn = document.getElementById('btn-download-update');
  const status = document.getElementById('update-status');

  checkBtn.disabled = true;
  downloadBtn.style.display = 'none';
  status.textContent = 'Checking for updates…';

  const res = await window.api.checkUpdate();
  checkBtn.disabled = false;

  if (!res.success) {
    status.textContent = 'Could not check for updates. Check your connection and try again.';
  } else if (res.updateAvailable) {
    status.textContent = `Version ${res.latestVersion} is available (you have ${res.currentVersion}).`;
    downloadBtn.textContent = `Download Version ${res.latestVersion}`;
    downloadBtn.style.display = '';
  } else {
    status.textContent = `You have the latest version (${res.currentVersion}).`;
  }
});

document.getElementById('btn-download-update').addEventListener('click', async () => {
  const res = await window.api.downloadUpdate();
  if (res.success) {
    showToast('Close this app, then run the downloaded installer', 'success');
  } else {
    showToast(res.error || 'Failed to open download', 'error');
  }
});

// ─── Lock ─────────────────────────────────────────────────────────────────────
document.getElementById('btn-lock').addEventListener('click', async () => {
  document.body.style.transition = 'opacity 0.3s';
  document.body.style.opacity = '0';
  setTimeout(() => window.api.lock(), 300);
});

document.getElementById('btn-close-mgr').addEventListener('click', () => {
  window.close();
});

document.getElementById('btn-uninstall').addEventListener('click', async () => {
  if (confirm("Are you sure you want to completely uninstall this app? This action cannot be undone.")) {
    const res = await window.api.uninstallApp();
    if (!res.success) {
      showToast(res.error || 'Failed to uninstall', 'error');
    }
  }
});

// ─── Close modal on backdrop click ───────────────────────────────────────────
modalOverlay.addEventListener('click', (e) => { if (e.target === modalOverlay) closeModal(); });
confirmOvl.addEventListener('click', (e) => {
  if (e.target === confirmOvl) { confirmOvl.classList.remove('show'); pendingDelete = null; }
});
renameOvl.addEventListener('click', (e) => {
  if (e.target === renameOvl) closeRenameModal();
});
settingsModal.addEventListener('click', (e) => {
  if (e.target === settingsModal) { settingsModal.classList.remove('show'); }
});

// ─── Init ─────────────────────────────────────────────────────────────────────
updateClock();
setInterval(updateClock, 1000);
loadProfiles();
