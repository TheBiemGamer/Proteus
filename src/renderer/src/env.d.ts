/// <reference types="vite/client" />

interface Window {
  electron: {
    getExtensions: () => Promise<any[]>
    runExtensionCommand: (id: string, cmd: string, args: any) => Promise<any>
  }
}
