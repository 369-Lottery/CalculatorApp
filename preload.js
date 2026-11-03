const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  verifyPasscode: (code) => ipcRenderer.invoke('verify-passcode', code),
  getProfiles: () => ipcRenderer.invoke('get-profiles'),
  addProfile: (name) => ipcRenderer.invoke('add-profile', name),
  launchProfile: (profileDir) => ipcRenderer.invoke('launch-profile', profileDir),
  deleteProfile: (profileDir) => ipcRenderer.invoke('delete-profile', profileDir),
  renameProfile: (profileDir, newName) => ipcRenderer.invoke('rename-profile', profileDir, newName),
  chromeStatus: () => ipcRenderer.invoke('chrome-status'),
  getActivity: () => ipcRenderer.invoke('get-activity'),
  lock: () => ipcRenderer.invoke('lock'),
  // Telegram
  getTelegramProfiles: () => ipcRenderer.invoke('get-telegram-profiles'),
  addTelegramProfile: (name, avatarIndex) => ipcRenderer.invoke('add-telegram-profile', name, avatarIndex),
  launchTelegram: (id) => ipcRenderer.invoke('launch-telegram', id),
  deleteTelegramProfile: (id) => ipcRenderer.invoke('delete-telegram-profile', id),
  renameTelegramProfile: (id, newName) => ipcRenderer.invoke('rename-telegram-profile', id, newName),
  // Facebook
  getFacebookProfiles: () => ipcRenderer.invoke('get-facebook-profiles'),
  addFacebookProfile: (name, avatarIndex) => ipcRenderer.invoke('add-facebook-profile', name, avatarIndex),
  launchFacebook: (id) => ipcRenderer.invoke('launch-facebook', id),
  deleteFacebookProfile: (id) => ipcRenderer.invoke('delete-facebook-profile', id),
  renameFacebookProfile: (id, newName) => ipcRenderer.invoke('rename-facebook-profile', id, newName),
  
  // Settings
  changePasscode: (oldCode, newCode) => ipcRenderer.invoke('change-passcode', oldCode, newCode),
  changeRestoreCode: (newCode) => ipcRenderer.invoke('change-restore-code', newCode),

  getAppVersion: () => ipcRenderer.invoke('get-app-version'),
  checkUpdate: () => ipcRenderer.invoke('check-update'),
  downloadUpdate: () => ipcRenderer.invoke('download-update'),

  createShortcut: () => ipcRenderer.invoke('create-shortcut'),
  uninstallApp: () => ipcRenderer.invoke('uninstall-app'),
  
  relaunch: () => ipcRenderer.send('relaunch'),
  _minimize: () => ipcRenderer.send('minimize'),
});
