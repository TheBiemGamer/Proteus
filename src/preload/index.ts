import { contextBridge, ipcRenderer } from 'electron'

// Custom APIs for renderer
const api = {
  // Frontend calls this to get the list of games
  getExtensions: () => ipcRenderer.invoke('get-extensions'),

  // Frontend calls this to run a command (e.g., deploy mods)
  runExtensionCommand: (gameId: string, command: string, args: any) =>
    ipcRenderer.invoke('run-extension-command', gameId, command, args)
}

// Use `contextBridge` APIs to expose Electron APIs to
// renderer only if context isolation is enabled, otherwise
// just add to the DOM global.
if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('electron', {
      ...api // This exposes window.electron.getExtensions()
    })
  } catch (error) {
    console.error(error)
  }
} else {
  // @ts-ignore (define in d.ts)
  window.electron = { ...api }
}
