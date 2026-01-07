/// <reference types="vite/client" />

interface Window {
  electron: {
    getExtensions: () => Promise<any[]>
    runExtensionCommand: (id: string, cmd: string, args: any) => Promise<any>
    onRequestAdminPermission: (callback: () => void) => () => void
    restartAsAdmin: () => Promise<void>
    [key: string]: any // Allow loose typing for other methods for now
  }
}
