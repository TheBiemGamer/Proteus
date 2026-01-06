import { contextBridge, ipcRenderer } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'

// Custom APIs for renderer
const api = {
  getExtensions: () => ipcRenderer.invoke('get-extensions'),
  manageGame: (id: string) => ipcRenderer.invoke('manage-game', id),
  // New: Open file dialog and install
  installMod: (gameId: string) => ipcRenderer.invoke('install-mod-dialog', gameId),
  toggleMod: (gameId: string, modId: string, enabled: boolean) =>
    ipcRenderer.invoke('toggle-mod', gameId, modId, enabled),
  deleteMod: (gameId: string, modId: string) => 
    ipcRenderer.invoke('delete-mod', gameId, modId),
  disableAllMods: (gameId: string) => ipcRenderer.invoke('disable-all-mods', gameId),
  getMods: (gameId: string) => ipcRenderer.invoke('get-mods', gameId),

  // New: Toggle command
  toggleLoader: (gameId: string, enable: boolean) =>
    ipcRenderer.invoke('run-extension-command', gameId, 'toggleLoader', enable),

  installExtension: () => ipcRenderer.invoke('install-extension-dialog'),
  exportExtension: (gameId: string) => ipcRenderer.invoke('export-extension', gameId)
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
