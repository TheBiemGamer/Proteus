import { contextBridge, ipcRenderer, webUtils } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'

// Custom APIs for renderer
const api = {
  getPathForFile: (file: File) => webUtils.getPathForFile(file),
  getExtensions: () => ipcRenderer.invoke('get-extensions'),
  manageGame: (id: string) => ipcRenderer.invoke('manage-game', id),
  unmanageGame: (id: string) => ipcRenderer.invoke('unmanage-game', id),
  // New: Open file dialog and install
  installMod: (gameId: string) => ipcRenderer.invoke('install-mod-dialog', gameId),
  installModDirect: (gameId: string, filePath: string, options?: any) =>
    ipcRenderer.invoke('install-mod-direct', gameId, filePath, options),

  analyzeFile: (gameId: string, filePath: string) =>
    ipcRenderer.invoke('analyze-file', gameId, filePath),

  toggleMod: (gameId: string, modId: string, enabled: boolean) =>
    ipcRenderer.invoke('toggle-mod', gameId, modId, enabled),
  deleteMod: (gameId: string, modId: string) => ipcRenderer.invoke('delete-mod', gameId, modId),
  disableAllMods: (gameId: string) => ipcRenderer.invoke('disable-all-mods', gameId),
  getMods: (gameId: string) => ipcRenderer.invoke('get-mods', gameId),
  fetchNexusMetadata: (nexusApiKey: string, gameDomain: string, nexusId: string) =>
    ipcRenderer.invoke('fetch-nexus-metadata', nexusApiKey, gameDomain, nexusId),
  checkModUpdate: (gameId: string, modId: string) =>
    ipcRenderer.invoke('check-mod-update', gameId, modId),
  validateGame: (gameId: string) => ipcRenderer.invoke('validate-game', gameId),
  onDownloadProgress: (callback: (data: { url: string; progress: number }) => void) => {
    const subscription = (_event, value) => callback(value)
    ipcRenderer.on('download-progress', subscription)
    return () => ipcRenderer.removeListener('download-progress', subscription)
  },
  onRequestAdminPermission: (callback: (data: any) => void) => {
    const subscription = (_event, value) => callback(value)
    ipcRenderer.on('request-admin-permission', subscription)
    return () => ipcRenderer.removeListener('request-admin-permission', subscription)
  },
  restartAsAdmin: () => ipcRenderer.invoke('restart-as-admin'),

  // New: Toggle command
  toggleLoader: (gameId: string, enable: boolean) =>
    ipcRenderer.invoke('run-extension-command', gameId, 'toggleLoader', enable),

  runExtensionCommand: (gameId: string, command: string, args?: any) =>
    ipcRenderer.invoke('run-extension-command', gameId, command, args),

  installExtension: () => ipcRenderer.invoke('install-extension-dialog'),
  // Extension Manager API
  getExtensionList: () => ipcRenderer.invoke('get-extension-list'),
  toggleExtension: (id: string, enabled: boolean) =>
    ipcRenderer.invoke('toggle-extension', id, enabled),
  deleteExtension: (id: string) => ipcRenderer.invoke('delete-extension', id),
  exportExtensions: (ids: string[]) => ipcRenderer.invoke('export-extensions', ids),
  installExtensionDialog: () => ipcRenderer.invoke('install-extension-dialog'),
  installExtensionsConfirm: (filePath: string, selected: string[]) =>
    ipcRenderer.invoke('install-extensions-confirm', filePath, selected),

  exportExtension: (gameId: string) => ipcRenderer.invoke('export-extension', gameId),

  // Modpack methods
  createModpack: (gameId: string, meta: any) =>
    ipcRenderer.invoke('create-modpack-dialog', gameId, meta),
  pickModpack: () => ipcRenderer.invoke('pick-modpack'),
  installModpack: (filePath: string) => ipcRenderer.invoke('install-modpack', filePath),

  getSettings: () => ipcRenderer.invoke('get-settings'),
  saveSettings: (settings: any) => ipcRenderer.invoke('save-settings', settings),

  getAppVersion: () => ipcRenderer.invoke('get-app-version'),

  openUrl: (url: string) => ipcRenderer.invoke('open-url', url),

  // Auto Updater
  checkForUpdates: () => ipcRenderer.invoke('check-for-updates'),
  quitAndInstall: () => ipcRenderer.invoke('quit-and-install'),
  onUpdateAvailable: (callback: () => void) => {
    const subscription = (_event) => callback()
    ipcRenderer.on('update-available', subscription)
    return () => ipcRenderer.removeListener('update-available', subscription)
  },
  onUpdateNotAvailable: (callback: () => void) => {
    const subscription = (_event) => callback()
    ipcRenderer.on('update-not-available', subscription)
    return () => ipcRenderer.removeListener('update-not-available', subscription)
  },
  onUpdateError: (callback: (error: string) => void) => {
    const subscription = (_event, error) => callback(error)
    ipcRenderer.on('update-error', subscription)
    return () => ipcRenderer.removeListener('update-error', subscription)
  },
  onUpdateDownloaded: (callback: () => void) => {
    const subscription = (_event) => callback()
    ipcRenderer.on('update-downloaded', subscription)
    return () => ipcRenderer.removeListener('update-downloaded', subscription)
  }
}

// Use `contextBridge` APIs to expose Electron APIs to
// renderer only if context isolation is enabled, otherwise
// just add to the DOM global.
if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('electron', {
      ...authElectronAPI(electronAPI),
      ...api
    })
  } catch (error) {
    console.error(error)
  }
} else {
  // @ts-ignore (define in dts)
  window.electron = { ...electronAPI, ...api }
}

function authElectronAPI(api) {
  // Just a helper to pass through if needed, usually electronAPI is enough
  return api
}
