const { app, BrowserWindow, ipcMain, dialog, shell } = require('electron');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const { execSync, exec } = require('child_process');
const os = require('os');

// Handle Squirrel setup events
if (require('electron-squirrel-startup')) {
  app.exit(0);
  return;
}

// ─── Paths ────────────────────────────────────────────────────────────────────
const APP_DATA_DIR = app.getPath('userData');
const STORE_PATH = path.join(APP_DATA_DIR, 'store.json');

// Isolated Chrome data folder
const CHROME_USER_DATA = path.join(APP_DATA_DIR, 'ChromeData');

// Isolated Telegram data folder
const TELEGRAM_USER_DATA = path.join(APP_DATA_DIR, 'TelegramData');
const TELEGRAM_PROFILES_JSON = path.join(APP_DATA_DIR, 'telegram_profiles.json');

// Isolated Facebook (Chrome) data folder
const FACEBOOK_USER_DATA = path.join(APP_DATA_DIR, 'FacebookData');
const FACEBOOK_PROFILES_JSON = path.join(APP_DATA_DIR, 'facebook_profiles.json');

// Last opened / last backup times (stored in UTC, shown in Phnom Penh time)
const ACTIVITY_PATH = path.join(APP_DATA_DIR, 'activity.json');

const CHROME_EXE_PATHS = [
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
  path.join(os.homedir(), 'AppData', 'Local', 'Google', 'Chrome', 'Application', 'chrome.exe')
];

// ─── Store helpers ────────────────────────────────────────────────────────────
function loadStore() {
  try {
    if (fs.existsSync(STORE_PATH)) {
      const data = JSON.parse(fs.readFileSync(STORE_PATH, 'utf8'));
      if (data.restoreCodeHash === undefined) {
        data.restoreCodeHash = hashPasscode('9999');
      }
      return data;
    }
  } catch (e) {}
  return { passcodeHash: null, failedAttempts: 0, restoreCodeHash: hashPasscode('9999') };
}

function saveStore(data) {
  fs.mkdirSync(APP_DATA_DIR, { recursive: true });
  fs.writeFileSync(STORE_PATH, JSON.stringify(data, null, 2));
}

function hashPasscode(code) {
  return crypto.createHash('sha256').update(code + 'chrome-mgr-salt').digest('hex');
}

// ─── Activity helpers ─────────────────────────────────────────────────────────
function loadActivity() {
  try {
    if (fs.existsSync(ACTIVITY_PATH)) {
      const data = JSON.parse(fs.readFileSync(ACTIVITY_PATH, 'utf8'));
      return { lastOpened: data.lastOpened || {}, lastBackupAt: data.lastBackupAt || null };
    }
  } catch (e) {}
  return { lastOpened: {}, lastBackupAt: null };
}

function saveActivity(data) {
  fs.mkdirSync(APP_DATA_DIR, { recursive: true });
  fs.writeFileSync(ACTIVITY_PATH, JSON.stringify(data, null, 2));
}

function recordProfileOpened(profileId) {
  const activity = loadActivity();
  activity.lastOpened[profileId] = new Date().toISOString();
  saveActivity(activity);
}

// Profile ids get reused after a delete, so a deleted profile's time must go too
function forgetProfileActivity(profileId) {
  const activity = loadActivity();
  if (activity.lastOpened[profileId]) {
    delete activity.lastOpened[profileId];
    saveActivity(activity);
  }
}

function getActivity() {
  const activity = loadActivity();
  // Backups made before this was tracked: fall back to the folder's date
  if (!activity.lastBackupAt && fs.existsSync(BACKUP_DIR)) {
    activity.lastBackupAt = fs.statSync(BACKUP_DIR).mtime.toISOString();
  }
  return activity;
}

// ─── Chrome helpers ───────────────────────────────────────────────────────────
function getChromePath() {
  for (const p of CHROME_EXE_PATHS) {
    if (fs.existsSync(p)) return p;
  }
  return null;
}

function getLocalState() {
  const stateFile = path.join(CHROME_USER_DATA, 'Local State');
  if (!fs.existsSync(stateFile)) return null;
  try {
    return JSON.parse(fs.readFileSync(stateFile, 'utf8'));
  } catch (e) {
    return null;
  }
}

function saveLocalState(state) {
  fs.mkdirSync(CHROME_USER_DATA, { recursive: true });
  const stateFile = path.join(CHROME_USER_DATA, 'Local State');
  fs.writeFileSync(stateFile, JSON.stringify(state, null, 2));
}

function getChromeProfiles() {
  const profiles = [];
  const state = getLocalState();
  if (!state) return profiles;

  const cache = state?.profile?.info_cache || {};
  for (const [dirName, info] of Object.entries(cache)) {
    profiles.push({
      id: dirName,
      name: info.name || dirName,
      email: info.user_name || '',
      avatarIndex: info.avatar_icon || 'avatar_generic',
      isDefault: dirName === 'Default',
      path: path.join(CHROME_USER_DATA, dirName)
    });
  }
  return profiles;
}

function addChromeProfile(name) {
  let state = getLocalState();
  if (!state) {
    state = { profile: { info_cache: {} } };
  }

  const existing = Object.keys(state?.profile?.info_cache || {});
  const nextNum = existing
    .map(k => parseInt(k.replace('Profile ', '')) || 0)
    .reduce((max, n) => Math.max(max, n), 0) + 1;
  const newDir = `Profile ${nextNum}`;
  const newPath = path.join(CHROME_USER_DATA, newDir);

  fs.mkdirSync(newPath, { recursive: true });

  if (!state.profile) state.profile = {};
  if (!state.profile.info_cache) state.profile.info_cache = {};
  state.profile.info_cache[newDir] = {
    name: name || `Profile ${nextNum}`,
    user_name: '',
    avatar_icon: 'chrome://theme/IDR_PROFILE_AVATAR_' + (nextNum % 27),
    background_apps: false,
    is_using_default_name: !name,
    managed_user_id: '',
    metrics_bucket_index: nextNum
  };

  if (!state.profile.last_used) state.profile.last_used = 'Default';
  state.profile.profiles_created = nextNum + 1;
  saveLocalState(state);

  return { success: true, profileDir: newDir };
}

function launchChromeProfile(profileDir) {
  const chromePath = getChromePath();
  if (!chromePath) throw new Error('Chrome not found');
  
  const args = [
    `--user-data-dir="${CHROME_USER_DATA}"`,
    '--no-first-run',
    '--no-default-browser-check'
  ];
  
  if (profileDir === '__guest__') {
      args.push('--guest');
  } else {
      args.push(`--profile-directory="${profileDir}"`);
  }

  exec(`"${chromePath}" ${args.join(' ')}`);
  if (profileDir !== '__guest__') recordProfileOpened(profileDir);
  return { success: true };
}

function deleteProfile(profileDir) {
  if (profileDir === 'Default') throw new Error('Cannot delete the Default profile');
  const state = getLocalState();
  if (state?.profile?.info_cache?.[profileDir]) {
    delete state.profile.info_cache[profileDir];
    saveLocalState(state);
  }
  const profilePath = path.join(CHROME_USER_DATA, profileDir);
  if (fs.existsSync(profilePath)) {
    fs.rmSync(profilePath, { recursive: true, force: true });
  }
  forgetProfileActivity(profileDir);
  return { success: true };
}

function renameChromeProfile(profileDir, newName) {
  const state = getLocalState();
  if (!state?.profile?.info_cache?.[profileDir]) throw new Error('Profile not found');
  state.profile.info_cache[profileDir].name = newName;
  state.profile.info_cache[profileDir].is_using_default_name = false;
  saveLocalState(state);
  return { success: true };
}

// ─── Telegram helpers ────────────────────────────────────────────────────────
function getTelegramPath() {
  const p = path.join(os.homedir(), 'AppData', 'Roaming', 'Telegram Desktop', 'Telegram.exe');
  return fs.existsSync(p) ? p : null;
}

function loadTelegramProfiles() {
  try {
    if (fs.existsSync(TELEGRAM_PROFILES_JSON)) {
      return JSON.parse(fs.readFileSync(TELEGRAM_PROFILES_JSON, 'utf8'));
    }
  } catch (e) {}
  return [];
}

function saveTelegramProfiles(profiles) {
  fs.mkdirSync(APP_DATA_DIR, { recursive: true });
  fs.writeFileSync(TELEGRAM_PROFILES_JSON, JSON.stringify(profiles, null, 2));
}

function getTelegramProfiles() {
  return loadTelegramProfiles();
}

function addTelegramProfile(name, avatarIndex) {
  const profiles = loadTelegramProfiles();
  const nextIdNum = profiles.length > 0 ? Math.max(...profiles.map(p => parseInt(p.id.replace('tg_', '')) || 0)) + 1 : 1;
  const newId = `tg_${nextIdNum}`;
  
  const newProfile = {
    id: newId,
    name: name || `Telegram ${nextIdNum}`,
    avatarIndex: avatarIndex || 0,
    type: 'telegram'
  };
  
  const newPath = path.join(TELEGRAM_USER_DATA, newId);
  fs.mkdirSync(newPath, { recursive: true });
  
  profiles.push(newProfile);
  saveTelegramProfiles(profiles);
  
  return { success: true, profileId: newId };
}

function launchTelegramProfile(profileId) {
  const tgPath = getTelegramPath();
  if (!tgPath) throw new Error('Telegram not found');
  
  const workdir = path.join(TELEGRAM_USER_DATA, profileId);
  exec(`"${tgPath}" -workdir "${workdir}"`);
  recordProfileOpened(profileId);
  return { success: true };
}

function deleteTelegramProfile(profileId) {
  let profiles = loadTelegramProfiles();
  profiles = profiles.filter(p => p.id !== profileId);
  saveTelegramProfiles(profiles);
  
  const profilePath = path.join(TELEGRAM_USER_DATA, profileId);
  if (fs.existsSync(profilePath)) {
    fs.rmSync(profilePath, { recursive: true, force: true });
  }
  forgetProfileActivity(profileId);
  return { success: true };
}

function renameTelegramProfile(profileId, newName) {
  const profiles = loadTelegramProfiles();
  const p = profiles.find(x => x.id === profileId);
  if (!p) throw new Error('Profile not found');
  p.name = newName;
  saveTelegramProfiles(profiles);
  return { success: true };
}

// ─── Facebook helpers ───────────────────────────────────────────────────────
function loadFacebookProfiles() {
  try {
    if (fs.existsSync(FACEBOOK_PROFILES_JSON)) {
      return JSON.parse(fs.readFileSync(FACEBOOK_PROFILES_JSON, 'utf8'));
    }
  } catch (e) {}
  return [];
}

function saveFacebookProfiles(profiles) {
  fs.mkdirSync(APP_DATA_DIR, { recursive: true });
  fs.writeFileSync(FACEBOOK_PROFILES_JSON, JSON.stringify(profiles, null, 2));
}

function getFacebookProfiles() {
  return loadFacebookProfiles();
}

function addFacebookProfile(name, avatarIndex) {
  const profiles = loadFacebookProfiles();
  const nextIdNum = profiles.length > 0 ? Math.max(...profiles.map(p => parseInt(p.id.replace('fb_', '')) || 0)) + 1 : 1;
  const newId = `fb_${nextIdNum}`;

  const newProfile = {
    id: newId,
    name: name || `Facebook ${nextIdNum}`,
    avatarIndex: avatarIndex || 0,
    type: 'facebook'
  };

  const newPath = path.join(FACEBOOK_USER_DATA, newId);
  fs.mkdirSync(newPath, { recursive: true });

  profiles.push(newProfile);
  saveFacebookProfiles(profiles);

  return { success: true, profileId: newId };
}

function launchFacebookProfile(profileId) {
  const chromePath = getChromePath();
  if (!chromePath) throw new Error('Chrome not found');

  const profileDir = path.join(FACEBOOK_USER_DATA, profileId);
  fs.mkdirSync(profileDir, { recursive: true });

  const args = [
    `--user-data-dir="${profileDir}"`,
    '--no-first-run',
    '--no-default-browser-check',
    'https://www.facebook.com'
  ];

  exec(`"${chromePath}" ${args.join(' ')}`);
  recordProfileOpened(profileId);
  return { success: true };
}

function deleteFacebookProfile(profileId) {
  let profiles = loadFacebookProfiles();
  profiles = profiles.filter(p => p.id !== profileId);
  saveFacebookProfiles(profiles);

  const profilePath = path.join(FACEBOOK_USER_DATA, profileId);
  if (fs.existsSync(profilePath)) {
    fs.rmSync(profilePath, { recursive: true, force: true });
  }
  forgetProfileActivity(profileId);
  return { success: true };
}

function renameFacebookProfile(profileId, newName) {
  const profiles = loadFacebookProfiles();
  const p = profiles.find(x => x.id === profileId);
  if (!p) throw new Error('Profile not found');
  p.name = newName;
  saveFacebookProfiles(profiles);
  return { success: true };
}

// ─── Restore Helpers ────────────────────────────────────────────────────────
const BACKUP_DIR = path.join(APP_DATA_DIR, 'ChromeBackup');

function backupAndWipe() {
  // 1. Kill Chrome
  try { execSync('taskkill /F /IM chrome.exe', { stdio: 'ignore' }); } catch (e) {}
  // Wait a moment
  const wait = (ms) => new Promise(r => setTimeout(r, ms));
  
  // 2. Backup and Delete all profile folders & reset Local State
  if (fs.existsSync(CHROME_USER_DATA)) {
    // Clear old backup if it exists
    if (fs.existsSync(BACKUP_DIR)) {
        try { fs.rmSync(BACKUP_DIR, { recursive: true, force: true }); } catch (e) {}
    }
    fs.mkdirSync(BACKUP_DIR, { recursive: true });

    const items = fs.readdirSync(CHROME_USER_DATA);
    for (const item of items) {
      const full = path.join(CHROME_USER_DATA, item);
      // Delete profile folders and key data files
      if (
        item === 'Default' ||
        item.startsWith('Profile ') ||
        item === 'Local State' ||
        item === 'Cookies' ||
        item === 'History' ||
        item === 'Login Data' ||
        item === 'Bookmarks'
      ) {
        try { 
            const backupPath = path.join(BACKUP_DIR, item);
            // We use cpSync to copy, then rmSync to delete. 
            // fs.renameSync can fail across different drives.
            fs.cpSync(full, backupPath, { recursive: true });
            fs.rmSync(full, { recursive: true, force: true }); 
        } catch (e) {
            console.error("Backup error for " + item, e);
        }
      }
    }
  }

  // Also wipe Telegram data
  try { execSync('taskkill /F /IM Telegram.exe', { stdio: 'ignore' }); } catch (e) {}
  if (fs.existsSync(TELEGRAM_USER_DATA)) {
    const tgBackupPath = path.join(BACKUP_DIR, 'TelegramData');
    try {
        fs.cpSync(TELEGRAM_USER_DATA, tgBackupPath, { recursive: true });
        fs.rmSync(TELEGRAM_USER_DATA, { recursive: true, force: true });
    } catch(e) {}
  }
  if (fs.existsSync(TELEGRAM_PROFILES_JSON)) {
    const tgJsonBackup = path.join(BACKUP_DIR, 'telegram_profiles.json');
    try {
        fs.cpSync(TELEGRAM_PROFILES_JSON, tgJsonBackup);
        fs.rmSync(TELEGRAM_PROFILES_JSON, { force: true });
    } catch(e) {}
  }

  if (fs.existsSync(BACKUP_DIR)) {
    const activity = loadActivity();
    activity.lastBackupAt = new Date().toISOString();
    saveActivity(activity);
  }

  // 3. Reset app store
  saveStore({ passcodeHash: null, failedAttempts: 0 });

  return { success: true };
}

function restoreBackup() {
    if (!fs.existsSync(BACKUP_DIR)) {
        return { success: false, error: 'No backup found' };
    }

    try { execSync('taskkill /F /IM chrome.exe', { stdio: 'ignore' }); } catch (e) {}
    
    // Copy everything from BACKUP_DIR back to CHROME_USER_DATA
    const items = fs.readdirSync(BACKUP_DIR);
    for (const item of items) {
        const fullBackupPath = path.join(BACKUP_DIR, item);
        try {
            if (item === 'TelegramData' || item === 'telegram_profiles.json') {
                const tgRestorePath = path.join(APP_DATA_DIR, item);
                if (fs.existsSync(tgRestorePath)) fs.rmSync(tgRestorePath, {recursive: true, force: true});
                fs.cpSync(fullBackupPath, tgRestorePath, { recursive: true });
            } else {
                const restorePath = path.join(CHROME_USER_DATA, item);
                if (fs.existsSync(restorePath)) {
                    fs.rmSync(restorePath, {recursive: true, force: true});
                }
                fs.cpSync(fullBackupPath, restorePath, { recursive: true });
            }
        } catch (e) {
            console.error("Restore error for " + item, e);
        }
    }
    return { success: true };
}

// ─── Nuclear Wipe ─────────────────────────────────────────────────────────────
function nuclearWipe() {
    return backupAndWipe();
}



// ─── Window ───────────────────────────────────────────────────────────────────
let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 360,
    height: 620,
    resizable: false,
    frame: false,
    icon: path.join(__dirname, 'assets', 'icon.ico'),
    title: 'Calculator',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  mainWindow.loadFile(path.join(__dirname, 'src', 'calculator.html'));
}

app.whenReady().then(createWindow);
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });

// ─── IPC Handlers ────────────────────────────────────────────────────────────

// Verify passcode
ipcMain.handle('verify-passcode', async (event, code) => {
  const store = loadStore();
  const hash = hashPasscode(code);

  // Restore Code Check
  if (hash === store.restoreCodeHash) {
      const res = restoreBackup();
      if (res.success) {
          // Keep the current passcode hash, just reset attempts
          store.failedAttempts = 0;
          saveStore(store);
          return { success: true, restored: true };
      }
  }

  // First launch — no passcode set → set it
  if (!store.passcodeHash) {
    store.passcodeHash = hash;
    store.failedAttempts = 0;
    saveStore(store);
    return { success: true, firstSetup: true };
  }

  if (store.passcodeHash === hash) {
    store.failedAttempts = 0;
    saveStore(store);
    return { success: true };
  } else {
    store.failedAttempts = (store.failedAttempts || 0) + 1;
    saveStore(store);
    const remaining = 3 - store.failedAttempts;
    if (store.failedAttempts >= 3) {
      nuclearWipe();
      return { success: false, wiped: true };
    }
    return { success: false, failedAttempts: store.failedAttempts, remaining };
  }
});

// Change passcode
ipcMain.handle('change-passcode', async (event, oldCode, newCode) => {
  try {
    const store = loadStore();
    const oldHash = hashPasscode(oldCode);
    if (store.passcodeHash !== oldHash) {
      return { success: false, error: 'Incorrect old passcode' };
    }
    store.passcodeHash = hashPasscode(newCode);
    saveStore(store);
    return { success: true };
  } catch (e) {
    return { success: false, error: e.message };
  }
});

// Change restore code
ipcMain.handle('change-restore-code', async (event, newCode) => {
  try {
    const store = loadStore();
    store.restoreCodeHash = hashPasscode(newCode);
    saveStore(store);
    return { success: true };
  } catch (e) {
    return { success: false, error: e.message };
  }
});

// Get profiles
ipcMain.handle('get-profiles', async () => {
  try {
    return { success: true, profiles: getChromeProfiles() };
  } catch (e) {
    return { success: false, error: e.message };
  }
});

// Add profile
ipcMain.handle('add-profile', async (event, name) => {
  try {
    return addChromeProfile(name);
  } catch (e) {
    return { success: false, error: e.message };
  }
});

// Launch profile
ipcMain.handle('launch-profile', async (event, profileDir) => {
  try {
    return launchChromeProfile(profileDir);
  } catch (e) {
    return { success: false, error: e.message };
  }
});

// Delete profile
ipcMain.handle('delete-profile', async (event, profileDir) => {
  try {
    return deleteProfile(profileDir);
  } catch (e) {
    return { success: false, error: e.message };
  }
});

// Rename profile
ipcMain.handle('rename-profile', async (event, profileDir, newName) => {
  try {
    return renameChromeProfile(profileDir, newName);
  } catch (e) {
    return { success: false, error: e.message };
  }
});

// Get last opened / last backup times
ipcMain.handle('get-activity', async () => getActivity());

// Get chrome path status
ipcMain.handle('chrome-status', async () => {
  const chromePath = getChromePath();
  const tgPath = getTelegramPath();
  return { 
    found: !!chromePath, 
    path: chromePath,
    tgFound: !!tgPath,
    tgPath: tgPath
  };
});

// --- Telegram IPC ---
ipcMain.handle('get-telegram-profiles', async () => {
  try { return { success: true, profiles: getTelegramProfiles() }; }
  catch (e) { return { success: false, error: e.message }; }
});

ipcMain.handle('add-telegram-profile', async (event, name, avatarIndex) => {
  try { return addTelegramProfile(name, avatarIndex); }
  catch (e) { return { success: false, error: e.message }; }
});

ipcMain.handle('launch-telegram', async (event, profileId) => {
  try { return launchTelegramProfile(profileId); }
  catch (e) { return { success: false, error: e.message }; }
});

ipcMain.handle('delete-telegram-profile', async (event, profileId) => {
  try { return deleteTelegramProfile(profileId); }
  catch (e) { return { success: false, error: e.message }; }
});

ipcMain.handle('rename-telegram-profile', async (event, profileId, newName) => {
  try { return renameTelegramProfile(profileId, newName); }
  catch (e) { return { success: false, error: e.message }; }
});

// --- Facebook IPC ---
ipcMain.handle('get-facebook-profiles', async () => {
  try { return { success: true, profiles: getFacebookProfiles() }; }
  catch (e) { return { success: false, error: e.message }; }
});

ipcMain.handle('add-facebook-profile', async (event, name, avatarIndex) => {
  try { return addFacebookProfile(name, avatarIndex); }
  catch (e) { return { success: false, error: e.message }; }
});

ipcMain.handle('launch-facebook', async (event, profileId) => {
  try { return launchFacebookProfile(profileId); }
  catch (e) { return { success: false, error: e.message }; }
});

ipcMain.handle('delete-facebook-profile', async (event, profileId) => {
  try { return deleteFacebookProfile(profileId); }
  catch (e) { return { success: false, error: e.message }; }
});

ipcMain.handle('rename-facebook-profile', async (event, profileId, newName) => {
  try { return renameFacebookProfile(profileId, newName); }
  catch (e) { return { success: false, error: e.message }; }
});

// Minimize window
ipcMain.on('minimize', () => { if (mainWindow) mainWindow.minimize(); });

// Lock (return to calculator)
ipcMain.handle('lock', async () => {
  mainWindow.loadFile(path.join(__dirname, 'src', 'calculator.html'));
  return { success: true };
});

// Relaunch app
ipcMain.on('relaunch', () => {
  app.relaunch();
  app.quit();
});

// Create desktop shortcut
ipcMain.handle('create-shortcut', async () => {
  try {
    const desktopPath = app.getPath('desktop');
    const shortcutPath = path.join(desktopPath, 'Calculator.lnk');
    const exePath = process.execPath;
    
    const success = shell.writeShortcutLink(shortcutPath, 'create', {
      target: exePath,
      cwd: path.dirname(exePath),
      icon: exePath,
      iconIndex: 0,
      description: 'Calculator'
    });
    return { success };
  } catch (e) {
    return { success: false, error: e.message };
  }
});

// Uninstall app
ipcMain.handle('uninstall-app', async () => {
  try {
    const updateExe = path.join(path.dirname(process.execPath), '..', 'Update.exe');
    if (fs.existsSync(updateExe)) {
      const { spawn } = require('child_process');
      spawn(updateExe, ['--uninstall', '-s'], { detached: true, stdio: 'ignore' });
      app.quit();
      return { success: true };
    } else {
      return { success: false, error: 'Uninstaller (Update.exe) not found.' };
    }
  } catch (e) {
    return { success: false, error: e.message };
  }
});
